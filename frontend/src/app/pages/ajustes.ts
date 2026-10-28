import { Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, FechaPipe } from '../core/formato';
import { Taller } from '../core/modelos';
import { evaluarClave } from '../core/clave';
import { SesionService } from '../core/sesion.service';
import { validarFormulario } from '../core/validar';
import { CampoClave } from '../ui/campo-clave';
import { Esqueleto } from '../ui/esqueleto';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';
import { MaquinasTaller } from '../ui/maquinas-taller';
import { PagosSucursal } from '../ui/pagos-sucursal';

@Component({
  selector: 'app-ajustes',
  imports: [FormsModule, DineroPipe, FechaPipe, CampoClave, Esqueleto, Hoja, Icono, MaquinasTaller, PagosSucursal],
  template: `
    <div class="encabezado"><div class="titulo"><span class="icono-modulo"><app-icono nombre="ajustes" /></span><div><h1>Ajustes y plan</h1><p>Datos que aparecen en tus PDF y valores para calcular costos.</p></div></div></div>
    @if (t(); as t) {
      <div class="rejilla max-w-[820px]">
        <section class="caja">
          <h3>Tu negocio</h3>
          <div class="campos">
            <div class="campo todo"><label for="a-n">Nombre comercial</label><input id="a-n" name="nombre" required minlength="2" maxlength="120" [(ngModel)]="t.nombre"></div>
            <div class="campo"><label for="a-t">WhatsApp / teléfono</label><input id="a-t" type="tel" [(ngModel)]="t.telefono"></div>
            <div class="campo"><label for="a-e">Correo</label><input id="a-e" name="email" type="email" [(ngModel)]="t.email"></div>
            <div class="campo todo"><label for="a-d">Dirección</label><input id="a-d" [(ngModel)]="t.direccion"></div>
          </div>
        </section>
        <section class="caja">
          <h3>Costos y precios</h3>
          <div class="campos c3">
            <div class="campo"><label for="a-tm">Costo de máquina por minuto</label><input id="a-tm" name="tarifaMinuto" min="0" type="number" inputmode="decimal" [(ngModel)]="t.tarifaMinuto"></div>
            <div class="campo"><label for="a-mg">Margen objetivo (%)</label><input id="a-mg" name="margenObjetivo" min="0" max="95" type="number" [(ngModel)]="t.margenObjetivo"></div>
            <div class="campo"><label for="a-v">Vigencia de cotizaciones (días)</label><input id="a-v" name="vigenciaDias" min="1" max="365" type="number" [(ngModel)]="t.vigenciaDias"></div>
            <div class="campo"><label for="a-mo">Moneda</label><input id="a-mo" name="moneda" maxlength="8" [(ngModel)]="t.moneda"></div>
            <div class="campo"><label for="a-l">Lada de país (WhatsApp)</label><input id="a-l" name="lada" maxlength="4" [(ngModel)]="t.lada"></div>
          </div>
          <p class="tenue chico">El costo por minuto cubre luz, desgaste del tubo y lentes, y tu tiempo. Para estimarlo: (gasto mensual de la máquina + sueldo que te asignas) ÷ minutos de trabajo al mes.</p>
        </section>
        <section class="caja">
          <h3>Texto al pie de las cotizaciones</h3>
          <div class="campo"><textarea [(ngModel)]="t.notasCotizacion" aria-label="Texto al pie"></textarea></div>
        </section>
        <div><button class="btn pri" (click)="guardar()">Guardar ajustes</button></div>
        @if (s.gerencia()) { <app-pagos-sucursal /> <app-maquinas-taller /> }

        <form class="caja" (ngSubmit)="cambiarClave()">
          <h3>Tu contraseña</h3>
          <input type="email" name="usuario" [value]="s.perfil()?.usuario?.email" autocomplete="username" hidden>
          <div class="grid items-start gap-2.5 sm:grid-cols-3">
            <app-campo-clave entrada="c-a" etiqueta="Contraseña actual" autocomplete="current-password" [(valor)]="clave.actual" />
            <app-campo-clave entrada="c-n" etiqueta="Contraseña nueva" [(valor)]="clave.nueva" [medidor]="true" [personales]="[s.perfil()?.usuario?.email, s.perfil()?.usuario?.nombre]" />
            <app-campo-clave entrada="c-n2" etiqueta="Repite la nueva" [(valor)]="clave.nueva2" />
          </div>
          <div class="fila"><button class="btn">Cambiar contraseña</button><span class="tenue chico">Se cerrará tu sesión en otros dispositivos.</span></div>
        </form>

        @if (s.perfil()?.suscripcion; as x) {
          <section class="caja">
            <h3>Tu plan</h3>
            <p>
              @if (x.estado === 'prueba') { Prueba gratuita · vence el {{ x.vence | fecha }} ({{ x.diasRestantes }} días) }
              @else { Plan <b>{{ nombrePlan(x.plan) }}</b> · {{ x.vigente ? 'pagado hasta el' : 'venció el' }} {{ x.vence | fecha }} }
            </p>
            @if (s.rol() === 'dueno') {
              <div class="chips"><button class="chip" [class.on]="!anual()" (click)="anual.set(false)">Mensual</button><button class="chip" [class.on]="anual()" (click)="anual.set(true)">Anual</button></div>
              <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
                @for (p of x.planes; track p.id) {
                  <div class="tarjeta pad flex flex-col gap-1" [class]="p.id === x.plan ? 'border-2 border-marca' : ''">
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

        @if (s.rol() === 'dueno') {
          <section class="caja border-bad/40">
            <h3>Eliminar cuenta</h3>
            <p class="tenue chico">Borra tu taller y todos sus datos: clientes, cotizaciones, ventas, pagos, inventario, compras y usuarios. Tienes {{ dias }} días para arrepentirte; después el borrado es definitivo.</p>
            <div><button class="btn peligro" (click)="borrar.set({ nombre: '', clave: '', motivo: '', entiendo: false })">Eliminar mi cuenta</button></div>
          </section>
        }
      </div>
    } @else { <app-esqueleto tipo="formulario" [filas]="3" /> }
    @if (borrar(); as b) {
      <app-hoja titulo="Eliminar cuenta" ancho="560px" (cerrar)="borrar.set(null)">
        <p>Al confirmar:</p>
        <ul class="ml-5 list-disc text-base text-tenue">
          <li>La cuenta de <b class="text-tinta">{{ s.taller()?.nombre }}</b> se desactiva y nadie de tu equipo podrá entrar.</li>
          <li>Durante {{ dias }} días puedes entrar con tu correo y restaurarla tal como estaba.</li>
          <li>Pasado ese plazo borramos de forma definitiva todos sus datos. No se pueden recuperar.</li>
        </ul>
        <p class="tenue chico">Lo hacemos así para cumplir con tu derecho de cancelación (derechos ARCO) de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Si antes quieres una copia de tu información, descarga los PDF que necesites o escríbenos a soporte&#64;elikarsystems.com.</p>
        <div class="campo"><label for="e-n">Escribe <b>{{ s.taller()?.nombre }}</b> para confirmar</label><input id="e-n" [(ngModel)]="b.nombre" autocomplete="off"></div>
        <app-campo-clave entrada="e-c" etiqueta="Tu contraseña" autocomplete="current-password" [(valor)]="b.clave" />
        <div class="campo"><label for="e-m">¿Por qué te vas? (opcional)</label><textarea id="e-m" [(ngModel)]="b.motivo" maxlength="500" placeholder="Nos ayuda a mejorar"></textarea></div>
        <label class="flex items-start gap-2 text-base"><input type="checkbox" class="mt-1" [(ngModel)]="b.entiendo">Entiendo que después de {{ dias }} días mis datos se borran para siempre.</label>
        <ng-container pie>
          <button class="btn" (click)="borrar.set(null)">Cancelar</button>
          <span class="flex-1"></span>
          <button class="btn peligro" [disabled]="!b.entiendo || !b.clave || b.nombre.trim() !== s.taller()?.nombre || eliminando()" (click)="eliminarCuenta()">{{ eliminando() ? 'Eliminando…' : 'Eliminar cuenta' }}</button>
        </ng-container>
      </app-hoja>
    }
  `,
})
export class Ajustes implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  t = signal<Taller | null>(null);
  anual = signal(false);
  async ngOnInit() { this.t.set(await this.api.get('/taller')); }
  nombrePlan(id: string) { return this.s.perfil()?.suscripcion.planes.find((p) => p.id === id)?.nombre ?? id; }
  async guardar() {
    // Solo las secciones del negocio y los costos; el cambio de contraseña tiene su propio botón.
    const secciones = ['#a-n', '#a-tm'].map((id) => this.el.nativeElement.querySelector(id)?.closest('section'));
    if (!secciones.map((x) => !x || validarFormulario(x)).every(Boolean)) return;
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
  clave = { actual: '', nueva: '', nueva2: '' };
  async cambiarClave() {
    const c = this.clave;
    const u = this.s.perfil()?.usuario;
    if (!evaluarClave(c.nueva, [u?.email, u?.nombre]).valida) return this.aviso.error('Tu contraseña nueva aún no es segura: revisa los puntos debajo del campo.');
    if (c.nueva !== c.nueva2) return this.aviso.error('Las contraseñas nuevas no coinciden');
    try {
      await this.s.cambiarContrasena(c.actual, c.nueva);
      this.clave = { actual: '', nueva: '', nueva2: '' };
      this.aviso.ok('Contraseña cambiada');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
  readonly dias = 30;
  borrar = signal<{ nombre: string; clave: string; motivo: string; entiendo: boolean } | null>(null);
  eliminando = signal(false);
  async eliminarCuenta() {
    const b = this.borrar()!;
    this.eliminando.set(true);
    try {
      await this.api.post('/cuenta/eliminar', { password: b.clave, motivo: b.motivo.trim() || undefined });
      this.borrar.set(null);
      await this.s.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.eliminando.set(false); }
  }
  async pagar(plan: string) {
    try {
      await this.api.post('/taller/suscripcion', { plan, periodo: this.anual() ? 'anual' : 'mensual' });
      await this.s.cargar();
      this.aviso.ok('Plan activado');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
