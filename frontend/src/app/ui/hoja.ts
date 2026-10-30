import { AfterViewInit, Component, ElementRef, HostListener, inject, input, output, viewChild } from '@angular/core';
import { validarFormulario } from '../core/validar';

/** Panel modal: hoja inferior en el celular, ventana centrada en escritorio. */
@Component({
  selector: 'app-hoja',
  host: { class: 'fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6' },
  template: `
    <!-- Tocar fuera no cierra: así no se pierde lo capturado por un toque accidental. -->
    <div class="absolute inset-0 bg-[rgba(8,20,30,.45)]"></div>
    <section [style.max-width]="ancho()" class="relative flex max-h-[94%] w-full flex-col overflow-hidden rounded-t-2xl bg-fondo shadow-caja motion-safe:animate-sube md:max-h-full md:rounded-2xl"
      role="dialog" aria-modal="true" [attr.aria-label]="titulo()">
      <header class="flex items-center justify-between gap-2.5 border-b border-linea bg-superficie px-4 pt-3.5 pb-3">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1"><h2>{{ titulo() }}</h2><ng-content select="[cabeza]" /></div>
        <button class="px-1.5 py-0.5 text-2xl leading-none text-tenue" (click)="cerrar.emit()" aria-label="Cerrar">×</button>
      </header>
      <div class="flex flex-col gap-3.5 overflow-x-hidden overflow-y-auto p-4"><ng-content /></div>
      <footer #pie class="flex flex-wrap gap-2 border-t border-linea bg-superficie px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] empty:hidden"><ng-content select="[pie]" /></footer>
    </section>
  `,
})
export class Hoja implements AfterViewInit {
  titulo = input('');
  /** Ancho máximo en escritorio. */
  ancho = input('780px');
  cerrar = output();
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private pie = viewChild.required<ElementRef<HTMLElement>>('pie');
  // En captura, para revisar los campos antes que el (click) del botón.
  ngAfterViewInit() { this.pie().nativeElement.addEventListener('click', (e) => this.validar(e), true); }
  /** Escape cierra solo la ventana de más arriba, si hay una encima de otra. */
  @HostListener('document:keydown.escape') esc() {
    const hojas = document.querySelectorAll('app-hoja');
    if (hojas[hojas.length - 1] === this.el.nativeElement) this.cerrar.emit();
  }

  /** El botón principal del pie (Guardar, Crear…) primero revisa los campos; si falta algo no llega a guardar. */
  validar(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button.pri, button[type=submit]');
    if (!b || b.hasAttribute('sin-validar')) return;
    if (!validarFormulario(this.el.nativeElement.querySelector('section > div')!)) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
    }
  }
}
