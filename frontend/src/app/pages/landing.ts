import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Logo } from '../ui/logo';
import { Icono } from '../ui/icono';
import { SelectorTema } from '../ui/selector-tema';
import { AvisoService } from '../core/aviso.service';
import { Api } from '../core/api.service';
import { dinero } from '../core/formato';
import { Plan } from '../core/modelos';
import { EntradaSimulador, simular } from '../core/simulador';

interface Preset { nombre: string; valores: Partial<EntradaSimulador> }

const LASER: Preset[] = [
  { nombre: 'MDF 3 mm (60×40 cm)', valores: { costoHoja: 45, anchoHoja: 60, altoHoja: 40 } },
  { nombre: 'Acrílico 3 mm (60×40 cm)', valores: { costoHoja: 210, anchoHoja: 60, altoHoja: 40 } },
  { nombre: 'Triplay 3 mm (60×40 cm)', valores: { costoHoja: 38, anchoHoja: 60, altoHoja: 40 } },
  { nombre: 'Piel sintética (50×30 cm)', valores: { costoHoja: 60, anchoHoja: 50, altoHoja: 30 } },
];
const SUBLI: Preset[] = [
  { nombre: 'Taza blanca 11 oz', valores: { costoBase: 28, costoPapel: 2.5, minutos: 4 } },
  { nombre: 'Playera poliéster', valores: { costoBase: 55, costoPapel: 5, minutos: 3 } },
  { nombre: 'Termo de acero 600 ml', valores: { costoBase: 90, costoPapel: 2.5, minutos: 5 } },
  { nombre: 'Mousepad', valores: { costoBase: 25, costoPapel: 2.5, minutos: 2 } },
];

