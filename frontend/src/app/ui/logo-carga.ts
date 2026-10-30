import { Component, input } from '@angular/core';

/** La G del logo dibujándose con el punto del láser: indicador de carga de Grabix. */
@Component({
  selector: 'app-logo-carga',
  host: { class: 'inline-block leading-none' },
  template: `
    <svg [attr.width]="tam()" [attr.height]="tam()" viewBox="0 0 64 64" aria-hidden="true" class="logo-carga block">
      <rect width="64" height="64" rx="15" fill="#002150" />
      <path d="M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
      <path class="g" pathLength="100" d="M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
      <g opacity="0">
        <!-- Oculto hasta que arranca la animación, para que no aparezca en la esquina. -->
        <set attributeName="opacity" to="1" fill="freeze" />
        <circle class="halo" r="6" fill="#67BE28" opacity=".4" />
        <circle r="3.6" fill="#67BE28" />
        <animateMotion dur="1.8s" repeatCount="indefinite" keyPoints="0;1;1;1" keyTimes="0;.6;.85;1" calcMode="spline"
          keySplines=".65 0 .35 1;0 0 1 1;0 0 1 1" path="M43.3 21.4A15.5 15.5 0 1 0 47.5 33H33.5" />
      </g>
    </svg>
  `,
})
export class LogoCarga {
  tam = input(26);
}
