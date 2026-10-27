import { Component, HostListener, input, output } from '@angular/core';

/** Panel modal: hoja inferior en el celular, ventana centrada en escritorio. */
@Component({
  selector: 'app-hoja',
  template: `
    <div class="fondo" (click)="cerrar.emit()"></div>
    <section class="hoja" role="dialog" aria-modal="true" [attr.aria-label]="titulo()">
      <header><h2>{{ titulo() }}</h2><button class="x" (click)="cerrar.emit()" aria-label="Cerrar">×</button></header>
      <div class="cuerpo"><ng-content /></div>
      <footer><ng-content select="[pie]" /></footer>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
    @media (min-width: 760px) { :host { align-items: center; padding: 24px; } }
    .fondo { position: absolute; inset: 0; background: rgba(8, 20, 30, .45); }
    .hoja { position: relative; background: var(--fondo); width: 100%; max-width: 780px; max-height: 94%; display: flex; flex-direction: column;
      border-radius: 16px 16px 0 0; box-shadow: var(--sombra); overflow: hidden; animation: sube .18s ease-out; }
    @media (min-width: 760px) { .hoja { border-radius: 16px; max-height: 100%; } }
    @media (prefers-reduced-motion: reduce) { .hoja { animation: none; } }
    @keyframes sube { from { transform: translateY(16px); opacity: .6; } }
    header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 16px 12px; background: var(--superficie); border-bottom: 1px solid var(--linea); }
    .cuerpo { overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--superficie); border-top: 1px solid var(--linea); }
    footer:empty { display: none; }
    .x { background: none; border: 0; font-size: 1.6rem; line-height: 1; cursor: pointer; color: var(--tenue); padding: 2px 6px; }
  `,
})
export class Hoja {
  titulo = input('');
  cerrar = output();
  @HostListener('document:keydown.escape') esc() { this.cerrar.emit(); }
}
