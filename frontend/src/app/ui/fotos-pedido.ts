import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { FotosService } from '../core/fotos.service';
import { FotoPedido } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { FotoTrabajo } from './foto';
import { Icono } from './icono';
import { FotoVisor, VisorFotos } from './visor-fotos';

/** Fotos del trabajo terminado de un pedido: se toman con la cámara o se eligen de la galería. */
@Component({
  selector: 'app-fotos-pedido',
  imports: [Icono, FotoTrabajo, VisorFotos],
  template: `
    <section>
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <h3 class="text-base">Fotos del trabajo @if (fotos().length) { <span class="chico num tenue">({{ fotos().length }})</span> }</h3>
        <button type="button" class="btn sm" (click)="elegir.click()" [disabled]="subiendo() > 0"><app-icono nombre="camara" />{{ subiendo() ? 'Subiendo ' + subiendo() + '…' : 'Agregar fotos' }}</button>
        <input #elegir type="file" accept="image/*" multiple class="hidden" (change)="subir($event)" aria-label="Elegir fotos">
      </div>
      @if (fotos().length) {
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
          @for (f of fotos(); track f.id; let i = $index) {
            <div class="group relative">
              <button type="button" class="block aspect-square w-full overflow-hidden rounded-lg" (click)="verIndice.set(i)" [attr.aria-label]="'Ver foto ' + (i + 1)">
                <app-foto [fotoId]="f.id" [mini]="true" class="size-full" [alt]="'Foto ' + (i + 1) + ' del trabajo'" />
              </button>
              @if (puedeBorrar(f)) {
                <button type="button" class="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  [attr.aria-label]="'Eliminar foto ' + (i + 1)" title="Eliminar" (click)="eliminar(f)"><app-icono nombre="basura" class="size-4" /></button>
              }
            </div>
          }
        </div>
      } @else if (cargado()) {
        <button type="button" class="w-full rounded-xl border border-dashed border-linea p-4 text-center tenue" (click)="elegir.click()">
          Toma o sube fotos de cómo quedó. Quedan como evidencia en el pedido y en la galería del producto.
        </button>
      }
    </section>
    @if (verIndice() !== null) {
      <app-visor-fotos [fotos]="visor()" [indice]="verIndice()!" (indiceChange)="verIndice.set($event)" (cerrar)="verIndice.set(null)" />
    }
  `,
})
export class FotosPedido {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  private servicio = inject(FotosService);
  private s = inject(SesionService);
  ventaId = input.required<number>();
  folio = input('');
  fotos = signal<FotoPedido[]>([]);
  cargado = signal(false);
  subiendo = signal(0);
  verIndice = signal<number | null>(null);
  visor = computed<FotoVisor[]>(() => this.fotos().map((f) => ({
    id: f.id, nota: f.nota,
    titulo: this.folio() ? `${this.folio()} · foto` : undefined,
    detalle: `${f.usuarioNombre} · ${new Date(f.creadoEn).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
  })));

  constructor() {
    effect(() => { void this.cargar(this.ventaId()); });
  }

  private async cargar(id: number) {
    try { this.fotos.set(await this.api.get<FotoPedido[]>(`/ventas/${id}/fotos`)); }
    catch (e) { this.aviso.error(mensajeError(e)); }
    this.cargado.set(true);
  }

  puedeBorrar(f: FotoPedido) { return this.s.verCostos() || f.usuarioId === this.s.perfil()?.usuario.id; }

  async subir(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const archivos = Array.from(el.files ?? []);
    el.value = '';
    let ok = 0;
    for (const [i, a] of archivos.entries()) {
      this.subiendo.set(archivos.length - i);
      try {
        const lista = await this.servicio.preparar(a);
        const f = await this.api.post<FotoPedido>(`/ventas/${this.ventaId()}/fotos`, lista);
        this.fotos.update((l) => [...l, f]);
        ok++;
      } catch (e) { this.aviso.error(e instanceof Error ? e.message : mensajeError(e)); }
    }
    this.subiendo.set(0);
    if (ok) this.aviso.ok(ok === 1 ? 'Foto agregada' : `${ok} fotos agregadas`);
  }

  async eliminar(f: FotoPedido) {
    if (!(await this.confirmar.preguntar({ titulo: '¿Eliminar esta foto?', texto: 'Se quita del pedido y de la galería del producto.', accion: 'Eliminar', peligro: true }))) return;
    try {
      await this.api.del(`/fotos/${f.id}`);
      this.servicio.olvidar(f.id);
      this.fotos.update((l) => l.filter((x) => x.id !== f.id));
      this.aviso.ok('Foto eliminada');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
