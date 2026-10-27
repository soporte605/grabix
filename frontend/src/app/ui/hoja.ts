import { Component, HostListener, input, output } from '@angular/core';

/** Panel modal: hoja inferior en el celular, ventana centrada en escritorio. */
@Component({
  selector: 'app-hoja',
  host: { class: 'fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6' },
  template: `
    <div class="absolute inset-0 bg-[rgba(8,20,30,.45)]" (click)="cerrar.emit()"></div>
    <section class="relative flex max-h-[94%] w-full max-w-[780px] flex-col overflow-hidden rounded-t-2xl bg-fondo shadow-caja motion-safe:animate-sube md:max-h-full md:rounded-2xl"
      role="dialog" aria-modal="true" [attr.aria-label]="titulo()">
      <header class="flex items-center justify-between gap-2.5 border-b border-linea bg-superficie px-4 pt-3.5 pb-3">
        <h2>{{ titulo() }}</h2>
        <button class="px-1.5 py-0.5 text-[1.6rem] leading-none text-tenue" (click)="cerrar.emit()" aria-label="Cerrar">×</button>
      </header>
      <div class="flex flex-col gap-3.5 overflow-auto p-4"><ng-content /></div>
      <footer class="flex flex-wrap gap-2 border-t border-linea bg-superficie px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] empty:hidden"><ng-content select="[pie]" /></footer>
    </section>
  `,
})
export class Hoja {
  titulo = input('');
  cerrar = output();
  @HostListener('document:keydown.escape') esc() { this.cerrar.emit(); }
}