@Component({
  selector: 'app-landing',
  imports: [FormsModule, RouterLink, Logo, Icono, SelectorTema],
  template: `
    <header class="sticky top-0 z-30 border-b border-linea bg-superficie/90 py-2.5 backdrop-blur">
      <div class="mx-auto max-w-[1200px] margen-x fila entre">
        <a class="no-underline" routerLink="/" aria-label="Grabix, inicio"><app-logo [tamano]="30" /></a>
        <nav class="hidden items-center gap-1 text-[.92rem] font-medium md:flex">
          @for (n of navegacion; track n.id) { <a [href]="'#' + n.id" class="rounded-lg px-3 py-1.5 text-tinta no-underline hover:bg-superficie-2">{{ n.texto }}</a> }
        </nav>
        <div class="flex items-center gap-1.5">
          <app-selector-tema />
          <a routerLink="/entrar" class="btn sm max-[400px]:hidden">Entrar</a>
          <a routerLink="/registro" class="btn sm pri">Prueba gratis</a>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative overflow-hidden bg-linear-to-b from-marca-suave to-fondo pt-10 pb-12 sm:pt-14 lg:pt-20 lg:pb-20">
      <div class="mx-auto grid max-w-[1200px] items-center gap-10 margen-x lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <div class="flex flex-col items-start gap-5 max-lg:items-center max-lg:text-center">
          <span class="pill sec">Software para talleres de corte láser y sublimación</span>
          <h1 class="text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] tracking-[-.035em]">Tu taller organizado, de la cotización a la entrega</h1>
          <p class="max-w-[52ch] text-[1.05rem] text-tenue sm:text-[1.12rem]">Grabix reúne cotizaciones, pedidos, producción, inventario y cobros en un solo lugar. Cotizas en segundos con tus costos reales, tu equipo sabe qué sigue y tú ves cuánto ganas cada mes.</p>
          <div class="flex w-full flex-col gap-2.5 min-[480px]:w-auto min-[480px]:flex-row">
            <a routerLink="/registro" class="btn pri min-h-12 px-6 text-[1rem]">Prueba {{ diasPrueba() }} días gratis</a>
            <a href="#simulador" class="btn min-h-12 px-6 text-[1rem]"><app-icono class="text-acento-2" nombre="rayo" />Prueba el cotizador</a>
          </div>
          <ul class="flex flex-wrap gap-x-5 gap-y-1.5 text-[.88rem] text-tenue max-lg:justify-center">
            @for (c of confianza; track c) { <li class="flex items-center gap-1.5"><app-icono class="text-acento-2" nombre="ok" />{{ c }}</li> }
          </ul>
        </div>
        <div class="w-full overflow-hidden rounded-2xl border border-linea bg-fondo shadow-caja" aria-label="Vista de ejemplo del panel de Grabix" role="img">
          <div class="flex items-center gap-1.5 border-b border-linea bg-superficie px-4 py-2.5" aria-hidden="true">
            <span class="size-2.5 rounded-full bg-bad/60"></span><span class="size-2.5 rounded-full bg-warn/60"></span><span class="size-2.5 rounded-full bg-ok/60"></span>
            <span class="ml-3 truncate rounded-md bg-superficie-2 px-3 py-0.5 text-[.75rem] text-tenue">grabix · Inicio · Datos de ejemplo</span>
          </div>
          <div class="grid grid-cols-[48px_1fr] xl:grid-cols-[150px_1fr]" aria-hidden="true">
            <div class="flex flex-col gap-1 border-r border-linea bg-superficie p-2.5">
              @for (m of menuDemo; track m.t; let i = $index) {
                <span class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[.82rem]" [class]="i === 0 ? 'bg-marca-suave text-marca font-semibold' : 'text-tenue'"><app-icono [nombre]="m.i" /><span class="max-xl:hidden">{{ m.t }}</span></span>
              }
            </div>
            <div class="flex min-w-0 flex-col gap-3 p-3 sm:p-5">
              <div class="grid grid-cols-2 gap-2.5">
                @for (k of kpisDemo; track k.l; let i = $index) {
                  <div class="rounded-xl border px-3 py-2.5" [class]="i === 0 ? 'border-[#002150] bg-[#002150] text-white' : 'border-linea bg-superficie'">
                    <p class="text-[.65rem] font-bold tracking-[.07em] uppercase opacity-75">{{ k.l }}</p>
                    <p class="num mt-0.5 text-[1.05rem]">{{ k.v }}</p>
                  </div>
                }
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-linea bg-superficie p-3.5">
                  <p class="mb-3 text-[.85rem] font-bold">Ventas y ganancia</p>
                  <div class="flex h-28 items-end gap-1.5">
                    @for (b of barrasDemo; track $index) {
                      <div class="flex h-full flex-1 items-end gap-0.5"><span class="flex-1 rounded-t-sm bg-marca" [style.height.%]="b[0]"></span><span class="flex-1 rounded-t-sm bg-acento" [style.height.%]="b[1]"></span></div>
                    }
                  </div>
                </div>
                <div class="rounded-xl border border-linea bg-superficie p-3.5">
                  <p class="mb-2 text-[.85rem] font-bold">Por entregar</p>
                  @for (p of pedidosDemo; track p.c) {
                    <div class="flex items-center justify-between gap-2 border-t border-linea py-2 text-[.8rem] first-of-type:border-t-0">
                      <span class="min-w-0 truncate">{{ p.c }}</span><span class="pill" [class]="p.e === 'Listo' ? 'ok' : 'warn'">{{ p.e }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Cotizador -->
    <section class="scroll-mt-16 py-14 lg:py-20" id="simulador">
      <div class="mx-auto max-w-[1200px] margen-x">
        <div class="mx-auto max-w-[640px] text-center">
          <p class="text-[.78rem] font-bold tracking-[.08em] text-acento-2 uppercase">Pruébalo ahora, sin registrarte</p>
          <h2 class="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] leading-tight">Así cotiza Grabix: rápido y con tus costos reales</h2>
          <p class="mt-3 text-tenue">Elige un material, ajusta medidas y minutos, y obtén un precio que cubre material, máquina y la ganancia que tú decides. Puedes mandarlo a tu cliente por WhatsApp en ese momento.</p>
        </div>

        <div class="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div class="tarjeta flex flex-col gap-4 p-[18px] sm:p-6">
            <div class="chips" role="group" aria-label="Tipo de trabajo">
              <button class="chip" [class.on]="e().tipo === 'laser'" (click)="tipo('laser')">Corte / grabado láser</button>
              <button class="chip" [class.on]="e().tipo === 'sublimacion'" (click)="tipo('sublimacion')">Sublimación</button>
            </div>
          <div class="campos">
              <div class="campo todo">
                <label for="s-mat">{{ e().tipo === 'laser' ? 'Material' : 'Producto base' }}</label>
                <select id="s-mat" [ngModel]="preset()" (ngModelChange)="usarPreset($event)">
                  @for (p of presets(); track p.nombre; let i = $index) { <option [ngValue]="i">{{ p.nombre }}</option> }
                </select>
              </div>
              @if (e().tipo === 'laser') {
                <div class="campo"><label for="s-a">Ancho de la pieza (cm)</label><input id="s-a" type="number" inputmode="decimal" [ngModel]="e().anchoPieza" (ngModelChange)="set('anchoPieza', $event)"></div>
                <div class="campo"><label for="s-h">Alto de la pieza (cm)</label><input id="s-h" type="number" inputmode="decimal" [ngModel]="e().altoPieza" (ngModelChange)="set('altoPieza', $event)"></div>
                <div class="campo"><label for="s-ch">Costo de la lámina</label><input id="s-ch" type="number" inputmode="decimal" [ngModel]="e().costoHoja" (ngModelChange)="set('costoHoja', $event)"></div>
                <div class="campo"><label for="s-m">Minutos por pieza</label><input id="s-m" type="number" inputmode="decimal" [ngModel]="e().minutos" (ngModelChange)="set('minutos', $event)"></div>
              } @else {
                <div class="campo"><label for="s-cb">Costo de la pieza base</label><input id="s-cb" type="number" inputmode="decimal" [ngModel]="e().costoBase" (ngModelChange)="set('costoBase', $event)"></div>
                <div class="campo"><label for="s-cp">Papel y tinta por pieza</label><input id="s-cp" type="number" inputmode="decimal" [ngModel]="e().costoPapel" (ngModelChange)="set('costoPapel', $event)"></div>
                <div class="campo"><label for="s-mp">Minutos por pieza</label><input id="s-mp" type="number" inputmode="decimal" [ngModel]="e().minutos" (ngModelChange)="set('minutos', $event)"></div>
                <div class="campo"><label for="s-ex">Empaque u otros</label><input id="s-ex" type="number" inputmode="decimal" [ngModel]="e().extra" (ngModelChange)="set('extra', $event)"></div>
              }
              <div class="campo"><label for="s-q">Cantidad</label><input id="s-q" type="number" inputmode="numeric" [ngModel]="e().cantidad" (ngModelChange)="set('cantidad', $event)"></div>
              <div class="campo"><label for="s-d">Diseño (cobro único)</label><input id="s-d" type="number" inputmode="decimal" [ngModel]="e().diseno" (ngModelChange)="set('diseno', $event)"></div>
              <div class="campo"><label for="s-t">Costo por minuto</label><input id="s-t" type="number" inputmode="decimal" [ngModel]="e().tarifaMinuto" (ngModelChange)="set('tarifaMinuto', $event)"></div>
              <div class="campo"><label for="s-mg">Margen de ganancia: {{ e().margen }}%</label><input id="s-mg" type="range" min="20" max="80" step="5" [ngModel]="e().margen" (ngModelChange)="set('margen', $event)"></div>
              <div class="campo todo"><label for="s-hoy">Tu precio actual por pieza <span class="font-normal">(opcional, para comparar)</span></label>
                <input id="s-hoy" type="number" inputmode="decimal" placeholder="Ej. 18" [ngModel]="hoy() || null" (ngModelChange)="hoy.set(+$event || 0)"></div>
            </div>
            <a href="#resultado" class="sticky bottom-3 z-10 -mx-1 flex items-center justify-between gap-3 rounded-xl bg-[#002150] px-4 py-3 text-white no-underline shadow-caja lg:hidden">
              <span class="text-[.85rem] text-white/75">Precio por pieza<br><b class="num text-[1.35rem] text-white">{{ $(r().precioPieza) }}</b></span>
              <span class="text-[.85rem] font-semibold">Ver detalle ↓</span>
            </a>
          </div>

          <aside class="tarjeta flex scroll-mt-20 flex-col gap-4 p-[18px] shadow-caja sm:p-6 lg:sticky lg:top-20" id="resultado" aria-live="polite">
            <div>
              <span class="text-[.85rem] text-tenue">Precio sugerido por pieza</span>
              <p class="num text-[2.6rem] leading-[1.1] font-semibold text-marca">{{ $(r().precioPieza) }}</p>
              <p class="text-[.9rem] text-tenue">Total del pedido: <b class="num text-tinta">{{ $(r().precioTotal) }}</b></p>
            </div>
            <div class="rounded-xl bg-superficie-2 p-3.5">
            <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-[3px] text-[.88rem] [&_dd]:text-right [&_dt]:text-tenue">
                @if (e().tipo === 'laser') {
                  <dt>Piezas por lámina</dt><dd class="num">{{ r().piezasPorHoja || 'No cabe' }}</dd>
                  <dt>Láminas necesarias</dt><dd class="num">{{ r().hojas }}</dd>
                }
                <dt>Material</dt><dd class="num">{{ $(r().material) }}</dd>
                <dt>Tiempo de máquina</dt><dd class="num">{{ $(r().maquina) }}</dd>
                <dt>Costo por pieza</dt><dd class="num">{{ $(r().costoPieza) }}</dd>
                <dt>Tu ganancia</dt><dd class="num font-semibold text-ok">{{ $(r().ganancia) }}</dd>
              </dl>
            </div>
          @if (diagnostico(); as d) {
              <div class="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[.92rem]" role="status"
                [class]="d.tipo === 'bad' ? 'bg-warn-suave text-warn' : d.tipo === 'warn' ? 'bg-marca-suave text-marca' : 'bg-ok-suave text-ok'">
                <app-icono class="mt-0.5 text-[1.1rem]" [nombre]="d.tipo === 'ok' ? 'ok' : d.tipo === 'warn' ? 'info' : 'alerta'" />
                <span><b class="font-bold">{{ d.titulo }}</b> {{ d.texto }}</span>
              </div>
            }
            <div class="grid gap-2 min-[480px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <a class="btn wa min-h-11" [href]="whatsapp()" target="_blank" rel="noopener"><app-icono nombre="wa" />Enviar por WhatsApp</a>
              <button class="btn min-h-11" (click)="copiar()">{{ copiado() ? '¡Copiada!' : 'Copiar cotización' }}</button>
            </div>
            <div class="flex flex-col gap-2.5 border-t border-dashed border-linea pt-4">
              <p class="tenue chico">En Grabix cada cotización se guarda con folio, se convierte en PDF con tu logo y pasa a producción cuando el cliente acepta.</p>
              <a routerLink="/registro" class="btn sec min-h-11">Crear cuenta gratis</a>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <!-- Antes / con Grabix -->
    <section class="mx-auto max-w-[1200px] margen-x py-14" id="por-que">
      <p class="text-center text-[.78rem] font-bold tracking-[.08em] text-acento-2 uppercase">Por qué Grabix</p>
      <h2 class="mx-auto mt-2 max-w-[24ch] text-center text-[clamp(1.5rem,3vw,2.1rem)] leading-tight">Menos tiempo en cuentas y mensajes, más tiempo produciendo</h2>
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <article class="tarjeta p-6">
          <h3 class="mb-3 text-tenue">Sin un sistema</h3>
          <ul class="grid gap-2.5">@for (x of antes; track x) { <li class="flex items-start gap-2.5"><span class="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-bad-suave text-[.8rem] font-bold text-bad">×</span>{{ x }}</li> }</ul>
        </article>
        <article class="tarjeta border-2 border-acento p-6">
          <h3 class="mb-3 text-acento-2">Con Grabix</h3>
          <ul class="grid gap-2.5">@for (x of despues; track x) { <li class="flex items-start gap-2.5"><span class="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-ok-suave text-ok"><app-icono nombre="ok" /></span>{{ x }}</li> }</ul>
        </article>
      </div>
    </section>

    <!-- Vista previa del producto -->
    <section class="bg-superficie py-14" id="funciones">
      <div class="mx-auto max-w-[1200px] margen-x">
        <p class="text-center text-[.78rem] font-bold tracking-[.08em] text-acento-2 uppercase">Funciones</p>
        <h2 class="mx-auto mt-2 max-w-[26ch] text-center text-[clamp(1.5rem,3vw,2.1rem)] leading-tight">Todo lo que tu taller necesita, en un solo sistema</h2>

        <div class="mt-10 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          @for (b of beneficios; track b.t) {
            <article class="flex gap-3.5">
              <span class="flex size-10 flex-none items-center justify-center rounded-xl bg-marca-suave text-[1.2rem] text-marca"><app-icono [nombre]="b.i" /></span>
              <div><h3>{{ b.t }}</h3><p class="mt-1 text-[.94rem] text-tenue">{{ b.d }}</p></div>
            </article>
          }
        </div>
      </div>
    </section>

    <!-- Cómo funciona -->
    <section class="mx-auto max-w-[1200px] margen-x py-14" id="como-funciona">
      <p class="text-center text-[.78rem] font-bold tracking-[.08em] text-acento-2 uppercase">Cómo funciona</p>
      <h2 class="mt-2 text-center text-[clamp(1.5rem,3vw,2.1rem)]">Del mensaje del cliente a la entrega</h2>
      <ol class="mt-8 grid gap-4 md:grid-cols-3">
        @for (p of pasos; track p.t; let i = $index) {
          <li class="tarjeta relative p-6">
            <span class="num flex size-9 items-center justify-center rounded-full bg-marca text-[.95rem] font-semibold text-sobre-marca">{{ i + 1 }}</span>
            <h3 class="mt-4 text-[1.05rem]">{{ p.t }}</h3><p class="mt-1.5 text-tenue">{{ p.d }}</p>
          </li>
        }
      </ol>
    </section>

    <!-- Planes -->
    <section class="bg-superficie py-14" id="precios">
      <div class="mx-auto max-w-[1200px] margen-x">
        <p class="text-center text-[.78rem] font-bold tracking-[.08em] text-acento-2 uppercase">Precios</p>
        <h2 class="mt-2 text-center text-[clamp(1.5rem,3vw,2.1rem)]">Un plan para cada tamaño de taller</h2>
        <p class="tenue mt-2 text-center">{{ diasPrueba() }} días gratis con todas las funciones. Sin tarjeta para empezar.</p>
        <div class="chips mt-4 mb-7 justify-center">
          <button class="chip" [class.on]="!anual()" (click)="anual.set(false)">Mensual</button>
          <button class="chip" [class.on]="anual()" (click)="anual.set(true)">Anual (2 meses gratis)</button>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] items-start gap-4">
          @for (p of planes(); track p.id; let i = $index) {
            <article class="tarjeta flex flex-col gap-2 p-6" [class]="i === 1 ? 'border-2 border-acento shadow-caja' : ''">
              @if (i === 1) { <span class="pill sec self-start">El más elegido</span> }
              <h3 class="text-[1.1rem]">{{ p.nombre }}</h3>
              <p class="text-[1.7rem] font-semibold"><span class="num">{{ $(anual() ? p.precioAnual : p.precioMensual) }}</span> <span class="text-[1rem] font-normal text-tenue">/ {{ anual() ? 'año' : 'mes' }}</span></p>
              <p class="tenue chico">{{ p.sucursales }} sucursal{{ p.sucursales > 1 ? 'es' : '' }} · {{ p.usuarios }} usuarios</p>
              <ul class="mt-2 mb-3 grid gap-1.5 text-[.92rem]">@for (x of p.incluye; track x) { <li class="flex items-start gap-2"><app-icono class="mt-0.5 text-acento-2" nombre="ok" />{{ x }}</li> }</ul>
              <a routerLink="/registro" class="btn min-h-11" [class.pri]="i === 1">Empezar prueba gratis</a>
            </article>
          } @empty {
            <p class="tenue text-center">Los precios se cargan en un momento.</p>
          }
        </div>
      </div>
    </section>

    <!-- Preguntas frecuentes -->
    <section class="mx-auto max-w-[820px] margen-x py-14" id="preguntas">
      <h2 class="text-center text-[clamp(1.5rem,3vw,2.1rem)]">Preguntas frecuentes</h2>
      <div class="mt-7 flex flex-col gap-2.5">
        @for (f of preguntas; track f.p) {
          <details class="group tarjeta px-5 py-4 open:shadow-caja">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
              {{ f.p }}<span class="text-[1.3rem] leading-none text-tenue transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p class="mt-2.5 text-tenue">{{ f.r }}</p>
          </details>
        }
      </div>
    </section>

    <!-- Llamado final -->
    <section class="margen-x pb-14">
      <div class="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-[#002150] px-6 py-12 text-center text-white sm:px-12">
        <div class="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full bg-[#67be28] opacity-25 blur-3xl" aria-hidden="true"></div>
        <h2 class="relative mx-auto max-w-[22ch] text-[clamp(1.6rem,3.4vw,2.3rem)] leading-tight">Organiza tu taller y dedica tu tiempo a producir</h2>
        <p class="relative mx-auto mt-3 max-w-[48ch] text-white/75">{{ diasPrueba() }} días gratis con todas las funciones. Cargamos datos de ejemplo para que lo conozcas en minutos.</p>
        <div class="relative mt-6 flex flex-wrap justify-center gap-2.5">
          <a routerLink="/registro" class="btn sec min-h-11 px-6">Crear mi cuenta gratis</a>
          <a href="#simulador" class="btn min-h-11 border-white/30 bg-transparent px-6 text-white hover:border-white">Probar el cotizador</a>
        </div>
      </div>
    </section>

    <footer class="border-t border-linea">
      <div class="mx-auto max-w-[1200px] margen-x flex flex-wrap items-center justify-between gap-3 py-7 text-[.88rem] text-tenue">
        <app-logo [tamano]="24" />
        <span>Software para talleres de corte láser y sublimación · Hecho por Elikar Systems</span>
        <a href="mailto:soporte@elikarsystems.com" class="text-tenue">soporte&#64;elikarsystems.com</a>
      </div>
    </footer>
  `,
  host: { class: 'block bg-fondo' },
})
export class Landing implements OnInit {
  private api = inject(Api);
  private avisos = inject(AvisoService);
  navegacion = [
    { id: 'simulador', texto: 'Cotizador' },
    { id: 'funciones', texto: 'Funciones' },
    { id: 'precios', texto: 'Precios' },
    { id: 'preguntas', texto: 'Preguntas' },
  ];
  confianza = ['Sin tarjeta', 'Cancela cuando quieras', 'Funciona en tu celular'];
  antes = [
    'Cada precio se calcula a mano y cada quien cotiza distinto.',
    'Las cotizaciones se pierden entre chats y nadie les da seguimiento.',
    'El material se acaba sin aviso y los pedidos se retrasan.',
    'Saber cuánto se ganó en el mes toma horas de cuentas.',
  ];
  despues = [
    'Precios consistentes, calculados con tus costos reales y tu margen.',
    'Cotizaciones con folio y PDF, enviadas por WhatsApp en un toque.',
    'El inventario se descuenta solo y te avisa antes de que falte.',
    'Ventas, ganancia y cobros pendientes al día, por sucursal.',
  ];
  beneficios = [
    { i: 'cotizaciones', t: 'Cotiza y envía por WhatsApp', d: 'Folio, descuentos y promociones. El cliente recibe el resumen y la liga a su PDF.' },
    { i: 'inventario', t: 'Inventario que se descuenta solo', d: 'Arma recetas: una taza sublimada usa una taza blanca y una hoja de papel. Al vender se descuentan.' },
    { i: 'rayo', t: 'Costos reales', d: 'Material, minutos de máquina y extras. Sabes cuánto ganas en cada pedido antes de aceptarlo.' },
    { i: 'ventas', t: 'Ventas, anticipos y saldos', d: 'Del pedido a producción y entrega, con pagos parciales y lo que te deben.' },
    { i: 'sucursales', t: 'Sucursales y roles', d: 'Inventario y folios por sucursal, traspasos, y permisos: el vendedor no ve tus costos.' },
    { i: 'inicio', t: 'Estadísticas', d: 'Ventas, ganancia y margen por mes, lo que más te deja y alertas de stock bajo.' },
  ];
  pasos = [
    { t: 'Cotiza en segundos', d: 'Elige el producto y la cantidad. Grabix calcula material, máquina y margen, y mandas el PDF por WhatsApp.' },
    { t: 'Produce sin perder nada', d: 'La cotización aceptada pasa a producción. Tu equipo ve qué sigue y el inventario se descuenta solo.' },
    { t: 'Cobra y mide', d: 'Registra anticipos y saldos, entrega, y mira cuánto ganaste por producto, por mes y por sucursal.' },
  ];
  preguntas = [
    { p: '¿Necesito tarjeta para la prueba?', r: 'No. Creas tu cuenta con tu correo y usas todas las funciones durante la prueba. Al terminar eliges un plan si te convenció.' },
    { p: '¿Funciona en el celular?', r: 'Sí. Grabix funciona en el navegador del celular, la tablet o la computadora, y puedes instalarlo como app en tu pantalla de inicio.' },
    { p: '¿Sirve si hago corte láser y también sublimación?', r: 'Sí. Puedes tener productos de los dos tipos, con sus propios costos de material, papel, tinta y minutos de máquina o plancha.' },
    { p: '¿Puedo tener varias sucursales y empleados?', r: 'Sí. Cada sucursal tiene su inventario y sus folios, y cada empleado entra con su usuario. Tú decides qué puede ver cada quien.' },
    { p: '¿Puedo cancelar cuando quiera?', r: 'Sí. No hay plazos forzosos. Si cancelas, puedes seguir consultando tu información.' },
    { p: '¿Mis datos están seguros?', r: 'Cada taller tiene su información separada, las contraseñas se guardan cifradas y solo tu equipo puede entrar a tu cuenta.' },
  ];
  menuDemo = [
    { i: 'inicio', t: 'Inicio' }, { i: 'cotizaciones', t: 'Cotizaciones' }, { i: 'ventas', t: 'Ventas' },
    { i: 'produccion', t: 'Producción' }, { i: 'inventario', t: 'Inventario' }, { i: 'clientes', t: 'Clientes' },
  ];
  kpisDemo = [{ l: 'Ventas del mes', v: '$48,320' }, { l: 'Ganancia', v: '$21,410' }, { l: 'Por cobrar', v: '$6,900' }, { l: 'Pedidos', v: '37' }];
  barrasDemo = [[38, 18], [52, 24], [45, 20], [64, 30], [58, 27], [76, 36], [70, 33], [92, 44]];
  pedidosDemo = [{ c: '120 llaveros MDF', e: 'En proceso' }, { c: '24 tazas', e: 'Listo' }, { c: 'Letrero acrílico', e: 'En proceso' }];

