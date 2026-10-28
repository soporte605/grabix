import { Component, computed, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe } from '../core/formato';
import { CajaTurno, DetalleTurno } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { corteHtml, imprimirTicket } from '../core/ticket';
import { Hoja } from './hoja';
import { Icono } from './icono';

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Billetes y monedas de México, de mayor a menor. */
const BILLETES = [1000, 500, 200, 100, 50, 20];
const MONEDAS = [10, 5, 2, 1, 0.5];

/** Apertura de caja: fondo inicial (propone lo que dejó el último corte). */
@Component({
  selector: 'app-abrir-caja',
  imports: [FormsModule, Hoja, DineroPipe],
  template: `
    <app-hoja titulo="Abrir caja" ancho="460px" (cerrar)="cerrar.emit()">
      <p class="tenue">Cuenta el efectivo con el que empiezas: es el fondo para dar cambio.</p>
      @if (ultimo(); as u) { <p class="chico rounded-lg bg-superficie-2 px-3 py-2">El último corte ({{ u.folio }}, {{ u.cerroNombre }}) dejó <b class="num">{{ u.dejado | dinero }}</b> en caja.</p> }
      <div class="campo"><label for="ac-f">Fondo inicial</label><input id="ac-f" class="num text-xl" type="number" inputmode="decimal" min="0" [(ngModel)]="fondo" (keydown.enter)="abrir()"></div>
      <div class="campo"><label for="ac-n">Notas (opcional)</label><input id="ac-n" [(ngModel)]="notas" maxlength="500"></div>
      <ng-container pie>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button><span class="flex-1"></span>
        <button class="btn pri" (click)="abrir()" [disabled]="ocupado()">{{ ocupado() ? 'Abriendo…' : 'Abrir caja' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class AbrirCaja implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  sugerido = input(0);
  ultimo = input<{ folio: string; cerroNombre: string; dejado: number } | null>(null);
  cerrar = output();
  abierta = output();
  fondo = 0;
  notas = '';
  ocupado = signal(false);
  ngOnInit() { this.fondo = this.sugerido(); }
  async abrir() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.api.post('/caja/turno', { fondo: Number(this.fondo) || 0, notas: this.notas });
      this.aviso.ok('Caja abierta');
      this.abierta.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}

/** Entrada o salida de efectivo durante el turno (retiro, gasto, cambio que traen…). */
@Component({
  selector: 'app-movimiento-caja',
  imports: [FormsModule, Hoja],
  template: `
    <app-hoja titulo="Entrada o salida de efectivo" ancho="460px" (cerrar)="cerrar.emit()">
      <div class="grid grid-cols-2 gap-2">
        <button class="rounded-xl border-2 py-3 font-semibold" [class]="tipo() === 'salida' ? 'border-marca bg-marca-suave text-marca' : 'border-linea'" (click)="tipo.set('salida')">Salida</button>
        <button class="rounded-xl border-2 py-3 font-semibold" [class]="tipo() === 'entrada' ? 'border-marca bg-marca-suave text-marca' : 'border-linea'" (click)="tipo.set('entrada')">Entrada</button>
      </div>
      <p class="chico tenue">{{ tipo() === 'salida' ? 'Efectivo que sale del cajón: pago a proveedor, gasto, retiro parcial.' : 'Efectivo que entra sin ser venta: cambio que traen, reposición de fondo.' }}</p>
      <div class="campo"><label for="mc-m">Monto</label><input id="mc-m" class="num text-xl" type="number" inputmode="decimal" min="0" [(ngModel)]="monto"></div>
      <div class="campo"><label for="mc-c">Concepto</label><input id="mc-c" [(ngModel)]="concepto" maxlength="200" [placeholder]="tipo() === 'salida' ? 'Ej. Pago de garrafón' : 'Ej. Cambio del banco'" (keydown.enter)="guardar()"></div>
      <ng-container pie>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button><span class="flex-1"></span>
        <button class="btn pri" (click)="guardar()" [disabled]="ocupado() || !valido()">Registrar {{ tipo() }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class MovimientoCaja {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  cerrar = output();
  guardado = output();
  tipo = signal<'entrada' | 'salida'>('salida');
  monto: number | null = null;
  concepto = '';
  ocupado = signal(false);
  valido() { return Number(this.monto) > 0 && !!this.concepto.trim(); }
  async guardar() {
    if (this.ocupado() || !this.valido()) return;
    this.ocupado.set(true);
    try {
      await this.api.post('/caja/turno/movimientos', { tipo: this.tipo(), monto: Number(this.monto), concepto: this.concepto.trim() });
      this.aviso.ok(this.tipo() === 'salida' ? 'Salida registrada' : 'Entrada registrada');
      this.guardado.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}

/** Corte de caja: cobros del turno, efectivo esperado contra contado, lo que se deja y el retiro. */
@Component({
  selector: 'app-cerrar-caja',
  imports: [FormsModule, Hoja, Icono, DineroPipe],
  template: `
    <app-hoja [titulo]="'Corte de caja ' + turno().folio" ancho="640px" (cerrar)="cerrar.emit()">
      @if (turno().resumen; as r) {
        <div class="grid gap-3 sm:grid-cols-2">
          <section class="rounded-xl border border-linea bg-superficie p-3">
            <h3 class="mb-1.5 text-base">Cobros del turno</h3>
            @for (k of metodos(); track k) { <div class="flex justify-between text-base"><span class="text-tenue">{{ k }}</span><span class="num">{{ r.porMetodo[k] | dinero }}</span></div> }
            @empty { <p class="chico tenue">Sin cobros todavía.</p> }
            <div class="mt-1.5 flex justify-between border-t border-linea pt-1.5 font-semibold"><span>Total ({{ r.ventas }} {{ r.ventas === 1 ? 'venta' : 'ventas' }})</span><span class="num">{{ r.cobrado | dinero }}</span></div>
          </section>
          <section class="rounded-xl border border-linea bg-superficie p-3">
            <h3 class="mb-1.5 text-base">Efectivo esperado</h3>
            <div class="flex justify-between text-base"><span class="text-tenue">Fondo inicial</span><span class="num">{{ turno().fondo | dinero }}</span></div>
            <div class="flex justify-between text-base"><span class="text-tenue">+ Cobros en efectivo</span><span class="num">{{ r.porMetodo['Efectivo'] | dinero }}</span></div>
            @if (r.entradas) { <div class="flex justify-between text-base"><span class="text-tenue">+ Entradas</span><span class="num">{{ r.entradas | dinero }}</span></div> }
            @if (r.salidas) { <div class="flex justify-between text-base"><span class="text-tenue">− Salidas</span><span class="num">{{ r.salidas | dinero }}</span></div> }
            <div class="mt-1.5 flex justify-between border-t border-linea pt-1.5 font-semibold"><span>Debe haber</span><span class="num">{{ r.esperado | dinero }}</span></div>
          </section>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-lg">¿Cuánto efectivo hay en el cajón?</h3>
          <div class="chips"><button class="chip" [class.on]="!porPiezas()" (click)="porPiezas.set(false)">Total</button><button class="chip" [class.on]="porPiezas()" (click)="porPiezas.set(true)">Billetes y monedas</button></div>
        </div>
        @if (porPiezas()) {
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            @for (d of denominaciones; track d) {
              <label class="flex items-center gap-2 text-base"><span class="num w-14 text-right text-tenue">{{ d | dinero }}</span><span class="text-tenue">×</span>
                <input class="entrada num w-16 p-1.5 text-right" type="number" inputmode="numeric" min="0" [ngModel]="piezas()[d] || null" (ngModelChange)="pieza(d, +$event)" [attr.aria-label]="'Piezas de ' + d"></label>
            }
          </div>
        } @else {
          <input #campoContado class="entrada num text-xl" type="number" inputmode="decimal" min="0" placeholder="Escribe el efectivo contado" [ngModel]="tocado() ? contadoLibre() : null"
            (ngModelChange)="contadoLibre.set(+$event || 0); tocado.set($event !== null && $event !== '')" aria-label="Efectivo contado">
        }

        <div class="grid grid-cols-2 gap-2.5">
          <div class="rounded-xl bg-superficie-2 p-3.5"><p class="chico tenue">Contado</p><p class="num text-2xl font-semibold">{{ contado() | dinero }}</p></div>
          <div class="rounded-xl p-3.5" [class]="!tocado() ? 'bg-superficie-2' : diferencia() === 0 ? 'bg-ok-suave text-ok' : diferencia() > 0 ? 'bg-warn-suave text-warn' : 'bg-bad-suave text-bad'">
            <p class="chico font-semibold">{{ !tocado() ? 'Diferencia' : diferencia() === 0 ? 'Cuadra' : diferencia() > 0 ? 'Sobran' : 'Faltan' }}</p>
            @if (tocado()) { <p class="num text-2xl font-semibold">{{ (diferencia() < 0 ? -diferencia() : diferencia()) | dinero }}</p> }
            @else { <p class="pt-1.5 text-base text-tenue">Aparece al capturar lo contado</p> }
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="campo"><label for="cc-d">Se deja en caja para el siguiente turno</label>
            <input id="cc-d" class="num" type="number" inputmode="decimal" min="0" [ngModel]="dejado()" (ngModelChange)="dejadoManual.set(+$event || 0)">
            <div class="mt-1 flex gap-1.5"><button class="chip" (click)="dejadoManual.set(turno().fondo)">Mismo fondo ({{ turno().fondo | dinero }})</button><button class="chip" (click)="dejadoManual.set(0)">Nada</button></div>
            @if (tocado() && retiro() < 0) { <p class="chico mt-1 text-bad">No puedes dejar más de lo que contaste.</p> }
          </div>
          <div class="rounded-xl border border-linea p-3"><p class="chico tenue">Retiro (se lleva)</p>@if (tocado()) { <p class="num text-2xl font-semibold" [class.text-bad]="retiro() < 0">{{ retiro() | dinero }}</p> }
            @else { <p class="pt-1.5 text-base text-tenue">Contado menos lo que se deja</p> }</div>
        </div>
        <div class="campo"><label for="cc-n">Notas del corte {{ tocado() && diferencia() !== 0 ? '(explica la diferencia)' : '(opcional)' }}</label><textarea id="cc-n" rows="2" [(ngModel)]="notas" maxlength="1000"></textarea></div>
      }
      <ng-container pie>
        <button class="btn" (click)="cerrar.emit()">Volver</button><span class="flex-1"></span>
        @if (falta(); as f) { <span class="chico self-center text-tenue">{{ f }}</span> }
        <button class="btn pri" (click)="confirmar()" [disabled]="ocupado() || !!falta()"><app-icono nombre="caja" />{{ ocupado() ? 'Cerrando…' : 'Cerrar caja' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class CerrarCaja implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private s = inject(SesionService);
  turno = input.required<CajaTurno>();
  cerrar = output();
  cerrada = output<DetalleTurno>();

  denominaciones = [...BILLETES, ...MONEDAS];
  porPiezas = signal(false);
  piezas = signal<Record<number, number>>({});
  contadoLibre = signal(0);
  tocado = signal(false);
  /** Lo que se deja: el fondo (sin pasar de lo contado) mientras no lo cambien a mano. */
  dejadoManual = signal<number | null>(null);
  dejado = computed(() => this.dejadoManual() ?? Math.min(this.turno().fondo, this.tocado() ? this.contado() : this.turno().fondo));
  notas = '';
  ocupado = signal(false);

  metodos = computed(() => Object.keys(this.turno().resumen?.porMetodo ?? {}));
  contado = computed(() => this.porPiezas() ? r2(Object.entries(this.piezas()).reduce((a, [d, n]) => a + Number(d) * (n || 0), 0)) : this.contadoLibre());
  diferencia = computed(() => r2(this.contado() - (this.turno().resumen?.esperado ?? 0)));
  retiro = computed(() => r2(this.contado() - this.dejado()));

  falta = computed(() => (!this.tocado() ? 'Captura el efectivo contado' : this.retiro() < 0 ? 'Ajusta lo que se deja' : ''));
  private campo = viewChild<ElementRef<HTMLInputElement>>('campoContado');
  ngOnInit() { setTimeout(() => this.campo()?.nativeElement.focus(), 150); }
  pieza(d: number, n: number) { this.piezas.update((p) => ({ ...p, [d]: Math.max(0, Math.floor(n || 0)) })); this.tocado.set(true); }

  async confirmar() {
    if (this.ocupado() || this.falta()) return;
    this.ocupado.set(true);
    try {
      const conteo = this.porPiezas() ? Object.fromEntries(Object.entries(this.piezas()).filter(([, n]) => n > 0)) : undefined;
      const t = await this.api.post<CajaTurno>('/caja/turno/cerrar', { contado: this.contado(), dejado: this.dejado(), conteo, notas: this.notas });
      this.aviso.ok('Caja cerrada');
      this.cerrada.emit(await this.api.get<DetalleTurno>(`/caja/turnos/${t.id}`));
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}

/** Imprime el ticket del corte con el ancho de ticket elegido en la caja. */
export function imprimirCorte(t: DetalleTurno, s: SesionService) {
  const taller = s.taller();
  if (!taller) return;
  const suc = s.perfil()?.sucursales.find((x) => x.id === t.sucursalId)?.nombre ?? '';
  let ancho: 58 | 80 = 80;
  try { if (localStorage.getItem('grabix.ticket-ancho') === '58') ancho = 58; } catch { /* sin almacenamiento */ }
  imprimirTicket(corteHtml(t, taller, suc, ancho));
}
