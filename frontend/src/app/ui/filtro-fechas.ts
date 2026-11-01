import { Component, computed, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { fecha, hoy, sumarDias } from '../core/formato';
import { Icono } from './icono';

export interface Rango { desde: string; hasta: string }
export type Periodo = 'todo' | 'hoy' | 'semana' | 'mes' | 'mes_pasado' | 'anio' | 'fechas';

const TEXTO: Record<Periodo, string> = {
  todo: 'Cualquier fecha', hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', mes_pasado: 'Mes pasado', anio: 'Este año', fechas: 'Elegir fechas',
};

/** Rango de un periodo, con la semana empezando en lunes. */
export function rangoDe(p: Periodo): Rango {
  const h = hoy();
  const d = new Date(h + 'T12:00:00');
  switch (p) {
    case 'hoy': return { desde: h, hasta: h };
    case 'semana': return { desde: sumarDias(h, -((d.getDay() + 6) % 7)), hasta: h };
    case 'mes': return { desde: h.slice(0, 8) + '01', hasta: h };
    case 'mes_pasado': {
      const ini = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12);
      const fin = new Date(d.getFullYear(), d.getMonth(), 0, 12);
      return { desde: ini.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) };
    }
    case 'anio': return { desde: h.slice(0, 4) + '-01-01', hasta: h };
    default: return { desde: '', hasta: '' };
  }
}

/** Botón "Cualquier fecha ▾" con periodos rápidos y un rango libre. Úsalo con [(rango)] y (rangoChange). */
@Component({
  selector: 'app-filtro-fechas',
  imports: [FormsModule, Icono],
  host: { class: 'relative inline-flex', '(document:click)': 'fuera($event)', '(keydown.escape)': 'abierto.set(false)' },
  template: `
    <button type="button" class="flex min-h-10 items-center gap-2 rounded-[9px] border border-linea bg-superficie px-3 py-2 text-base font-medium hover:border-marca"
      [class.!border-marca]="periodo() !== 'todo'" [class.!text-marca]="periodo() !== 'todo'"
      (click)="abierto.set(!abierto())" aria-haspopup="menu" [attr.aria-expanded]="abierto()">
      <app-icono nombre="calendario" />{{ texto() }}<app-icono nombre="abajo" class="text-tenue" />
    </button>
    @if (abierto()) {
      <div class="absolute top-full right-0 z-40 mt-1.5 flex w-64 animate-entra flex-col gap-0.5 rounded-xl border border-linea bg-superficie p-1.5 shadow-caja max-sm:left-0 max-sm:right-auto" role="menu">
        @for (p of opciones(); track p) {
          <button type="button" role="menuitemradio" [attr.aria-checked]="periodo() === p" (click)="elegir(p)"
            class="rounded-lg px-2.5 py-2 text-left text-base hover:bg-superficie-2" [class.!bg-marca-suave]="periodo() === p" [class.font-semibold]="periodo() === p">{{ nombres[p] }}</button>
        }
        @if (periodo() === 'fechas') {
          <div class="mt-1 grid grid-cols-2 gap-2 border-t border-linea px-1 pt-2.5 pb-1">
            <label class="flex flex-col gap-1 text-xs font-semibold text-tenue">Desde<input class="entrada text-base text-tinta" type="date" [ngModel]="rango().desde" (ngModelChange)="fijar({ desde: $event, hasta: rango().hasta })"></label>
            <label class="flex flex-col gap-1 text-xs font-semibold text-tenue">Hasta<input class="entrada text-base text-tinta" type="date" [ngModel]="rango().hasta" (ngModelChange)="fijar({ desde: rango().desde, hasta: $event })"></label>
          </div>
        }
      </div>
    }
  `,
})
export class FiltroFechas {
  private el = inject(ElementRef<HTMLElement>);
  rango = model<Rango>({ desde: '', hasta: '' });
  /** Periodos que se ofrecen; por defecto todos. */
  opciones = input<Periodo[]>(['todo', 'hoy', 'semana', 'mes', 'mes_pasado', 'anio', 'fechas']);
  nombres = TEXTO;
  abierto = signal(false);
  /** Periodo con el que arranca (debe coincidir con el rango inicial). */
  inicial = input<Periodo>('todo');
  periodo = signal<Periodo>('todo');
  ngOnInit() { this.periodo.set(this.inicial()); }
  texto = computed(() => {
    const p = this.periodo(), r = this.rango();
    if (p !== 'fechas') return TEXTO[p];
    if (r.desde && r.hasta) return `${fecha(r.desde)} – ${fecha(r.hasta)}`;
    return r.desde ? `Desde ${fecha(r.desde)}` : r.hasta ? `Hasta ${fecha(r.hasta)}` : TEXTO.fechas;
  });

  elegir(p: Periodo) {
    this.periodo.set(p);
    if (p === 'fechas') return;
    this.rango.set(rangoDe(p));
    this.abierto.set(false);
  }

  fijar(r: Rango) { this.rango.set(r); }

  fuera(ev: Event) {
    if (this.abierto() && !this.el.nativeElement.contains(ev.target as Node)) this.abierto.set(false);
  }
}
