import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Cliente, Existencia, MovimientoInventario, Producto, ProductoComponente, Promocion, Sucursal, Taller, TipoProducto, Venta } from '../entities';
import { BitacoraService } from '../common/bitacora.service';
import { Sesion } from '../common/sesion';
import { existe, r2, sucursalDe } from '../common/util';
import { AjusteDto, ClienteDto, ProductoDto, PromocionDto, TraspasoDto } from './catalogo.dto';
import { CostosService } from './costos.service';

@Injectable()
export class CatalogoService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    private costos: CostosService,
    private bitacora: BitacoraService,
  ) {}

  /* ---------- productos ---------- */
  async productos(s: Sesion) {
    const em = this.ds.manager;
    const t = await em.findOneByOrFail(Taller, { id: s.tallerId });
    const cat = await this.costos.catalogo(em, s.tallerId);
    const ex = await em.find(Existencia, { where: s.sucursal ? { tallerId: s.tallerId, sucursalId: s.sucursal } : { tallerId: s.tallerId } });
    return [...cat.values()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => {
        const mias = ex.filter((e) => e.productoId === p.id);
        const costoUnitario = r2(this.costos.costoUnitario(p, cat, t.tarifaMinuto));
        return {
          ...p,
          costoUnitario,
          margen: p.precio ? r2((p.precio - costoUnitario) / p.precio) : null,
          existencia: r2(mias.reduce((a, e) => a + e.cantidad, 0)),
          minimo: r2(mias.reduce((a, e) => a + e.minimo, 0)),
          controlaStock: p.tipo !== TipoProducto.Servicio && !p.componentes?.length,
        };
      });
  }

  async guardarProducto(s: Sesion, dto: ProductoDto, id?: number) {
    return this.ds.transaction(async (em) => {
      const cat = await this.costos.catalogo(em, s.tallerId);
      let p: Producto;
      if (id) p = existe(cat.get(id), 'Artículo');
      else p = em.create(Producto, { tallerId: s.tallerId });
      const comps = dto.tipo !== TipoProducto.Insumo ? (dto.componentes ?? []).filter((c) => c.cantidad > 0) : [];
      for (const c of comps) {
        const i = cat.get(c.insumoId);
        if (!i || i.id === id) throw new BadRequestException('Uno de los insumos de la receta no existe');
      }
      const { componentes: _c, stockInicial, minimo, ...campos } = dto;
      Object.assign(p, campos);
      p.componentes = comps.map((c) => em.create(ProductoComponente, { insumoId: c.insumoId, cantidad: c.cantidad }));
      const r = await em.save(p);
      if (!id && s.sucursal && (stockInicial || minimo)) {
        await em.save(em.create(Existencia, { tallerId: s.tallerId, sucursalId: s.sucursal, productoId: r.id, cantidad: 0, minimo: minimo ?? 0 }));
        if (stockInicial) await this.costos.mover(em, s.tallerId, s.sucursal, new Map([[r.id, stockInicial]]), 'ajuste', 'inicial', s.usuarioId);
      }
      await this.bitacora.registrar(s, id ? 'actualizar' : 'crear', 'producto', r.id, { nombre: r.nombre, precio: r.precio }, em);
      return r;
    });
  }

  async eliminarProducto(s: Sesion, id: number) {
    const em = this.ds.manager;
    const p = existe(await em.findOneBy(Producto, { id, tallerId: s.tallerId }), 'Artículo');
    // Se desactiva en lugar de borrar para no romper el historial de ventas.
    p.activo = false;
    await em.save(p);
    await this.bitacora.registrar(s, 'desactivar', 'producto', id, { nombre: p.nombre });
    return { ok: true };
  }

  async ajustar(s: Sesion, productoId: number, dto: AjusteDto) {
    const sucursalId = sucursalDe(s);
    return this.ds.transaction(async (em) => {
      existe(await em.findOneBy(Producto, { id: productoId, tallerId: s.tallerId }), 'Artículo');
      let e = await em.findOne(Existencia, { where: { tallerId: s.tallerId, sucursalId, productoId }, lock: { mode: 'pessimistic_write' } });
      if (!e) e = await em.save(em.create(Existencia, { tallerId: s.tallerId, sucursalId, productoId, cantidad: 0, minimo: 0 }));
      if (dto.minimo !== undefined) {
        e.minimo = dto.minimo;
        await em.save(e);
      }
      if (dto.cantidad !== undefined && dto.cantidad !== e.cantidad) {
        const dif = dto.cantidad - e.cantidad;
        await this.costos.mover(em, s.tallerId, sucursalId, new Map([[productoId, dif]]), 'ajuste', dto.motivo ?? 'conteo', s.usuarioId);
        await this.bitacora.registrar(s, 'ajuste-inventario', 'producto', productoId, { sucursalId, antes: e.cantidad, despues: dto.cantidad }, em);
      }
      return em.findOneByOrFail(Existencia, { id: e.id });
    });
  }

  async traspasar(s: Sesion, dto: TraspasoDto) {
    const origen = sucursalDe(s);
    if (origen === dto.destinoId) throw new BadRequestException('El origen y el destino son la misma sucursal');
    return this.ds.transaction(async (em) => {
      existe(await em.findOneBy(Sucursal, { id: dto.destinoId, tallerId: s.tallerId }), 'Sucursal destino');
      const ids = dto.items.map((i) => i.productoId);
      const n = await em.countBy(Producto, { tallerId: s.tallerId, id: In(ids) });
      if (n !== new Set(ids).size) throw new BadRequestException('Algún artículo no existe');
      const ref = `T-${Date.now().toString(36).toUpperCase()}`;
      await this.costos.mover(em, s.tallerId, origen, new Map(dto.items.map((i) => [i.productoId, -i.cantidad])), 'traspaso', ref, s.usuarioId);
      await this.costos.mover(em, s.tallerId, dto.destinoId, new Map(dto.items.map((i) => [i.productoId, i.cantidad])), 'traspaso', ref, s.usuarioId);
      await this.bitacora.registrar(s, 'traspaso', 'inventario', null, { origen, destino: dto.destinoId, items: dto.items, ref }, em);
      return { referencia: ref };
    });
  }

  movimientos(s: Sesion, productoId: number) {
    return this.ds.manager.find(MovimientoInventario, {
      where: { tallerId: s.tallerId, productoId, ...(s.sucursal ? { sucursalId: s.sucursal } : {}) },
      order: { id: 'DESC' },
      take: 100,
    });
  }

  /* ---------- clientes ---------- */
  async clientes(s: Sesion) {
    const cs = await this.ds.manager.find(Cliente, { where: { tallerId: s.tallerId }, order: { nombre: 'ASC' } });
    const tot = await this.ds.manager
      .createQueryBuilder(Venta, 'v')
      .select('v.clienteId', 'clienteId')
      .addSelect('COUNT(*)', 'pedidos')
      .addSelect('SUM(v.total)', 'comprado')
      .where('v.tallerId = :t AND v.estado <> :c', { t: s.tallerId, c: 'cancelada' })
      .groupBy('v.clienteId')
      .getRawMany<{ clienteId: number; pedidos: string; comprado: string }>();
    const m = new Map(tot.map((x) => [Number(x.clienteId), x]));
    return cs.map((c) => ({ ...c, pedidos: Number(m.get(c.id)?.pedidos ?? 0), comprado: r2(Number(m.get(c.id)?.comprado ?? 0)) }));
  }

  async guardarCliente(s: Sesion, dto: ClienteDto, id?: number) {
    const repo = this.ds.getRepository(Cliente);
    const c = id ? existe(await repo.findOneBy({ id, tallerId: s.tallerId }), 'Cliente') : repo.create({ tallerId: s.tallerId });
    Object.assign(c, dto);
    const r = await repo.save(c);
    await this.bitacora.registrar(s, id ? 'actualizar' : 'crear', 'cliente', r.id, { nombre: r.nombre });
    return r;
  }

  async eliminarCliente(s: Sesion, id: number) {
    const repo = this.ds.getRepository(Cliente);
    const c = existe(await repo.findOneBy({ id, tallerId: s.tallerId }), 'Cliente');
    await repo.remove(c);
    await this.bitacora.registrar(s, 'eliminar', 'cliente', id, { nombre: c.nombre });
    return { ok: true };
  }

  /* ---------- promociones ---------- */
  promociones(s: Sesion) {
    return this.ds.manager.find(Promocion, { where: { tallerId: s.tallerId }, order: { id: 'DESC' } });
  }

  async guardarPromocion(s: Sesion, dto: PromocionDto, id?: number) {
    const repo = this.ds.getRepository(Promocion);
    const p = id ? existe(await repo.findOneBy({ id, tallerId: s.tallerId }), 'Promoción') : repo.create({ tallerId: s.tallerId });
    Object.assign(p, dto);
    const r = await repo.save(p);
    await this.bitacora.registrar(s, id ? 'actualizar' : 'crear', 'promocion', r.id, dto);
    return r;
  }

  async eliminarPromocion(s: Sesion, id: number) {
    const repo = this.ds.getRepository(Promocion);
    const p = existe(await repo.findOneBy({ id, tallerId: s.tallerId }), 'Promoción');
    await repo.remove(p);
    await this.bitacora.registrar(s, 'eliminar', 'promocion', id, { nombre: p.nombre });
    return { ok: true };
  }
}
