import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { DineroPipe, FechaPipe, hoy } from '../core/formato';
import { EST_VTA, Venta } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Hoja } from './hoja';
import { Icono } from './icono';

/**
 * Orden de trabajo de un pedido en una ventana legible en el teléfono:
 * qué hacer, para quién y para cuándo, con accesos a PDF, impresión y WhatsApp.
 * Producción no ve importes.
 */
@Component({
  selector: 'app-orden-venta',
  imports: [Hoja, Icono, DineroPipe, FechaPipe],
  template: `
    @let v = venta();
    <app-hoja [titulo]="'Orden ' + v.folio" ancho="640px" (cerrar)="cerrar.emit()">
      <span cabeza class="pill" [class]="est[v.estado][1]">{{ est[v.estado][0] }}</span>

      <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div><p class="chico tenue">Cliente</p><p class="font-semibold">{{ cliente() }}</p>
          @if (telefono()) { <p class="chico num tenue">{{ telefono() }}</p> }</div>
        <div><p class="chico tenue">Entrega</p>
          <p class="font-semibold" [class.text-bad]="atrasada()">{{ v.entrega ? (v.entrega | fecha) : 'Sin fecha' }}@if (atrasada()) { · atrasada }</p>
          <p class="chico tenue">Pedido el {{ v.fecha | fecha }}</p></div>
      </div>

      <section>
        <h3 class="mb-1.5 text-base">Qué hay que hacer</h3>
        <div class="tarjeta lista">
          @for (i of v.items; track $index) {
            <div class="flex items-start gap-3 px-3.5 py-2.5">
              <span class="num grid min-w-9 flex-none place-items-center rounded-lg bg-superficie-2 px-1.5 py-1 font-semibold">{{ i.cantidad }}</span>
              <span class="min-w-0 flex-1 pt-0.5">{{ i.descripcion }}</span>
              @if (conImportes()) { <span class="num pt-0.5 text-tenue">{{ i.cantidad * i.precio | dinero }}</span> }
            </div>
          }
        </div>
      </section>

      @if (v.notas) {
        <section class="rounded-xl border border-linea bg-superficie p-3"><p class="chico mb-0.5 font-semibold tenue">Notas del pedido</p><p class="whitespace-pre-line">{{ v.notas }}</p></section>
      }

      @if (conImportes()) {
        <div class="totales rounded-xl bg-superficie-2 p-3">
          @if (v.descuento) { <span class="k">Descuento</span><span class="text-right">−{{ v.descuento | dinero }}</span> }
          <span class="k">Total</span><span class="text-right font-semibold">{{ v.total | dinero }}</span>
          <span class="k">Pagado</span><span class="text-right">{{ v.pagado | dinero }}</span>
          <span class="k">Saldo</span><span class="text-right font-semibold" [class.text-bad]="v.saldo > 0">{{ v.saldo | dinero }}</span>
        </div>
      }

      <ng-container pie>
        @if (puedeCancelar()) { <button class="btn peligro max-sm:order-last max-sm:w-full" (click)="cancelar()" [disabled]="ocupado()">Cancelar pedido</button> }
        <div class="grid flex-1 auto-cols-fr grid-flow-col gap-2 sm:flex sm:justify-end">
          @if (conImportes() && telefono()) { <button class="btn wa justify-center" (click)="whatsapp()" [disabled]="ocupado()"><app-icono nombre="wa" />WhatsApp</button> }
          <button class="btn justify-center" (click)="abrir()" [disabled]="ocupado()"><app-icono nombre="imprimir" />Imprimir</button>
          <button class="btn pri justify-center" (click)="descargar()" [disabled]="ocupado()" sin-validar><app-icono nombre="descargar" />PDF</button>
        </div>
      </ng-container>
    </app-hoja>
  `,
})
export class OrdenVenta {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  private s = inject(SesionService);
  venta = input.required<Venta>();
  cerrar = output();
  /** Se canceló el pedido: la lista debe recargarse. */
  cambio = output();

  est = EST_VTA;
  ocupado = signal(false);
  conImportes = computed(() => this.s.rol() !== 'produccion');
  puedeCancelar = computed(() => this.s.verCostos() && this.venta().estado !== 'cancelada' && this.venta().estado !== 'entregada');
  cliente = computed(() => this.venta().cliente?.nombre || this.venta().clienteNombre || 'Mostrador');
  telefono = computed(() => this.venta().cliente?.telefono || this.venta().clienteTelefono || '');
  atrasada = computed(() => !!this.venta().entrega && String(this.venta().entrega).slice(0, 10) < hoy());

  private url() { return `/ventas/${this.venta().id}`; }
  descargar() { this.api.descargarPdf(`${this.url()}/pdf`, this.venta().folio).catch((e) => this.aviso.error(mensajeError(e))); }
  abrir() { this.api.abrirPdf(`${this.url()}/pdf`).catch((e) => this.aviso.error(mensajeError(e))); }
  whatsapp() { this.api.whatsapp(`${this.url()}/whatsapp`).catch((e) => this.aviso.error(mensajeError(e))); }

  async cancelar() {
    const v = this.venta();
    const ok = await this.confirmar.preguntar({
      titulo: `¿Cancelar el pedido ${v.folio}?`,
      texto: v.pagado > 0
        ? `Sale del tablero y regresa el material al inventario. Tiene ${v.pagado.toFixed(2)} pagados: si devuelves dinero, regístralo como salida en Caja.`
        : 'Sale del tablero y regresa el material al inventario. Queda en Ventas como cancelado.',
      accion: 'Cancelar pedido', peligro: true,
    });
    if (!ok) return;
    this.ocupado.set(true);
    try {
      await this.api.patch(`${this.url()}/estado`, { estado: 'cancelada' });
      this.aviso.ok(`${v.folio} cancelado`);
      this.cambio.emit();
      this.cerrar.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }
}
