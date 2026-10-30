import { Component, input } from '@angular/core';

/**
 * Logo de Grabix: una "G" en blanco cortada por un rayo láser verde sobre el cuadro azul marino de Elikar.
 * El mismo dibujo está en public/logo.svg (favicon e íconos).
 */
@Component({
  selector: 'app-logo',
  host: { class: 'inline-flex items-center gap-2.5' },
  template: `
    <svg class="flex-none" [style.width.px]="tamano()" [style.height.px]="tamano()" viewBox="0 0 64 64" aria-hidden="true">
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="14.5" fill="#002150" stroke="var(--logo-borde)" stroke-width="1.5" />
      <path d="M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M43.3 6.5v11" stroke="#67BE28" stroke-width="3" stroke-linecap="round" />
      <circle cx="43.3" cy="21.4" r="4.6" fill="#67BE28" />
      <circle cx="43.3" cy="21.4" r="8" fill="#67BE28" opacity=".22" />
    </svg>
    @if (texto()) { <span class="font-titulo font-extrabold tracking-[-.01em] text-tinta" [style.font-size.px]="tamano() * 0.72">Grabix</span> }
  `,
})
export class Logo {
  tamano = input(30);
  texto = input(true);
}
