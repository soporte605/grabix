import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, FechaPipe } from '../core/formato';
import { Venta } from '../core/modelos';
import { VentaHecha as Datos } from '../core/pos.service';
import { SesionService } from '../core/sesion.service';
import { AnchoTicket, imprimirTicket, ticketHtml } from '../core/ticket';
import { Hoja } from './hoja';
import { Icono } from './icono';

const CLAVE_ANCHO = 'grabix.ticket-ancho';

/** Ventana de "venta realizada" estilo punto de venta: resumen, cambio, ticket con vista previa, nota PDF y WhatsApp. */
@Component({
  selector: 'app-venta-hecha',
  imports: [Hoja, Icono, DineroPipe, FechaPipe],
  template: `
    <app-hoja [titulo]="datos().nueva ? 'Venta registrada' : 'Ticket ' + (v()?.folio ?? '')" ancho="900px" (cerrar)="cerrar.emit()">
      @if (v(); as v) {
        <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="flex flex-col gap-4">
            @if (datos().nueva) {
              <div class="flex items-center gap-3">
                <span class="flex size-12 flex-none items-center justify-center rounded-full bg-ok-suave text-[1.5rem] text-ok motion-safe:animate-entra"><app-icono nombre="ok" /></span>
                <div>
                  <p class="font-titulo text-[1.2rem] font-bold">¡Listo! Venta <span class="num">{{ v.folio }}</span></p>
                  <p class="chico tenue">{{ v.cliente?.nombre || v.clienteNombre || 'Público en general' }} · {{ v.items.length }} concepto{{ v.items.length === 1 ? '' : 's' }}</p>
                </div>
              </div>
            }

            <div class="grid grid-cols-2 gap-2.5">
              <div class="rounded-xl bg-superficie-2 p-3.5"><p class="chico tenue">Total</p><p class="num text-[1.6rem] font-semibold">{{ v.total | dinero }}</p></div>
              @if (datos().cambio) {
                <div class="rounded-xl bg-ok-suave p-3.5 text-ok"><p class="chico font-semibold">Cambio</p><p class="num text-[1.6rem] font-semibold">{{ datos().cambio! | dinero }}</p></div>
              } @else {
                @if (saldo() > 0) {
                  <div class="rounded-xl bg-warn-suave p-3.5 text-warn"><p class="chico font-semibold">Saldo por cobrar</p><p class="num text-[1.6rem] font-semibold">{{ saldo() | dinero }}</p></div>
                } @else {
                  <div class="flex items-center gap-2.5 rounded-xl bg-ok-suave p-3.5 text-ok"><app-icono nombre="ok" class="text-[1.6rem]" /><div><p class="font-titulo text-[1.15rem] font-bold">Pagada</p><p class="chico">Sin saldo pendiente</p></div></div>
                }
              }
            </div>
            <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[.92rem] [&_dd]:font-mono [&_dd]:tabular-nums [&_dd]:text-right [&_dt]:text-tenue">
              @for (p of v.pagos; track p.id) { <dt>Pago {{ p.metodo.toLowerCase() }}</dt><dd>{{ p.monto | dinero }}</dd> }
              @if (v.pagos.length !== 1) { <dt>Total pagado</dt><dd>{{ v.pagado | dinero }}</dd> }
              @if (datos().recibido) { <dt>Recibido en efectivo</dt><dd>{{ datos().recibido! | dinero }}</dd> }
              @if (datos().cambio) { <dt>Saldo</dt><dd>{{ saldo() | dinero }}</dd> }
              @if (v.entrega) { <dt>Entrega</dt><dd>{{ v.entrega | fecha }}</dd> }
            </dl>

            <div class="mt-auto grid grid-cols-2 gap-2 pt-1">
              <button class="btn pri col-span-2 min-h-12 text-[1rem]" (click)="imprimir()"><app-icono nombre="imprimir" />Imprimir ticket</button>
              <button class="btn min-h-11" (click)="descargar()" [disabled]="ocupado()"><app-icono nombre="descargar" />Descargar nota</button>
              <button class="btn wa min-h-11" (click)="whatsapp()" [disabled]="ocupado()"><app-icono nombre="wa" />WhatsApp</button>
            </div>
            <button class="btn md:hidden" (click)="verPrevia.set(!verPrevia())">{{ verPrevia() ? 'Ocultar ticket' : 'Ver ticket' }}</button>
          </div>

          <div class="flex-col items-center gap-2.5 rounded-xl bg-superficie-2 p-3.5 md:flex" [class.hidden]="!verPrevia()" [class.flex]="verPrevia()">
            <div class="chips" role="group" aria-label="Ancho del papel">
              @for (a of anchos; track a) { <button class="chip" [class.on]="ancho() === a" (click)="cambiarAncho(a)">{{ a }} mm</button> }
            </div>
            <iframe class="rounded-sm bg-white shadow-caja" [style.width.mm]="ancho()" [style.height.px]="alto()" [attr.srcdoc]="previa()" title="Vista previa del ticket" (load)="medir($event)"></iframe>
            <p class="max-w-[260px] text-center text-[.74rem] text-tenue">Elige el ancho de tu impresora térmica. Se guarda en este equipo.</p>
          </div>
        </div>
      } @else {
        <div class="h-60 animate-pulse rounded-xl bg-superficie-2"></div>
      }
      <ng-container pie>
        <button class="btn" (click)="ver()">Ver venta</button>
        <span class="flex-1"></span>
        @if (datos().nueva) { <button class="btn" (click)="nueva.emit()"><app-icono nombre="mas1" />Nueva venta</button> }
        <button class="btn pri" (click)="cerrar.emit()">Listo</button>
      </ng-container>
    </app-hoja>
  `,
})
export class VentaHechaVentana implements OnInit {
  datos = input.required<Datos>();
  cerrar = output();
  nueva = output();

