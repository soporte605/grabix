import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';
import { DataSource, In, Not } from 'typeorm';
import { BitacoraService } from '../common/bitacora.service';
import { GERENCIA, Roles, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { DocumentosModule } from '../documentos/documentos.module';
import { DocumentosService } from '../documentos/documentos.service';
import { Comprobante, Diseno, EstadoComprobante, EstadoDiseno, EstadoVenta, EtapaTaller, Maquina, Producto, Rol, TipoMaquina, Usuario, Venta, VentaItem } from '../entities';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Estado de la venta que corresponde a cada etapa del taller. */
const ESTADO_DE: Record<EtapaTaller, EstadoVenta> = {
  [EtapaTaller.Diseno]: EstadoVenta.Pendiente,
  [EtapaTaller.Aprobacion]: EstadoVenta.Pendiente,
  [EtapaTaller.Cola]: EstadoVenta.Pendiente,
  [EtapaTaller.Maquina]: EstadoVenta.Produccion,
  [EtapaTaller.Acabado]: EstadoVenta.Produccion,
  [EtapaTaller.Lista]: EstadoVenta.Lista,
};
/** Etapa por omisión cuando la venta cambió de estado por otro lado (Ventas, Caja). */
const ETAPA_DE: Partial<Record<EstadoVenta, EtapaTaller>> = {
  [EstadoVenta.Pendiente]: EtapaTaller.Cola,
  [EstadoVenta.Produccion]: EtapaTaller.Maquina,
  [EstadoVenta.Lista]: EtapaTaller.Lista,
};
export const etapaDe = (v: Pick<Venta, 'etapa' | 'estado'>) =>
  v.etapa && ESTADO_DE[v.etapa] === v.estado ? v.etapa : (ETAPA_DE[v.estado] ?? null);

const MAQUINAS_INICIALES: [string, TipoMaquina][] = [
  ['Láser', TipoMaquina.Laser],
  ['Impresora de sublimación', TipoMaquina.Sublimacion],
  ['Plancha', TipoMaquina.Plancha],
];

export class MaquinaDto {
  @IsString() @MinLength(2) @MaxLength(80) nombre: string;
  @IsEnum(TipoMaquina) tipo: TipoMaquina;
  @IsOptional() @IsBoolean() activa?: boolean;
}

export class OrdenDto {
  @IsOptional() @IsEnum(EtapaTaller) etapa?: EtapaTaller;
  @IsOptional() @IsInt() maquinaId?: number | null;
  @IsOptional() @IsInt() responsableId?: number | null;
  @IsOptional() @IsBoolean() urgente?: boolean;
}

export class AvanceDto {
  @IsNumber() @Min(0) hechos: number;
}

@Injectable()
export class ProduccionService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    private docs: DocumentosService,
    private bitacora: BitacoraService,
  ) {}

  /* ---------- máquinas ---------- */

  async maquinas(s: Sesion) {
    const em = this.ds.manager;
    let ms = await em.find(Maquina, { where: { tallerId: s.tallerId }, order: { activa: 'DESC', id: 'ASC' } });
    // Primera vez: se dan de alta las máquinas típicas de un taller de láser y sublimación.
    if (!ms.length) {
      await em.save(MAQUINAS_INICIALES.map(([nombre, tipo]) => em.create(Maquina, { tallerId: s.tallerId, nombre, tipo })));
      ms = await em.find(Maquina, { where: { tallerId: s.tallerId }, order: { id: 'ASC' } });
    }
    return ms;
  }

  crearMaquina(s: Sesion, dto: MaquinaDto) {
    return this.ds.manager.save(this.ds.manager.create(Maquina, { ...dto, nombre: dto.nombre.trim(), tallerId: s.tallerId }));
  }

  async editarMaquina(s: Sesion, id: number, dto: MaquinaDto) {
    const m = await this.ds.manager.findOneBy(Maquina, { id, tallerId: s.tallerId });
    if (!m) throw new NotFoundException('No encontramos esa máquina');
    Object.assign(m, { ...dto, nombre: dto.nombre.trim() });
    return this.ds.manager.save(m);
  }

  async eliminarMaquina(s: Sesion, id: number) {
    const m = await this.ds.manager.findOneBy(Maquina, { id, tallerId: s.tallerId });
    if (!m) throw new NotFoundException('No encontramos esa máquina');
    await this.ds.manager.update(Venta, { tallerId: s.tallerId, maquinaId: id }, { maquinaId: null });
    await this.ds.manager.delete(Maquina, { id });
    return { ok: true };
  }

  /* ---------- tablero ---------- */

  async tablero(s: Sesion) {
    const em = this.ds.manager;
    const ventas = (await this.docs.ventas(s, { estado: 'pendiente,produccion,lista' })) as (Venta & { saldo: number })[];
    const ids = [...new Set(ventas.flatMap((v) => v.items.map((i) => i.productoId).filter((x): x is number => !!x)))];
    const productos = ids.length ? await em.find(Producto, { where: { id: In(ids), tallerId: s.tallerId }, select: { id: true, minutos: true } }) : [];
    const min = new Map(productos.map((p) => [p.id, p.minutos]));
    const [maquinas, equipo] = await Promise.all([
      this.maquinas(s),
      em.find(Usuario, { where: { tallerId: s.tallerId, activo: true }, select: { id: true, nombre: true, rol: true }, order: { nombre: 'ASC' } }),
    ]);
    // Lo que respondió el cliente por el enlace: último diseño y comprobantes por revisar.
    const vids = ventas.map((v) => v.id);
    const [disenos, comprobantes] = vids.length
      ? await Promise.all([
          em.find(Diseno, { where: { tallerId: s.tallerId, ventaId: In(vids), estado: Not(EstadoDiseno.Reemplazado) }, select: { ventaId: true, version: true, estado: true } }),
          em.find(Comprobante, { where: { tallerId: s.tallerId, ventaId: In(vids), estado: EstadoComprobante.Pendiente }, select: { ventaId: true } }),
        ])
      : [[], []];
    const ultimo = new Map<number, Diseno>();
    for (const d of disenos) if ((ultimo.get(d.ventaId)?.version ?? 0) < d.version) ultimo.set(d.ventaId, d);
    const ordenes = ventas.map((v) => {
      const items = v.items.map((i) => ({ ...i, hechos: Math.min(i.hechos ?? 0, i.cantidad), minutosPieza: i.productoId ? (min.get(i.productoId) ?? 0) : 0 }));
      const piezas = items.reduce((a, i) => a + i.cantidad, 0);
      const hechas = items.reduce((a, i) => a + i.hechos, 0);
      // Minutos de máquina que faltan, según el costeo de cada producto.
      const minutos = r2(items.reduce((a, i) => a + i.minutosPieza * (i.cantidad - i.hechos), 0));
      const diseno = ultimo.get(v.id)?.estado ?? null;
      return { ...v, items, etapa: etapaDe(v), piezas, hechas, minutos, diseno, comprobantes: comprobantes.filter((c) => c.ventaId === v.id).length };
    });
    return { ordenes, maquinas, equipo: equipo.map((u) => ({ id: u.id, nombre: u.nombre })) };
  }

  async actualizar(s: Sesion, id: number, dto: OrdenDto) {
    const em = this.ds.manager;
    const v = await em.findOne(Venta, { where: { id, tallerId: s.tallerId }, relations: { items: false, pagos: false } });
    if (!v || (s.sucursal && v.sucursalId !== s.sucursal)) throw new NotFoundException('No encontramos ese pedido');
    if (v.estado === EstadoVenta.Cancelada || v.estado === EstadoVenta.Entregada) throw new ForbiddenException('Ese pedido ya no está en producción');
    if (dto.maquinaId) await this.validar(Maquina, dto.maquinaId, s, 'Esa máquina no existe');
    if (dto.responsableId) await this.validar(Usuario, dto.responsableId, s, 'Ese usuario no existe');
    const cambios: Partial<Venta> = {};
    if (dto.maquinaId !== undefined) cambios.maquinaId = dto.maquinaId;
    if (dto.responsableId !== undefined) cambios.responsableId = dto.responsableId;
    if (dto.urgente !== undefined) cambios.urgente = dto.urgente;
    if (dto.etapa && dto.etapa !== etapaDe(v)) {
      cambios.etapa = dto.etapa;
      cambios.etapaEn = new Date();
      // El estado de la venta sigue a la etapa (aplica inventario igual que desde Ventas).
      if (ESTADO_DE[dto.etapa] !== v.estado) await this.docs.cambiarEstado(s, id, ESTADO_DE[dto.etapa]);
      await this.bitacora.registrar(s, 'etapa', 'venta', id, { folio: v.folio, antes: etapaDe(v), despues: dto.etapa });
    }
    if (Object.keys(cambios).length) await em.update(Venta, { id }, cambios);
    return { id, ...cambios };
  }

  async avance(s: Sesion, id: number, itemId: number, dto: AvanceDto) {
    const em = this.ds.manager;
    const v = await em.findOne(Venta, { where: { id, tallerId: s.tallerId }, relations: { items: false, pagos: false } });
    if (!v || (s.sucursal && v.sucursalId !== s.sucursal)) throw new NotFoundException('No encontramos ese pedido');
    const i = await em.findOneBy(VentaItem, { id: itemId, ventaId: id });
    if (!i) throw new NotFoundException('No encontramos ese concepto');
    const hechos = Math.min(dto.hechos, i.cantidad);
    await em.update(VentaItem, { id: itemId }, { hechos });
    return { id: itemId, hechos };
  }

  private async validar(ent: typeof Maquina | typeof Usuario, id: number, s: Sesion, msg: string) {
    const x = await this.ds.manager.findOne(ent, { where: { id, tallerId: s.tallerId }, select: { id: true } });
    if (!x) throw new NotFoundException(msg);
  }
}

