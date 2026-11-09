import { Component, effect, inject, input, signal } from '@angular/core';
import { FotosService } from '../core/fotos.service';
import { Icono } from './icono';

/** Miniatura de la foto principal de un producto, descargada con la sesión. Sin foto muestra un icono. */
@Component({
  selector: 'app-foto-producto',
  imports: [Icono],
  host: { class: 'block shrink-0 overflow-hidden bg-superficie-2' },
  template: `
    @if (src(); as u) { <img [src]="u" [alt]="alt()" class="size-full object-cover" draggable="false"> }
    @else if (archivo()) { <span class="block size-full animate-pulse"></span> }
    @else { <span class="grid size-full place-items-center text-tenue"><app-icono nombre="fotos" /></span> }
  `,
})
export class FotoProducto {
  private fotos = inject(FotosService);
  productoId = input.required<number>();
  archivo = input<string | null | undefined>(null);
  /** Foto completa en lugar de la miniatura. */
  grande = input(false);
  alt = input('');
  src = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.productoId(), a = this.archivo(), mini = !this.grande();
      this.src.set(null);
      if (!a) return;
      this.fotos.urlProducto(id, a, mini).then((u) => { if (a === this.archivo()) this.src.set(u); }, () => undefined);
    });
  }
}
