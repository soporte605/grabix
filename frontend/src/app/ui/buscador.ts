import { Component, computed, DestroyRef, ElementRef, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icono } from './icono';

export interface Opcion {
  valor: unknown;
  texto: string;
  grupo?: string;
  detalle?: string;
}

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Selector con buscador. Funciona con [(ngModel)] como un <select>.
 * La lista se abre en la capa superior del navegador (popover), así no la corta un modal
 * y se abre hacia abajo o hacia arriba según el espacio que haya.
 */
@Component({
  selector: 'app-buscador',
  imports: [Icono],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Buscador), multi: true }],
  host: {
    class: 'block min-w-0',
    '(document:pointerdown)': 'fuera($event)',
    '(window:resize)': 'cerrar()',
  },
  template: `
    <button #boton type="button" class="entrada flex items-center gap-2 text-left" [attr.id]="idCampo() || null" [disabled]="bloqueado()"
      (click)="abierto() ? cerrar() : abrir()" (keydown.arrowdown)="$event.preventDefault(); abrir()"
      aria-haspopup="listbox" [attr.aria-expanded]="abierto()" [attr.aria-label]="etiqueta() || null">
      <span class="min-w-0 flex-1 truncate" [class.text-tenue]="!elegida()">{{ elegida()?.texto ?? vacio() }}</span>
      <app-icono nombre="abajo" class="flex-none text-tenue" />
    </button>
    <div #panel popover="manual" class="m-0 flex-col overflow-hidden rounded-xl border border-linea bg-superficie p-0 text-tinta shadow-caja [&:popover-open]:flex"
      [style.top.px]="pos().top" [style.bottom.px]="pos().bottom" [style.left.px]="pos().left" [style.width.px]="pos().ancho" [style.max-height.px]="pos().alto">
      <div class="flex items-center gap-2 border-b border-linea px-3">
        <app-icono nombre="buscar" class="flex-none text-tenue" />
        <input #caja class="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none" [placeholder]="placeholder()" [value]="q()"
          (input)="buscar($any($event.target).value)" (keydown)="tecla($event)" aria-label="Buscar" autocomplete="off">
      </div>
      <ul class="flex-1 overflow-y-auto overscroll-contain p-1.5" role="listbox">
        @for (o of visibles(); track $index; let i = $index) {
          @if (o.grupo && o.grupo !== visibles()[i - 1]?.grupo) {
            <li class="px-2.5 pt-2 pb-1 text-xs font-bold tracking-[.08em] text-tenue uppercase" role="presentation">{{ o.grupo }}</li>
          }
          <li role="option" [attr.aria-selected]="o.valor === valor()" (pointerdown)="$event.preventDefault()" (click)="elegir(o)" (pointermove)="activo.set(i)"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-base"
            [class.bg-superficie-2]="activo() === i" [class.font-semibold]="o.valor === valor()" [class.text-marca]="o.valor === valor()">
            <span class="min-w-0 flex-1">{{ o.texto }}</span>
            @if (o.detalle) { <span class="flex-none text-sm text-tenue">{{ o.detalle }}</span> }
          </li>
        } @empty {
          <li class="px-2.5 py-3 text-base text-tenue">Sin resultados para “{{ q() }}”</li>
        }
      </ul>
    </div>
  `,
})
export class Buscador implements ControlValueAccessor {
  opciones = input<Opcion[]>([]);
  /** Texto cuando no hay nada elegido; si `conVacio` es true también aparece como primera opción. */
  vacio = input('Elige una opción');
  conVacio = input(false);
  placeholder = input('Buscar…');
  idCampo = input('');
  etiqueta = input('');

  private el = inject(ElementRef<HTMLElement>);
  private boton = viewChild.required<ElementRef<HTMLButtonElement>>('boton');
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private caja = viewChild.required<ElementRef<HTMLInputElement>>('caja');

  valor = signal<unknown>(null);
  bloqueado = signal(false);
  abierto = signal(false);
  q = signal('');
  activo = signal(0);
  pos = signal<{ top: number | null; bottom: number | null; left: number; ancho: number; alto: number }>({ top: 0, bottom: null, left: 0, ancho: 0, alto: 0 });