  e = signal<EntradaSimulador>({
    tipo: 'laser', cantidad: 50, costoHoja: 45, anchoHoja: 60, altoHoja: 40, anchoPieza: 6, altoPieza: 4,
    costoBase: 28, costoPapel: 2.5, minutos: 3, tarifaMinuto: 6, extra: 0, diseno: 150, margen: 60,
  });
  preset = signal(0);
  presets = computed(() => (this.e().tipo === 'laser' ? LASER : SUBLI));
  r = computed(() => simular(this.e()));
  planes = signal<Plan[]>([]);
  diasPrueba = signal(14);
  anual = signal(false);
  /** Lo que el taller cobra hoy por pieza, para compararlo con el precio sugerido. */
  hoy = signal(0);
  copiado = signal(false);

  diagnostico = computed(() => {
    const hoy = this.hoy(), r = this.r(), q = Math.max(1, Math.floor(this.e().cantidad || 1));
    if (!hoy || !r.precioPieza) return null;
    if (hoy < r.costoPieza)
      return { tipo: 'bad', titulo: 'Ese precio no alcanza a cubrir los costos.', texto: `Cada pieza cuesta ${dinero(r.costoPieza)} en material y máquina. Con el precio sugerido este pedido deja ${dinero(r.ganancia)} de ganancia.` };
    if (hoy < r.precioPieza)
      return { tipo: 'warn', titulo: `Podrías ganar ${dinero((r.precioPieza - hoy) * q)} más en este pedido.`, texto: `Con tu precio actual el margen es de ${Math.round((1 - r.costoPieza / hoy) * 100)}%; el sugerido llega al ${this.e().margen}%.` };
    return { tipo: 'ok', titulo: 'Tu precio está en buen nivel.', texto: `Cubre costos y deja ${Math.round((1 - r.costoPieza / hoy) * 100)}% de margen.` };
  });

