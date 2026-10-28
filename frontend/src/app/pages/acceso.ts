import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../core/aviso.service';
import { SesionService } from '../core/sesion.service';
import { evaluarClave } from '../core/clave';
import { CampoClave } from '../ui/campo-clave';
import { MarcoAcceso } from '../ui/marco-acceso';

/** Inicio de sesión y registro de un taller nuevo (misma pantalla, dos modos). */
@Component({
  selector: 'app-acceso',
  imports: [FormsModule, RouterLink, MarcoAcceso, CampoClave],
  template: `
    <app-marco-acceso>
      <form class="contents" (ngSubmit)="enviar()">
        @if (modo() === 'registro') {
          <div>
            <span class="pill sec mb-3">14 días gratis · Sin tarjeta</span>
            <h1>Crea tu cuenta</h1>
            <p class="mt-1 tenue">Configura tu taller en menos de un minuto.</p>
          </div>
          <fieldset class="campos">
            <legend class="mb-2 text-xs font-bold tracking-[.08em] text-tenue uppercase">Tu taller</legend>
            <div class="campo todo"><label for="a-t">Nombre del taller</label><input id="a-t" name="taller" [(ngModel)]="taller" required autocomplete="organization" placeholder="Ej. Láser y Diseño MX"></div>
            <div class="campo"><label for="a-n">Tu nombre</label><input id="a-n" name="nombre" [(ngModel)]="nombre" required autocomplete="name"></div>
            <div class="campo"><label for="a-w">WhatsApp <span class="font-normal">(opcional)</span></label><input id="a-w" name="tel" type="tel" [(ngModel)]="telefono" autocomplete="tel"></div>
          </fieldset>
          <p class="mt-1 mb-[-4px] text-xs font-bold tracking-[.08em] text-tenue uppercase">Tu acceso</p>
        } @else {
          <div>
            <h1>Bienvenido de nuevo</h1>
            <p class="mt-1 tenue">Entra para ver tus cotizaciones, ventas y producción.</p>
          </div>
        }
        <div class="campo"><label for="a-e">Correo</label><input id="a-e" name="email" type="email" [(ngModel)]="email" required autocomplete="email" placeholder="tu@taller.com"></div>
        <app-campo-clave entrada="a-p" [(valor)]="password" [medidor]="modo() === 'registro'" [personales]="[email, nombre, taller]"
          [autocomplete]="modo() === 'registro' ? 'new-password' : 'current-password'">
          @if (modo() === 'entrar') { <a etiqueta class="chico float-right font-semibold tracking-normal no-underline hover:underline" routerLink="/olvide-contrasena" [queryParams]="email ? { email } : {}">¿La olvidaste?</a> }
        </app-campo-clave>
        @if (modo() === 'registro') {
          <label class="flex items-start gap-2.5 rounded-lg border border-linea bg-superficie-2 px-3 py-2.5 text-sm">
            <input class="mt-1" type="checkbox" name="ej" [(ngModel)]="conEjemplos">
            <span><b class="font-semibold">Cargar datos de ejemplo</b><br><span class="tenue">Clientes, materiales y cotizaciones para conocer la app. Los puedes borrar después.</span></span>
          </label>
        }
        @if (error()) { <p class="error rounded-lg bg-bad-suave px-3 py-2" role="alert">{{ error() }}</p> }
        <button class="btn pri mt-1 w-full" [disabled]="cargando()">{{ cargando() ? 'Un momento…' : modo() === 'registro' ? 'Crear mi cuenta gratis' : 'Entrar' }}</button>
        <div class="my-1 flex items-center gap-3 text-sm text-tenue" aria-hidden="true"><span class="h-px flex-1 bg-linea"></span>o<span class="h-px flex-1 bg-linea"></span></div>
        @if (modo() === 'registro') {
          <a class="btn w-full" routerLink="/entrar">Ya tengo cuenta, entrar</a>
        } @else {
          <a class="btn w-full" routerLink="/registro">Crear una cuenta gratis</a>
        }
        @if (modo() === 'registro') {
          <p class="text-center text-xs text-tenue">Al crear tu cuenta aceptas que te enviemos correos sobre tu cuenta y tu suscripción.</p>
        }
      </form>
    </app-marco-acceso>
  `,
})
export class Acceso {
  private sesion = inject(SesionService);
  private router = inject(Router);
  modo = input<'entrar' | 'registro'>('entrar');
  taller = ''; nombre = ''; telefono = ''; email = ''; password = ''; conEjemplos = true;
  error = signal('');
  cargando = signal(false);

  async enviar() {
    this.error.set('');
    if (this.modo() === 'registro' && !evaluarClave(this.password, [this.email, this.nombre, this.taller]).valida)
      return this.error.set('Tu contraseña aún no es segura: revisa los puntos debajo del campo.');
    this.cargando.set(true);
    try {
      if (this.modo() === 'registro')
        await this.sesion.registro({ taller: this.taller, nombre: this.nombre, telefono: this.telefono, email: this.email, password: this.password, conEjemplos: this.conEjemplos });
      else await this.sesion.login(this.email, this.password);
      this.router.navigateByUrl('/app');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
