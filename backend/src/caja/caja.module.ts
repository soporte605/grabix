import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Between, DataSource, EntityManager, In } from 'typeorm';
import { BitacoraService } from '../common/bitacora.service';
import { GERENCIA, Roles, Ses, VEN_COSTOS, type Sesion } from '../common/sesion';
import { r2, sucursalDe } from '../common/util';
import { FoliosService } from '../documentos/folios.service';
import { DocumentosModule } from '../documentos/documentos.module';
import { CajaMovimiento, CajaTurno, Cliente, EstadoTurno, EstadoVenta, Pago, ResumenTurno, Rol, Usuario, Venta } from '../entities';

const VENTA = [...VEN_COSTOS, Rol.Vendedor];

export class AbrirTurnoDto {
  @IsNumber() @Min(0) @Max(10_000_000) fondo: number;
  @IsOptional() @IsString() @MaxLength(500) notas?: string;
}

export class MovimientoDto {
  @IsIn(['entrada', 'salida']) tipo: 'entrada' | 'salida';
  @IsNumber() @Min(0.01) @Max(10_000_000) monto: number;
  @IsString() @MaxLength(200) concepto: string;
}

export class CerrarTurnoDto {
  @IsNumber() @Min(0) @Max(10_000_000) contado: number;
  @IsNumber() @Min(0) @Max(10_000_000) dejado: number;
  /** Conteo por denominación (opcional): { "500": 2, "0.5": 4 }. */
  @IsOptional() @IsObject() conteo?: Record<string, number>;
  @IsOptional() @IsString() @MaxLength(1000) notas?: string;
}

export class EliminarTurnoDto {
  @IsString() @MinLength(3) @MaxLength(300) motivo: string;
}

export class TurnosFiltroDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() usuarioId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
}

export class ReporteDto {
  @IsDateString() desde: string;
  @IsDateString() hasta: string;
}

/**
 * Turnos de caja por sucursal: apertura con fondo, entradas y salidas de efectivo,
 * corte (esperado contra contado) y lo que se deja para el siguiente turno.
 */