  /** Texto de la cotización para el cliente final. */
  textoCotizacion = computed(() => {
    const e = this.e(), r = this.r(), q = Math.max(1, Math.floor(e.cantidad || 1));
    const p = this.presets()[this.preset()]?.nombre ?? '';
    const que = e.tipo === 'laser' ? `${q} piezas de ${e.anchoPieza}×${e.altoPieza} cm en ${p}` : `${q} × ${p} sublimado`;
    return [
      'Hola, te comparto la cotización:',
      `• ${que}`,
      `• Precio por pieza: ${dinero(r.precioPieza)}`,
      e.diseno ? `• Diseño: incluido en el total` : '',
      `Total: ${dinero(r.precioTotal)}`,
      '',
      '¿Te la confirmo?',
    ].filter((x, i, a) => x || a[i - 1]).join('\n');
  });
  whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(this.textoCotizacion())}`);

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.textoCotizacion());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.avisos.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  }

  async ngOnInit() {
    try {
      const r = await this.api.get<{ diasPrueba: number; planes: Plan[] }>('/publico/planes');
      this.planes.set(r.planes);
      this.diasPrueba.set(r.diasPrueba);
    } catch { /* sin API: la landing sigue funcionando sin precios */ }
  }

  $ = (n: number) => dinero(n);
  set<K extends keyof EntradaSimulador>(k: K, v: EntradaSimulador[K]) { this.e.update((x) => ({ ...x, [k]: typeof x[k] === 'number' ? Number(v) || 0 : v })); }
  tipo(t: 'laser' | 'sublimacion') {
    this.e.update((x) => ({ ...x, tipo: t, cantidad: t === 'laser' ? 50 : 12, minutos: t === 'laser' ? 3 : 4, extra: 0 }));
    this.usarPreset(0);
  }
  usarPreset(i: number) {
    this.preset.set(i);
    this.e.update((x) => ({ ...x, ...this.presets()[i].valores }));
  }
}
