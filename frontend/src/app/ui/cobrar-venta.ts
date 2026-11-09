import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe } from '../core/formato';
import { Hoja } from './hoja';

export interface VentaPorCobrar { id: number; folio: string; cliente: string; total: number; pagado: number }

const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cobro rápido desde la lista de ventas: muestra el saldo y registra el pago sin abrir la venta. */
@Component({
  selector: 'app-cobrar-venta',
  imports: [FormsModule, Hoja, DineroPipe],
  template: `
    <app-hoja [titulo]="'Cobrar ' + venta().folio" ancho="460px" (cerrar)="cerrar.emit()">
      <p class="-mt-1 text-tenue">{{ venta().cliente }}</p>
      <div class="totales">
        <span class="k">Total</span><span class="num">{{ venta().total | dinero }}</span>
        <span class="k">Ya pagado</span><span class="num">{{ venta().pagado | dinero }}</span>
        <span class="k">Saldo</span><span class="grande num">{{ saldo() | dinero }}</span>
      </div>
      <div class="campos">
        <div class="campo"><label for="cv-m">Monto que paga</label>
          <input id="cv-m" name="monto" type="number" inputmode="decimal" min="0.01" required [ngModel]="monto()" (ngModelChange)="monto.set(+$event || 0)"></div>
        <div class="campo"><label for="cv-f">Forma de pago</label>
          <select id="cv-f" [(ngModel)]="metodo">@for (m of metodos; track m) { <option>{{ m }}</option> }</select></div>
        @if (metodo === 'Efectivo') {
          <div class="campo"><label for="cv-c">Paga con (efectivo)</label>
            <input id="cv-c" type="number" inputmode="decimal" min="0" placeholder="Opcional" [ngModel]="pagaCon()" (ngModelChange)="pagaCon.set(+$event || 0)"></div>
        }
      </div>
      @if (metodo === 'Efectivo' && cambio() > 0) { <p class="rounded-xl bg-ok-suave px-3.5 py-2 text-ok">Cambio <b class="num text-xl">{{ cambio() | dinero }}</b></p> }
      @if (monto() > saldo() + 0.009) { <p class="rounded-xl bg-warn-suave px-3.5 py-2 text-warn">El monto es mayor que el saldo.</p> }
      @else if (monto() > 0 && monto() < saldo()) { <p class="tenue chico">Queda un saldo de <span class="num">{{ saldo() - monto() | dinero }}</span>.</p> }
      <ng-container pie>
        <span class="flex-1"></span>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button>
        <button class="btn pri" (click)="registrar()" [disabled]="ocupado() || monto() <= 0 || monto() > saldo() + 0.009">
          {{ ocupado() ? 'Guardando…' : monto() >= saldo() ? 'Marcar como pagada' : 'Registrar abono' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class CobrarVenta implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  venta = input.required<VentaPorCobrar>();
  cerrar = output();
  /** Se registró el pago. */
  listo = output();
  metodos = METODOS;
  metodo = 'Efectivo';
  monto = signal(0);
  pagaCon = signal(0);
  ocupado = signal(false);
  saldo = computed(() => r2(Math.max(0, this.venta().total - this.venta().pagado)));
  cambio = computed(() => (this.metodo === 'Efectivo' && this.pagaCon() > this.monto() ? r2(this.pagaCon() - this.monto()) : 0));

  ngOnInit() { this.monto.set(this.saldo()); }

  async registrar() {
    this.ocupado.set(true);
    try {
      const r = await this.api.post<{ saldo: number }>(`/ventas/${this.venta().id}/pagos`, { monto: this.monto(), metodo: this.metodo });
      this.aviso.ok(r.saldo > 0 ? `Abono registrado. Saldo ${r.saldo.toFixed(2)}` : `${this.venta().folio} pagada`);
      this.listo.emit();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}