  private todas = computed<Opcion[]>(() => (this.conVacio() ? [{ valor: null, texto: this.vacio() }, ...this.opciones()] : this.opciones()));
  elegida = computed(() => this.opciones().find((o) => o.valor === this.valor()) ?? null);
  visibles = computed(() => {
    const q = normal(this.q().trim());
    if (!q) return this.todas();
    const ps = q.split(/\s+/);
    return this.opciones().filter((o) => {
      const t = normal(`${o.texto} ${o.grupo ?? ''} ${o.detalle ?? ''}`);
      return ps.every((p) => t.includes(p));
    });
  });

  constructor() {
    // El scroll de un modal no llega a document si no se escucha en captura.
    const f = (ev: Event) => this.alDesplazar(ev);
    document.addEventListener('scroll', f, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', f, true);
      if (this.abierto()) this.panel().nativeElement.hidePopover();
    });
  }

  private cambio: (v: unknown) => void = () => {};
  private tocado: () => void = () => {};
  writeValue(v: unknown) { this.valor.set(v ?? null); }
  registerOnChange(fn: (v: unknown) => void) { this.cambio = fn; }
  registerOnTouched(fn: () => void) { this.tocado = fn; }
  setDisabledState(d: boolean) { this.bloqueado.set(d); }

  abrir() {
    if (this.abierto()) return;
    this.q.set('');
    this.ubicar();
    this.panel().nativeElement.showPopover();
    this.abierto.set(true);
    const i = this.visibles().findIndex((o) => o.valor === this.valor());
    this.activo.set(Math.max(0, i));
    setTimeout(() => {
      this.caja().nativeElement.focus({ preventScroll: true });
      this.panel().nativeElement.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    });
  }

  cerrar(enfocar = false) {
    if (!this.abierto()) return;
    this.panel().nativeElement.hidePopover();
    this.abierto.set(false);
    this.tocado();
    if (enfocar) this.boton().nativeElement.focus();
  }

  /** Abre hacia abajo si cabe; si no, hacia donde haya más espacio. */
  private ubicar() {
    const r = this.boton().nativeElement.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.visualViewport?.height ?? window.innerHeight;
    const abajo = vh - r.bottom - 8, arriba = r.top - 8;
    const haciaAbajo = abajo >= 280 || abajo >= arriba;
    const ancho = Math.min(Math.max(r.width, 280), vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - ancho - 8);
    const alto = Math.min(380, haciaAbajo ? abajo : arriba);
    this.pos.set(haciaAbajo ? { top: r.bottom + 4, bottom: null, left, ancho, alto } : { top: null, bottom: vh - r.top + 4, left, ancho, alto });
  }

  buscar(t: string) {
    this.q.set(t);
    this.activo.set(0);
  }

  elegir(o: Opcion) {
    this.valor.set(o.valor);
    this.cambio(o.valor);
    this.cerrar(true);
  }

  tecla(ev: KeyboardEvent) {
    const n = this.visibles().length;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (n) this.activo.set((this.activo() + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n);
      queueMicrotask(() => this.panel().nativeElement.querySelectorAll('[role="option"]')[this.activo()]?.scrollIntoView({ block: 'nearest' }));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const o = this.visibles()[this.activo()];
      if (o) this.elegir(o);
    } else if (ev.key === 'Escape') {
      // No dejar que el Escape cierre también el modal de atrás.
      ev.stopPropagation();
      this.cerrar(true);
    } else if (ev.key === 'Tab') this.cerrar();
  }

  fuera(ev: Event) {
    const t = ev.target as Node;
    if (this.abierto() && !this.el.nativeElement.contains(t) && !this.panel().nativeElement.contains(t)) this.cerrar();
  }

  alDesplazar(ev: Event) {
    if (this.abierto() && !this.panel().nativeElement.contains(ev.target as Node)) this.ubicar();
  }
}
