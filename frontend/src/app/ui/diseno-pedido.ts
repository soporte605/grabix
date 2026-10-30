import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { FotosService } from '../core/fotos.service';
import { DisenoPedido, EST_DISENO, VIA_DISENO } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Icono } from './icono';
import { FotoVisor, VisorFotos } from './visor-fotos';

const cuando = (f: string) => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Prueba de diseño del pedido: se sube, se manda por WhatsApp (la imagen sale en la vista previa del enlace)
 * y el cliente la aprueba en el enlace. Si contesta "sí" por WhatsApp o en persona, aquí se registra.
 */
@Component({
  selector: 'app-diseno-pedido',
  imports: [FormsModule, Icono, VisorFotos],
  template: `
    @if (!cerrado() || disenos().length) {
    <section>
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <h3 class="text-base">{{ cerrado() ? 'Diseño' : 'Diseño para aprobar' }}</h3>
        @if (cargado() && !nuevo() && !cerrado()) {
          <button type="button" class="btn sm" (click)="elegir.click()"><app-icono nombre="nueva" />{{ ultimo() ? 'Nueva versión' : 'Subir diseño' }}</button>
        }
        <input #elegir type="file" accept="image/*" class="hidden" (change)="preparar($event)" aria-label="Elegir diseño">
      </div>

      @if (nuevo(); as n) {
        <div class="caja">
          <img [src]="n.miniatura" alt="Diseño por subir" class="max-h-56 w-full rounded-lg bg-white object-contain">
          <div class="campo"><label for="dp-n">Qué debe revisar el cliente (opcional)</label>
            <textarea id="dp-n" rows="2" maxlength="500" [(ngModel)]="nota" placeholder="Ej. Tamaño 8 × 5 cm, centrado, grabado en madera de pino"></textarea></div>
          <div class="fila justify-end">
            <button type="button" class="btn" (click)="nuevo.set(null)" [disabled]="ocupado()">Cancelar</button>
            <button type="button" class="btn pri" sin-validar (click)="subir()" [disabled]="ocupado()">{{ ocupado() ? 'Subiendo…' : 'Guardar diseño' }}</button>
          </div>
        </div>
      } @else if (ultimo(); as d) {
        <div class="caja">
          <button type="button" class="block overflow-hidden rounded-lg bg-white" (click)="ver(d)" aria-label="Ver diseño en grande">
            <img [src]="d.mini" [alt]="'Diseño versión ' + d.version" class="max-h-60 w-full object-contain">
          </button>
          <div class="flex flex-wrap items-center gap-2">
            <span class="pill" [class]="est[d.estado][1]">{{ est[d.estado][0] }}</span>
            <span class="chico tenue">Versión {{ d.version }} · {{ d.usuarioNombre }} · {{ cuando(d.creadoEn) }}</span>
          </div>
          @if (d.nota) { <p class="chico whitespace-pre-line">{{ d.nota }}</p> }
          @if (d.estado === 'aprobado') {
            <p class="chico rounded-lg bg-ok-suave p-2.5"><b>Aprobado</b> por {{ d.respondidoPor }} {{ via[d.via ?? ''] }} el {{ cuando(d.respondidoEn!) }}.@if (d.respuesta) { “{{ d.respuesta }}” }</p>
          } @else if (d.estado === 'cambios') {
            <p class="chico rounded-lg bg-bad-suave p-2.5"><b>{{ d.respondidoPor }} pidió cambios</b> el {{ cuando(d.respondidoEn!) }}: <span class="whitespace-pre-line">“{{ d.respuesta }}”</span></p>
          }

          @if (cerrado()) {
            <button type="button" class="btn self-start" (click)="copiar()">Copiar enlace</button>
          } @else if (marcando()) {
            <div class="flex flex-col gap-2 rounded-lg border border-linea p-2.5">
              <p class="chico font-semibold">¿Cómo te lo aprobó?</p>
              <input class="entrada" maxlength="500" [(ngModel)]="notaAprobacion" placeholder="Nota opcional, p. ej. contestó “sí, así está bien”" aria-label="Nota de la aprobación">
              <div class="grid grid-cols-2 gap-2">
                <button type="button" class="btn justify-center" (click)="aprobar('whatsapp')" [disabled]="ocupado()"><app-icono nombre="wa" />Por WhatsApp</button>
                <button type="button" class="btn justify-center" (click)="aprobar('mostrador')" [disabled]="ocupado()">En mostrador</button>
              </div>
              <button type="button" class="chico self-start tenue" (click)="marcando.set(false)">Cancelar</button>
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              @if (d.estado === 'pendiente' && telefono()) { <button type="button" class="btn wa justify-center" (click)="whatsapp()" [disabled]="ocupado()"><app-icono nombre="wa" />Enviar por WhatsApp</button> }
              @if (d.estado === 'pendiente') { <button type="button" class="btn justify-center" (click)="marcando.set(true)"><app-icono nombre="ok" />Ya lo aprobó</button> }
              <button type="button" class="btn justify-center" (click)="copiar()">Copiar enlace</button>
              @if (puedeBorrar(d)) { <button type="button" class="btn justify-center" (click)="eliminar(d)" [disabled]="ocupado()"><app-icono nombre="basura" />Quitar</button> }
            </div>
          }
        </div>
        @if (anteriores().length) {
          <details class="mt-2">
            <summary class="chico cursor-pointer tenue">Versiones anteriores ({{ anteriores().length }})</summary>
            <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              @for (a of anteriores(); track a.id) {
                <button type="button" class="flex flex-col gap-1 text-left" (click)="ver(a)">
                  <img [src]="a.mini" [alt]="'Versión ' + a.version" class="aspect-square w-full rounded-lg bg-white object-contain">
                  <span class="chico tenue">v{{ a.version }} · {{ est[a.estado][0] }}</span>
                </button>
              }
            </div>
          </details>
        }
      } @else if (cargado() && !cerrado()) {
        <button type="button" class="w-full rounded-xl border border-dashed border-linea p-4 text-center tenue" (click)="elegir.click()">
          Sube la imagen del diseño (JPG, PNG o SVG) y mándala por WhatsApp. El cliente lo ve en el chat y lo aprueba con un toque o contestando “sí”.
        </button>
      }
    </section>
    }
    @if (verIndice() !== null) {
      <app-visor-fotos [fotos]="visor()" [indice]="verIndice()!" (indiceChange)="verIndice.set($event)" (cerrar)="verIndice.set(null)" />
    }
  `,
})
export class DisenoPedidoSeccion {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  private fotos = inject(FotosService);
  private s = inject(SesionService);
  ventaId = input.required<number>();
  folio = input('');
  telefono = input('');
  /** Pedido entregado o cancelado: solo se consulta lo que hubo. */
  cerrado = input(false);
  /** Cambió el diseño o su aprobación: la etapa del pedido pudo moverse. */
  cambio = output();

