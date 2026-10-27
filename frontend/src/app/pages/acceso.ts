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
          <h1>Crea tu cuenta</h1>
          <p class="tenue">14 días gratis con todas las funciones. Sin tarjeta.</p>
          <div class="campo"><label for="a-t">Nombre de tu taller</label><input id="a-t" name="taller" [(ngModel)]="taller" required autocomplete="organization"></div>
          <div class="campo"><label for="a-n">Tu nombre</label><input id="a-n" name="nombre" [(ngModel)]="nombre" required autocomplete="name"></div>
          <div class="campo"><label for="a-w">WhatsApp del taller</label><input id="a-w" name="tel" type="tel" [(ngModel)]="telefono" autocomplete="tel"></div>
        } @else {
          <h1>Entra a tu taller</h1>
        }
        <div class="campo"><label for="a-e">Correo</label><input id="a-e" name="email" type="email" [(ngModel)]="email" required autocomplete="email"></div>
        <app-campo-clave entrada="a-p" [(valor)]="password" [medidor]="modo() === 'registro'" [personales]="[email, nombre, taller]"
          [autocomplete]="modo() === 'registro' ? 'new-password' : 'current-password'">
          @if (modo() === 'entrar') { <a etiqueta class="chico float-right font-normal tracking-normal" routerLink="/olvide-contrasena" [queryParams]="email ? { email } : {}">¿La olvidaste?</a> }
        </app-campo-clave>
        @if (modo() === 'registro') {
          <label class="fila chico"><input type="checkbox" name="ej" [(ngModel)]="conEjemplos"> Cargar datos de ejemplo para conocer la app</label>
        }
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn pri" [disabled]="cargando()">{{ cargando() ? 'Un momento…' : modo() === 'registro' ? 'Crear cuenta' : 'Entrar' }}</button>
        <p class="chico tenue text-center">
          @if (modo() === 'registro') { ¿Ya tienes cuenta? <a routerLink="/entrar">Entra aquí</a> }
          @else { ¿Aún no tienes cuenta? <a routerLink="/registro">Pruébalo gratis</a> }
        </p>
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
