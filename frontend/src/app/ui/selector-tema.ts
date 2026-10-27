import { Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { Tema, TemaService } from '../core/tema.service';
import { Icono } from './icono';

const OPCIONES: { valor: Tema; texto: string; icono: string }[] = [
  { valor: 'claro', texto: 'Claro', icono: 'sol' },
  { valor: 'oscuro', texto: 'Oscuro', icono: 'luna' },
  { valor: 'sistema', texto: 'Como mi equipo', icono: 'pantalla' },
];

/** Botón con menú para elegir el tema: claro, oscuro o el del equipo. Se usa en la app, la landing y las pantallas de cuenta. */
@Component({
  selector: 'app-selector-tema',
  imports: [Icono],
  host: { class: 'relative inline-flex', '(document:click)': 'fuera($event)', '(keydown.escape)': 'abierto.set(false)' },
  template: `
    <button type="button" class="flex size-9 flex-none items-center justify-center rounded-lg text-[1.15rem] hover:bg-superficie-2 hover:text-tinta"
      [class]="claro() ? 'text-white/80 hover:!bg-white/10 hover:!text-white' : 'text-tenue'"
      (click)="abierto.set(!abierto())" aria-haspopup="menu" [attr.aria-expanded]="abierto()" [attr.aria-label]="'Tema: ' + actual().texto" [title]="'Tema: ' + actual().texto">
      <app-icono [nombre]="actual().icono" />
    </button>
    @if (abierto()) {
      <div role="menu" class="absolute top-full right-0 z-40 mt-1.5 flex w-52 animate-entra flex-col gap-0.5 rounded-xl border border-linea bg-superficie p-1.5 text-tinta shadow-caja">
        <p class="px-2.5 pt-1 pb-1.5 text-[.7rem] font-bold tracking-[.08em] text-tenue uppercase">Tema</p>
        @for (o of opciones; track o.valor) {
          <button type="button" role="menuitemradio" [attr.aria-checked]="tema.tema() === o.valor" (click)="elegir(o.valor)"
            class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[.9rem] font-medium hover:bg-superficie-2"
            [class.!bg-marca-suave]="tema.tema() === o.valor" [class.!text-marca]="tema.tema() === o.valor">
            <app-icono class="text-[1.05rem]" [nombre]="o.icono" /><span class="flex-1">{{ o.texto }}</span>
            @if (tema.tema() === o.valor) { <app-icono nombre="ok" /> }
          </button>
        }
      </div>
    }
  `,
})
export class SelectorTema {
  tema = inject(TemaService);
  private el = inject(ElementRef<HTMLElement>);
  /** Para ponerlo sobre un fondo azul marino (botón en blanco). */
  claro = input(false);
  opciones = OPCIONES;
  abierto = signal(false);
  actual = computed(() => OPCIONES.find((o) => o.valor === this.tema.tema())!);

  elegir(t: Tema) {
    this.tema.elegir(t);
    this.abierto.set(false);
  }

  fuera(ev: Event) {
    if (this.abierto() && !this.el.nativeElement.contains(ev.target as Node)) this.abierto.set(false);
  }
}
