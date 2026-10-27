import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AsistenteService } from '../core/asistente.service';
import { markdown } from '../core/markdown';
import { SesionService } from '../core/sesion.service';
import { Icono } from './icono';

const SUGERENCIAS: Record<string, string[]> = {
  costos: ['¿Cómo van las ventas este mes?', '¿Qué pedidos tengo por entregar?', '¿Qué material está por acabarse?', '¿Quién me debe dinero?', '¿Qué producto me deja más ganancia?'],
  vendedor: ['¿Qué pedidos tengo por entregar?', '¿Qué cotizaciones siguen sin respuesta?', '¿Cómo convierto una cotización en venta?', '¿Hay stock de tazas blancas?'],
  produccion: ['¿Qué pedidos siguen en producción?', '¿Qué se entrega esta semana?', '¿Qué material está por acabarse?'],
};

/** Panel de chat del asistente con IA. Se abre desde el botón "Asistente" de la barra superior. */
@Component({
  selector: 'app-asistente',
  imports: [Icono],
  host: { '(document:keydown.escape)': 'a.abierto.set(false)' },
  template: `
    @if (a.abierto()) {
      <section class="fixed inset-0 z-40 flex animate-entra flex-col bg-superficie sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[min(680px,calc(100dvh-32px))] sm:w-[420px] sm:rounded-2xl sm:border sm:border-linea sm:shadow-caja lg:right-6 lg:bottom-6"
        role="dialog" aria-label="Asistente de Grabix">
        <header class="flex items-center gap-3 border-b border-linea px-4 py-3">
          <span class="flex size-9 flex-none items-center justify-center rounded-xl bg-[#002150] text-[1.15rem] text-[#8fd85a]"><app-icono nombre="chispa" /></span>
          <div class="min-w-0 flex-1">
            <h2 class="text-[.98rem]">Asistente</h2>
            <p class="truncate text-[.76rem] text-tenue">Consulta datos de {{ s.nombreSucursal() }}</p>
          </div>
          @if (a.mensajes().length) {
            <button class="flex size-9 items-center justify-center rounded-lg text-[1.1rem] text-tenue hover:bg-superficie-2 hover:text-tinta" (click)="a.nueva()" title="Nueva conversación" aria-label="Nueva conversación"><app-icono nombre="nueva" /></button>
          }
          <button class="flex size-9 items-center justify-center rounded-lg text-[1.1rem] text-tenue hover:bg-superficie-2 hover:text-tinta" (click)="a.abierto.set(false)" aria-label="Cerrar el asistente"><app-icono nombre="cerrar" /></button>
        </header>

        <div #lista class="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" (click)="enlace($event)" aria-live="polite">
          @if (a.estado()?.disponible === false) {
            <p class="rounded-xl bg-warn-suave px-3.5 py-3 text-[.86rem] text-warn">El asistente todavía no está activado en este servidor. Falta agregar la llave de IA en la configuración.</p>
          }
          @if (!a.mensajes().length) {
            <div class="flex flex-col gap-1 pt-2">
              <p class="font-titulo text-[1.15rem] font-bold">Hola, {{ nombre() }}</p>
              <p class="text-[.92rem] text-tenue">Pregúntame por tus ventas, pedidos, inventario o clientes, o cómo hacer algo en Grabix. Respondo con los datos de tu sucursal.</p>
            </div>
            <div class="mt-1 flex flex-col items-start gap-2">
              @for (q of sugerencias(); track q) {
                <button class="rounded-xl border border-linea bg-superficie px-3.5 py-2 text-left text-[.88rem] hover:border-marca hover:bg-marca-suave" (click)="enviar(q)">{{ q }}</button>
              }
            </div>
          }
          @for (m of a.mensajes(); track $index) {
            @if (m.rol === 'usuario') {
              <p class="max-w-[85%] self-end rounded-2xl rounded-br-md bg-marca px-3.5 py-2 text-[.92rem] whitespace-pre-wrap text-sobre-marca">{{ m.texto }}</p>
            } @else {
              <div class="max-w-[92%] self-start rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[.92rem] leading-relaxed
                [&_a]:font-semibold [&_a]:text-marca [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                [class]="m.error ? 'bg-bad-suave text-bad' : 'bg-superficie-2'" [innerHTML]="html(m.texto)"></div>
            }
          }
          @if (a.pensando()) {
            <div class="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-superficie-2 px-4 py-3" aria-label="El asistente está escribiendo">
              @for (i of [0, 1, 2]; track i) { <span class="size-2 animate-bounce rounded-full bg-tenue" [style.animation-delay.ms]="i * 150"></span> }
            </div>
          }
        </div>

        <form class="border-t border-linea px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] sm:pb-3" (submit)="$event.preventDefault(); enviar()">
          <div class="flex items-end gap-2 rounded-xl border border-linea bg-superficie px-2 py-1.5 focus-within:border-marca">
            <label class="sr" for="asis-txt">Escribe tu pregunta</label>
            <textarea #caja id="asis-txt" rows="1" class="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[.95rem] outline-none" placeholder="Escribe tu pregunta…"
              [value]="texto()" (input)="escribir($event)" (keydown.enter)="enter($any($event))"></textarea>
            <button class="flex size-9 flex-none items-center justify-center rounded-lg bg-marca text-[1.1rem] text-sobre-marca disabled:opacity-40" [disabled]="!texto().trim() || a.pensando()" aria-label="Enviar"><app-icono nombre="enviar" /></button>
          </div>
          <p class="mt-1.5 px-1 text-[.7rem] text-tenue">Puede equivocarse: revisa las cifras importantes.@if (a.estado(); as e) { @if (e.disponible) { · {{ e.usadas }} de {{ e.limite }} preguntas hoy } }</p>
        </form>
      </section>
    }
  `,
})
export class Asistente {
  a = inject(AsistenteService);
  s = inject(SesionService);
  private router = inject(Router);
  private lista = viewChild<ElementRef<HTMLElement>>('lista');
  private caja = viewChild<ElementRef<HTMLTextAreaElement>>('caja');
  texto = signal('');
  nombre = computed(() => (this.s.perfil()?.usuario.nombre ?? '').split(' ')[0]);
  sugerencias = computed(() => SUGERENCIAS[this.s.verCostos() ? 'costos' : this.s.rol() === 'produccion' ? 'produccion' : 'vendedor']);
  private cache = new Map<string, string>();

  constructor() {
    // Baja al último mensaje cuando llega uno nuevo.
    effect(() => {
      if (this.a.abierto()) setTimeout(() => this.caja()?.nativeElement.focus(), 50);
    });
    effect(() => {
      this.a.mensajes();
      this.a.pensando();
      queueMicrotask(() => {
        const el = this.lista()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }


  html(t: string) {
    let h = this.cache.get(t);
    if (!h) this.cache.set(t, (h = markdown(t)));
    return h;
  }

  escribir(ev: Event) {
    const el = ev.target as HTMLTextAreaElement;
    this.texto.set(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  enter(ev: KeyboardEvent) {
    if (ev.shiftKey) return;
    ev.preventDefault();
    this.enviar();
  }

  enviar(q = this.texto()) {
    if (!q.trim()) return;
    this.a.preguntar(q);
    this.texto.set('');
    const el = this.caja()?.nativeElement;
    if (el) el.style.height = 'auto';
  }

  /** Los enlaces de las respuestas abren la pantalla dentro de la app. */
  enlace(ev: MouseEvent) {
    const a = (ev.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href?.startsWith('/app/')) return;
    ev.preventDefault();
    this.router.navigateByUrl(href);
    if (window.innerWidth < 640) this.a.abierto.set(false);
  }
}
