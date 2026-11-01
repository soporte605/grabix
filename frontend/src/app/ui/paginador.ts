import { Component, computed, input, model } from '@angular/core';
import { Icono } from './icono';

/** Paginador para listas: "1–20 de 134" con anterior/siguiente y números de página. `pagina` empieza en 1. */
@Component({
  selector: 'app-paginador',
  imports: [Icono],
  template: `
    @if (total() > por()) {
      <nav class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-tenue" aria-label="Páginas">
        <span class="num">{{ desde() }}–{{ hasta() }} de {{ total() }}</span>
        <span class="flex items-center gap-1">
          <button type="button" class="ico" [disabled]="pagina() <= 1" (click)="ir(pagina() - 1)" aria-label="Página anterior"><app-icono nombre="izq" /></button>
          @for (n of numeros(); track $index) {
            @if (n) { <button type="button" class="ico num text-sm" [class.pagina-on]="n === pagina()" [attr.aria-current]="n === pagina() ? 'page' : null" (click)="ir(n)">{{ n }}</button> }
            @else { <span class="px-1">…</span> }
          }
          <button type="button" class="ico" [disabled]="pagina() >= paginas()" (click)="ir(pagina() + 1)" aria-label="Página siguiente"><app-icono nombre="der" /></button>
        </span>
      </nav>
    }
  `,
  styles: `.pagina-on { border-color: var(--marca); background: var(--marca); color: var(--sobre-marca); font-weight: 600; }`,
})
export class Paginador {
  total = input(0);
  por = input(20);
  pagina = model(1);
  paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.por())));
  desde = computed(() => (this.pagina() - 1) * this.por() + 1);
  hasta = computed(() => Math.min(this.total(), this.pagina() * this.por()));
  /** Primera, última y dos alrededor de la actual; 0 marca un hueco. */
  numeros = computed(() => {
    const n = this.paginas(), p = this.pagina(), r: number[] = [];
    for (let i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - p) <= 1) r.push(i); else if (r[r.length - 1] !== 0) r.push(0);
    return r;
  });
  ir(n: number) { this.pagina.set(Math.min(this.paginas(), Math.max(1, n))); }
}

/** Corta una lista ya cargada a la página indicada. */
export const pagina = <T>(xs: T[], n: number, por = 20) => xs.slice((n - 1) * por, n * por);
