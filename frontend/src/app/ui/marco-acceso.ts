import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from './icono';
import { Logo } from './logo';
import { SelectorTema } from './selector-tema';

/**
 * Marco de las pantallas de cuenta (entrar, registro, recuperar, invitación).
 * En escritorio: panel de marca a la izquierda y formulario a la derecha. En celular: logo arriba y formulario.
 */
@Component({
  selector: 'app-marco-acceso',
  imports: [RouterLink, Logo, Icono, SelectorTema],
  host: { class: 'block min-h-full' },
  template: `
    <div class="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <!-- Panel de marca (solo escritorio) -->
      <aside class="relative hidden overflow-hidden bg-[#002150] p-12 text-white lg:flex lg:flex-col">
        <svg class="pointer-events-none absolute inset-0 size-full opacity-[.07]" aria-hidden="true">
          <defs><pattern id="rejilla-acceso" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="#fff" stroke-width="1" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#rejilla-acceso)" />
        </svg>
        <div class="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-[#67be28] opacity-20 blur-3xl" aria-hidden="true"></div>
        <div class="pointer-events-none absolute top-0 right-[22%] h-[46%] w-[2px] bg-linear-to-b from-transparent to-[#67be28]" aria-hidden="true"></div>
        <div class="pointer-events-none absolute top-[46%] right-[22%] size-3 translate-x-[5px] -translate-y-1.5 rounded-full bg-[#67be28] shadow-[0_0_0_8px_rgba(103,190,40,.18),0_0_24px_6px_rgba(103,190,40,.45)]" aria-hidden="true"></div>

        <a class="relative no-underline [--logo-borde:rgba(255,255,255,.3)] [&_span]:!text-white" routerLink="/" aria-label="Grabix, inicio"><app-logo [tamano]="36" /></a>
        <div class="relative mt-auto max-w-[440px]">
          <h2 class="text-[2rem]/[1.15] font-extrabold tracking-[-.03em]">Cotiza, produce y cobra desde un solo lugar</h2>
          <ul class="mt-7 grid gap-3.5 text-[.95rem] text-white/85">
            @for (b of beneficios; track b) {
              <li class="flex items-start gap-3">
                <span class="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-[#67be28]/20 text-[#8fd85a]"><app-icono nombre="ok" /></span>{{ b }}
              </li>
            }
          </ul>
        </div>
        <p class="relative mt-12 text-[.8rem] text-white/55">14 días gratis · Sin tarjeta · Un producto de Elikar Systems</p>
      </aside>

      <!-- Formulario -->
      <main class="relative margen-x flex flex-col items-center justify-center gap-7 bg-linear-to-b from-marca-suave to-fondo py-10 lg:bg-none lg:bg-superficie">
        <div class="absolute top-3 right-3"><app-selector-tema /></div>
        <a class="no-underline lg:hidden" routerLink="/" aria-label="Grabix, inicio"><app-logo [tamano]="34" /></a>
        <div class="tarjeta flex w-full max-w-[420px] flex-col gap-3.5 p-6 shadow-caja sm:p-8 lg:max-w-[400px] lg:border-0 lg:p-0 lg:shadow-none
          [&_h1]:text-[1.65rem] [&_h1]:tracking-[-.03em] [&_.campo_input]:min-h-11 [&_.btn.pri]:min-h-11 [&_.btn.pri]:text-[.95rem]">
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class MarcoAcceso {
  beneficios = [
    'Cotiza en segundos con tus costos reales de material, máquina y mano de obra.',
    'Controla producción, inventario y ventas de todas tus sucursales.',
    'Tu equipo entra con su propio usuario y solo ve lo que le toca.',
    'Un asistente con IA que responde con los datos de tu sucursal.',
  ];
}
