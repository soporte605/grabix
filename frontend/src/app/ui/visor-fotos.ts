import { Component, computed, HostListener, input, model, output } from '@angular/core';
import { FotoTrabajo } from './foto';
import { Hoja } from './hoja';
import { Icono } from './icono';

/** `src`: imagen pública (diseños, fotos en el enlace del cliente); si no, se descarga con la sesión. */
export interface FotoVisor { id: number; src?: string; titulo?: string; detalle?: string; nota?: string | null }

/** Fotos a tamaño completo, una por una, con flechas (o deslizando en el teléfono). */
@Component({
  selector: 'app-visor-fotos',
  imports: [Hoja, Icono, FotoTrabajo],
  template: `
    @let f = actual();
    <app-hoja [titulo]="f.titulo || 'Foto ' + (indice() + 1) + ' de ' + fotos().length" ancho="980px" (cerrar)="cerrar.emit()">
      <div class="relative -mx-1" (touchstart)="toque($event)" (touchend)="suelta($event)">
        @if (f.src) { <img [src]="f.src" [alt]="f.titulo || 'Imagen'" class="h-[62vh] w-full rounded-xl bg-white object-contain" draggable="false"> }
        @else { <app-foto [fotoId]="f.id" ajuste="contener" [alt]="f.titulo || 'Foto del trabajo'" class="h-[62vh] rounded-xl" /> }
        @if (fotos().length > 1) {
          <button type="button" class="ico absolute left-2 top-1/2 -translate-y-1/2 bg-fondo/90 shadow max-sm:hidden" aria-label="Foto anterior" (click)="mover(-1)"><app-icono nombre="izq" /></button>
          <button type="button" class="ico absolute right-2 top-1/2 -translate-y-1/2 bg-fondo/90 shadow max-sm:hidden" aria-label="Foto siguiente" (click)="mover(1)"><app-icono nombre="der" /></button>
        }
      </div>
      @if (f.detalle || f.nota) {
        <div>@if (f.detalle) { <p class="chico tenue">{{ f.detalle }}</p> } @if (f.nota) { <p>{{ f.nota }}</p> }</div>
      }
      <ng-container pie>
        @if (fotos().length > 1) {
          <button class="btn" (click)="mover(-1)" aria-label="Anterior"><app-icono nombre="izq" /></button>
          <span class="chico num tenue">{{ indice() + 1 }} / {{ fotos().length }}</span>
          <button class="btn" (click)="mover(1)" aria-label="Siguiente"><app-icono nombre="der" /></button>
        }
        <span class="flex-1"></span>
        <button class="btn pri" sin-validar (click)="cerrar.emit()">Cerrar</button>
      </ng-container>
    </app-hoja>
  `,
})
export class VisorFotos {
  fotos = input.required<FotoVisor[]>();
  indice = model(0);
  cerrar = output();
  actual = computed(() => this.fotos()[Math.min(this.indice(), this.fotos().length - 1)]);
  private x0 = 0;

  mover(d: number) {
    const n = this.fotos().length;
    this.indice.set((this.indice() + d + n) % n);
  }
  @HostListener('document:keydown.arrowleft') izq() { this.mover(-1); }
  @HostListener('document:keydown.arrowright') der() { this.mover(1); }
  toque(e: TouchEvent) { this.x0 = e.changedTouches[0].clientX; }
  suelta(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.x0;
    if (Math.abs(dx) > 50) this.mover(dx < 0 ? 1 : -1);
  }
}
