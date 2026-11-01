import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { FotosService } from '../core/fotos.service';
import { Icono } from './icono';
import { FotoVisor, VisorFotos } from './visor-fotos';

export interface ImagenCotizacion { id: number; cotizacionId: number; nota: string | null; ancho: number; alto: number; usuarioNombre: string; creadoEn: string; url: string; mini: string }
type Pendiente = Awaited<ReturnType<FotosService['prepararDiseno']>> & { nota: string };

const MAX = 8;
/** Sube cuando se agregan imágenes: si el editor se recrea al guardar la cotización nueva, la instancia nueva recarga. */
const cambios = signal(0);

/**
 * Imágenes que acompañan una cotización (diseño propuesto, boceto o foto de un trabajo parecido).
 * El cliente las ve en su enlace y en el PDF; en la venta que sale de la cotización se ven como referencia.
 */
@Component({
  selector: 'app-imagenes-cotizacion',
  imports: [FormsModule, Icono, VisorFotos],
  template: `
    @if (!soloLectura() || lista().length) {
      <section>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <h3 class="text-base">{{ soloLectura() ? 'Imágenes de la cotización' : 'Imágenes para el cliente' }} @if (lista().length) { <span class="chico num tenue">({{ lista().length }})</span> }</h3>
          @if (!soloLectura() && cargado() && !pendientes().length && lista().length < max) {
            <button type="button" class="btn sm" (click)="elegir.click()" [disabled]="ocupado()"><app-icono nombre="camara" />Agregar imágenes</button>
          }
          <input #elegir type="file" accept="image/*" multiple class="hidden" (change)="preparar($event)" aria-label="Elegir imágenes">
        </div>

        @if (pendientes().length) {
          <div class="caja">
            @for (p of pendientes(); track $index; let i = $index) {
              <div class="flex items-start gap-3">
                <img [src]="p.miniatura" alt="Imagen por subir" class="size-20 flex-none rounded-lg bg-white object-contain">
                <div class="campo flex-1"><label [for]="'ic-n' + i">Nota (opcional)</label>
                  <input [id]="'ic-n' + i" maxlength="200" [(ngModel)]="p.nota" placeholder="Ej. Taza blanca 11 oz, diseño a todo color"></div>
                <button type="button" class="ico mt-6" (click)="quitarPendiente(i)" aria-label="No subir esta imagen"><app-icono nombre="cerrar" /></button>
              </div>
            }
            <div class="fila justify-end">
              <button type="button" class="btn" (click)="pendientes.set([])" [disabled]="ocupado()">Cancelar</button>
              <button type="button" class="btn pri" sin-validar (click)="subir()" [disabled]="ocupado()">{{ ocupado() ? 'Subiendo…' : pendientes().length === 1 ? 'Guardar imagen' : 'Guardar ' + pendientes().length + ' imágenes' }}</button>
            </div>
          </div>
        } @else if (lista().length) {
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (x of lista(); track x.id; let i = $index) {
              <div class="group relative flex flex-col gap-1">
                <button type="button" class="block aspect-square w-full overflow-hidden rounded-lg border border-linea bg-white" (click)="verIndice.set(i)" [attr.aria-label]="'Ver imagen ' + (i + 1)">
                  <img [src]="x.mini" [alt]="x.nota || 'Imagen ' + (i + 1)" class="size-full object-contain"></button>
                @if (x.nota) { <span class="chico line-clamp-2 tenue">{{ x.nota }}</span> }
                @if (!soloLectura()) {
                  <button type="button" class="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    [attr.aria-label]="'Eliminar imagen ' + (i + 1)" title="Eliminar" (click)="eliminar(x)"><app-icono nombre="basura" class="size-4" /></button>
                }
              </div>
            }
          </div>
        } @else if (cargado()) {
          <button type="button" class="w-full rounded-xl border border-dashed border-linea p-4 text-center tenue" (click)="elegir.click()">
            Agrega cómo quedaría el trabajo: el diseño sobre la taza, un boceto o la foto de un trabajo parecido. Tu cliente lo ve en el PDF, en su enlace y en la vista previa de WhatsApp.
          </button>
        }
      </section>
    }
    @if (verIndice() !== null) {
      <app-visor-fotos [fotos]="visor()" [indice]="verIndice()!" (indiceChange)="verIndice.set($event)" (cerrar)="verIndice.set(null)" />
    }
  `,
})
export class ImagenesCotizacion {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  private fotos = inject(FotosService);
  /** Cotización a la que pertenecen (null = todavía no se guarda). */
  cotizacionId = input<number | null>(null);
  /** Venta: muestra las imágenes de la cotización de la que salió, sin editar. */
  ventaId = input<number | null>(null);
  /** Guarda la cotización si hace falta y devuelve su id (desde el editor). */
  asegurar = input<(() => Promise<number | null>) | null>(null);