  private api = inject(Api);
  private aviso = inject(AvisoService);
  private s = inject(SesionService);
  private router = inject(Router);
  private san = inject(DomSanitizer);

  v = signal<Venta | null>(null);
  ocupado = signal(false);
  verPrevia = signal(false);
  anchos: AnchoTicket[] = [58, 80];
  ancho = signal<AnchoTicket>(leerAncho());
  alto = signal(420);
  saldo = computed(() => Math.max(0, (this.v()?.total ?? 0) - (this.v()?.pagado ?? 0)));
  private html = computed(() => {
    const v = this.v(), t = this.s.taller();
    if (!v || !t) return '';
    const sucursal = this.s.perfil()?.sucursales.find((x) => x.id === v.sucursalId);
    return ticketHtml({ venta: v, taller: t, sucursal, ancho: this.ancho(), recibido: this.datos().recibido, cambio: this.datos().cambio });
  });
  // El HTML del ticket se arma escapando todos los datos del cliente.
  previa = computed(() => this.san.bypassSecurityTrustHtml(this.html()));

  async ngOnInit() {
    try {
      this.v.set(await this.api.get<Venta>(`/ventas/${this.datos().id}`));
    } catch (e) {
      this.aviso.error(mensajeError(e));
      this.cerrar.emit();
    }
  }

  medir(ev: Event) {
    const d = (ev.target as HTMLIFrameElement).contentDocument;
    if (d?.body) this.alto.set(Math.min(430, d.documentElement.scrollHeight + 4));
  }

  cambiarAncho(a: AnchoTicket) {
    this.ancho.set(a);
    try { localStorage.setItem(CLAVE_ANCHO, String(a)); } catch { /* sin almacenamiento */ }
  }

  imprimir() { if (this.html()) imprimirTicket(this.html()); }

  async descargar() {
    const v = this.v()!;
    this.ocupado.set(true);
    await this.api.descargarPdf(`/ventas/${v.id}/pdf`, `Nota ${v.folio}`).catch((e) => this.aviso.error(mensajeError(e)));
    this.ocupado.set(false);
  }

  async whatsapp() {
    await this.api.whatsapp(`/ventas/${this.v()!.id}/whatsapp`).catch((e) => this.aviso.error(mensajeError(e)));
  }

  ver() {
    this.cerrar.emit();
    this.router.navigate(['/app/ventas', this.datos().id]);
  }
}

function leerAncho(): AnchoTicket {
  try { return localStorage.getItem(CLAVE_ANCHO) === '58' ? 58 : 80; } catch { return 80; }
}