const TALLER = [...VEN_COSTOS, Rol.Vendedor, Rol.Produccion];

@Controller()
export class ProduccionController {
  constructor(private p: ProduccionService) {}

  @Get('produccion') @Roles(...TALLER)
  tablero(@Ses() s: Sesion) { return this.p.tablero(s); }

  @Patch('produccion/:id') @Roles(...TALLER)
  actualizar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: OrdenDto) { return this.p.actualizar(s, id, dto); }

  @Patch('produccion/:id/items/:itemId') @Roles(...TALLER)
  avance(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: AvanceDto) {
    return this.p.avance(s, id, itemId, dto);
  }

  @Get('maquinas') @Roles(...TALLER)
  maquinas(@Ses() s: Sesion) { return this.p.maquinas(s); }

  @Post('maquinas') @Roles(...GERENCIA)
  crear(@Ses() s: Sesion, @Body() dto: MaquinaDto) { return this.p.crearMaquina(s, dto); }

  @Put('maquinas/:id') @Roles(...GERENCIA)
  editar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: MaquinaDto) { return this.p.editarMaquina(s, id, dto); }

  @Delete('maquinas/:id') @Roles(...GERENCIA) @HttpCode(200)
  eliminar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.p.eliminarMaquina(s, id); }
}

@Module({ imports: [DocumentosModule], controllers: [ProduccionController], providers: [ProduccionService] })
export class ProduccionModule {}