@Injectable()
export class CajaService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    private folios: FoliosService,
    private bitacora: BitacoraService,
  ) {}

  private abierto(em: EntityManager, tallerId: number, sucursalId: number) {
    return em.findOne(CajaTurno, { where: { tallerId, sucursalId, estado: EstadoTurno.Abierto } });
  }

  /** Totales del turno a partir de sus cobros y movimientos. */
  async resumen(em: EntityManager, t: CajaTurno): Promise<ResumenTurno> {
    const pagos = await em.find(Pago, { where: { turnoId: t.id } });
    const movs = await em.find(CajaMovimiento, { where: { turnoId: t.id } });
    const porMetodo: Record<string, number> = {};
    for (const p of pagos) porMetodo[p.metodo] = r2((porMetodo[p.metodo] ?? 0) + p.monto);
    const entradas = r2(movs.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0));
    const salidas = r2(movs.filter((m) => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0));
    return {
      porMetodo,
      cobrado: r2(pagos.reduce((a, p) => a + p.monto, 0)),
      ventas: new Set(pagos.map((p) => p.ventaId)).size,
      entradas,
      salidas,
      esperado: r2(t.fondo + (porMetodo['Efectivo'] ?? 0) + entradas - salidas),
    };
  }

  /** Turno abierto de la sucursal con su resumen, o null. También dice cuánto dejó el último corte. */
  async actual(s: Sesion) {
    const suc = sucursalDe(s);
    const em = this.ds.manager;
    const t = await this.abierto(em, s.tallerId, suc);
    if (!t) {
      const ultimo = await em.findOne(CajaTurno, { where: { tallerId: s.tallerId, sucursalId: suc, estado: EstadoTurno.Cerrado }, order: { cerradoEn: 'DESC' } });
      return { turno: null, sugerido: ultimo?.dejado ?? 0, ultimo: ultimo ? { folio: ultimo.folio, cerradoEn: ultimo.cerradoEn, cerroNombre: ultimo.cerroNombre, dejado: ultimo.dejado } : null };
    }
    return { turno: { ...t, resumen: await this.resumen(em, t) }, movimientos: await em.find(CajaMovimiento, { where: { turnoId: t.id }, order: { id: 'ASC' } }) };
  }

  async abrir(s: Sesion, dto: AbrirTurnoDto) {
    const suc = sucursalDe(s);
    return this.ds.transaction(async (em) => {
      // Bloquea el folio para que dos aperturas simultáneas no abran dos turnos.
      const folio = await this.folios.siguiente(em, s.tallerId, 'TRN');
      if (await this.abierto(em, s.tallerId, suc)) throw new BadRequestException('Ya hay un turno abierto en esta sucursal');
      const t = await em.save(
        em.create(CajaTurno, { tallerId: s.tallerId, sucursalId: suc, folio, abrioId: s.usuarioId, abrioNombre: s.nombre, fondo: r2(dto.fondo), notasApertura: dto.notas?.trim() || null }),
      );
      await this.bitacora.registrar(s, 'abrir', 'caja', t.id, { folio, fondo: t.fondo }, em);
      return t;
    });
  }

  async movimiento(s: Sesion, dto: MovimientoDto) {
    const t = await this.abierto(this.ds.manager, s.tallerId, sucursalDe(s));
    if (!t) throw new BadRequestException('La caja está cerrada');
    if (!dto.concepto.trim()) throw new BadRequestException('Escribe el concepto');
    const m = await this.ds.manager.save(
      this.ds.manager.create(CajaMovimiento, { tallerId: s.tallerId, turnoId: t.id, tipo: dto.tipo, monto: r2(dto.monto), concepto: dto.concepto.trim(), usuarioId: s.usuarioId, usuarioNombre: s.nombre }),
    );
    await this.bitacora.registrar(s, dto.tipo, 'caja', t.id, { folio: t.folio, monto: m.monto, concepto: m.concepto });
    return m;
  }

  async cerrar(s: Sesion, dto: CerrarTurnoDto) {
    const suc = sucursalDe(s);
    return this.ds.transaction(async (em) => {
      const t = await em.findOne(CajaTurno, { where: { tallerId: s.tallerId, sucursalId: suc, estado: EstadoTurno.Abierto }, lock: { mode: 'pessimistic_write' } });
      if (!t) throw new BadRequestException('No hay un turno abierto');
      if (dto.dejado > dto.contado + 0.001) throw new BadRequestException('No puedes dejar más efectivo del que contaste');
      const res = await this.resumen(em, t);
      Object.assign(t, {
        estado: EstadoTurno.Cerrado,
        cerroId: s.usuarioId,
        cerroNombre: s.nombre,
        cerradoEn: new Date(),
        esperado: res.esperado,
        contado: r2(dto.contado),
        diferencia: r2(dto.contado - res.esperado),
        dejado: r2(dto.dejado),
        retiro: r2(dto.contado - dto.dejado),
        conteo: dto.conteo ?? null,
        resumen: res,
        notasCierre: dto.notas?.trim() || null,
      });
      await em.save(t);
      await this.bitacora.registrar(s, 'cerrar', 'caja', t.id, { folio: t.folio, esperado: t.esperado, contado: t.contado, diferencia: t.diferencia }, em);
      return t;
    });
  }

  async historial(s: Sesion, f: TurnosFiltroDto) {
    const qb = this.ds.manager.createQueryBuilder(CajaTurno, 't').where('t.tallerId = :t', { t: s.tallerId }).orderBy('t.abiertoEn', 'DESC');
    if (s.sucursal) qb.andWhere('t.sucursalId = :s', { s: s.sucursal });
    // Un vendedor solo ve los turnos que abrió o cerró.
    if (s.rol === Rol.Vendedor) qb.andWhere('(t.abrioId = :u OR t.cerroId = :u)', { u: s.usuarioId });
    else if (f.usuarioId) qb.andWhere('(t.abrioId = :u OR t.cerroId = :u)', { u: f.usuarioId });
    if (f.desde) qb.andWhere('t.abiertoEn >= :d', { d: new Date(f.desde + 'T00:00:00') });
    if (f.hasta) qb.andWhere('t.abiertoEn <= :h', { h: new Date(f.hasta + 'T23:59:59') });
    const por = 20;
    const [items, total] = await qb.skip(((f.pagina ?? 1) - 1) * por).take(por).getManyAndCount();
    // El turno abierto todavía no tiene resumen guardado: se calcula al vuelo.
    for (const t of items) if (t.estado === EstadoTurno.Abierto) t.resumen = await this.resumen(this.ds.manager, t);
    return { items, total };
  }

  /** Borra un movimiento de efectivo capturado por error, solo mientras su turno sigue abierto. */
  async eliminarMovimiento(s: Sesion, id: number) {
    const em = this.ds.manager;
    const m = await em.findOneBy(CajaMovimiento, { id, tallerId: s.tallerId });
    if (!m) throw new NotFoundException('No encontramos ese movimiento');
    const t = await em.findOneBy(CajaTurno, { id: m.turnoId, tallerId: s.tallerId });
    if (!t || t.estado !== EstadoTurno.Abierto) throw new BadRequestException('Ese turno ya se cerró; para corregirlo elimina el corte completo');
    if (s.rol === Rol.Vendedor && m.usuarioId !== s.usuarioId) throw new ForbiddenException('Solo puedes borrar los movimientos que tú capturaste');
    await em.delete(CajaMovimiento, { id });
    await this.bitacora.registrar(s, 'eliminar', 'caja_movimiento', t.id, { folio: t.folio, tipo: m.tipo, monto: m.monto, concepto: m.concepto });
    return { ok: true };
  }

  /**
   * Elimina un corte cerrado (por ejemplo, uno de prueba). Los cobros del turno se conservan:
   * solo dejan de estar ligados al corte, así que ventas y reportes no cambian.
   */
  async eliminarTurno(s: Sesion, id: number, motivo: string) {
    return this.ds.transaction(async (em) => {
      const t = await em.findOne(CajaTurno, { where: { id, tallerId: s.tallerId, ...(s.sucursal ? { sucursalId: s.sucursal } : {}) } });
      if (!t) throw new NotFoundException('Turno no encontrado');
      if (t.estado === EstadoTurno.Abierto) throw new BadRequestException('Primero cierra la caja; solo se eliminan cortes cerrados');
      const pagos = await em.count(Pago, { where: { turnoId: t.id } });
      await em.update(Pago, { turnoId: t.id }, { turnoId: null });
      await em.delete(CajaMovimiento, { turnoId: t.id });
      await em.delete(CajaTurno, { id: t.id });
      await this.bitacora.registrar(s, 'eliminar', 'caja', t.id, {
        folio: t.folio, motivo: motivo.trim(), fondo: t.fondo, esperado: t.esperado, contado: t.contado, diferencia: t.diferencia, pagos,
      }, em);
      return { ok: true };
    });
  }

  async detalle(s: Sesion, id: number) {
    const em = this.ds.manager;
    const t = await em.findOne(CajaTurno, { where: { id, tallerId: s.tallerId, ...(s.sucursal ? { sucursalId: s.sucursal } : {}) } });
    if (!t || (s.rol === Rol.Vendedor && t.abrioId !== s.usuarioId && t.cerroId !== s.usuarioId)) throw new NotFoundException('Turno no encontrado');
    if (t.estado === EstadoTurno.Abierto) t.resumen = await this.resumen(em, t);
    const pagos = await em.find(Pago, { where: { turnoId: t.id }, order: { id: 'ASC' } });
    const ventas = await em.find(Venta, { where: { id: In(pagos.map((p) => p.ventaId).concat(0)) }, select: { id: true, folio: true, clienteId: true, clienteNombre: true } });
    const clientes = await em.find(Cliente, { where: { id: In(ventas.map((v) => v.clienteId).filter((x): x is number => !!x).concat(0)) }, select: { id: true, nombre: true } });
    return {
      ...t,
      movimientos: await em.find(CajaMovimiento, { where: { turnoId: t.id }, order: { id: 'ASC' } }),
      pagos: pagos.map((p) => {
        const v = ventas.find((x) => x.id === p.ventaId);
        return { id: p.id, ventaId: p.ventaId, folio: v?.folio ?? '', cliente: clientes.find((c) => c.id === v?.clienteId)?.nombre || v?.clienteNombre || 'Mostrador', monto: p.monto, metodo: p.metodo, creadoEn: p.creadoEn };
      }),
    };
  }

  /** Reporte de ventas del periodo: por día, forma de pago, producto, vendedor y cliente. */
  async reporte(s: Sesion, desde: string, hasta: string) {
    const em = this.ds.manager;
    const suc = s.sucursal ? { sucursalId: s.sucursal } : {};
    const ventas = (await em.find(Venta, { where: { tallerId: s.tallerId, ...suc, fecha: Between(desde, hasta) } })).filter((v) => v.estado !== EstadoVenta.Cancelada);
    const canceladas = (await em.count(Venta, { where: { tallerId: s.tallerId, ...suc, fecha: Between(desde, hasta), estado: EstadoVenta.Cancelada } }));
    const pagos = await em
      .createQueryBuilder(Pago, 'p')
      .innerJoin('p.venta', 'v')
      .where('v.tallerId = :t', { t: s.tallerId })
      .andWhere(s.sucursal ? 'v.sucursalId = :s' : '1=1', { s: s.sucursal })
      .andWhere('p.fecha BETWEEN :d AND :h', { d: desde, h: hasta })
      .getMany();
    const usuarios = await em.find(Usuario, { where: { tallerId: s.tallerId }, select: { id: true, nombre: true } });
    const clientes = await em.find(Cliente, { where: { id: In(ventas.map((v) => v.clienteId).filter((x): x is number => !!x).concat(0)) }, select: { id: true, nombre: true } });

    const agrupar = <K extends string>(clave: (v: Venta) => K) => {
      const m = new Map<K, { clave: K; ventas: number; total: number; ganancia: number }>();
      for (const v of ventas) {
        const k = clave(v);
        const x = m.get(k) ?? { clave: k, ventas: 0, total: 0, ganancia: 0 };
        x.ventas += 1;
        x.total += v.total;
        x.ganancia += v.total - v.costo;
        m.set(k, x);
      }
      return [...m.values()].map((x) => ({ ...x, total: r2(x.total), ganancia: r2(x.ganancia) }));
    };

    const porDia = agrupar((v) => String(v.fecha)).sort((a, b) => a.clave.localeCompare(b.clave));
    const porVendedor = agrupar((v) => usuarios.find((u) => u.id === v.usuarioId)?.nombre ?? 'Sin registro').sort((a, b) => b.total - a.total);
    const porCliente = agrupar((v) => clientes.find((c) => c.id === v.clienteId)?.nombre || v.clienteNombre || 'Público en general').sort((a, b) => b.total - a.total);

    const prod = new Map<string, { clave: string; cantidad: number; total: number; ganancia: number }>();
    for (const v of ventas) {
      const f = v.subtotal ? v.total / v.subtotal : 1;
      for (const i of v.items) {
        const k = i.descripcion.replace(/\s*\(ejemplo\)$/, '');
        const x = prod.get(k) ?? { clave: k, cantidad: 0, total: 0, ganancia: 0 };
        x.cantidad += i.cantidad;
        x.total += i.cantidad * i.precio * f;
        x.ganancia += i.cantidad * (i.precio * f - i.costo);
        prod.set(k, x);
      }
    }
    const porProducto = [...prod.values()].map((x) => ({ ...x, cantidad: r2(x.cantidad), total: r2(x.total), ganancia: r2(x.ganancia) })).sort((a, b) => b.total - a.total);

    const met = new Map<string, { clave: string; pagos: number; total: number }>();
    for (const p of pagos) {
      const x = met.get(p.metodo) ?? { clave: p.metodo, pagos: 0, total: 0 };
      x.pagos += 1;
      x.total += p.monto;
      met.set(p.metodo, x);
    }
    const porMetodo = [...met.values()].map((x) => ({ ...x, total: r2(x.total) })).sort((a, b) => b.total - a.total);

    const total = r2(ventas.reduce((a, v) => a + v.total, 0));
    const costo = r2(ventas.reduce((a, v) => a + v.costo, 0));
    return {
      desde,
      hasta,
      totales: {
        ventas: ventas.length,
        total,
        ganancia: r2(total - costo),
        margen: total ? r2((total - costo) / total) : null,
        ticketPromedio: ventas.length ? r2(total / ventas.length) : 0,
        cobrado: r2(pagos.reduce((a, p) => a + p.monto, 0)),
        porCobrar: r2(ventas.reduce((a, v) => a + Math.max(0, v.total - v.pagado), 0)),
        descuentos: r2(ventas.reduce((a, v) => a + v.descuento, 0)),
        canceladas,
      },
      porDia,
      porMetodo,
      porProducto,
      porVendedor,
      porCliente,
    };
  }
}

