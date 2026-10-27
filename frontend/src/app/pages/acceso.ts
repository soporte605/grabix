import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../core/aviso.service';
import { SesionService } from '../core/sesion.service';

/** Inicio de sesión y registro de un taller nuevo (misma pantalla, dos modos). */
@Component({
  selector: 'app-acceso',
  imports: [FormsModule, RouterLink],
  template: `
    <main>
      <a class="logo" routerLink="/"><span class="marca-ico"></span>Grabix</a>
      <form class="tarjeta" (ngSubmit)="enviar()">
        @if (modo() === 'registro') {
          <h1>Crea tu cuenta</h1>
          <p class="tenue">14 días gratis con todas las funciones. Sin tarjeta.</p>
          <div class="campo"><label for="a-t">Nombre de tu taller</label><input id="a-t" name="taller" [(ngModel)]="taller" required autocomplete="organization"></div>
          <div class="campo"><label for="a-n">Tu nombre</label><input id="a-n" name="nombre" [(ngModel)]="nombre" required autocomplete="name"></div>
          <div class="campo"><label for="a-w">WhatsApp del taller</label><input id="a-w" name="tel" type="tel" [(ngModel)]="telefono" autocomplete="tel"></div>
        } @else {
          <h1>Entra a tu taller</h1>
        }
        <div class="campo"><label for="a-e">Correo</label><input id="a-e" name="email" type="email" [(ngModel)]="email" required autocomplete="email"></div>
        <div class="campo"><label for="a-p">Contraseña</label><input id="a-p" name="pass" type="password" [(ngModel)]="password" required [attr.autocomplete]="modo() === 'registro' ? 'new-password' : 'current-password'"></div>
        @if (modo() === 'registro') {
          <label class="fila chico"><input type="checkbox" name="ej" [(ngModel)]="conEjemplos"> Cargar datos de ejemplo para conocer la app</label>
        }
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn pri" [disabled]="cargando()">{{ cargando() ? 'Un momento…' : modo() === 'registro' ? 'Crear cuenta' : 'Entrar' }}</button>
        <p class="chico tenue centro">
          @if (modo() === 'registro') { ¿Ya tienes cuenta? <a routerLink="/entrar">Entra aquí</a> }
          @else { ¿Aún no tienes cuenta? <a routerLink="/registro">Pruébalo gratis</a> }
        </p>
      </form>
    </main>
  `,
  styles: `
    main { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
      padding: 32px max(16px, env(safe-area-inset-right, 0px)) 32px max(16px, env(safe-area-inset-left, 0px)); background: linear-gradient(180deg, var(--marca-suave), var(--fondo)); }
    :host { display: block; height: 100%; }
    .logo { display: flex; align-items: center; gap: 9px; font: 800 1.4rem var(--f-titulo); color: var(--tinta); text-decoration: none; }
    .marca-ico { width: 28px; height: 28px; border-radius: 7px; background: linear-gradient(180deg, var(--marca) 0 72%, var(--acento) 72%); }
    form { width: 100%; max-width: 420px; padding: 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--sombra); }
    h1 { font-size: 1.4rem; } p { margin: 0; }
    .centro { text-align: center; }
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
