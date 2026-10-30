import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Cliente, EstadoVenta, Existencia, Folio, Pago, Producto, ProductoComponente, Promocion, Sucursal, Taller, TipoProducto, Venta, VentaItem,
} from '../entities';
import { CostosService } from '../catalogo/costos.service';
import { hoy, sumarDias } from '../common/suscripcion';
import { r2, token } from '../common/util';

/** Datos de ejemplo para que un taller nuevo vea la app funcionando. Todos llevan "(ejemplo)". */
@Injectable()
export class EjemplosService {
  constructor(private costos: CostosService) {}

  async crear(em: EntityManager, t: Taller, s: Sucursal) {
    const P = (x: Partial<Producto>) => em.save(em.create(Producto, { tallerId: t.id, ...x, nombre: `${x.nombre} (ejemplo)` }));
    const taza = await P({ nombre: 'Taza blanca 11 oz', tipo: TipoProducto.Insumo, categoria: 'Sublimación', unidad: 'pza', costo: 28 });
    const papel = await P({ nombre: 'Papel de sublimación carta', tipo: TipoProducto.Insumo, categoria: 'Sublimación', unidad: 'hoja', costo: 2.5 });
    const mdf = await P({ nombre: 'MDF 3 mm 60×40 cm', tipo: TipoProducto.Insumo, categoria: 'Corte láser', unidad: 'hoja', costo: 45 });
    const acr = await P({ nombre: 'Acrílico transparente 3 mm 60×40 cm', tipo: TipoProducto.Insumo, categoria: 'Grabado láser', unidad: 'hoja', costo: 210 });
    const arg = await P({ nombre: 'Argolla metálica para llavero', tipo: TipoProducto.Insumo, categoria: 'Corte láser', unidad: 'pza', costo: 1.8 });
    const C = (insumoId: number, cantidad: number) => em.create(ProductoComponente, { insumoId, cantidad });
    const tazaS = await P({ nombre: 'Taza sublimada personalizada', tipo: TipoProducto.Producto, categoria: 'Sublimación', precio: 120, minutos: 4, componentes: [C(taza.id, 1), C(papel.id, 1)] });
    const llav = await P({ nombre: 'Llavero MDF grabado', tipo: TipoProducto.Producto, categoria: 'Corte láser', precio: 35, minutos: 3, componentes: [C(mdf.id, 0.03), C(arg.id, 1)] });
    const reco = await P({ nombre: 'Reconocimiento acrílico grabado', tipo: TipoProducto.Producto, categoria: 'Grabado láser', precio: 380, minutos: 12, extra: 15, componentes: [C(acr.id, 0.25)] });
    await P({ nombre: 'Corte láser (por minuto)', tipo: TipoProducto.Servicio, categoria: 'Corte láser', unidad: 'min', precio: 15, minutos: 1 });
    const dis = await P({ nombre: 'Diseño personalizado', tipo: TipoProducto.Servicio, categoria: 'Otro', unidad: 'servicio', precio: 150 });

    const stock: [Producto, number, number][] = [[taza, 36, 24], [papel, 180, 100], [mdf, 6, 10], [acr, 4, 3], [arg, 150, 50]];
    for (const [p, cantidad, minimo] of stock) await em.save(em.create(Existencia, { tallerId: t.id, sucursalId: s.id, productoId: p.id, cantidad, minimo }));

    const cli = async (nombre: string, telefono: string, empresa = '') => em.save(em.create(Cliente, { tallerId: t.id, nombre: `${nombre} (ejemplo)`, telefono, empresa }));
    const laura = await cli('Laura Méndez', '5512345678');
    const escuela = await cli('Esc. Primaria Benito Juárez', '5523456789', 'Dirección escolar');
    const cafe = await cli('Café La Molienda', '5534567890', 'Cafetería');

    const promo = await em.save(
      em.create(Promocion, { tallerId: t.id, nombre: '10% en tazas (ejemplo)', tipo: 'pct', valor: 10, inicio: sumarDias(hoy(), -1), fin: sumarDias(hoy(), 30), activa: true }),
    );

    const cat = await this.costos.catalogo(em, t.id);
    const cu = (p: Producto) => r2(this.costos.costoUnitario(cat.get(p.id), cat, t.tarifaMinuto));
    const ventas: [number, Cliente, [Producto, number, number?][], EstadoVenta, number, number?][] = [
      [-75, cafe, [[llav, 50], [dis, 1]], EstadoVenta.Entregada, 1],
      [-52, escuela, [[reco, 30, 350]], EstadoVenta.Entregada, 1],
      [-35, laura, [[tazaS, 12]], EstadoVenta.Entregada, 1],
      [-19, cafe, [[tazaS, 40, 110]], EstadoVenta.Entregada, 1],
      [-7, escuela, [[llav, 100, 30]], EstadoVenta.Produccion, 0.5],
      [-2, laura, [[tazaS, 6], [dis, 1]], EstadoVenta.Pendiente, 0.3, promo.id],
    ];
    let n = 0;
    for (const [dias, c, items, estado, pagoPct, promoId] of ventas) {
      n++;
      const v = em.create(Venta, {
        tallerId: t.id, sucursalId: s.id, folio: `VTA-${String(n).padStart(4, '0')}`, fecha: sumarDias(hoy(), dias), clienteId: c.id,
        estado, entrega: sumarDias(hoy(), dias + 4), tokenPublico: token(), stockAplicado: false,
        descuentoTipo: 'pct', descuentoValor: promoId ? 10 : 0, promocionId: promoId ?? null,
        items: items.map(([p, cantidad, precio]) => em.create(VentaItem, { productoId: p.id, descripcion: p.nombre.replace(' (ejemplo)', ''), cantidad, precio: precio ?? p.precio, costo: cu(p) })),
      });
      const sub = v.items.reduce((a, i) => a + i.cantidad * i.precio, 0);
      v.subtotal = r2(sub);
      v.descuento = r2((sub * v.descuentoValor) / 100);
      v.total = r2(sub - v.descuento);
      v.costo = r2(v.items.reduce((a, i) => a + i.cantidad * i.costo, 0));
      v.pagado = r2(v.total * pagoPct);
      v.pagos = [em.create(Pago, { fecha: v.fecha, monto: v.pagado, metodo: 'Transferencia' })];
      await em.save(v);
    }
    await em.save(em.create(Folio, { tallerId: t.id, tipo: 'VTA', ultimo: n }));
  }
}
