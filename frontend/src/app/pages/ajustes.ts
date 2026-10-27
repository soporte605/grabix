import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, FechaPipe } from '../core/formato';
import { Taller } from '../core/modelos';
import { SesionService } from '../core/sesion.service';

@Component({
  selector: 'app-ajustes',
  imports: [FormsModule, DineroPipe, FechaPipe],
  template: `
    <div class="encabezado"><div><h1>Ajustes y plan</h1><p>Datos que aparecen en tus PDF y valores para calcular costos.</p></div></div>
    @if (t(); as t) {
      <div class="rejilla" style="max-width:820px">
        <section class="caja">
          <h3>Tu negocio</h3>
          <div class="campos">
            <div class="campo todo"><label for="a-n">Nombre comercial</label><input id="a-n" [(ngModel)]="t.nombre"></div>
            <div class="campo"><label for="a-t">WhatsApp / teléfono</label><input id="a-t" type="tel" [(ngModel)]="t.telefono"></div>
            <div class="campo"><label for="a-e">Correo</label><input id="a-e" type="email" [(ngModel)]="t.email"></div>
            <div class="campo todo"><label for="a-d">Dirección</label><input id="a-d" [(ngModel)]="t.direccion"></div>
          </div>
        </section>
        <section class="caja">
          <h3>Costos y precios</h3>
          <div class="campos c3">
            <div class="campo"><label for="a-tm">Costo de máquina por minuto</label><input id="a-tm" type="number" inputmode="decimal" [(ngModel)]="t.tarifaMinuto"></div>
            <div class="campo"><label for="a-mg">Margen objetivo (%)</label><input id="a-mg" type="number" [(ngModel)]="t.margenObjetivo"></div>
            <div class="campo"><label for="a-v">Vigencia de cotizaciones (días)</label><input id="a-v" type="number" [(ngModel)]="t.vigenciaDias"></div>
            <div class="campo"><label for="a-mo">Moneda</label><input id="a-mo" [(ngModel)]="t.moneda"></div>
            <div class="campo"><label for="a-l">Lada de país (WhatsApp)</label><input id="a-l" [(ngModel)]="t.lada"></div>
          </div>
          <p class="tenue chico">El costo por minuto cubre luz, desgaste del tubo y lentes, y tu tiempo. Para estimarlo: (gasto mensual de la máquina + sueldo que te asignas) ÷ minutos de trabajo al mes.</p>
        </section>
        <section class="caja">
          <h3>Texto al pie de las cotizaciones</h3>
          <div class="campo"><textarea [(ngModel)]="t.notasCotizacion" aria-label="Texto al pie"></textarea></div>
        </section>
        <div><button class="btn pri" (click)="guardar()">Guardar ajustes</button></div>

        @if (s.perfil()?.suscripcion; as x) {
          <section class="caja">
            <h3>Tu plan</h3>
            <p>
              @if (x.estado === 'prueba') { Prueba gratuita · vence el {{ x.vence | fecha }} ({{ x.diasRestantes }} días) }
              @else { Plan <b>{{ nombrePlan(x.plan) }}</b> · {{ x.vigente ? 'pagado hasta el' : 'venció el' }} {{ x.vence | fecha }} }
            </p>
            @if (s.rol() === 'dueno') {
              <div class="chips"><button class="chip" [class.on]="!anual()" (click)="anual.set(false)">Mensual</button><button class="chip" [class.on]="anual()" (click)="anual.set(true)">Anual</button></div>
              <div class="planes">
                @for (p of x.planes; track p.id) {
                  <div class="tarjeta pad plan" [class.actual]="p.id === x.plan">
                    <b>{{ p.nombre }}</b>
                    <span class="num">{{ anual() ? (p.precioAnual | dinero) + ' / año' : (p.precioMensual | dinero) + ' / mes' }}</span>
                    <span class="tenue chico">{{ p.sucursales }} sucursales · {{ p.usuarios }} usuarios</span>
                    <button class="btn sm" [class.pri]="p.id !== x.plan" (click)="pagar(p.id)">{{ p.id === x.plan ? 'Renovar' : 'Elegir' }}</button>
                  </div>
                }
              </div>
              <p class="tenue chico">El cobro en línea (Stripe o Mercado Pago) se conecta en la siguiente etapa. En modo demostración el plan se activa sin cobrar.</p>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    .planes { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .plan { display: flex; flex-direction: column; gap: 4px; }
    .plan.actual { border: 2px solid var(--marca); }
  `,
})
export class Ajustes implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  t = signal<Taller | null>(null);
  anual = signal(false);
  async ngOnInit() { this.t.set(await this.api.get('/taller')); }
  nombrePlan(id: string) { return this.s.perfil()?.suscripcion.planes.find((p) => p.id === id)?.nombre ?? id; }
  async guardar() {
    const t = this.t()!;
    try {
      await this.api.patch('/taller', {
        nombre: t.nombre, telefono: t.telefono, email: t.email, direccion: t.direccion, moneda: t.moneda, lada: t.lada,
        tarifaMinuto: Number(t.tarifaMinuto) || 0, margenObjetivo: Number(t.margenObjetivo) || 0, vigenciaDias: Number(t.vigenciaDias) || 15,
        notasCotizacion: t.notasCotizacion ?? '',
      });
      await this.s.cargar();
      this.aviso.ok('Ajustes guardados');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
  async pagar(plan: string) {
    try {
      await this.api.post('/taller/suscripcion', { plan, periodo: this.anual() ? 'anual' : 'mensual' });
      await this.s.cargar();
      this.aviso.ok('Plan activado');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
