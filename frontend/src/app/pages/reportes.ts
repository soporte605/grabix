import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, fecha, PctPipe } from '../core/formato';
import { SesionService } from '../core/sesion.service';
import { Esqueleto } from '../ui/esqueleto';
import { FiltroFechas, Rango, rangoDe } from '../ui/filtro-fechas';
import { Icono } from '../ui/icono';

interface Fila { clave: string; ventas?: number; pagos?: number; cantidad?: number; total: number; ganancia?: number }
interface Reporte {
  desde: string; hasta: string;
  totales: { ventas: number; total: number; ganancia: number; margen: number | null; ticketPromedio: number; cobrado: number; porCobrar: number; descuentos: number; canceladas: number };
  porDia: Fila[]; porMetodo: Fila[]; porProducto: Fila[]; porVendedor: Fila[]; porCliente: Fila[];
}
type Vista = 'porDia' | 'porMetodo' | 'porProducto' | 'porVendedor' | 'porCliente';

const VISTAS: { id: Vista; texto: string; clave: string; cuenta: 'ventas' | 'pagos' | 'cantidad'; cuentaTexto: string }[] = [
  { id: 'porDia', texto: 'Por día', clave: 'Día', cuenta: 'ventas', cuentaTexto: 'Ventas' },
  { id: 'porMetodo', texto: 'Forma de pago', clave: 'Forma de pago', cuenta: 'pagos', cuentaTexto: 'Pagos' },
  { id: 'porProducto', texto: 'Productos', clave: 'Producto', cuenta: 'cantidad', cuentaTexto: 'Cantidad' },
  { id: 'porVendedor', texto: 'Vendedores', clave: 'Vendedor', cuenta: 'ventas', cuentaTexto: 'Ventas' },
  { id: 'porCliente', texto: 'Clientes', clave: 'Cliente', cuenta: 'ventas', cuentaTexto: 'Ventas' },
];

