import { Component, effect, inject, input, signal } from '@angular/core';
import { FotosService } from '../core/fotos.service';

/** Imagen de una foto de trabajo, descargada con la sesión. */
@Component({
  selector: 'app-foto',
  host: { class: 'block overflow-hidden bg-superficie-2' },
  template: `
    @if (src(); as u) { <img [src]="u" [alt]="alt()" class="size-full" [class]="ajuste() === 'cubrir' ? 'object-cover' : 'object-contain'" draggable="false"> }
    @else if (fallo()) { <span class="chico grid size-full place-items-center p-2 text-center tenue">No se pudo cargar</span> }
    @else { <span class="block size-full animate-pulse"></span> }
  `,
})
export class FotoTrabajo {
  private fotos = inject(FotosService);
  fotoId = input.required<number>();
  mini = input(false);
  alt = input('');
  ajuste = input<'cubrir' | 'contener'>('cubrir');
  src = signal<string | null>(null);
  fallo = signal(false);

  constructor() {
    effect(() => {
      const id = this.fotoId(), mini = this.mini();
      this.src.set(null);
      this.fallo.set(false);
      this.fotos.url(id, mini).then((u) => { if (id === this.fotoId()) this.src.set(u); }, () => this.fallo.set(true));
    });
  }
}