  max = MAX;
  lista = signal<ImagenCotizacion[]>([]);
  pendientes = signal<Pendiente[]>([]);
  cargado = signal(false);
  ocupado = signal(false);
  verIndice = signal<number | null>(null);
  soloLectura = computed(() => !!this.ventaId());
  visor = computed<FotoVisor[]>(() => this.lista().map((x, i) => ({ id: x.id, src: x.url, titulo: `Imagen ${i + 1} de ${this.lista().length}`, nota: x.nota })));

  constructor() {
    effect(() => { cambios(); void this.cargar(this.cotizacionId(), this.ventaId()); });
  }

  /** Evita que una carga vieja pise lo recién subido (al guardar la cotización cambia el id mientras se suben). */
  private turno = 0;
  private async cargar(cot: number | null, venta: number | null) {
    const t = ++this.turno;
    try {
      const l = venta ? await this.api.get<ImagenCotizacion[]>(`/ventas/${venta}/imagenes-cotizacion`)
        : cot ? await this.api.get<ImagenCotizacion[]>(`/cotizaciones/${cot}/imagenes`) : [];
      if (t === this.turno) this.lista.set(l);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.cargado.set(true);
  }

  async preparar(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const archivos = Array.from(el.files ?? []).slice(0, MAX - this.lista().length);
    el.value = '';
    const listos: Pendiente[] = [];
    for (const a of archivos) {
      try { listos.push({ ...(await this.fotos.prepararDiseno(a)), nota: '' }); }
      catch (e) { this.aviso.error(e instanceof Error ? e.message : mensajeError(e)); }
    }
    this.pendientes.set(listos);
  }

  quitarPendiente(i: number) { this.pendientes.update((l) => l.filter((_, k) => k !== i)); }

  async subir() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      const id = this.cotizacionId() ?? (await this.asegurar()?.()) ?? null;
      if (!id) { this.ocupado.set(false); return; }
      this.turno++;
      let ok = 0;
      for (const p of this.pendientes()) {
        const x = await this.api.post<ImagenCotizacion>(`/cotizaciones/${id}/imagenes`, { ...p, nota: p.nota.trim() });
        this.turno++;
        this.lista.update((l) => [...l, x]);
        ok++;
      }
      this.pendientes.set([]);
      cambios.update((n) => n + 1);
      this.aviso.ok(ok === 1 ? 'Imagen agregada' : `${ok} imágenes agregadas`);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  async eliminar(x: ImagenCotizacion) {
    if (!(await this.confirmar.preguntar({ titulo: '¿Eliminar esta imagen?', texto: 'Ya no saldrá en el PDF ni en el enlace del cliente.', accion: 'Eliminar', peligro: true }))) return;
    try {
      await this.api.del(`/cotizacion-imagenes/${x.id}`);
      this.lista.update((l) => l.filter((y) => y.id !== x.id));
      this.aviso.ok('Imagen eliminada');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
