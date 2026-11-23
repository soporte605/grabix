import { Component, ElementRef, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../core/aviso.service';
import { PublicoService } from '../core/publico.service';
import { SesionService } from '../core/sesion.service';
import { validarFormulario } from '../core/validar';
import { evaluarClave } from '../core/clave';
import { CampoClave } from '../ui/campo-clave';
import { Icono } from '../ui/icono';
import { MarcoAcceso } from '../ui/marco-acceso';

/** Inicio de sesión y registro de un taller nuevo (misma pantalla, dos modos). */
@Component({
  selector: 'app-acceso',
  imports: [FormsModule, RouterLink, MarcoAcceso, CampoClave, Icono],
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
            <div class="campo todo"><label for="a-t">Nombre del taller</label><input id="a-t" name="taller" [(ngModel)]="taller" required minlength="2" autocomplete="organization" placeholder="Ej. Láser y Diseño MX"></div>
            <div class="campo"><label for="a-n">Tu nombre</label><input id="a-n" name="nombre" [(ngModel)]="nombre" required minlength="2" autocomplete="name"></div>
            <div class="campo"><label for="a-w">WhatsApp o teléfono</label><input id="a-w" name="telefono" type="tel" inputmode="tel" [(ngModel)]="telefono" required maxlength="25" autocomplete="tel" placeholder="Ej. 55 1234 5678"></div>
          </fieldset>
          <p class="mt-1 mb-[-4px] text-xs font-bold tracking-[.08em] text-tenue uppercase">Tu acceso</p>
        } @else if (!listo()) {
          <div class="grid gap-3" aria-busy="true">
            <div class="h-8 w-3/5 animate-pulse rounded-lg bg-superficie-2"></div>
            <div class="h-4 w-4/5 animate-pulse rounded bg-superficie-2"></div>
            <div class="mt-3 h-11 animate-pulse rounded-lg bg-superficie-2"></div>
            <div class="h-11 animate-pulse rounded-lg bg-superficie-2"></div>
          </div>
        } @else if (recordado(); as r) {
          <div class="flex flex-col items-center text-center sm:items-start sm:text-left">
            <span class="mb-4 flex size-14 items-center justify-center rounded-full bg-marca-suave text-2xl font-extrabold text-marca" aria-hidden="true">{{ r.nombre.charAt(0).toUpperCase() }}</span>
            <h1>Hola, {{ r.nombre }}</h1>
            <p class="mt-1 tenue">Ingresa tu contraseña para continuar.</p>
            <span class="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-linea bg-superficie-2 px-3 py-1 text-sm">
              <app-icono class="shrink-0 text-tenue" nombre="correo" /><span class="truncate font-mono">{{ r.email }}</span>
            </span>
          </div>
        } @else {
          <div>
            <h1>Bienvenido de nuevo</h1>
            <p class="mt-1 tenue">Entra para ver tus cotizaciones, ventas y producción.</p>
          </div>
        }
        @if (modo() === 'registro' || (listo() && !recordado())) {
          <div class="campo"><label for="a-e">Correo</label><input id="a-e" name="email" type="email" [(ngModel)]="email" required autocomplete="email" placeholder="tu@taller.com"></div>
        }
        @if (modo() === 'registro' || listo()) {
        <app-campo-clave entrada="a-p" [(valor)]="password" [medidor]="modo() === 'registro'" [personales]="[email, nombre, taller]"
          [autocomplete]="modo() === 'registro' ? 'new-password' : 'current-password'">
          @if (modo() === 'entrar') { <a etiqueta class="chico float-right font-semibold tracking-normal no-underline hover:underline" routerLink="/olvide-contrasena" [queryParams]="email ? { email } : {}">¿La olvidaste?</a> }
        </app-campo-clave>
        @if (modo() === 'entrar' && !recordado()) {
          <label class="flex cursor-pointer items-start gap-2.5 text-sm">
            <input class="mt-0.5" type="checkbox" name="recordar" [(ngModel)]="recordar">
            <span><b class="font-semibold">Recordar mi usuario en este equipo</b><br><span class="tenue">La próxima vez solo te pediremos la contraseña.</span></span>
          </label>
        }
        }
        @if (modo() === 'registro') {
          <label class="flex items-start gap-2.5 rounded-lg border border-linea bg-superficie-2 px-3 py-2.5 text-sm">
            <input class="mt-1" type="checkbox" name="ej" [(ngModel)]="conEjemplos">
            <span><b class="font-semibold">Cargar datos de ejemplo</b><br><span class="tenue">Clientes, materiales y cotizaciones para conocer la app. Los puedes borrar después.</span></span>
          </label>
        }
        @if (error()) { <p class="error rounded-lg bg-bad-suave px-3 py-2" role="alert">{{ error() }}</p> }
        <button class="btn pri mt-1 w-full" [disabled]="cargando() || (modo() === 'entrar' && !listo())">{{ cargando() ? 'Un momento…' : modo() === 'registro' ? 'Crear mi cuenta gratis' : 'Entrar' }}</button>
        <div class="my-1 flex items-center gap-3 text-sm text-tenue" aria-hidden="true"><span class="h-px flex-1 bg-linea"></span>o<span class="h-px flex-1 bg-linea"></span></div>
        @if (modo() === 'entrar' && recordado(); as r) {
          <button type="button" class="btn w-full" (click)="otraCuenta()">No soy {{ r.nombre }}, usar otra cuenta</button>
        } @else if (modo() === 'registro') {
          <a class="btn w-full" routerLink="/entrar">Ya tengo cuenta, entrar</a>
        } @else {
          <a class="btn w-full" routerLink="/registro">Crear una cuenta gratis</a>
        }
        @if (modo() === 'registro') {
          <p class="text-center text-xs text-tenue">Al crear tu cuenta aceptas los <a routerLink="/terminos" target="_blank">Términos de uso</a> y el <a routerLink="/privacidad" target="_blank">Aviso de privacidad</a>, y que te enviemos correos sobre tu cuenta y tu suscripción.</p>
        }
      </form>
    </app-marco-acceso>
  `,
})
export class Acceso implements OnInit {
  private sesion = inject(SesionService);
  private pub = inject(PublicoService);
  private router = inject(Router);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  modo = input<'entrar' | 'registro'>('entrar');
  taller = ''; nombre = ''; telefono = ''; email = ''; password = ''; conEjemplos = true; recordar = false;
  error = signal('');
  cargando = signal(false);
  /** Usuario recordado en este navegador (lo resuelve el servidor desde una cookie HttpOnly). */
  recordado = signal<{ nombre: string; email: string } | null>(null);
  listo = signal(false);

  async ngOnInit() {
    if (this.modo() === 'entrar') this.recordado.set(await this.sesion.recordado());
    this.listo.set(true);
  }

  async otraCuenta() {
    this.recordado.set(null);
    this.password = '';
    this.error.set('');
    await this.sesion.olvidarRecordado();
  }

  async enviar() {
    this.error.set('');
    if (!validarFormulario(this.el.nativeElement)) return;
    if (this.modo() === 'registro' && !evaluarClave(this.password, [this.email, this.nombre, this.taller]).valida)
      return this.error.set('Tu contraseña aún no es segura: revisa los puntos debajo del campo.');
    this.cargando.set(true);
    try {
      if (this.modo() === 'registro')
        await this.sesion.registro({ taller: this.taller, nombre: this.nombre, telefono: this.telefono, email: this.email, password: this.password, conEjemplos: this.conEjemplos });
      else if (this.recordado()) await this.sesion.login(null, this.password, true);
      else await this.sesion.login(this.email, this.password, this.recordar);
      if (this.modo() === 'registro') void this.pub.evento('CompleteRegistration', { content_name: 'Prueba gratis' });
      this.router.navigateByUrl('/app');
    } catch (e) {
      // La cookie venció o ya no es válida: vuelve al formulario normal.
      if (this.recordado() && mensajeError(e).startsWith('Escribe tu correo')) this.recordado.set(null);
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