  est = EST_DISENO;
  via = VIA_DISENO;
  cuando = cuando;
  disenos = signal<DisenoPedido[]>([]);
  enlace = signal('');
  cargado = signal(false);
  ocupado = signal(false);
  marcando = signal(false);
  nuevo = signal<Awaited<ReturnType<FotosService['prepararDiseno']>> | null>(null);
  nota = '';
  notaAprobacion = '';
  verIndice = signal<number | null>(null);
  ultimo = computed(() => this.disenos()[0] ?? null);
  anteriores = computed(() => this.disenos().slice(1));
  visor = computed<FotoVisor[]>(() => this.disenos().map((d) => ({
    id: d.id, src: d.url, titulo: `${this.folio()} · diseño v${d.version}`, nota: d.nota,
    detalle: `${EST_DISENO[d.estado][0]} · ${d.usuarioNombre} · ${cuando(d.creadoEn)}`,
  })));

  constructor() {
    effect(() => { void this.cargar(this.ventaId()); });
  }

  private async cargar(id: number) {
    try {
      const r = await this.api.get<{ enlace: string; disenos: DisenoPedido[] }>(`/ventas/${id}/disenos`);
      this.disenos.set(r.disenos);
      this.enlace.set(r.enlace);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.cargado.set(true);
  }

  puedeBorrar(d: DisenoPedido) { return d.estado !== 'aprobado' && (this.s.verCostos() || d.usuarioId === this.s.perfil()?.usuario.id); }
  ver(d: DisenoPedido) { this.verIndice.set(this.disenos().indexOf(d)); }

  async preparar(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const a = el.files?.[0];
    el.value = '';
    if (!a) return;
    try {
      this.nota = this.ultimo()?.nota ?? '';
      this.nuevo.set(await this.fotos.prepararDiseno(a));
    } catch (e) { this.aviso.error(e instanceof Error ? e.message : mensajeError(e)); }
  }

  async subir() {
    const n = this.nuevo();
    if (!n || this.ocupado()) return;
    this.ocupado.set(true);
    try {
      const d = await this.api.post<DisenoPedido>(`/ventas/${this.ventaId()}/disenos`, { ...n, nota: this.nota.trim() });
      this.disenos.update((l) => [d, ...l.map((x) => (x.estado === 'pendiente' ? { ...x, estado: 'reemplazado' as const } : x))]);
      this.nuevo.set(null);
      this.aviso.ok(this.telefono() ? 'Diseño guardado. Ahora mándalo por WhatsApp.' : 'Diseño guardado');
      this.cambio.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  whatsapp() { this.api.whatsapp(`/ventas/${this.ventaId()}/disenos/whatsapp`).catch((e) => this.aviso.error(mensajeError(e))); }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.enlace());
      this.aviso.ok('Enlace copiado');
    } catch { this.aviso.info(this.enlace()); }
  }

  async aprobar(via: 'whatsapp' | 'mostrador') {
    const d = this.ultimo();
    if (!d || this.ocupado()) return;
    this.ocupado.set(true);
    try {
      const r = await this.api.post<DisenoPedido>(`/disenos/${d.id}/aprobar`, { via, nota: this.notaAprobacion.trim() });
      this.disenos.update((l) => l.map((x) => (x.id === d.id ? r : x)));
      this.marcando.set(false);
      this.notaAprobacion = '';
      this.aviso.ok('Diseño aprobado. El pedido pasó a la cola.');
      this.cambio.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  async eliminar(d: DisenoPedido) {
    if (!(await this.confirmar.preguntar({ titulo: `¿Quitar la versión ${d.version}?`, texto: 'Si ya la mandaste, el cliente ya no podrá verla en el enlace.', accion: 'Quitar', peligro: true }))) return;
    this.ocupado.set(true);
    try {
      await this.api.del(`/disenos/${d.id}`);
      this.disenos.update((l) => l.filter((x) => x.id !== d.id));
      this.aviso.ok('Diseño quitado');
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }
}
