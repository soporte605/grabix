import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { FechaPipe } from '../core/formato';
import { FotoTrabajo as Foto } from '../core/modelos';
import { FotoTrabajo } from './foto';
import { Hoja } from './hoja';
import { Paginador } from './paginador';
import { FotoVisor, VisorFotos } from './visor-fotos';

/** Galería de un producto o servicio: las fotos de todos los pedidos que lo llevaron. */
@Component({
  selector: 'app-trabajos-producto',
  imports: [Hoja, FotoTrabajo, VisorFotos, Paginador, FechaPipe],
  template: `
    <app-hoja [titulo]="'Trabajos hechos · ' + nombre()" ancho="900px" (cerrar)="cerrar.emit()">
      @if (!listo()) {
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">@for (x of [1, 2, 3, 4]; track x) { <div class="aspect-square animate-pulse rounded-xl bg-superficie-2"></div> }</div>
      } @else if (fotos().length) {
        <p class="chico tenue">{{ total() }} {{ total() === 1 ? 'foto' : 'fotos' }} de pedidos que incluyeron este {{ esServicio() ? 'servicio' : 'producto' }}.</p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          @for (f of fotos(); track f.id; let i = $index) {
            <button type="button" class="overflow-hidden rounded-xl border border-linea bg-superficie text-left" (click)="verIndice.set(i)" [attr.aria-label]="'Ver foto de ' + f.folio">
              <app-foto [fotoId]="f.id" [mini]="true" class="aspect-square" [alt]="'Trabajo ' + f.folio" />
              <span class="block px-2.5 py-1.5"><span class="chico block truncate font-semibold">{{ f.cliente }}</span>
                <span class="chico num block tenue">{{ f.folio }} · {{ f.fecha | fecha }}</span></span>
            </button>
          }
        </div>
        <app-paginador [total]="total()" [pagina]="pagina()" [por]="porPagina()" (paginaChange)="pagina.set($event)" />
      } @else {
        <div class="vacio"><b>Todavía no hay fotos</b>Cuando subas fotos en un pedido que lleve {{ nombre() }}, aparecerán aquí para que veas cómo se hizo.</div>
      }
    </app-hoja>
    @if (verIndice() !== null) {
      <app-visor-fotos [fotos]="visor()" [indice]="verIndice()!" (indiceChange)="verIndice.set($event)" (cerrar)="verIndice.set(null)" />
    }
  `,
})
export class TrabajosProducto {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  productoId = input.required<number>();
  nombre = input('');
  esServicio = input(false);
  cerrar = output();
  fotos = signal<Foto[]>([]);
  total = signal(0);
  porPagina = signal(24);
  pagina = signal(1);
  listo = signal(false);
  verIndice = signal<number | null>(null);
  visor = computed<FotoVisor[]>(() => this.fotos().map((f) => ({
    id: f.id, nota: f.nota, titulo: `${f.folio} · ${f.cliente}`,
    detalle: `Pedido del ${new Date(f.fecha + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · foto de ${f.usuarioNombre}`,
  })));

  constructor() {
    effect(() => { void this.cargar(this.productoId(), this.pagina()); });
  }

  private async cargar(id: number, pagina: number) {
    try {
      const r = await this.api.get<{ items: Foto[]; total: number; porPagina: number }>(`/productos/${id}/trabajos`, { pagina: String(pagina) });
      this.fotos.set(r.items);
      this.total.set(r.total);
      this.porPagina.set(r.porPagina);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.listo.set(true);
  }
}
