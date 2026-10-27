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
  template: `
    <div class="encabezado">
      <div><h1>{{ s.taller()?.nombre }}</h1><p>{{ s.nombreSucursal() }} · {{ hoyTxt | fecha }}</p></div>
      <div class="fila">
        <a class="btn pri" routerLink="../cotizaciones/nueva"><app-icono nombre="mas1" />Cotización</a>
        <a class="btn" routerLink="../ventas/nueva"><app-icono nombre="mas1" />Venta</a>
        <a class="btn" routerLink="../compras"><app-icono nombre="mas1" />Compra</a>
      </div>
    </div>
    <div class="chips mb-3">
      @for (p of periodos; track p[0]) { <button class="chip" [class.on]="periodo() === p[0]" (click)="cambiar(p[0])">{{ p[1] }}</button> }
    </div>
    @if (e(); as e) {
      <div class="kpis">
        <div class="tarjeta kpi destacado"><div class="l">Ventas</div><div class="v">{{ e.ventas | dinero }}</div><div class="s">{{ e.pedidos }} pedidos · ticket {{ e.ticketPromedio | dinero }}</div></div>
        <div class="tarjeta kpi"><div class="l">Ganancia bruta</div><div class="v">{{ e.ganancia | dinero }}</div><div class="s">Margen {{ e.margen | pct }}</div></div>
        <div class="tarjeta kpi"><div class="l">Cobrado</div><div class="v">{{ e.cobrado | dinero }}</div><div class="s">Por cobrar {{ e.porCobrar | dinero }}</div></div>
        <div class="tarjeta kpi"><div class="l">Compras</div><div class="v">{{ e.compras | dinero }}</div><div class="s">Cotizaciones aceptadas {{ e.cotizaciones.aceptadas }}/{{ e.cotizaciones.total }}</div></div>
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
  private api = inject(Api);
  est = EST_VTA;
  hoyTxt = hoy();
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
