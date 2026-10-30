import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { DineroPipe } from '../core/formato';
import { ComprobantePedido } from '../core/modelos';
import { Icono } from './icono';
import { FotoVisor, VisorFotos } from './visor-fotos';

const cuando = (f: string) => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ESTADO: Record<ComprobantePedido['estado'], [string, string]> = {
  pendiente: ['Por revisar', 'warn'], aplicado: ['Pago registrado', 'ok'], descartado: ['No válido', 'mut'],
};

/** Comprobantes de transferencia que el cliente subió en su enlace; al revisarlos se registra el pago. */
@Component({
  selector: 'app-comprobantes-pedido',
  imports: [FormsModule, Icono, DineroPipe, VisorFotos],
  template: `
    @if (lista().length) {
      <section>
        <h3 class="mb-1.5 text-base">Comprobantes del cliente @if (pendientes()) { <span class="pill warn">{{ pendientes() }} por revisar</span> }</h3>
        <div class="tarjeta lista">
          @for (c of lista(); track c.id; let i = $index) {
            <div class="flex items-start gap-3 px-3.5 py-2.5">
              <button type="button" class="size-16 flex-none overflow-hidden rounded-lg bg-white" (click)="verIndice.set(i)" aria-label="Ver comprobante">
                <img [src]="c.mini" alt="Comprobante" class="size-full object-cover"></button>
              <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="pill" [class]="estado[c.estado][1]">{{ estado[c.estado][0] }}</span>
                  <span class="chico tenue">{{ cuando(c.creadoEn) }}</span>
                </div>
                <p class="chico">@if (c.monto) { Dice que pagó <b class="num">{{ c.monto | dinero }}</b> } @else { No escribió el monto }@if (c.nota) { · {{ c.nota }} }</p>
                @if (c.estado === 'pendiente') {
                  @if (aplicando() === c.id) {
                    <div class="flex flex-wrap items-center gap-2">
                      <input class="entrada num w-32" type="number" inputmode="decimal" min="0.01" [(ngModel)]="monto" aria-label="Monto recibido">
                      <button type="button" class="btn sm pri" sin-validar (click)="aplicar(c)" [disabled]="ocupado()">Registrar pago</button>
                      <button type="button" class="btn sm" (click)="aplicando.set(null)">Cancelar</button>
                    </div>
                    <p class="chico tenue">Confirma en tu banca que el dinero llegó. Se registra como transferencia.</p>
                  } @else {
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="btn sm pri" sin-validar (click)="empezar(c)"><app-icono nombre="ok" />Ya llegó, registrar</button>
                      <button type="button" class="btn sm" (click)="descartar(c)" [disabled]="ocupado()">No es válido</button>
                    </div>
                  }
                } @else if (c.revisadoPor) { <p class="chico tenue">Revisó {{ c.revisadoPor }}</p> }
              </div>
            </div>
          }
        </div>
      </section>
    }
    @if (verIndice() !== null) {
      <app-visor-fotos [fotos]="visor()" [indice]="verIndice()!" (indiceChange)="verIndice.set($event)" (cerrar)="verIndice.set(null)" />
    }
  `,
})
export class ComprobantesPedido {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  ventaId = input.required<number>();
  saldo = input(0);
  /** Se registró un pago: hay que recargar la venta. */
  cambio = output();

  estado = ESTADO;
  cuando = cuando;
  lista = signal<ComprobantePedido[]>([]);
  aplicando = signal<number | null>(null);
  ocupado = signal(false);
  monto: number | null = null;
  verIndice = signal<number | null>(null);
  pendientes = computed(() => this.lista().filter((c) => c.estado === 'pendiente').length);
  visor = computed<FotoVisor[]>(() => this.lista().map((c) => ({ id: c.id, src: c.url, titulo: 'Comprobante', detalle: cuando(c.creadoEn), nota: c.nota })));

  constructor() {
    effect(() => { void this.cargar(this.ventaId()); });
  }

  private async cargar(id: number) {
    try { this.lista.set(await this.api.get<ComprobantePedido[]>(`/ventas/${id}/comprobantes`)); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }

  empezar(c: ComprobantePedido) {
    this.monto = c.monto > 0 ? Math.min(c.monto, this.saldo() || c.monto) : this.saldo() || null;
    this.aplicando.set(c.id);
  }

  async aplicar(c: ComprobantePedido) {
    const m = Number(this.monto);
    if (!(m > 0) || this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.api.post(`/comprobantes/${c.id}/aplicar`, { monto: m });
      this.aplicando.set(null);
      await this.cargar(this.ventaId());
      this.aviso.ok('Pago registrado');
      this.cambio.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  async descartar(c: ComprobantePedido) {
    if (!(await this.confirmar.preguntar({ titulo: '¿Marcar como no válido?', texto: 'No se registra ningún pago. Avísale al cliente por WhatsApp si hace falta.', accion: 'No es válido', peligro: true }))) return;
    this.ocupado.set(true);
    try {
      await this.api.post(`/comprobantes/${c.id}/descartar`);
      await this.cargar(this.ventaId());
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }
}
