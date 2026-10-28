import { Component, computed, effect, HostListener, inject, signal, viewChild, ElementRef } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { AvisoService } from '../core/aviso.service';
import { CargaService } from '../core/carga.service';
import { ConfirmarService } from '../core/confirmar.service';
import { Icono } from './icono';
import { LogoCarga } from './logo-carga';

const ESTILO = {
  ok: { icono: 'ok', circulo: 'bg-ok-suave text-ok', borde: 'border-l-ok' },
  error: { icono: 'alerta', circulo: 'bg-bad-suave text-bad', borde: 'border-l-bad' },
  info: { icono: 'info', circulo: 'bg-marca-suave text-marca', borde: 'border-l-marca' },
};

/** Capas globales que viven encima de todas las pantallas: barra de carga, avisos (toasts) y ventana de confirmación. */
@Component({
  selector: 'app-capas',
  imports: [Icono, LogoCarga],
  template: `
    <!-- Cargando: la G del logo cortándose, en una pastilla arriba al centro que no tapa nada. -->
    @if (barra()) {
      <div class="pointer-events-none fixed inset-x-0 top-[max(10px,env(safe-area-inset-top,0px))] z-[70] flex justify-center px-3 motion-safe:animate-entra" role="status" aria-live="polite">
        <div class="flex items-center gap-2.5 rounded-full border border-linea bg-superficie py-1.5 pr-4 pl-1.5 shadow-caja">
          <app-logo-carga [tam]="26" />
          <span class="text-sm font-semibold">{{ lento() ? 'Un momento…' : 'Cargando…' }}</span>
        </div>
      </div>
    }

    <section class="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top,0px))] z-[65] flex flex-col items-center gap-2 px-3 sm:right-4 sm:left-auto sm:items-end"
      aria-live="polite" aria-label="Avisos">
      @for (a of avisos.avisos(); track a.id) {
        <div class="pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-xl border border-l-4 border-linea bg-superficie p-3 pr-2 shadow-caja motion-safe:animate-entra"
          [class]="estilo[a.tipo].borde" [attr.role]="a.tipo === 'error' ? 'alert' : 'status'" (mouseenter)="avisos.pausar(a.id)" (mouseleave)="avisos.reanudar(a)">
          <span class="flex size-8 flex-none items-center justify-center rounded-full" [class]="estilo[a.tipo].circulo"><app-icono [nombre]="estilo[a.tipo].icono" /></span>
          <div class="min-w-0 flex-1 pt-0.5">
            <p class="text-base font-semibold">{{ a.titulo }}</p>
            <p class="text-sm text-tenue wrap-anywhere">{{ a.texto }}</p>
          </div>
          <button class="flex size-8 flex-none items-center justify-center rounded-lg text-xl leading-none text-tenue hover:bg-superficie-2 hover:text-tinta"
            (click)="avisos.cerrar(a.id)" aria-label="Cerrar aviso">×</button>
        </div>
      }
    </section>

    @if (confirmar.actual(); as p) {
      <div class="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
        <div class="absolute inset-0 bg-[rgba(8,20,30,.5)]" (click)="p.responder(false)"></div>
        <section class="relative w-full max-w-[420px] rounded-t-2xl bg-superficie p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] shadow-caja motion-safe:animate-sube sm:rounded-2xl sm:pb-5"
          role="alertdialog" aria-modal="true" aria-labelledby="conf-t" aria-describedby="conf-d">
          <div class="flex gap-3.5">
            <span class="flex size-10 flex-none items-center justify-center rounded-full text-xl" [class]="p.peligro ? 'bg-bad-suave text-bad' : 'bg-marca-suave text-marca'">
              <app-icono [nombre]="p.peligro ? 'alerta' : 'info'" />
            </span>
            <div class="min-w-0">
              <h2 id="conf-t">{{ p.titulo }}</h2>
              @if (p.texto) { <p id="conf-d" class="mt-1.5 text-base text-tenue">{{ p.texto }}</p> }
            </div>
          </div>
          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button #cancelar class="btn" (click)="p.responder(false)">Cancelar</button>
            <button class="btn" [class]="p.peligro ? 'peligro armado' : 'pri'" (click)="p.responder(true)">{{ p.accion ?? 'Aceptar' }}</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class Capas {
  avisos = inject(AvisoService);
  confirmar = inject(ConfirmarService);
  private carga = inject(CargaService);
  private navegando = signal(false);
  private visible = signal(false);
  estilo = ESTILO;
  private cancelar = viewChild<ElementRef<HTMLButtonElement>>('cancelar');
  /** Solo aparece si la espera pasa de 400 ms, para no parpadear en respuestas rápidas. */
  barra = this.visible.asReadonly();
  /** La espera ya es larga: cambia el texto para que se note que sigue trabajando. */
  lento = signal(false);
  private ocupado = computed(() => this.carga.activa() || this.navegando());
  private t?: ReturnType<typeof setTimeout>;
  private tLento?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.navegando.set(true);
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.navegando.set(false);
    });
    effect(() => {
      clearTimeout(this.t);
      clearTimeout(this.tLento);
      if (this.ocupado()) {
        this.t = setTimeout(() => this.visible.set(true), 400);
        this.tLento = setTimeout(() => this.lento.set(true), 4000);
      } else {
        this.visible.set(false);
        this.lento.set(false);
      }
    });
    // Al abrir la confirmación, el foco va a "Cancelar" para que Enter no borre por accidente.
    effect(() => { if (this.confirmar.actual()) queueMicrotask(() => this.cancelar()?.nativeElement.focus()); });
  }

  @HostListener('document:keydown.escape') esc() { this.confirmar.actual()?.responder(false); }
}
