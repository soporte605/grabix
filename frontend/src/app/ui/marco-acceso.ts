import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../ui/logo';

/** Marco de las pantallas de cuenta (entrar, registro, recuperar, invitación): logo y tarjeta centrada. */
@Component({
  selector: 'app-marco-acceso',
  imports: [RouterLink, Logo],
  host: { class: 'block h-full' },
  template: `
    <main class="margen-x flex min-h-full flex-col items-center justify-center gap-5 bg-linear-to-b from-marca-suave to-fondo py-8">
      <a class="no-underline" routerLink="/" aria-label="Grabix, inicio"><app-logo [tamano]="34" /></a>
      <div class="tarjeta flex w-full max-w-[420px] flex-col gap-3 p-6 shadow-caja [&_h1]:text-[1.4rem]"><ng-content /></div>
    </main>
  `,
})
export class MarcoAcceso {}
