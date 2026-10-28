import { Esqueleto } from '../ui/esqueleto';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { FechaPipe, hoy, sumarDias } from '../core/formato';
import { EST_VTA, EstadoVenta, Venta } from '../core/modelos';
import { Icono } from '../ui/icono';

const COLUMNAS: EstadoVenta[] = ['pendiente', 'produccion', 'lista'];
const SIGUIENTE: Partial<Record<EstadoVenta, [EstadoVenta, string]>> = {
  pendiente: ['produccion', 'Empezar'],
  produccion: ['lista', 'Terminado'],
  lista: ['entregada', 'Entregar'],
};

/** Tablero de pedidos por hacer: pendiente → en producción → listo → entregado. */
@Component({
  selector: 'app-produccion',
  imports: [FormsModule, FechaPipe, Icono, Esqueleto],
  template: `
    <div class="encabezado"><div class="titulo"><span class="icono-modulo"><app-icono nombre="produccion" /></span><div><h1>Producción</h1><p>Pedidos por hacer, ordenados por fecha de entrega.</p></div></div></div>
    <div class="mb-3 flex flex-col gap-2.5">
      <input class="buscar" type="search" placeholder="Buscar por folio, cliente o producto" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Buscar">
      <div class="chips" role="group" aria-label="Fecha de entrega">
        @for (o of entregas; track o[0]) { <button class="chip" [class.on]="entrega() === o[0]" (click)="entrega.set(o[0])">{{ o[1] }}</button> }
      </div>
    </div>
    @if (!listo()) { <app-esqueleto tipo="tablero" /> } @else {
    <div class="grid gap-3.5 min-[900px]:grid-cols-3">
      @for (c of columnas; track c) {
        <section class="flex min-w-0 flex-col gap-2.5">
          <h2 class="flex items-center gap-2 text-base">{{ est[c][0] }} <span class="pill" [class]="est[c][1]">{{ de(c).length }}</span></h2>
          @for (v of de(c); track v.id) {
            <article class="tarjeta flex flex-col gap-1.5 p-3" [class.border-bad]="v.entrega && v.entrega < hoy">
              <div class="fila entre"><b class="num">{{ v.folio }}</b><span class="chico" [class]="v.entrega && v.entrega < hoy ? 'font-semibold text-bad' : ''">Entrega {{ v.entrega ? (v.entrega | fecha) : 'sin fecha' }}</span></div>
              <div>{{ v.cliente?.nombre || v.clienteNombre || 'Mostrador' }}</div>
              <ul class="list-disc pl-[1.1em] text-base">@for (i of v.items; track $index) { <li><b>{{ i.cantidad }}</b> × {{ i.descripcion }}</li> }</ul>
              @if (v.notas) { <p class="chico tenue">{{ v.notas }}</p> }
              <div class="fila">
                <button class="btn sm pri" (click)="mover(v, siguiente[c]![0])">{{ siguiente[c]![1] }}</button>
                <button class="btn sm" (click)="pdf(v)"><app-icono nombre="pdf" />Orden</button>
              </div>
            </article>
          } @empty { <p class="tenue chico">Nada aquí.</p> }
        </section>
      }
    </div>
    }
  `,
})
export class Produccion implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  est = EST_VTA;
  columnas = COLUMNAS;
  siguiente = SIGUIENTE;
  hoy = hoy();
  q = signal('');
  entrega = signal<'todas' | 'atrasados' | 'hoy' | 'semana'>('todas');
  entregas = [['todas', 'Todas'], ['atrasados', 'Atrasados'], ['hoy', 'Para hoy'], ['semana', 'Próximos 7 días']] as const;
  private filtradas = computed(() => {
    const q = this.q().trim().toLowerCase(), e = this.entrega(), h = this.hoy, sem = sumarDias(h, 7);
    return this.ventas().filter((v) => {
      const f = v.entrega ? String(v.entrega).slice(0, 10) : '';
      if (e === 'atrasados' && !(f && f < h)) return false;
      if (e === 'hoy' && f !== h) return false;
      if (e === 'semana' && !(f && f >= h && f <= sem)) return false;
      if (!q) return true;
      const t = `${v.folio} ${v.cliente?.nombre ?? ''} ${v.clienteNombre ?? ''} ${v.items.map((i) => i.descripcion).join(' ')}`.toLowerCase();
      return t.includes(q);
    });
  });
  ventas = signal<Venta[]>([]);
  listo = signal(false);

  ngOnInit() { this.cargar(); }
  async cargar() {
    const vs = await this.api.get<Venta[]>('/ventas', { estado: COLUMNAS.join(',') });
    this.ventas.set(vs.sort((a, b) => String(a.entrega ?? '9').localeCompare(String(b.entrega ?? '9'))));
    this.listo.set(true);
  }
  de(e: EstadoVenta) { return this.filtradas().filter((v) => v.estado === e); }
  async mover(v: Venta, estado: EstadoVenta) {
    try {
      await this.api.patch(`/ventas/${v.id}/estado`, { estado });
      this.aviso.ok(`${v.folio}: ${EST_VTA[estado][0]}`);
      await this.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
  pdf(v: Venta) { this.api.abrirPdf(`/ventas/${v.id}/pdf`).catch((e) => this.aviso.error(mensajeError(e))); }
}