@Controller()
export class CajaController {
  constructor(private caja: CajaService) {}

  @Get('caja/turno') @Roles(...VENTA)
  actual(@Ses() s: Sesion) {
    return this.caja.actual(s);
  }

  @Post('caja/turno') @Roles(...VENTA)
  abrir(@Ses() s: Sesion, @Body() dto: AbrirTurnoDto) {
    return this.caja.abrir(s, dto);
  }

  @Post('caja/turno/movimientos') @Roles(...VENTA)
  movimiento(@Ses() s: Sesion, @Body() dto: MovimientoDto) {
    return this.caja.movimiento(s, dto);
  }

  @Post('caja/turno/cerrar') @Roles(...VENTA) @HttpCode(200)
  cerrar(@Ses() s: Sesion, @Body() dto: CerrarTurnoDto) {
    return this.caja.cerrar(s, dto);
  }

  @Delete('caja/turno/movimientos/:id') @Roles(...VENTA) @HttpCode(200)
  eliminarMovimiento(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.caja.eliminarMovimiento(s, id);
  }

  @Post('caja/turnos/:id/eliminar') @Roles(...GERENCIA) @HttpCode(200)
  eliminarTurno(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: EliminarTurnoDto) {
    return this.caja.eliminarTurno(s, id, dto.motivo);
  }

  @Get('caja/turnos') @Roles(...VENTA)
  historial(@Ses() s: Sesion, @Query() f: TurnosFiltroDto) {
    return this.caja.historial(s, f);
  }

  @Get('caja/turnos/:id') @Roles(...VENTA)
  detalle(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.caja.detalle(s, id);
  }

  @Get('reportes/ventas') @Roles(...VEN_COSTOS)
  reporte(@Ses() s: Sesion, @Query() q: ReporteDto) {
    return this.caja.reporte(s, q.desde, q.hasta);
  }
}

@Module({ imports: [DocumentosModule], controllers: [CajaController], providers: [CajaService] })
export class CajaModule {}
