import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { dinero, FechaPipe, hoy, sumarDias } from '../core/formato';
import { EtapaTaller, ETAPAS, Maquina, OrdenTaller } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Esqueleto } from '../ui/esqueleto';
import { Icono } from '../ui/icono';
import { OrdenTallerVentana } from '../ui/orden-taller';
import { VistaDocumento } from '../ui/vista-documento';

const COLUMNAS = Object.keys(ETAPAS) as EtapaTaller[];

/** Minutos legibles: "45 min", "2 h 10 min". */
export const duracion = (m: number) => {
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};

/**
 * Tablero del taller: cada pedido pasa por diseño, aprobación, cola, máquina, acabado y listo.
 * Muestra la carga de cada máquina con los minutos del costeo, el avance por pieza y lo atrasado.
 */
@Component({
  selector: 'app-produccion',
  imports: [FormsModule, FechaPipe, Icono, Esqueleto, OrdenTallerVentana, VistaDocumento],
  styles: `
    .tablero { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(215px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .columna.sobre { outline: 2px dashed var(--acento); outline-offset: 2px; border-radius: 14px; }
    .tarjeta-orden[draggable='true'] { cursor: grab; }
    /* En el teléfono los chips van en una fila que se desliza, en lugar de ocupar media pantalla. */
    @media (max-width: 767px) { .deslizar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -16px; padding-inline: 16px; } .deslizar .chip { white-space: nowrap; flex: none; } }
  `,
  template: `
    <div class="encabezado">
      <div class="titulo"><span class="icono-modulo"><app-icono nombre="produccion" /></span>
        <div><h1>Producción</h1><p>{{ s.nombreSucursal() }} · {{ activas().length }} {{ activas().length === 1 ? 'pedido' : 'pedidos' }} en el taller</p></div></div>
    </div>

    <!-- Resumen del día -->
    <div class="kpis chicos">
      <button class="tarjeta kpi text-left" [class.border-bad]="resumen().atrasados" (click)="entrega.set('atrasados')">
        <div class="l">Atrasados</div><div class="v" [class.text-bad]="resumen().atrasados">{{ resumen().atrasados }}</div><div class="s">Entrega ya pasó</div></button>
      <button class="tarjeta kpi text-left" (click)="entrega.set('hoy')"><div class="l">Para hoy</div><div class="v">{{ resumen().hoy }}</div><div class="s">{{ resumen().semana }} en los próximos 7 días</div></button>
      <div class="tarjeta kpi max-md:hidden"><div class="l">Máquina por hacer</div><div class="v">{{ duracion(resumen().minutos) }}</div><div class="s">En cola y en máquina</div></div>
      <div class="tarjeta kpi max-md:hidden"><div class="l">Por máquina</div>
        @for (m of cargaMaquinas(); track m.nombre) { <div class="s flex justify-between gap-2"><span class="truncate">{{ m.nombre }}</span><span class="num">{{ duracion(m.minutos) }}</span></div> }
        @empty { <div class="s">Asigna máquina a los pedidos para ver su carga.</div> }
      </div>
    </div>

    <!-- Filtros -->
    <div class="mb-3 flex flex-col gap-2.5">
      <div class="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <input class="buscar col-span-2" type="search" placeholder="Buscar por folio, cliente o producto" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Buscar">
        <select class="entrada min-w-0 md:w-auto md:max-w-[220px]" [ngModel]="maquina()" (ngModelChange)="maquina.set($event)" aria-label="Máquina">
          <option [ngValue]="0">Todas las máquinas</option><option [ngValue]="-1">Sin máquina</option>
          @for (m of maquinas(); track m.id) { <option [ngValue]="m.id">{{ m.nombre }}</option> }
        </select>
        <select class="entrada min-w-0 md:w-auto md:max-w-[220px]" [ngModel]="responsable()" (ngModelChange)="responsable.set($event)" aria-label="Responsable">
          <option [ngValue]="0">Todo el equipo</option><option [ngValue]="-1">Sin responsable</option>
          @for (u of equipo(); track u.id) { <option [ngValue]="u.id">{{ u.nombre }}</option> }
        </select>
      </div>
      <div class="chips deslizar" role="group" aria-label="Fecha de entrega">
        @for (o of entregas; track o[0]) { <button class="chip" [class.on]="entrega() === o[0]" (click)="entrega.set(o[0])">{{ o[1] }}</button> }
        <button class="chip" [class.on]="soloUrgentes()" (click)="soloUrgentes.set(!soloUrgentes())">Solo urgentes</button>
      </div>
    </div>

    @if (!listo()) { <app-esqueleto tipo="tablero" /> } @else {
      <!-- En el teléfono se ve una etapa a la vez -->
      <div class="chips deslizar mb-3 md:hidden" role="tablist" aria-label="Etapas">
        @for (c of columnas; track c) {
          <button class="chip" role="tab" [class.on]="etapaMovil() === c" [attr.aria-selected]="etapaMovil() === c" (click)="etapaMovil.set(c)">{{ etapas[c].nombre }} · {{ de(c).length }}</button>
        }
      </div>
      <div class="tablero">
        @for (c of columnas; track c) {
          <section class="columna flex min-w-0 flex-col gap-2.5" [class.max-md:hidden]="etapaMovil() !== c" [class.sobre]="sobre() === c"
            (dragover)="$event.preventDefault(); sobre.set(c)" (dragleave)="sobre.set(null)" (drop)="soltar(c)" [attr.aria-label]="etapas[c].nombre">
            <h2 class="flex items-center gap-2 text-base max-md:hidden">{{ etapas[c].nombre }} <span class="pill" [class]="etapas[c].clase">{{ de(c).length }}</span></h2>
            @for (o of de(c); track o.id) {
              <article class="tarjeta tarjeta-orden flex flex-col gap-2 p-3" [class.border-bad]="atrasado(o)" [attr.draggable]="escritorio"
                (dragstart)="arrastrando = o" (dragend)="arrastrando = null; sobre.set(null)">
                <button type="button" class="flex flex-col gap-1.5 text-left" (click)="abrir(o)">
                  <span class="flex items-center justify-between gap-2">
                    <b class="num">{{ o.folio }}</b>
                    @if (o.urgente) { <span class="pill bad">Urgente</span> }
                  </span>
                  <span class="font-semibold leading-snug">{{ cliente(o) }}</span>
                  <span class="chico" [class]="atrasado(o) ? 'font-semibold text-bad' : 'tenue'">Entrega {{ o.entrega ? (o.entrega | fecha) : 'sin fecha' }}@if (atrasado(o)) { · atrasado }</span>
                  <ul class="text-sm">@for (i of o.items; track i.id) { <li class="flex justify-between gap-2"><span class="min-w-0 truncate">{{ i.descripcion }}</span><span class="num flex-none tenue">{{ i.hechos }}/{{ i.cantidad }}</span></li> }</ul>
                  <span class="h-1.5 overflow-hidden rounded-full bg-superficie-2"><span class="block h-full rounded-full bg-acento" [style.width.%]="o.piezas ? o.hechas / o.piezas * 100 : 0"></span></span>
                  <span class="flex flex-wrap gap-1.5 text-xs">
                    <span class="pill mut">{{ nombreMaquina(o.maquinaId) }}</span>
                    @if (o.responsableId) { <span class="pill mut">{{ nombreUsuario(o.responsableId) }}</span> }
                    @if (o.minutos) { <span class="pill mut">{{ duracion(o.minutos) }}</span> }
                  </span>
                </button>
                <div class="fila">
                  @if (etapas[c].siguiente; as sg) { <button class="btn sm pri flex-1 justify-center" (click)="mover(o, sg[0])">{{ sg[1] }}<app-icono nombre="der" /></button> }
                  @else { <button class="btn sm pri flex-1 justify-center" (click)="entregar(o)">Entregar</button> }
                  <button class="btn sm" (click)="vista.set(o)" title="Ver orden" aria-label="Ver orden {{ o.folio }}"><app-icono nombre="ojo" /></button>
                </div>
              </article>
            } @empty { <p class="chico tenue rounded-xl border border-dashed border-linea p-3 text-center">Nada aquí.</p> }
          </section>
        }
      </div>
    }

    @if (abierta(); as o) {
      <app-orden-taller [orden]="o" [maquinas]="maquinas()" [equipo]="equipo()" (cerrar)="abierta.set(null)"
        (verOrden)="vista.set(o)" (cambio)="actualizado($event.orden, $event.antes)" />
    }
    @if (vista(); as v) { <app-vista-documento [venta]="$any(v)" modo="orden" (cerrar)="vista.set(null)" (cambio)="cargar()" /> }
  `,
})
export class Produccion implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  etapas = ETAPAS;
  columnas = COLUMNAS;
  duracion = duracion;
  hoy = hoy();
  /** El arrastre de tarjetas solo en pantallas con mouse. */
  escritorio = !matchMedia('(pointer: coarse)').matches;

  ordenes = signal<OrdenTaller[]>([]);
  maquinas = signal<Maquina[]>([]);
  equipo = signal<{ id: number; nombre: string }[]>([]);
  listo = signal(false);
  abierta = signal<OrdenTaller | null>(null);
  vista = signal<OrdenTaller | null>(null);
  etapaMovil = signal<EtapaTaller>('cola');
  sobre = signal<EtapaTaller | null>(null);
  arrastrando: OrdenTaller | null = null;

  q = signal('');
  maquina = signal(0);
  responsable = signal(0);
  soloUrgentes = signal(false);
  entrega = signal<'todas' | 'atrasados' | 'hoy' | 'semana'>('todas');
  entregas = [['todas', 'Todas'], ['atrasados', 'Atrasados'], ['hoy', 'Para hoy'], ['semana', 'Próximos 7 días']] as const;

  activas = computed(() => this.ordenes().filter((o) => o.etapa !== 'lista'));
  private filtradas = computed(() => {
    const q = this.q().trim().toLowerCase(), e = this.entrega(), h = this.hoy, sem = sumarDias(h, 7);
    const mq = this.maquina(), rs = this.responsable(), urg = this.soloUrgentes();
    return this.ordenes().filter((o) => {
      const f = this.fechaEntrega(o);
      if (e === 'atrasados' && !this.atrasado(o)) return false;
      if (e === 'hoy' && f !== h) return false;
      if (e === 'semana' && !(f && f >= h && f <= sem)) return false;
      if (mq && (mq === -1 ? o.maquinaId : o.maquinaId !== mq)) return false;
      if (rs && (rs === -1 ? o.responsableId : o.responsableId !== rs)) return false;
      if (urg && !o.urgente) return false;
      if (!q) return true;
      return `${o.folio} ${this.cliente(o)} ${o.items.map((i) => i.descripcion).join(' ')}`.toLowerCase().includes(q);
    });
  });
  resumen = computed(() => {
    const h = this.hoy, sem = sumarDias(h, 7), act = this.activas();
    return {
      atrasados: act.filter((o) => this.atrasado(o)).length,
      hoy: act.filter((o) => this.fechaEntrega(o) === h).length,
      semana: act.filter((o) => { const f = this.fechaEntrega(o); return f > h && f <= sem; }).length,
      minutos: act.filter((o) => o.etapa === 'cola' || o.etapa === 'maquina').reduce((a, o) => a + o.minutos, 0),
    };
  });
  cargaMaquinas = computed(() => {
    const m = new Map<number, number>();
    for (const o of this.activas()) if (o.maquinaId && o.minutos && ['cola', 'maquina', 'diseno', 'aprobacion'].includes(o.etapa)) m.set(o.maquinaId, (m.get(o.maquinaId) ?? 0) + o.minutos);
    return [...m].map(([id, minutos]) => ({ nombre: this.nombreMaquina(id), minutos })).sort((a, b) => b.minutos - a.minutos).slice(0, 3);
  });

  ngOnInit() { this.cargar(); }
  async cargar() {
    try {
      const r = await this.api.get<{ ordenes: OrdenTaller[]; maquinas: Maquina[]; equipo: { id: number; nombre: string }[] }>('/produccion');
      this.ordenes.set(r.ordenes);
      this.maquinas.set(r.maquinas);
      this.equipo.set(r.equipo);
      // En el teléfono abre en la primera etapa que tenga pedidos.
      if (!this.listo()) this.etapaMovil.set(COLUMNAS.find((c) => r.ordenes.some((o) => o.etapa === c)) ?? 'cola');
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.listo.set(true);
  }

  /** Pedidos de la columna: urgentes primero, luego por fecha de entrega. */
  de(e: EtapaTaller) {
    return this.filtradas().filter((o) => o.etapa === e)
      .sort((a, b) => Number(b.urgente) - Number(a.urgente) || (this.fechaEntrega(a) || '9').localeCompare(this.fechaEntrega(b) || '9'));
  }
  fechaEntrega(o: OrdenTaller) { return o.entrega ? String(o.entrega).slice(0, 10) : ''; }
  atrasado(o: OrdenTaller) { const f = this.fechaEntrega(o); return o.etapa !== 'lista' && !!f && f < this.hoy; }
  cliente(o: OrdenTaller) { return o.cliente?.nombre || o.clienteNombre || 'Mostrador'; }
  nombreMaquina(id: number | null) { return this.maquinas().find((m) => m.id === id)?.nombre ?? 'Sin máquina'; }
  nombreUsuario(id: number | null) { return this.equipo().find((u) => u.id === id)?.nombre.split(' ')[0] ?? ''; }

  abrir(o: OrdenTaller) { this.abierta.set(o); }

  soltar(e: EtapaTaller) {
    const o = this.arrastrando;
    this.sobre.set(null);
    this.arrastrando = null;
    if (o && o.etapa !== e) this.mover(o, e);
  }

  async mover(o: OrdenTaller, etapa: EtapaTaller) {
    // Se mueve en pantalla de inmediato; si el servidor lo rechaza, se recarga.
    this.ordenes.update((l) => l.map((x) => (x.id === o.id ? { ...x, etapa } : x)));
    try {
      await this.api.patch(`/produccion/${o.id}`, { etapa });
      this.aviso.ok(`${o.folio}: ${ETAPAS[etapa].nombre}`);
      if (etapa === 'lista') this.avisarListo({ ...o, etapa });
    } catch (e) {
      this.aviso.error(mensajeError(e));
      await this.cargar();
    }
  }

  actualizado(o: OrdenTaller, antes: EtapaTaller) {
    this.ordenes.update((l) => l.map((x) => (x.id === o.id ? o : x)));
    this.abierta.set(o);
    if (o.etapa !== antes) {
      this.aviso.ok(`${o.folio}: ${ETAPAS[o.etapa].nombre}`);
      if (o.etapa === 'lista') { this.abierta.set(null); this.avisarListo(o); }
    }
  }

  async entregar(o: OrdenTaller) {
    const saldo = Math.max(0, o.total - o.pagado);
    const ok = await this.confirmar.preguntar({
      titulo: `¿Entregar ${o.folio}?`,
      texto: saldo > 0 ? `Queda un saldo de ${dinero(saldo, this.s.taller()?.moneda)}. Cóbralo en Ventas o en Caja.` : 'Sale del tablero y queda como entregado en Ventas.',
      accion: 'Entregar',
    });
    if (!ok) return;
    try {
      await this.api.patch(`/ventas/${o.id}/estado`, { estado: 'entregada' });
      this.ordenes.update((l) => l.filter((x) => x.id !== o.id));
      this.aviso.ok(`${o.folio} entregado`);
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }

  /** Al quedar listo, ofrece mandarle al cliente el WhatsApp de "tu pedido está listo". */
  private async avisarListo(o: OrdenTaller) {
    if (this.s.rol() === 'produccion') return;
    let tel = (o.cliente?.telefono || o.clienteTelefono || '').replace(/\D/g, '');
    if (!tel) return;
    if (tel.length === 10) tel = (this.s.taller()?.lada ?? '') + tel;
    const ok = await this.confirmar.preguntar({
      titulo: `${o.folio} está listo`, texto: `¿Le avisamos a ${this.cliente(o)} por WhatsApp?`, accion: 'Avisar por WhatsApp',
    });
    if (!ok) return;
    const taller = (this.s.taller()?.nombre ?? '').replace(/\s*\(ejemplo\)\s*$/i, '');
    const nombre = this.cliente(o).replace(/\s*\(ejemplo\)\s*$/i, '');
    const saldo = Math.max(0, o.total - o.pagado);
    const texto = `Hola ${nombre}, tu pedido ${o.folio} ya está listo para recoger en ${taller}.${saldo > 0 ? ` Queda un saldo de ${dinero(saldo, this.s.taller()?.moneda)}.` : ''} ¡Te esperamos!`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  }
}