/** Reporte de ventas del periodo, con tablas por día, forma de pago, producto, vendedor y cliente, descargables en CSV. */
@Component({
  selector: 'app-reportes',
  imports: [DineroPipe, PctPipe, FiltroFechas, Icono, Esqueleto],
  template: `
    <div class="encabezado">
      <div><h1>Reportes de ventas</h1><p>{{ s.nombreSucursal() }} · {{ periodoTxt() }}</p></div>
      <button class="btn" (click)="csv()" [disabled]="!filas().length"><app-icono nombre="descargar" />Descargar Excel (CSV)</button>
    </div>
    <div class="mb-3"><app-filtro-fechas [rango]="rango" inicial="mes" [opciones]="['hoy', 'semana', 'mes', 'mes_pasado', 'anio', 'fechas']" (rangoChange)="cambiarRango($event)" /></div>
    @if (r(); as r) {
      <div class="kpis">
        <div class="tarjeta kpi destacado"><div class="l">Vendido</div><div class="v">{{ r.totales.total | dinero }}</div><div class="s">{{ r.totales.ventas }} {{ r.totales.ventas === 1 ? 'venta' : 'ventas' }} · ticket {{ r.totales.ticketPromedio | dinero }}</div></div>
        <div class="tarjeta kpi"><div class="l">Ganancia bruta</div><div class="v">{{ r.totales.ganancia | dinero }}</div><div class="s">Margen {{ r.totales.margen | pct }}</div></div>
        <div class="tarjeta kpi"><div class="l">Cobrado</div><div class="v">{{ r.totales.cobrado | dinero }}</div><div class="s">Por cobrar {{ r.totales.porCobrar | dinero }}</div></div>
        <div class="tarjeta kpi"><div class="l">Descuentos</div><div class="v">{{ r.totales.descuentos | dinero }}</div><div class="s">{{ r.totales.canceladas }} {{ r.totales.canceladas === 1 ? 'venta cancelada' : 'ventas canceladas' }}</div></div>
      </div>
      <div class="chips mb-3">
        @for (v of vistas; track v.id) { <button class="chip" [class.on]="vista() === v.id" (click)="vista.set(v.id)">{{ v.texto }}</button> }
      </div>
      <div class="tarjeta overflow-x-auto">
        <table class="w-full min-w-[560px] text-base">
          <thead><tr class="border-b border-linea text-left text-xs font-semibold tracking-[.06em] text-tenue uppercase">
            <th class="px-4 py-2.5">{{ def().clave }}</th>
            <th class="px-3 py-2.5 text-right">{{ def().cuentaTexto }}</th>
            <th class="w-[34%] px-3 py-2.5 text-right">Total</th>
            @if (vista() !== 'porMetodo') { <th class="px-4 py-2.5 text-right">Ganancia</th> }
          </tr></thead>
          <tbody>
            @for (f of filas(); track f.clave) {
              <tr class="border-b border-linea last:border-0">
                <td class="px-4 py-2.5">{{ vista() === 'porDia' ? fechaTxt(f.clave) : f.clave }}</td>
                <td class="num px-3 py-2.5 text-right">{{ f[def().cuenta] }}</td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center justify-end gap-2.5">
                    <span class="hidden h-2 flex-1 overflow-hidden rounded-full bg-superficie-2 sm:block"><span class="block h-full rounded-full bg-marca" [style.width.%]="maximo() ? f.total / maximo() * 100 : 0"></span></span>
                    <span class="num w-28 text-right">{{ f.total | dinero }}</span>
                  </div>
                </td>
                @if (vista() !== 'porMetodo') { <td class="num px-4 py-2.5 text-right">{{ f.ganancia | dinero }}</td> }
              </tr>
            } @empty { <tr><td colspan="4" class="p-6 text-center text-tenue">Sin ventas en este periodo.</td></tr> }
          </tbody>
          @if (filas().length > 1) {
            <tfoot><tr class="border-t-2 border-linea font-semibold">
              <td class="px-4 py-2.5">Total</td><td class="num px-3 py-2.5 text-right">{{ suma(def().cuenta) }}</td>
              <td class="num px-3 py-2.5 text-right">{{ suma('total') | dinero }}</td>
              @if (vista() !== 'porMetodo') { <td class="num px-4 py-2.5 text-right">{{ suma('ganancia') | dinero }}</td> }
            </tr></tfoot>
          }
        </table>
      </div>
      @if (vista() === 'porMetodo') { <p class="chico tenue mt-2">Forma de pago cuenta los cobros recibidos en el periodo (incluye abonos a ventas de otros días).</p> }
    } @else { <app-esqueleto tipo="inicio" /> }
  `,
})
export class Reportes implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  vistas = VISTAS;
  vista = signal<Vista>('porDia');
  rango: Rango = rangoDe('mes');
  r = signal<Reporte | null>(null);
  def = computed(() => VISTAS.find((v) => v.id === this.vista())!);
  filas = computed(() => this.r()?.[this.vista()] ?? []);
  maximo = computed(() => Math.max(0, ...this.filas().map((f) => f.total)));
  periodoTxt = computed(() => { const r = this.r(); return r ? (r.desde === r.hasta ? fecha(r.desde) : `${fecha(r.desde)} al ${fecha(r.hasta)}`) : ''; });

  ngOnInit() { this.cargar(); }
  cambiarRango(r: Rango) {
    // "Cualquier fecha" no aplica a un reporte: se usa el año.
    this.rango = r.desde || r.hasta ? r : rangoDe('anio');
    this.cargar();
  }
  async cargar() {
    const h = rangoDe('hoy').hasta;
    try { this.r.set(await this.api.get<Reporte>('/reportes/ventas', { desde: this.rango.desde || '2000-01-01', hasta: this.rango.hasta || h })); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }
  fechaTxt(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); }
  suma(k: keyof Fila) { return Math.round(this.filas().reduce((a, f) => a + (Number(f[k]) || 0), 0) * 100) / 100; }

  csv() {
    const d = this.def();
    const conGanancia = this.vista() !== 'porMetodo';
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [
      [d.clave, d.cuentaTexto, 'Total', ...(conGanancia ? ['Ganancia'] : [])],
      ...this.filas().map((f) => [f.clave, f[d.cuenta] ?? 0, f.total.toFixed(2), ...(conGanancia ? [(f.ganancia ?? 0).toFixed(2)] : [])]),
    ];
    const texto = '﻿' + filas.map((x) => x.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    a.download = `ventas-${d.texto.toLowerCase().replace(/\s+/g, '-')}-${this.r()!.desde}-a-${this.r()!.hasta}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
