import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../core/aviso.service';
import { SesionService } from '../core/sesion.service';
import { evaluarClave } from '../core/clave';
import { CampoClave } from '../ui/campo-clave';
import { MarcoAcceso } from '../ui/marco-acceso';

/** Abre el enlace de confirmación que llega por correo al registrarse. */
@Component({
  selector: 'app-verificar-correo',
  imports: [RouterLink, MarcoAcceso],
  template: `
    <app-marco-acceso>
      <form class="contents" (submit)="$event.preventDefault()">
        @switch (estado()) {
          @case ('cargando') { <h1>Confirmando tu correo…</h1> }
          @case ('ok') {
            <h1>¡Correo confirmado!</h1>
            <p class="rounded-lg bg-ok-suave px-3 py-2.5 text-ok">Ya puedes invitar a tu equipo, elegir un plan y recuperar tu contraseña si la olvidas.</p>
            <a class="btn pri" [routerLink]="s.token() ? '/app' : '/entrar'">{{ s.token() ? 'Ir a mi taller' : 'Entrar' }}</a>
          }
          @case ('error') {
            <h1>No pudimos confirmar tu correo</h1>
            <p class="error">{{ error() }}</p>
            @if (s.token()) {
              <p class="tenue chico">Pide otro enlace desde el aviso de la parte superior de tu taller.</p>
              <a class="btn pri" routerLink="/app">Ir a mi taller</a>
            } @else {
              <p class="tenue chico">Entra a tu cuenta y pide otro enlace desde el aviso de la parte superior.</p>
              <a class="btn pri" routerLink="/entrar">Entrar</a>
            }
          }
        }
      </form>
    </app-marco-acceso>
  `,
})
export class VerificarCorreo implements OnInit {
  s = inject(SesionService);
  token = input('');
  estado = signal<'cargando' | 'ok' | 'error'>('cargando');
  error = signal('');

  async ngOnInit() {
    try {
      await this.s.verificarCorreo(this.token());
      this.estado.set('ok');
    } catch (e) {
      this.error.set(mensajeError(e));
      this.estado.set('error');
    }
  }
}

/** Pide el correo para mandar el enlace de recuperación. */
@Component({
  selector: 'app-olvide',
  imports: [FormsModule, RouterLink, MarcoAcceso],
  template: `
    <app-marco-acceso>
      <form class="contents" (ngSubmit)="enviar()">
        <h1>Recupera tu contraseña</h1>
        @if (enviado()) {
          <p class="rounded-lg bg-ok-suave px-3 py-2.5 text-ok">Si <b>{{ correo }}</b> tiene una cuenta, te llegará un correo con un enlace para crear una contraseña nueva. Vence en 1 hora.</p>
          <p class="tenue chico">¿No lo ves? Revisa la carpeta de spam o promociones.</p>
          <a class="btn" routerLink="/entrar">Volver a entrar</a>
        } @else {
          <p class="tenue">Escribe el correo con el que entras y te mandamos un enlace.</p>
          <div class="campo"><label for="o-e">Correo</label><input id="o-e" name="email" type="email" [(ngModel)]="correo" required autocomplete="email"></div>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn pri" [disabled]="cargando()">{{ cargando() ? 'Enviando…' : 'Enviar enlace' }}</button>
          <p class="chico tenue text-center"><a routerLink="/entrar">Volver a entrar</a></p>
        }
      </form>
    </app-marco-acceso>
  `,
})
export class OlvideContrasena implements OnInit {
  private s = inject(SesionService);
  email = input('');
  correo = '';
  enviado = signal(false);
  cargando = signal(false);
  error = signal('');

  ngOnInit() { this.correo = this.email(); }

  async enviar() {
    this.error.set('');
    this.cargando.set(true);
    try {
      await this.s.olvide(this.correo);
      this.enviado.set(true);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}

/** Crear contraseña desde un enlace de recuperación o de invitación. Al terminar deja la sesión iniciada. */
@Component({
  selector: 'app-restablecer',
  imports: [FormsModule, RouterLink, MarcoAcceso, CampoClave],
  template: `
    <app-marco-acceso>
      <form class="contents" (ngSubmit)="guardar()">
        @if (datos(); as d) {
          @if (d.tipo === 'invitacion') {
            <h1>Bienvenido a {{ d.taller }}</h1>
            <p class="tenue">Hola {{ d.nombre }}, crea tu contraseña para entrar con <b>{{ d.email }}</b>.</p>
          } @else {
            <h1>Crea una contraseña nueva</h1>
            <p class="tenue">Para la cuenta <b>{{ d.email }}</b>.</p>
          }
          <input type="email" name="usuario" [value]="d.email" autocomplete="username" hidden>
          <app-campo-clave entrada="r-p" etiqueta="Contraseña nueva" [(valor)]="password" [medidor]="true" [personales]="[d.email, d.nombre]" />
          <app-campo-clave entrada="r-p2" etiqueta="Repite la contraseña" [(valor)]="password2" />
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn pri" [disabled]="cargando()">{{ cargando() ? 'Guardando…' : d.tipo === 'invitacion' ? 'Crear contraseña y entrar' : 'Guardar y entrar' }}</button>
        } @else if (invalido()) {
          <h1>Este enlace ya no sirve</h1>
          <p class="error">{{ invalido() }}</p>
          @if (modo() === 'invitacion') {
            <p class="tenue chico">Pídele a quien te invitó que te reenvíe la invitación desde Usuarios.</p>
          } @else {
            <a class="btn pri" routerLink="/olvide-contrasena">Pedir otro enlace</a>
          }
        } @else {
          <h1>Revisando el enlace…</h1>
        }
      </form>
    </app-marco-acceso>
  `,
})
export class Restablecer implements OnInit {
  private s = inject(SesionService);
  private router = inject(Router);
  token = input('');
  modo = input<'recuperacion' | 'invitacion'>('recuperacion');
  datos = signal<{ tipo: 'recuperacion' | 'invitacion'; nombre: string; email: string; taller: string } | null>(null);
  invalido = signal('');
  password = '';
  password2 = '';
  cargando = signal(false);
  error = signal('');

  async ngOnInit() {
    try {
      this.datos.set(await this.s.enlace(this.token()));
    } catch (e) {
      this.invalido.set(mensajeError(e));
    }
  }

  async guardar() {
    this.error.set('');
    const d = this.datos();
    if (!evaluarClave(this.password, [d?.email, d?.nombre]).valida) return this.error.set('Tu contraseña aún no es segura: revisa los puntos debajo del campo.');
    if (this.password !== this.password2) return this.error.set('Las contraseñas no coinciden');
    this.cargando.set(true);
    try {
      await this.s.restablecer(this.token(), this.password);
      this.router.navigateByUrl('/app');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
