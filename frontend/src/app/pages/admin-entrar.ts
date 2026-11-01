import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../core/admin.service';
import { rutaPanel } from '../core/admin-host';
import { mensajeError } from '../core/aviso.service';
import { validarFormulario } from '../core/validar';
import { CampoClave } from '../ui/campo-clave';
import { Logo } from '../ui/logo';

@Component({
  selector: 'app-admin-entrar',
  imports: [FormsModule, CampoClave, Logo],
  template: `
    <div class="grid min-h-dvh place-items-center margen-x py-10">
      <form class="tarjeta flex w-full max-w-[420px] flex-col gap-3.5 p-6 shadow-caja sm:p-8" (ngSubmit)="enviar()">
        <app-logo [tamano]="36" />
        <div>
          <h1>Panel de Grabix</h1>
          <p class="mt-1 tenue">Entra con tu cuenta de administrador.</p>
        </div>
        <div class="campo">
          <label for="adm-e">Correo</label>
          <input id="adm-e" name="email" type="email" [(ngModel)]="email" required autocomplete="username" placeholder="tu@elikarsystems.com">
        </div>
        <app-campo-clave entrada="adm-p" [(valor)]="password" autocomplete="current-password" />
        @if (error()) { <p class="error rounded-lg bg-bad-suave px-3 py-2" role="alert">{{ error() }}</p> }
        <button class="btn pri mt-1 w-full" [disabled]="cargando()">{{ cargando() ? 'Un momento…' : 'Entrar' }}</button>
      </form>
    </div>
  `,
})
export class AdminEntrar {
  private admin = inject(AdminService);
  private router = inject(Router);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  email = '';
  password = '';
  error = signal('');
  cargando = signal(false);

  async enviar() {
    this.error.set('');
    if (!validarFormulario(this.el.nativeElement)) return;
    this.cargando.set(true);
    try {
      await this.admin.entrar(this.email.trim(), this.password);
      await this.router.navigateByUrl(rutaPanel());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
