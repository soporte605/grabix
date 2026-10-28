import { Esqueleto } from '../ui/esqueleto';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { DineroPipe, FechaPipe, hoy, PctPipe } from '../core/formato';
import { EST_VTA, Estadisticas } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Grafica } from '../ui/grafica';
import { Icono } from '../ui/icono';

type Periodo = 'mes' | 'anterior' | 'anio' | 'doce';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, DineroPipe, FechaPipe, PctPipe, Grafica, Icono, Esqueleto],
  styles: `
    .saludo { background: linear-gradient(120deg, var(--superficie) 55%, var(--marca-suave)); }
    .kpis.chicos .v { font-size: 1.05rem; }
    .corte { stroke-dasharray: 100; stroke-dashoffset: 100; animation: cortar 6s ease-in-out infinite; }
    .cabezal { offset-path: path('M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5'); animation: recorre 6s ease-in-out infinite; }
    .cabezal circle:first-child { animation: chispa .25s ease-in-out infinite alternate; transform-origin: center; }
    @keyframes cortar { 0%, 8% { stroke-dashoffset: 100; } 70%, 88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; opacity: 0; } }
    @keyframes recorre { 0%, 8% { offset-distance: 0%; opacity: 1; } 70% { offset-distance: 100%; opacity: 1; } 78%, 100% { offset-distance: 100%; opacity: 0; } }
    @keyframes chispa { to { transform: scale(.7); opacity: .6; } }
    @media (prefers-reduced-motion: reduce) {
      .corte { animation: none; stroke-dashoffset: 0; }
      .cabezal { display: none; }
    }
  `,
  template: `
    <section class="tarjeta saludo relative mb-3.5 grid items-center gap-4 overflow-hidden px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-6">
      <div class="min-w-0">
        <p class="text-[.8rem] text-tenue">{{ s.nombreSucursal() }} · {{ hoyLargo }}</p>
        <h1 class="mt-0.5 text-[1.5rem] leading-tight sm:text-[1.75rem]">{{ saludo }}, {{ nombre() }}</h1>
        <p class="mt-1 text-tenue">
          @if (e(); as e) {
            @if (e.hoy.pedidos) { Hoy llevas <b class="num text-tinta">{{ e.hoy.ventas | dinero }}</b> en {{ e.hoy.pedidos }} {{ e.hoy.pedidos === 1 ? 'venta' : 'ventas' }}. }
            @else { Aún no hay ventas hoy. }
            @if (e.atrasados) { Tienes <a routerLink="../produccion" class="font-semibold text-bad">{{ e.atrasados }} {{ e.atrasados === 1 ? 'pedido atrasado' : 'pedidos atrasados' }}</a>. }
            @else if (e.pendientes.length) { {{ e.pendientes.length }} {{ e.pendientes.length === 1 ? 'pedido' : 'pedidos' }} por entregar. }
          } @else { Preparando tu resumen… }
        </p>
        <div class="fila mt-3.5">
          <a class="btn pri" routerLink="../caja"><app-icono nombre="caja" />Abrir caja</a>
          <a class="btn" routerLink="../cotizaciones/nueva"><app-icono nombre="mas1" />Cotización</a>
          <a class="btn" routerLink="../ventas/nueva"><app-icono nombre="mas1" />Venta</a>
          <a class="btn" routerLink="../compras"><app-icono nombre="mas1" />Compra</a>
        </div>
      </div>
      <!-- Animación: el cabezal láser recorre y corta la G del logo sobre una lámina. -->
      <svg class="laser hidden w-[230px] sm:block" viewBox="0 0 200 150" aria-hidden="true">
        <defs>
          <pattern id="rejilla" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="var(--linea)" stroke-width=".6" /></pattern>
          <radialGradient id="brillo"><stop offset="0" stop-color="#67BE28" stop-opacity=".9" /><stop offset="1" stop-color="#67BE28" stop-opacity="0" /></radialGradient>
        </defs>
        <rect x="18" y="14" width="164" height="122" rx="10" fill="var(--superficie-2)" stroke="var(--linea)" />
        <rect x="18" y="14" width="164" height="122" rx="10" fill="url(#rejilla)" />
        <g transform="translate(52 27) scale(1.5)">
          <path d="M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5" fill="none" stroke="var(--linea)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
          <path class="corte" pathLength="100" d="M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5" fill="none" stroke="var(--marca)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
          <g class="cabezal">
            <circle r="7" fill="url(#brillo)" />
            <circle r="1.8" fill="#67BE28" />
          </g>
        </g>
      </svg>
    </section>
    @if (e(); as e) {
      <div class="chips mb-3">
        @for (p of periodos; track p[0]) { <button class="chip" [class.on]="periodo() === p[0]" (click)="cambiar(p[0])">{{ p[1] }}</button> }
      </div>
      <div class="kpis">
        <div class="tarjeta kpi destacado"><div class="l">Ventas</div><div class="v">{{ e.ventas | dinero }}</div>
          <div class="s">@if (cambio(); as c) { {{ c > 0 ? '▲' : c < 0 ? '▼' : '=' }} {{ (c < 0 ? -c : c) | pct }} vs. periodo anterior } @else { {{ e.pedidos }} {{ e.pedidos === 1 ? 'pedido' : 'pedidos' }} }</div></div>
        <div class="tarjeta kpi"><div class="l">Ganancia bruta</div><div class="v">{{ e.ganancia | dinero }}</div><div class="s">Margen {{ e.margen | pct }}</div></div>
        <div class="tarjeta kpi"><div class="l">Cobrado</div><div class="v">{{ e.cobrado | dinero }}</div><div class="s">Compras {{ e.compras | dinero }}</div></div>
        <div class="tarjeta kpi"><div class="l">Por cobrar</div><div class="v" [class.text-warn]="e.porCobrar > 0">{{ e.porCobrar | dinero }}</div><div class="s">Saldos de pedidos abiertos</div></div>
      </div>
      <div class="kpis chicos">
        <div class="tarjeta kpi"><div class="l">Ticket promedio</div><div class="v">{{ e.ticketPromedio | dinero }}</div><div class="s">{{ e.pedidos }} {{ e.pedidos === 1 ? 'pedido' : 'pedidos' }}</div></div>
        <div class="tarjeta kpi"><div class="l">Cotizaciones cerradas</div><div class="v">{{ e.cotizaciones.total ? (e.cotizaciones.aceptadas / e.cotizaciones.total | pct) : '—' }}</div>
          <div class="s">{{ e.cotizaciones.aceptadas }} de {{ e.cotizaciones.total }} · {{ e.cotizaciones.abiertas }} en espera</div></div>
        <a class="tarjeta kpi block no-underline hover:border-tenue" routerLink="../produccion"><div class="l">Pedidos atrasados</div><div class="v" [class.text-bad]="e.atrasados">{{ e.atrasados }}</div><div class="s">{{ e.atrasados ? 'Ya pasó su fecha de entrega' : 'Todo a tiempo' }}</div></a>
        <div class="tarjeta kpi"><div class="l">Clientes nuevos</div><div class="v">{{ e.clientesNuevos }}</div><div class="s">Registrados en el periodo</div></div>
      </div>
      <div class="grid gap-3.5 min-[1000px]:grid-cols-[1.4fr_1fr]">
        <div class="rejilla">
          <section class="tarjeta pad">
            <div class="fila entre mb-2"><h2>Últimos 12 meses</h2>
              <span class="flex items-center gap-[5px] text-[.8rem] text-tenue"><i class="ml-2 inline-block size-2.5 rounded-[2px] bg-marca"></i>Ventas <i class="ml-2 inline-block size-2.5 rounded-[2px] bg-acento"></i>Ganancia</span></div>
            <app-grafica [serie]="e.serie" />
          </section>
          <section class="tarjeta">
            <div class="fila entre px-4 pt-3.5 pb-1.5"><h2>Pedidos por entregar</h2><a routerLink="../produccion" class="chico">Ver producción</a></div>
            <div class="lista">
              @for (v of e.pendientes; track v.id) {
                <a class="renglon" [routerLink]="['../ventas', v.id]">
                  <span class="t">{{ v.cliente }}</span><span class="d num">{{ v.total | dinero }}</span>
                  <span class="m"><span class="num">{{ v.folio }}</span> · Entrega {{ v.entrega ? (v.entrega | fecha) : 'sin fecha' }}</span>
                  <span class="d"><span class="pill" [class]="est[v.estado][1]">{{ est[v.estado][0] }}</span></span>
                </a>
              } @empty { <div class="vacio"><b>Sin pedidos pendientes</b>Cuando registres una venta aparecerá aquí.</div> }
            </div>
          </section>
        </div>
        <div class="rejilla content-start">
          <section class="tarjeta">
            <div class="fila entre px-4 pt-3.5 pb-1.5"><h2>Lo que más te deja</h2></div>
            <div class="lista">
              @for (t of e.top; track t.descripcion) {
                <div class="renglon cursor-default hover:bg-transparent"><span class="t">{{ t.descripcion }}</span><span class="d num">{{ t.ganancia | dinero }}</span>
                  <span class="m">{{ t.cantidad }} vendidos · {{ t.ventas | dinero }}</span><span class="d m">{{ t.ventas ? (t.ganancia / t.ventas | pct) : '' }}</span></div>
              } @empty { <div class="vacio">Sin ventas en el periodo</div> }
            </div>
          </section>
          <section class="tarjeta">
            <div class="fila entre px-4 pt-3.5 pb-1.5"><h2>Stock bajo</h2><a routerLink="../inventario" class="chico">Inventario</a></div>
            <div class="lista">
              @for (p of e.stockBajo; track p.id) {
                <div class="renglon cursor-default hover:bg-transparent"><span class="t">{{ p.nombre }}</span><span class="d num text-bad">{{ p.existencia }} {{ p.unidad }}</span><span class="m">Mínimo {{ p.minimo }}</span><span></span></div>
              } @empty { <div class="vacio"><b>Todo en orden</b>Ningún insumo está por debajo de su mínimo.</div> }
            </div>
          </section>
        </div>
      </div>
    } @else { <app-esqueleto tipo="inicio" /> }
  `,
})
export class Inicio implements OnInit {
  s = inject(SesionService);
  saludo = ((h) => (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'))(new Date().getHours());
  nombre = computed(() => (this.s.perfil()?.usuario.nombre ?? '').split(' ')[0]);
  cambio = computed(() => { const e = this.e(); return e && e.ventasAnterior ? (e.ventas - e.ventasAnterior) / e.ventasAnterior : null; });
  private api = inject(Api);
  est = EST_VTA;
  hoyLargo = ((t) => t[0].toUpperCase() + t.slice(1))(new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
  periodos: [Periodo, string][] = [['mes', 'Este mes'], ['anterior', 'Mes pasado'], ['anio', 'Este año'], ['doce', 'Últimos 12 meses']];
  periodo = signal<Periodo>('mes');
  e = signal<Estadisticas | null>(null);
  rango = computed(() => {
    const h = hoy();
    const [y, m] = h.split('-').map(Number);
    const ini = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
    switch (this.periodo()) {
      case 'anterior': {
        const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
        const fin = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
        return { desde: ini(py, pm), hasta: fin };
      }
      case 'anio': return { desde: `${y}-01-01`, hasta: h };
      case 'doce': return { desde: ini(m === 12 ? y : y - 1, m === 12 ? 1 : m + 1), hasta: h };
      default: return { desde: ini(y, m), hasta: h };
    }
  });

  ngOnInit() { this.cargar(); }
  cambiar(p: Periodo) { this.periodo.set(p); this.cargar(); }
  async cargar() { this.e.set(await this.api.get<Estadisticas>('/estadisticas', this.rango())); }
}
