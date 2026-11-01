import { Component, input } from '@angular/core';

/** Marcadores grises animados mientras llegan los datos, con la forma de lo que se va a mostrar. */
@Component({
  selector: 'app-esqueleto',
  host: { class: 'block', 'aria-busy': 'true', 'aria-label': 'Cargando' },
  template: `
    @switch (tipo()) {
      @case ('lista') {
        @for (i of rango(); track i) {
          <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t border-linea px-4 py-3.5 first:border-t-0">
            <span class="hueso h-3.5" [style.width.%]="55 + ((i * 17) % 35)"></span><span class="hueso h-3.5 w-16"></span>
            <span class="hueso h-3" [style.width.%]="30 + ((i * 13) % 30)"></span><span class="hueso h-3 w-12 justify-self-end"></span>
          </div>
        }
      }
      @case ('inicio') {
        <div class="kpis">@for (i of [1, 2, 3, 4]; track i) { <div class="tarjeta kpi flex flex-col gap-2"><span class="hueso h-2.5 w-20"></span><span class="hueso h-6 w-28"></span><span class="hueso h-2.5 w-24"></span></div> }</div>
        <div class="grid gap-3.5 min-[1000px]:grid-cols-[1.4fr_1fr]">
          <div class="tarjeta pad flex flex-col gap-3"><span class="hueso h-4 w-40"></span><span class="hueso h-48 w-full"></span></div>
          <div class="tarjeta pad flex flex-col gap-3"><span class="hueso h-4 w-32"></span>@for (i of [1, 2, 3]; track i) { <span class="hueso h-10 w-full"></span> }</div>
        </div>
      }
      @case ('tablero') {
        <div class="grid gap-3.5 min-[900px]:grid-cols-3">
          @for (c of [1, 2, 3]; track c) {
            <div class="flex flex-col gap-2.5"><span class="hueso h-4 w-32"></span>
              @for (i of [1, 2]; track i) { <div class="tarjeta flex flex-col gap-2 p-3"><span class="hueso h-3.5 w-1/2"></span><span class="hueso h-3 w-3/4"></span><span class="hueso h-3 w-2/3"></span></div> }
            </div>
          }
        </div>
      }
      @default {
        <div class="flex max-w-[820px] flex-col gap-3.5">
          @for (i of rango(); track i) {
            <div class="caja"><span class="hueso h-4 w-40"></span><div class="campos"><span class="hueso col-span-full h-10"></span><span class="hueso h-10"></span><span class="hueso h-10"></span></div></div>
          }
        </div>
      }
    }
  `,
})
export class Esqueleto {
  tipo = input<'lista' | 'inicio' | 'tablero' | 'formulario'>('lista');
  filas = input(6);
  rango = () => Array.from({ length: this.filas() }, (_, i) => i);
}
