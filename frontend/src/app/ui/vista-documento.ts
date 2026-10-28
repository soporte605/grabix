import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { DineroPipe, FechaPipe, hoy, sumarDias } from '../core/formato';
import { Cotizacion, EST_COT, EST_VTA, Venta } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { DatosPago } from './datos-pago';
import { FotosPedido } from './fotos-pedido';
import { Hoja } from './hoja';
import { Icono } from './icono';

/**
 * Vista previa de una venta, orden de trabajo o cotización, legible en el teléfono,
 * con accesos a PDF, impresión y WhatsApp. Se dibuja como página porque los navegadores
 * del celular casi no muestran un PDF dentro de una ventana. Producción no ve importes.
 */
@Component({
  selector: 'app-vista-documento',
  imports: [Hoja, Icono, DineroPipe, FechaPipe, FotosPedido, DatosPago],
  template: `
    @let v = venta();
    <app-hoja [titulo]="titulo()" ancho="640px" (cerrar)="cerrar.emit()">
      <span cabeza class="pill" [class]="estado()[1]">{{ estado()[0] }}</span>

      <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div><p class="chico tenue">Cliente</p><p class="font-semibold">{{ cliente() }}</p>
          @if (telefono()) { <p class="chico num tenue">{{ telefono() }}</p> }</div>
        @if (esVenta()) {
          <div><p class="chico tenue">Entrega</p>
            <p class="font-semibold" [class.text-bad]="atrasada()">{{ $any(v).entrega ? ($any(v).entrega | fecha) : 'Sin fecha' }}@if (atrasada()) { · atrasada }</p>
            <p class="chico tenue">Pedido el {{ v.fecha | fecha }}</p></div>
        } @else {
          <div><p class="chico tenue">Válida hasta</p>
            <p class="font-semibold" [class.text-bad]="vencida()">{{ vence() | fecha }}@if (vencida()) { · vencida }</p>
            <p class="chico tenue">Hecha el {{ v.fecha | fecha }}</p></div>
        }
      </div>

      <section>
        <h3 class="mb-1.5 text-base">{{ modo() === 'orden' ? 'Qué hay que hacer' : 'Conceptos' }}</h3>
        <div class="tarjeta lista">
          @for (i of v.items; track $index) {
            <div class="flex items-start gap-3 px-3.5 py-2.5">
              <span class="num grid min-w-9 flex-none place-items-center rounded-lg bg-superficie-2 px-1.5 py-1 font-semibold">{{ i.cantidad }}</span>
              <span class="min-w-0 flex-1 pt-0.5">{{ i.descripcion }}</span>
              @if (conImportes()) {
                <span class="pt-0.5 text-right"><span class="num block">{{ i.cantidad * i.precio | dinero }}</span>
                  @if (modo() === 'documento' && i.cantidad !== 1) { <span class="num block text-sm text-tenue">{{ i.precio | dinero }} c/u</span> }</span>
              }
            </div>
          }
        </div>
      </section>

      @if (v.notas) {
        <section class="rounded-xl border border-linea bg-superficie p-3"><p class="chico mb-0.5 font-semibold tenue">Notas</p><p class="whitespace-pre-line">{{ v.notas }}</p></section>
      }

      @if (conImportes()) {
        <div class="totales rounded-xl bg-superficie-2 p-3">
          @if (v.descuento) {
            <span class="k">Subtotal</span><span class="text-right">{{ v.subtotal | dinero }}</span>
            <span class="k">Descuento</span><span class="text-right">−{{ v.descuento | dinero }}</span>
          }
          <span class="k">Total</span><span class="text-right font-semibold">{{ v.total | dinero }}</span>
          @if (esVenta()) {
            <span class="k">Pagado</span><span class="text-right">{{ $any(v).pagado | dinero }}</span>
            <span class="k">Saldo</span><span class="text-right font-semibold" [class.text-bad]="$any(v).saldo > 0">{{ $any(v).saldo | dinero }}</span>
          }
          @if (anticipo(); as a) { <span class="k">{{ a.texto }}</span><span class="text-right font-semibold text-marca">{{ a.monto | dinero }}</span> }
        </div>
        @if (modo() === 'documento') {
          @if (sucursal()?.condiciones?.trim(); as c) { <section class="rounded-xl border border-linea bg-superficie p-3"><p class="chico mb-0.5 font-semibold tenue">Condiciones</p><p class="chico whitespace-pre-line">{{ c }}</p></section> }
          @if (porPagar()) { <app-datos-pago [sucursal]="sucursal()" /> }
        }
      }
      @if (esVenta() && modo() === 'documento' && v.id) { <app-fotos-pedido [ventaId]="v.id" [folio]="v.folio" /> }

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
export class VistaDocumento {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  private s = inject(SesionService);
  venta = input.required<Venta | Cotizacion>();
  tipo = input<'venta' | 'cotizacion'>('venta');
  /** 'orden' para el taller (qué hacer); 'documento' muestra precios unitarios. */
  modo = input<'orden' | 'documento'>('documento');
  /** Muestra "Cancelar pedido" (solo ventas y solo gerencia/encargado). */
  conCancelar = input(true);
  cerrar = output();
  /** Se canceló el pedido: la lista debe recargarse. */
  cambio = output();

  esVenta = computed(() => this.tipo() === 'venta');
  titulo = computed(() => `${this.modo() === 'orden' ? 'Orden' : this.esVenta() ? 'Venta' : 'Cotización'} ${this.venta().folio}`);
  estado = computed(() => (this.esVenta() ? EST_VTA : EST_COT)[this.venta().estado as never] as [string, string]);
  vence = computed(() => sumarDias(String(this.venta().fecha).slice(0, 10), (this.venta() as Cotizacion).vigenciaDias ?? 15));
  vencida = computed(() => !this.esVenta() && ['borrador', 'enviada'].includes(this.venta().estado) && this.vence() < hoy());
  ocupado = signal(false);
  conImportes = computed(() => this.s.rol() !== 'produccion');
  puedeCancelar = computed(() => this.esVenta() && this.conCancelar() && this.s.verCostos() && !['cancelada', 'entregada'].includes(this.venta().estado));
  /** Sucursal del documento: de ahí salen anticipo, condiciones y datos bancarios. */
  sucursal = computed(() => this.s.perfil()?.sucursales.find((x) => x.id === this.venta().sucursalId) ?? null);
  porPagar = computed(() => {
    const v = this.venta() as Venta;
    return this.esVenta() ? v.estado !== 'cancelada' && v.total - v.pagado > 0 : v.total > 0;
  });
  anticipo = computed(() => {
    const pct = this.sucursal()?.anticipoPct ?? 0, v = this.venta() as Venta;
    if (!pct || !this.porPagar()) return null;
    const a = Math.round(v.total * pct) / 100;
    if (!this.esVenta()) return { texto: `Anticipo para iniciar (${pct}%)`, monto: a };
    return v.pagado < a ? { texto: `Falta para iniciar (${pct}%)`, monto: Math.round((a - v.pagado) * 100) / 100 } : null;
  });
  cliente = computed(() => this.venta().cliente?.nombre || this.venta().clienteNombre || 'Mostrador');
  telefono = computed(() => this.venta().cliente?.telefono || this.venta().clienteTelefono || '');
  atrasada = computed(() => {
    const v = this.venta() as Venta;
    return !['entregada', 'cancelada'].includes(v.estado) && !!v.entrega && String(v.entrega).slice(0, 10) < hoy();
  });

  private url() { return `/${this.esVenta() ? 'ventas' : 'cotizaciones'}/${this.venta().id}`; }
  descargar() { this.api.descargarPdf(`${this.url()}/pdf`, this.venta().folio).catch((e) => this.aviso.error(mensajeError(e))); }
  abrir() { this.api.abrirPdf(`${this.url()}/pdf`).catch((e) => this.aviso.error(mensajeError(e))); }
  whatsapp() { this.api.whatsapp(`${this.url()}/whatsapp`).catch((e) => this.aviso.error(mensajeError(e))); }

  async cancelar() {
    const v = this.venta() as Venta;
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
