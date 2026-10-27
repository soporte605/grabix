import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Existencia, MovimientoInventario, Producto, TipoProducto } from '../entities';

/** Cálculo de costos con recetas e impacto en inventario. */
@Injectable()
export class CostosService {
  /** Carga todos los productos del taller indexados por id (catálogos de talleres son chicos). */
  async catalogo(em: EntityManager, tallerId: number) {
    const ps = await em.find(Producto, { where: { tallerId } });
    return new Map(ps.map((p) => [p.id, p]));
  }

  /** Costo por pieza: insumos de la receta (o costo de compra) + minutos de máquina + extras. */
  costoUnitario(p: Producto | undefined, cat: Map<number, Producto>, tarifaMinuto: number, d = 0): number {
    if (!p) return 0;
    const base =
      p.componentes?.length && d < 4
        ? p.componentes.reduce((a, k) => a + this.costoUnitario(cat.get(k.insumoId), cat, tarifaMinuto, d + 1) * k.cantidad, 0)
        : p.costo;
    return base + p.minutos * tarifaMinuto + p.extra;
  }

  /** Qué insumos/productos salen del inventario al vender estos renglones. */
  consumo(items: { productoId: number | null; cantidad: number }[], cat: Map<number, Producto>) {
    const m = new Map<number, number>();
    const add = (id: number, q: number, d: number) => {
      const p = cat.get(id);
      if (!p || p.tipo === TipoProducto.Servicio) return;
      if (p.componentes?.length && d < 4) p.componentes.forEach((k) => add(k.insumoId, q * k.cantidad, d + 1));
      else m.set(id, (m.get(id) ?? 0) + q);
    };
    items.forEach((i) => i.productoId && add(i.productoId, i.cantidad, 0));
    return m;
  }

  /** Suma (o resta, con cantidades negativas) existencias y deja el movimiento registrado. */
  async mover(
    em: EntityManager,
    tallerId: number,
    sucursalId: number,
    cambios: Map<number, number>,
    motivo: string,
    referencia: string,
    usuarioId: number | null,
  ) {
    if (!cambios.size) return;
    const ids = [...cambios.keys()];
    const actuales = await em.find(Existencia, {
      where: { tallerId, sucursalId, productoId: In(ids) },
      lock: { mode: 'pessimistic_write' },
    });
    for (const [productoId, q] of cambios) {
      if (!q) continue;
      let e = actuales.find((x) => x.productoId === productoId);
      if (!e) e = em.create(Existencia, { tallerId, sucursalId, productoId, cantidad: 0, minimo: 0 });
      e.cantidad = Math.round((e.cantidad + q) * 10000) / 10000;
      await em.save(e);
      await em.save(em.create(MovimientoInventario, { tallerId, sucursalId, productoId, cantidad: q, motivo, referencia, usuarioId }));
    }
  }
}
