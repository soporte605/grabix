import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, Brackets, DataSource, EntityManager, In } from 'typeorm';
import {
  Cliente,
  Compra,
  CompraItem,
  Cotizacion,
  CotizacionItem,
  EstadoCotizacion,
  EstadoVenta,
  Existencia,
  Pago,
  Producto,
  Promocion,
  Rol,
  Sucursal,
  Taller,
  TipoProducto,
  Venta,
  VentaItem,
  CajaTurno,
  EstadoTurno,
} from '../entities';
import { BitacoraService } from '../common/bitacora.service';
import { Sesion } from '../common/sesion';
import { hoy, sumarDias } from '../common/suscripcion';
import { existe, r2, sucursalDe, token } from '../common/util';
import { CostosService } from '../catalogo/costos.service';
import { CompraDto, CotizacionDto, DocumentoDto, FiltroDto, PagoDto, VentaDto } from './documentos.dto';
import { FoliosService } from './folios.service';

type Doc = Cotizacion | Venta;

@Injectable()
export class DocumentosService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    private costos: CostosService,
    private folios: FoliosService,
    private bitacora: BitacoraService,
  ) {}

  /* ---------- comunes ---------- */

  /** Llena campos comunes, toma el costo de cada renglón del catálogo y calcula totales. */
  private async llenar(em: EntityManager, s: Sesion, d: Doc, dto: DocumentoDto, nuevo: () => CotizacionItem | VentaItem) {
    const t = await em.findOneByOrFail(Taller, { id: s.tallerId });
    const cat = await this.costos.catalogo(em, s.tallerId);
    if (dto.clienteId && !(await em.existsBy(Cliente, { id: dto.clienteId, tallerId: s.tallerId })))
      throw new BadRequestException('Cliente no válido');
    if (dto.promocionId && !(await em.existsBy(Promocion, { id: dto.promocionId, tallerId: s.tallerId })))
      throw new BadRequestException('Promoción no válida');
    d.clienteId = dto.clienteId ?? null;
    d.clienteNombre = dto.clienteId ? '' : (dto.clienteNombre ?? '');
    d.clienteTelefono = dto.clienteId ? '' : (dto.clienteTelefono ?? '');
    d.fecha = dto.fecha ?? d.fecha ?? hoy();
    d.descuentoTipo = dto.descuentoTipo ?? 'pct';
    d.descuentoValor = dto.descuentoValor ?? 0;
    d.promocionId = dto.promocionId ?? null;
    d.notas = dto.notas ?? null;
    d.items = dto.items.map((i) => {
      const p = i.productoId ? cat.get(i.productoId) : undefined;
      if (i.productoId && !p) throw new BadRequestException('Uno de los artículos no existe');
      return Object.assign(nuevo(), {
        productoId: p?.id ?? null,
        descripcion: i.descripcion || p?.nombre || 'Concepto',
        cantidad: i.cantidad,
        precio: i.precio,
        costo: r2(this.costos.costoUnitario(p, cat, t.tarifaMinuto)),
      });
    }) as never;
    this.totales(d);
    return cat;
  }

  totales(d: Doc) {
    const sub = d.items.reduce((a, i) => a + i.cantidad * i.precio, 0);
    let desc = d.descuentoTipo === 'pct' ? (sub * d.descuentoValor) / 100 : d.descuentoValor;
    desc = Math.max(0, Math.min(desc, sub));
    d.subtotal = r2(sub);
    d.descuento = r2(desc);
    d.total = r2(sub - desc);
    d.costo = r2(d.items.reduce((a, i) => a + i.cantidad * i.costo, 0));
  }

  private filtroSucursal(s: Sesion) {
    return s.sucursal ? { sucursalId: s.sucursal } : {};
  }

  /** Filtros comunes de cotizaciones y ventas (alias d, cliente c). */
  private filtrar<T extends Doc>(em: EntityManager, ent: new () => T, s: Sesion, f: FiltroDto) {
    const qb = em.createQueryBuilder(ent, 'd').leftJoin('d.cliente', 'c').where('d.tallerId = :t', { t: s.tallerId });
    if (s.sucursal) qb.andWhere('d.sucursalId = :s', { s: s.sucursal });
    if (f.estado) qb.andWhere('d.estado IN (:...e)', { e: f.estado.split(',') });
    if (f.clienteId) qb.andWhere('d.clienteId = :cl', { cl: f.clienteId });
    if (f.desde) qb.andWhere('d.fecha >= :desde', { desde: f.desde });
    if (f.hasta) qb.andWhere('d.fecha <= :hasta', { hasta: f.hasta });
    if (f.q)
      qb.andWhere(
        new Brackets((w) =>
          w.where('d.folio LIKE :q', { q: `%${f.q}%` }).orWhere('c.nombre LIKE :q').orWhere('d.clienteNombre LIKE :q'),
        ),
      );
    return qb;
  }

  private async listar<T extends Doc>(em: EntityManager, ent: new () => T, s: Sesion, f: FiltroDto) {
    const qb = this.filtrar(em, ent, s, f).addSelect('c').leftJoinAndSelect('d.items', 'i').orderBy('d.fecha', 'DESC').addOrderBy('d.id', 'DESC');
    if (!f.pagina) return qb.take(300).getMany();
    const por = f.por ?? 20;
    const [items, total] = await qb.skip((f.pagina - 1) * por).take(por).getManyAndCount();
    return { items, total };
  }

  /** Suma de total y saldo de lo filtrado (sin canceladas), para el pie de la lista paginada. */
  private async resumen<T extends Doc>(em: EntityManager, ent: new () => T, s: Sesion, f: FiltroDto, conSaldo: boolean) {
    const r = await this.filtrar(em, ent, s, f)
      .select('COALESCE(SUM(d.total), 0)', 'total')
      .addSelect(conSaldo ? 'COALESCE(SUM(GREATEST(d.total - d.pagado, 0)), 0)' : '0', 'saldo')
      .andWhere("d.estado <> 'cancelada'")
      .getRawOne<{ total: string; saldo: string }>();
    return { total: r2(Number(r?.total ?? 0)), saldo: r2(Number(r?.saldo ?? 0)) };
  }

  private async uno<T extends Doc>(em: EntityManager, ent: new () => T, s: Sesion, id: number, lock = false) {
    const d = await em.findOne(ent, {
      where: { id, tallerId: s.tallerId, ...this.filtroSucursal(s) } as never,
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    const r = existe(d, 'Documento') as T;
    if (!lock) r.cliente = r.clienteId ? await em.findOneBy(Cliente, { id: r.clienteId }) : null;
    return r;
  }

  /* ---------- cotizaciones ---------- */

  cotizaciones(s: Sesion, f: FiltroDto) {
    return this.listar(this.ds.manager, Cotizacion, s, f);
  }

  cotizacion(s: Sesion, id: number) {
    return this.uno(this.ds.manager, Cotizacion, s, id);
  }

  async guardarCotizacion(s: Sesion, dto: CotizacionDto, id?: number) {
    return this.ds.transaction(async (em) => {
      let c: Cotizacion;
      if (id) c = await this.uno(em, Cotizacion, s, id, true);
      else {
        const t = await em.findOneByOrFail(Taller, { id: s.tallerId });
        c = em.create(Cotizacion, {
          tallerId: s.tallerId,
          sucursalId: sucursalDe(s),
          folio: await this.folios.siguiente(em, s.tallerId, 'COT'),
          tokenPublico: token(),
          usuarioId: s.usuarioId,
          vigenciaDias: t.vigenciaDias,
          notas: t.notasCotizacion,
        });
      }
      await this.llenar(em, s, c, dto, () => em.create(CotizacionItem));
      if (dto.estado) c.estado = dto.estado;
      if (dto.vigenciaDias) c.vigenciaDias = dto.vigenciaDias;
      const r = await em.save(c);
      await this.bitacora.registrar(s, id ? 'actualizar' : 'crear', 'cotizacion', r.id, { folio: r.folio, total: r.total }, em);
      return r;
    });
  }

  async eliminarCotizacion(s: Sesion, id: number) {
    const c = await this.uno(this.ds.manager, Cotizacion, s, id);
    await this.ds.manager.remove(c);
    await this.bitacora.registrar(s, 'eliminar', 'cotizacion', id, { folio: c.folio });
    return { ok: true };
  }

  async marcarEnviada(s: Sesion, id: number) {
    const c = await this.uno(this.ds.manager, Cotizacion, s, id);
    if (c.estado === EstadoCotizacion.Borrador) await this.ds.manager.update(Cotizacion, { id }, { estado: EstadoCotizacion.Enviada });
  }

  /** Convierte una cotización aceptada en orden de venta (descuenta inventario). */
  async convertir(s: Sesion, id: number) {
    return this.ds.transaction(async (em) => {
      const c = await this.uno(em, Cotizacion, s, id, true);
      if (await em.existsBy(Venta, { cotizacionId: c.id, tallerId: s.tallerId }))
        throw new BadRequestException('Esta cotización ya se convirtió en venta');
      const v = await this.crearVentaEn(em, { ...s, sucursal: c.sucursalId }, {
        clienteId: c.clienteId,
        clienteNombre: c.clienteNombre,
        clienteTelefono: c.clienteTelefono,
        descuentoTipo: c.descuentoTipo,
        descuentoValor: c.descuentoValor,
        promocionId: c.promocionId,
        fecha: hoy(),
        entrega: sumarDias(hoy(), 3),
        items: c.items.map((i) => ({ productoId: i.productoId, descripcion: i.descripcion, cantidad: i.cantidad, precio: i.precio })),
      }, c.id);
      c.estado = EstadoCotizacion.Aceptada;
      await em.save(c);
      return v;
    });
  }

  /* ---------- ventas ---------- */

  async ventas(s: Sesion, f: FiltroDto) {
    const r = await this.listar(this.ds.manager, Venta, s, f);
    const conSaldo = (vs: Venta[]) => vs.map((v) => ({ ...v, saldo: r2(Math.max(0, v.total - v.pagado)) }));
    if (Array.isArray(r)) return conSaldo(r);
    return { items: conSaldo(r.items), total: r.total, resumen: await this.resumen(this.ds.manager, Venta, s, f, true) };
  }

  async venta(s: Sesion, id: number) {
    const v = await this.uno(this.ds.manager, Venta, s, id);
    return { ...v, saldo: r2(Math.max(0, v.total - v.pagado)) };
  }

  crearVenta(s: Sesion, dto: VentaDto) {
    return this.ds.transaction((em) => this.crearVentaEn(em, s, dto));
  }

  private async crearVentaEn(em: EntityManager, s: Sesion, dto: VentaDto, cotizacionId: number | null = null) {
    const v = em.create(Venta, {
      tallerId: s.tallerId,
      sucursalId: sucursalDe(s),
      folio: await this.folios.siguiente(em, s.tallerId, 'VTA'),
      tokenPublico: token(),
      usuarioId: s.usuarioId,
      cotizacionId,
      estado: dto.estado ?? EstadoVenta.Pendiente,
      entrega: dto.entrega ?? null,
      pagos: [],
      pagado: 0,
    });
    const turnoId = await this.turnoAbierto(em, s.tallerId, v.sucursalId);
    if (dto.origen === 'caja' && !turnoId) throw new BadRequestException('La caja está cerrada. Ábrela para empezar a cobrar.');
    await this.llenar(em, s, v, dto, () => em.create(VentaItem));
    const pagos = [...(dto.anticipo?.monto ? [dto.anticipo] : []), ...(dto.pagos ?? []).filter((p) => p.monto > 0)];
    const suma = r2(pagos.reduce((a, p) => a + p.monto, 0));
    if (suma > v.total + 0.009) throw new BadRequestException('Los pagos suman más que el total de la venta');
    for (const p of pagos)
      v.pagos.push(em.create(Pago, { fecha: p.fecha ?? hoy(), monto: r2(p.monto), metodo: p.metodo ?? 'Efectivo', usuarioId: s.usuarioId, turnoId }));
    v.pagado = suma;
    await this.aplicarStock(em, s, v);
    const r = await em.save(v);
    await this.bitacora.registrar(s, 'crear', 'venta', r.id, { folio: r.folio, total: r.total }, em);
    return r;
  }

  /** Turno de caja abierto en la sucursal: los cobros quedan ligados a él para el corte. */
  private async turnoAbierto(em: EntityManager, tallerId: number, sucursalId: number) {
    const t = await em.findOne(CajaTurno, { where: { tallerId, sucursalId, estado: EstadoTurno.Abierto }, select: { id: true } });
    return t?.id ?? null;
  }

  async editarVenta(s: Sesion, id: number, dto: VentaDto) {
    return this.ds.transaction(async (em) => {
      const v = await this.uno(em, Venta, s, id, true);
      await this.revertirStock(em, s, v);
      const antes = { total: v.total, estado: v.estado };
      await this.llenar(em, s, v, dto, () => em.create(VentaItem));
      if (dto.estado) v.estado = dto.estado;
      if (dto.entrega !== undefined) v.entrega = dto.entrega;
      await this.aplicarStock(em, s, v);
      const r = await em.save(v);
      await this.bitacora.registrar(s, 'actualizar', 'venta', id, { folio: v.folio, antes, despues: { total: v.total, estado: v.estado } }, em);
      return r;
    });
  }

  async cambiarEstado(s: Sesion, id: number, estado: EstadoVenta) {
    return this.ds.transaction(async (em) => {
      const v = await this.uno(em, Venta, s, id, true);
      if (s.rol === Rol.Produccion && [EstadoVenta.Cancelada].includes(estado))
        throw new ForbiddenException('Producción no puede cancelar pedidos');
      const antes = v.estado;
      v.estado = estado;
      if (estado === EstadoVenta.Cancelada) await this.revertirStock(em, s, v);
      else if (!v.stockAplicado) await this.aplicarStock(em, s, v);
      await em.save(v);
      await this.bitacora.registrar(s, 'estado', 'venta', id, { folio: v.folio, antes, despues: estado }, em);
      return { id, estado };
    });
  }

  async registrarPago(s: Sesion, id: number, dto: PagoDto) {
    return this.ds.transaction(async (em) => {
      const v = await this.uno(em, Venta, s, id, true);
      if (v.estado === EstadoVenta.Cancelada) throw new BadRequestException('La venta está cancelada');
      const turnoId = await this.turnoAbierto(em, s.tallerId, v.sucursalId);
      const p = em.create(Pago, { ventaId: v.id, fecha: dto.fecha ?? hoy(), monto: dto.monto, metodo: dto.metodo ?? 'Efectivo', usuarioId: s.usuarioId, turnoId });
      await em.save(p);
      v.pagado = r2(v.pagado + dto.monto);
      await em.update(Venta, { id: v.id }, { pagado: v.pagado });
      await this.bitacora.registrar(s, 'pago', 'venta', id, { folio: v.folio, monto: dto.monto, metodo: p.metodo }, em);
      return { pagado: v.pagado, saldo: r2(Math.max(0, v.total - v.pagado)), pagoId: p.id };
    });
  }

  async eliminarVenta(s: Sesion, id: number) {
    return this.ds.transaction(async (em) => {
      const v = await this.uno(em, Venta, s, id, true);
      await this.revertirStock(em, s, v);
      await em.remove(v);
      await this.bitacora.registrar(s, 'eliminar', 'venta', id, { folio: v.folio, total: v.total }, em);
      return { ok: true };
    });
  }

  private async aplicarStock(em: EntityManager, s: Sesion, v: Venta) {
    if (v.stockAplicado || v.estado === EstadoVenta.Cancelada) return;
    const cat = await this.costos.catalogo(em, s.tallerId);
    const m = this.costos.consumo(v.items, cat);
    await this.costos.mover(em, s.tallerId, v.sucursalId, new Map([...m].map(([k, q]) => [k, -q])), 'venta', v.folio, s.usuarioId);
    v.stockAplicado = true;
  }

  private async revertirStock(em: EntityManager, s: Sesion, v: Venta) {
    if (!v.stockAplicado) return;
    const cat = await this.costos.catalogo(em, s.tallerId);
    await this.costos.mover(em, s.tallerId, v.sucursalId, this.costos.consumo(v.items, cat), 'cancelacion', v.folio, s.usuarioId);
    v.stockAplicado = false;
  }

  /* ---------- compras ---------- */

  compras(s: Sesion, f: FiltroDto = {}) {
    const qb = this.ds.manager
      .createQueryBuilder(Compra, 'c')
      .leftJoinAndSelect('c.items', 'i')
      .where('c.tallerId = :t', { t: s.tallerId })
      .orderBy('c.fecha', 'DESC')
      .addOrderBy('c.id', 'DESC');
    if (!f.pagina) qb.take(300);
    if (s.sucursal) qb.andWhere('c.sucursalId = :s', { s: s.sucursal });
    if (f.desde) qb.andWhere('c.fecha >= :desde', { desde: f.desde });
    if (f.hasta) qb.andWhere('c.fecha <= :hasta', { hasta: f.hasta });
    if (f.q) qb.andWhere(new Brackets((w) => w.where('c.folio LIKE :q', { q: `%${f.q}%` }).orWhere('c.proveedor LIKE :q')));
    if (!f.pagina) return qb.getMany();
    const por = f.por ?? 20;
    return qb.skip((f.pagina - 1) * por).take(por).getManyAndCount().then(([items, total]) => ({ items, total }));
  }

  /** Registra la compra: suma existencias y recalcula el costo promedio ponderado. */
  async crearCompra(s: Sesion, dto: CompraDto) {
    const sucursalId = sucursalDe(s);
    return this.ds.transaction(async (em) => {
      const cat = await this.costos.catalogo(em, s.tallerId);
      for (const i of dto.items) {
        if (!i.productoId) continue;
        const p = cat.get(i.productoId);
        if (!p) throw new BadRequestException('Uno de los artículos no existe');
        if (p.tipo === TipoProducto.Servicio || p.componentes?.length)
          throw new BadRequestException(`"${p.nombre}" no lleva inventario propio; compra sus insumos`);
        const ex = await em.find(Existencia, { where: { tallerId: s.tallerId, productoId: p.id } });
        const stock = Math.max(0, ex.reduce((a, e) => a + e.cantidad, 0));
        p.costo = stock + i.cantidad > 0 ? Math.round(((stock * p.costo + i.cantidad * i.costo) / (stock + i.cantidad)) * 10000) / 10000 : i.costo;
        await em.update(Producto, { id: p.id }, { costo: p.costo });
      }
      const c = em.create(Compra, {
        tallerId: s.tallerId,
        sucursalId,
        folio: await this.folios.siguiente(em, s.tallerId, 'CMP'),
        fecha: dto.fecha ?? hoy(),
        proveedor: dto.proveedor ?? '',
        notas: dto.notas ?? null,
        usuarioId: s.usuarioId,
        total: r2(dto.items.reduce((a, i) => a + i.cantidad * i.costo, 0)),
        items: dto.items.map((i) =>
          em.create(CompraItem, {
            productoId: i.productoId ?? null,
            descripcion: i.descripcion || (i.productoId ? cat.get(i.productoId)!.nombre : 'Gasto'),
            cantidad: i.cantidad,
            costo: i.costo,
          }),
        ),
      });
      const r = await em.save(c);
      const m = new Map<number, number>();
      dto.items.forEach((i) => i.productoId && m.set(i.productoId, (m.get(i.productoId) ?? 0) + i.cantidad));
      await this.costos.mover(em, s.tallerId, sucursalId, m, 'compra', r.folio, s.usuarioId);
      await this.bitacora.registrar(s, 'crear', 'compra', r.id, { folio: r.folio, total: r.total, proveedor: r.proveedor }, em);
      return r;
    });
  }

  async eliminarCompra(s: Sesion, id: number) {
    return this.ds.transaction(async (em) => {
      const c = existe(await em.findOneBy(Compra, { id, tallerId: s.tallerId, ...this.filtroSucursal(s) }), 'Compra');
      const m = new Map<number, number>();
      c.items.forEach((i) => i.productoId && m.set(i.productoId, (m.get(i.productoId) ?? 0) - i.cantidad));
      await this.costos.mover(em, s.tallerId, c.sucursalId, m, 'cancelacion', c.folio, s.usuarioId);
      await em.remove(c);
      await this.bitacora.registrar(s, 'eliminar', 'compra', id, { folio: c.folio, total: c.total }, em);
      return { ok: true };
    });
  }

  /* ---------- datos para PDF y WhatsApp ---------- */

  async paraImprimir(tipo: 'cotizacion' | 'venta', d: Doc) {
    const em = this.ds.manager;
    const taller = await em.findOneByOrFail(Taller, { id: d.tallerId });
    const sucursal = await em.findOneBy(Sucursal, { id: d.sucursalId });
    const cliente = d.clienteId ? await em.findOneBy(Cliente, { id: d.clienteId }) : null;
    const promocion = d.promocionId ? await em.findOneBy(Promocion, { id: d.promocionId }) : null;
    return { tipo, d, taller, sucursal, cliente, promocion };
  }

  async porToken(tk: string) {
    const em = this.ds.manager;
    const c = await em.findOneBy(Cotizacion, { tokenPublico: tk });
    if (c) return this.paraImprimir('cotizacion', c);
    const v = await em.findOneBy(Venta, { tokenPublico: tk });
    return v ? this.paraImprimir('venta', v) : null;
  }

  /* ---------- estadísticas ---------- */

  async estadisticas(s: Sesion, desde: string, hasta: string) {
    const em = this.ds.manager;
    const suc = this.filtroSucursal(s);
    const base = { tallerId: s.tallerId, ...suc };
    const activas = (vs: Venta[]) => vs.filter((v) => v.estado !== EstadoVenta.Cancelada);
    const periodo = activas(await em.find(Venta, { where: { ...base, fecha: Between(desde, hasta) } }));
    const ventas = r2(periodo.reduce((a, v) => a + v.total, 0));
    const costo = r2(periodo.reduce((a, v) => a + v.costo, 0));

    // Serie de los últimos 12 meses hasta "hasta".
    const fin = new Date(hasta + 'T12:00:00Z');
    const ini = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
    const hist = activas(await em.find(Venta, { where: { ...base, fecha: Between(ini, hasta) } }));
    const serie: { mes: string; ventas: number; ganancia: number; pedidos: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      const vs = hist.filter((v) => String(v.fecha).startsWith(m));
      serie.push({ mes: m, ventas: r2(vs.reduce((a, v) => a + v.total, 0)), ganancia: r2(vs.reduce((a, v) => a + v.total - v.costo, 0)), pedidos: vs.length });
    }

    // Lo que más deja: el descuento se reparte en proporción a cada renglón.
    const top = new Map<string, { descripcion: string; cantidad: number; ventas: number; ganancia: number }>();
    for (const v of periodo) {
      const f = v.subtotal ? v.total / v.subtotal : 1;
      for (const i of v.items) {
        const k = i.productoId ? `p${i.productoId}` : i.descripcion;
        const x = top.get(k) ?? { descripcion: i.descripcion, cantidad: 0, ventas: 0, ganancia: 0 };
        x.cantidad += i.cantidad;
        x.ventas += i.cantidad * i.precio * f;
        x.ganancia += i.cantidad * (i.precio * f - i.costo);
        top.set(k, x);
      }
    }

    const abiertas = activas(await em.find(Venta, { where: { ...base, estado: In([EstadoVenta.Pendiente, EstadoVenta.Produccion, EstadoVenta.Lista, EstadoVenta.Entregada]) } }));
    const porCobrar = r2(abiertas.reduce((a, v) => a + Math.max(0, v.total - v.pagado), 0));
    const pendientes = abiertas
      .filter((v) => v.estado !== EstadoVenta.Entregada)
      .sort((a, b) => String(a.entrega ?? '9').localeCompare(String(b.entrega ?? '9')))
      .slice(0, 8);
    const clientes = await em.findBy(Cliente, { tallerId: s.tallerId, id: In(pendientes.map((v) => v.clienteId).filter((x): x is number => !!x).concat(0)) });

    const compras = await em.find(Compra, { where: { ...base, fecha: Between(desde, hasta) } });
    const cots = await em.find(Cotizacion, { where: { ...base, fecha: Between(desde, hasta) } });
    const cobrado = await em
      .createQueryBuilder(Pago, 'p')
      .innerJoin('p.venta', 'v')
      .select('SUM(p.monto)', 'total')
      .where('v.tallerId = :t', { t: s.tallerId })
      .andWhere(s.sucursal ? 'v.sucursalId = :s' : '1=1', { s: s.sucursal })
      .andWhere('p.fecha BETWEEN :d AND :h', { d: desde, h: hasta })
      .getRawOne<{ total: string | null }>();

    // Comparativo contra el periodo anterior del mismo largo, y el día de hoy.
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 864e5) + 1;
    const antHasta = sumarDias(desde, -1), antDesde = sumarDias(desde, -dias);
    const anterior = activas(await em.find(Venta, { where: { ...base, fecha: Between(antDesde, antHasta) } }));
    const h = hoy();
    const deHoy = activas(await em.find(Venta, { where: { ...base, fecha: h } }));
    const atrasados = abiertas.filter((v) => v.estado !== EstadoVenta.Entregada && v.entrega && String(v.entrega) < h).length;
    const clientesNuevos = await em.count(Cliente, { where: { tallerId: s.tallerId, creadoEn: Between(new Date(desde + 'T00:00:00'), new Date(hasta + 'T23:59:59')) } });

    const ex = await em.find(Existencia, { where: { tallerId: s.tallerId, ...suc } });
    const prods = await em.find(Producto, { where: { tallerId: s.tallerId, activo: true } });
    const bajos = prods
      .filter((p) => p.tipo !== TipoProducto.Servicio && !p.componentes?.length)
      .map((p) => {
        const e = ex.filter((x) => x.productoId === p.id);
        return { id: p.id, nombre: p.nombre, unidad: p.unidad, existencia: r2(e.reduce((a, x) => a + x.cantidad, 0)), minimo: r2(e.reduce((a, x) => a + x.minimo, 0)) };
      })
      .filter((p) => p.minimo > 0 && p.existencia <= p.minimo);

    return {
      desde,
      hasta,
      ventas,
      pedidos: periodo.length,
      ticketPromedio: periodo.length ? r2(ventas / periodo.length) : 0,
      costo,
      ganancia: r2(ventas - costo),
      margen: ventas ? r2((ventas - costo) / ventas) : null,
      cobrado: r2(Number(cobrado?.total ?? 0)),
      porCobrar,
      compras: r2(compras.reduce((a, c) => a + c.total, 0)),
      cotizaciones: {
        total: cots.length,
        aceptadas: cots.filter((c) => c.estado === EstadoCotizacion.Aceptada).length,
        abiertas: cots.filter((c) => c.estado === EstadoCotizacion.Borrador || c.estado === EstadoCotizacion.Enviada).length,
      },
      ventasAnterior: r2(anterior.reduce((a, v) => a + v.total, 0)),
      hoy: { ventas: r2(deHoy.reduce((a, v) => a + v.total, 0)), pedidos: deHoy.length },
      atrasados,
      clientesNuevos,
      serie,
      top: [...top.values()]
        .map((x) => ({ ...x, ventas: r2(x.ventas), ganancia: r2(x.ganancia) }))
        .sort((a, b) => b.ganancia - a.ganancia)
        .slice(0, 8),
      pendientes: pendientes.map((v) => ({
        id: v.id,
        folio: v.folio,
        cliente: clientes.find((c) => c.id === v.clienteId)?.nombre || v.clienteNombre || 'Mostrador',
        entrega: v.entrega,
        estado: v.estado,
        total: v.total,
        saldo: r2(Math.max(0, v.total - v.pagado)),
      })),
      stockBajo: bajos,
    };
  }
}

