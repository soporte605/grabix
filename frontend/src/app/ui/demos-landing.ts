import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { Icono } from './icono';

/*
 * Maquetas de la landing. Todo es dibujo con datos de ejemplo (Taller Luna, Ana Martínez, Banco Ejemplo):
 * nunca usar capturas reales de un taller, traen cuentas, tarjetas y teléfonos de clientes.
 */

/** Foto de ejemplo: llavero redondo de MDF grabado con láser, sobre una mano. */
@Component({
  selector: 'app-foto-llavero',
  host: { class: 'block' },
  template: `
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" class="block size-full" role="img" [attr.aria-label]="'Llavero de MDF grabado con láser'">
      <defs>
        <radialGradient [attr.id]="id('f')" cx=".3" cy=".25" r="1"><stop offset="0" [attr.stop-color]="fondo()[0]" /><stop offset="1" [attr.stop-color]="fondo()[1]" /></radialGradient>
        <radialGradient [attr.id]="id('m')" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#e6c79c" /><stop offset=".7" stop-color="#d2a978" /><stop offset="1" stop-color="#b88a57" /></radialGradient>
        <linearGradient [attr.id]="id('p')" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1c6a6" /><stop offset="1" stop-color="#d79b78" /></linearGradient>
      </defs>
      <rect width="200" height="200" [attr.fill]="url('f')" />
      <!-- mano -->
      <path d="M-10 200 C 20 150 40 128 78 120 C 110 113 150 118 176 140 L 210 170 L 210 200 Z" [attr.fill]="url('p')" />
      <path d="M150 128 C 168 120 186 122 200 132 L 200 150 C 186 142 170 142 158 146 Z" fill="#e2ad8c" />
      <!-- argolla -->
      <circle [attr.cx]="100 + giro()" cy="34" r="17" fill="none" stroke="#a9b0ba" stroke-width="3.2" />
      <circle [attr.cx]="100 + giro()" cy="34" r="17" fill="none" stroke="#e9edf2" stroke-width="1" stroke-dasharray="14 40" />
      <!-- pieza -->
      <g [attr.transform]="'rotate(' + giro() + ' 100 108)'">
        <circle cx="100" cy="112" r="66" fill="#000" opacity=".16" />
        <circle cx="100" cy="108" r="66" [attr.fill]="url('m')" />
        <path d="M44 92 C 80 86 120 98 156 90 M40 118 C 80 112 124 126 160 116 M50 142 C 84 136 118 148 150 140" fill="none" stroke="#a87b4b" stroke-width=".7" opacity=".35" />
        <circle cx="100" cy="108" r="66" fill="none" stroke="#8a5f33" stroke-width="1.2" opacity=".5" />
        <circle cx="100" cy="51" r="5.5" fill="#6d4a28" opacity=".85" />
        <g fill="#5a3818" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">
          <text x="100" y="94" font-size="20" font-style="italic">{{ linea1() }}</text>
          <text x="100" y="118" font-size="12" letter-spacing="2" font-weight="700">{{ linea2() }}</text>
          <text x="100" y="140" font-size="10" letter-spacing="1.5">{{ linea3() }}</text>
        </g>
        <path d="M76 126 h48" stroke="#5a3818" stroke-width=".8" opacity=".7" />
      </g>
      <!-- pulgar -->
      <path d="M118 200 C 122 176 136 160 160 156 C 176 154 190 162 200 170 L 200 200 Z" [attr.fill]="url('p')" opacity=".96" />
    </svg>
  `,
})
export class FotoLlavero {
  private static n = 0;
  private uid = `ll${FotoLlavero.n++}`;
  linea1 = input('Ana & Luis');
  linea2 = input('NUESTRA BODA');
  linea3 = input('14 · 02 · 2027');
  giro = input(0);
  fondo = input<[string, string]>(['#dfe9e2', '#9fb5a8']);
  id = (s: string) => `${this.uid}-${s}`;
  url = (s: string) => `url(#${this.uid}-${s})`;
}

/** Diseño para aprobar: la prueba en blanco y negro que manda el taller. */
@Component({
  selector: 'app-prueba-diseno',
  host: { class: 'block' },
  template: `
    <svg viewBox="0 0 200 150" class="block size-full" role="img" aria-label="Diseño del llavero para aprobar">
      <rect width="200" height="150" fill="#fff" />
      <g stroke="#d6dde6" stroke-width=".5">
        @for (x of rejilla; track x) { <path [attr.d]="'M' + x + ' 0V150'" /> <path [attr.d]="'M0 ' + x + 'H200'" /> }
      </g>
      <circle cx="100" cy="76" r="58" fill="none" stroke="#e5484d" stroke-width=".9" />
      <circle cx="100" cy="27" r="5" fill="none" stroke="#e5484d" stroke-width=".9" />
      <g fill="#111" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">
        <text x="100" y="66" font-size="18" font-style="italic">Ana &amp; Luis</text>
        <text x="100" y="87" font-size="10.5" letter-spacing="2" font-weight="700">NUESTRA BODA</text>
        <text x="100" y="105" font-size="9" letter-spacing="1.5">14 · 02 · 2027</text>
      </g>
      <path d="M78 93 h44" stroke="#111" stroke-width=".7" />
      <g font-family="system-ui, sans-serif" font-size="6" fill="#64748b">
        <text x="6" y="144">Ø 5 cm · MDF 3 mm · rojo = corte, negro = grabado</text>
      </g>
    </svg>
  `,
})
export class PruebaDiseno {
  rejilla = [25, 50, 75, 100, 125, 150, 175];
}

/** Taza sublimada de ejemplo para las imágenes de una cotización. */
@Component({
  selector: 'app-foto-taza',
  host: { class: 'block' },
  template: `
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" class="block size-full" role="img" aria-label="Taza sublimada de ejemplo">
      <rect width="120" height="120" [attr.fill]="fondo()" />
      <ellipse cx="58" cy="100" rx="34" ry="6" fill="#000" opacity=".12" />
      <path d="M86 46 c 16 0 18 30 0 30" fill="none" stroke="#e8edf3" stroke-width="7" />
      <path d="M86 46 c 16 0 18 30 0 30" fill="none" stroke="#cfd8e3" stroke-width="2" />
      <path d="M28 30 h60 v62 a8 8 0 0 1 -8 8 h-44 a8 8 0 0 1 -8 -8 z" fill="#fff" />
      <path d="M28 30 h60 v62 a8 8 0 0 1 -8 8 h-44 a8 8 0 0 1 -8 -8 z" fill="none" stroke="#dbe2ea" stroke-width="1" />
      <ellipse cx="58" cy="30" rx="30" ry="5" fill="#eef2f6" stroke="#dbe2ea" stroke-width="1" />
      <!-- impresión: corona de hojas con flores, como un diseño de boda -->
      <g transform="translate(57 63)">
        <circle r="19" fill="none" stroke="#c9a54a" stroke-width=".6" />
        @for (h of hojas; track h) {
          <ellipse [attr.transform]="'rotate(' + h + ') translate(0 -19) rotate(35)'" rx="1.6" ry="3.6" fill="#4d7a3c" />
        }
        @for (f of flores; track f) {
          <g [attr.transform]="'rotate(' + f + ') translate(0 -19)'"><circle r="3.4" [attr.fill]="color()" /><circle r="1.7" fill="#000" opacity=".22" /></g>
        }
        <text y="-1" text-anchor="middle" font-family="Georgia, serif" font-size="5.6" font-style="italic" fill="#2b2b2b">{{ texto() }}</text>
        <text y="7" text-anchor="middle" font-family="Georgia, serif" font-size="3.6" letter-spacing=".6" fill="#7a6a3a">{{ fecha() }}</text>
        <circle cx="-2" cy="12" r="2.4" fill="none" stroke="#c9a54a" stroke-width="1" /><circle cx="2" cy="12" r="2.4" fill="none" stroke="#c9a54a" stroke-width="1" />
      </g>
      <path d="M32 34 v52" stroke="#fff" stroke-width="3" opacity=".7" />
    </svg>
  `,
})
export class FotoTaza {
  hojas = [0, 24, 48, 72, 96, 132, 156, 180, 204, 228, 264, 288, 312, 336];
  flores = [116, 248, 30];
  fecha = input('14 · 02 · 2027');
  color = input('#b3243a');
  texto = input('Mamá');
  fondo = input('#eef3f8');
}

/** Logo de ejemplo del taller (cada sucursal puede tener el suyo). */
@Component({
  selector: 'app-logo-ejemplo',
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <svg [style.width.px]="tamano()" [style.height.px]="tamano()" viewBox="0 0 40 40" aria-hidden="true" class="flex-none">
      <rect width="40" height="40" rx="10" fill="#3b2a6b" />
      <circle cx="21" cy="20" r="11" fill="#f5c451" />
      <circle cx="26" cy="16" r="10" fill="#3b2a6b" />
      <circle cx="12" cy="11" r="1.2" fill="#f5c451" /><circle cx="30" cy="30" r="1" fill="#f5c451" />
    </svg>
    <span class="leading-tight"><b class="block font-titulo font-extrabold tracking-[-.01em]" [style.font-size.px]="tamano() * .42">Taller Luna</b>
      @if (sucursal()) { <span class="block text-tenue" [style.font-size.px]="tamano() * .3">{{ sucursal() }}</span> }</span>
  `,
})
export class LogoEjemplo {
  tamano = input(32);
  sucursal = input('');
}

interface Paso { i: string; t: string; d: string; url: string }

/**
 * El enlace del cliente en un celular: los pasos a la izquierda y la pantalla a la derecha.
 * Avanza solo cada pocos segundos hasta que el visitante elige un paso.
 */
@Component({
  selector: 'app-demo-enlace',
  imports: [Icono, FotoLlavero, FotoTaza, PruebaDiseno, LogoEjemplo],
  host: { class: 'grid items-center justify-center gap-8 lg:grid-cols-[minmax(0,500px)_auto] lg:gap-16' },
  template: `
    <ol class="flex flex-col gap-2 max-lg:hidden" role="tablist" aria-label="Lo que hace tu cliente en su enlace">
      @for (p of pasos; track p.t; let i = $index) {
        <li class="contents">
          <button type="button" role="tab" [attr.aria-selected]="i === actual()" (click)="elegir(i)"
            class="group relative flex w-full items-start gap-3.5 overflow-hidden rounded-2xl border p-3.5 text-left transition-colors sm:p-4"
            [class]="i === actual() ? 'border-marca bg-superficie shadow-caja' : 'border-transparent hover:bg-superficie'">
            <span class="flex size-10 flex-none items-center justify-center rounded-xl text-[1.15rem] transition-colors"
              [class]="i === actual() ? 'bg-[#002150] text-[#8fd85a]' : 'bg-marca-suave text-marca'"><app-icono [nombre]="p.i" /></span>
            <span class="min-w-0">
              <b class="block font-semibold">{{ p.t }}</b>
              <span class="block text-[.93rem] text-tenue">{{ p.d }}</span>
            </span>
            @if (i === actual() && auto()) { <span class="absolute bottom-0 left-0 h-0.5 bg-acento" [style.animation]="'barra ' + ms + 'ms linear forwards'"></span> }
          </button>
        </li>
      }
    </ol>

    <div class="relative mx-auto w-[300px] max-w-full sm:w-[316px]" aria-hidden="true">
      <div class="pointer-events-none absolute -inset-8 rounded-full bg-[#67be28] opacity-20 blur-3xl"></div>
      <div class="relative rounded-[2.6rem] bg-[#0d1626] p-2.5 shadow-[0_30px_60px_-20px_rgba(0,33,80,.55)] ring-1 ring-white/10">
        <div class="relative h-[600px] overflow-hidden rounded-[2.05rem] bg-[#f2f5f8] text-[#0f1b2d]">
          <!-- barra del navegador -->
          <div class="flex items-center justify-between px-5 pt-2.5 text-[.68rem] font-semibold"><span>9:41</span><span class="h-5 w-20 rounded-full bg-[#0d1626]"></span><span>5G ▮</span></div>
          <div class="mx-3 mt-1.5 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[.66rem] text-[#64748b] shadow-sm">
            <svg viewBox="0 0 12 12" class="size-2.5 flex-none"><path d="M3 5V4a3 3 0 0 1 6 0v1M2.5 5h7v5.5h-7z" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
            <span class="truncate">{{ pasos[actual()].url }}</span>
          </div>

          @switch (actual()) {
            @case (0) {
              <div class="flex animate-entra flex-col gap-2.5 px-3.5 pt-3 text-[.78rem]">
                <app-logo-ejemplo [tamano]="30" />
                <div><div class="flex items-center gap-2"><b class="font-titulo text-[1rem] whitespace-nowrap">Cotización COT-0127</b><span class="whitespace-nowrap rounded-full bg-[#e6ecf4] px-2 py-0.5 text-[.62rem] font-semibold text-[#002150]">Por aceptar</span></div>
                  <p class="text-[#64748b]">Ana Martínez · Válida hasta 14 nov</p></div>
                <b class="text-[.9rem]">Así quedaría tu pedido</b>
                <div class="grid grid-cols-2 gap-1.5">
                  <figure><app-foto-taza class="aspect-[4/3] overflow-hidden rounded-xl border border-[#e2e8f0]" texto="Ana & Luis" fondo="#f3ece4" /><figcaption class="mt-0.5 text-[.62rem] text-[#64748b]">Taza 11 oz, frente</figcaption></figure>
                  <figure><app-foto-llavero class="aspect-[4/3] overflow-hidden rounded-xl" /><figcaption class="mt-0.5 text-[.62rem] text-[#64748b]">Llavero de regalo</figcaption></figure>
                </div>
                <div class="flex items-start gap-2 rounded-xl border border-[#e2e8f0] bg-white p-2.5"><span class="rounded-md bg-[#f7f9fb] px-1.5 py-0.5 font-semibold">80</span><span class="flex-1">Taza sublimada de boda</span><span class="text-right"><b class="block">$2,240.00</b><span class="text-[.66rem] text-[#64748b]">$28.00 c/u</span></span></div>
                <div class="grid grid-cols-[1fr_auto] gap-y-0.5 rounded-xl bg-white/70 px-2.5 py-2"><span class="text-[#64748b]">Total</span><b>$2,240.00</b><span class="text-[#64748b]">Anticipo para iniciar (50%)</span><b class="text-[#002150]">$1,120.00</b></div>
                <div class="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-white p-3">
                  <b class="text-[.9rem]">¿Te late?</b>
                  <span class="rounded-lg border border-[#e2e8f0] px-2.5 py-1.5">Ana Martínez</span>
                  <span class="flex items-center justify-center gap-1.5 rounded-lg bg-[#002150] py-2 font-semibold text-white"><app-icono nombre="ok" />Aceptar cotización</span>
                </div>
              </div>
            }
            @case (1) {
              <div class="flex animate-entra flex-col gap-2.5 px-3.5 pt-3 text-[.78rem]">
                <app-logo-ejemplo [tamano]="30" />
                <div class="flex flex-col gap-2 rounded-xl border-2 border-[#002150] bg-white p-3">
                  <div class="flex items-baseline justify-between"><b class="text-[.95rem]">Revisa tu diseño</b><span class="text-[.66rem] text-[#64748b]">Versión 2</span></div>
                  <app-prueba-diseno class="overflow-hidden rounded-lg border border-[#e2e8f0]" />
                  <p class="text-[#64748b]">Revisa nombres, fecha y tamaño. Lo producimos tal como lo apruebes.</p>
                  <span class="flex items-center gap-2"><span class="grid size-4 place-items-center rounded bg-[#002150] text-white"><app-icono nombre="ok" class="size-3" /></span>Lo revisé y está correcto</span>
                  <div class="grid grid-cols-2 gap-1.5"><span class="rounded-lg border border-[#e2e8f0] py-2 text-center font-semibold">Pedir cambios</span><span class="flex items-center justify-center gap-1 rounded-lg bg-[#002150] py-2 font-semibold text-white"><app-icono nombre="ok" />Aprobar</span></div>
                </div>
                <div class="flex items-start gap-2 rounded-xl bg-[#e7f7ec] p-2.5 text-[#14532d]"><app-icono nombre="wa" class="mt-0.5 flex-none text-[#1fa855]" /><span>¿Te contestó “sí” por WhatsApp? El taller lo marca como aprobado y queda registrado.</span></div>
              </div>
            }
            @case (2) {
              <div class="flex animate-entra flex-col gap-2.5 px-3.5 pt-3 text-[.78rem]">
                <app-logo-ejemplo [tamano]="30" />
                <div><div class="flex items-center gap-2"><b class="font-titulo text-[1rem] whitespace-nowrap">Pedido VTA-0342</b><span class="rounded-full bg-[#fff4e0] px-2 py-0.5 text-[.62rem] font-semibold text-[#9a5b00]">En producción</span></div>
                  <p class="text-[#64748b]">Ana Martínez · Entrega 12 nov</p></div>
                <div class="flex flex-col gap-2.5 rounded-xl border border-[#e2e8f0] bg-white px-2 py-3">
                  <ol class="grid grid-cols-5 gap-0.5">
                    @for (t of etapas; track t; let i = $index) {
                      <li class="flex flex-col items-center gap-1 text-center">
                        <span class="grid size-6 place-items-center rounded-full text-[.66rem] font-bold" [class]="i < 2 ? 'bg-[#67be28] text-white' : i === 2 ? 'bg-[#002150] text-white ring-4 ring-[#e6ecf4]' : 'bg-[#f1f4f8] text-[#94a3b8]'">
                          @if (i < 2) { <app-icono nombre="ok" class="size-3" /> } @else { {{ i + 1 }} }</span>
                        <span class="text-[.58rem] leading-tight" [class]="i === 2 ? 'font-bold' : 'text-[#64748b]'">{{ t }}</span>
                      </li>
                    }
                  </ol>
                  <p class="text-center">Tu pedido ya está en la máquina.</p>
                </div>
                <div class="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-white p-2.5">
                  <app-prueba-diseno class="w-16 flex-none overflow-hidden rounded-md border border-[#e2e8f0]" />
                  <span><b class="block">Diseño aprobado</b><span class="text-[.68rem] text-[#64748b]">Por Ana, por WhatsApp, el 3 de noviembre a las 6:20 p.m.</span></span>
                </div>
                <div class="grid grid-cols-[1fr_auto] gap-y-0.5 rounded-xl bg-white/70 px-2.5 py-2"><span class="text-[#64748b]">Total</span><b>$2,240.00</b><span class="text-[#64748b]">Pagado</span><span>$1,120.00</span><span class="text-[#64748b]">Saldo</span><b>$1,120.00</b></div>
              </div>
            }
            @case (3) {
              <div class="flex animate-entra flex-col gap-2.5 px-3.5 pt-3 text-[.78rem]">
                <app-logo-ejemplo [tamano]="30" />
                <div class="grid grid-cols-[1fr_auto] gap-y-0.5 rounded-xl bg-white/70 px-2.5 py-2"><span class="text-[#64748b]">Saldo por pagar</span><b class="text-[.95rem]">$1,120.00</b></div>
                <div class="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-white p-3">
                  <b>Datos para transferencia</b>
                  @for (d of datosPago; track d[0]) {
                    <div class="flex items-center justify-between gap-2"><span class="min-w-0"><span class="block text-[.64rem] text-[#64748b]">{{ d[0] }}</span><b class="block truncate">{{ d[1] }}</b></span>
                      @if (d[2]) { <span class="rounded-md border border-[#e2e8f0] px-2 py-1 text-[.66rem] font-semibold" [class]="copiado() === d[0] ? 'border-[#67be28] text-[#3f7a16]' : ''">{{ copiado() === d[0] ? 'Copiado' : 'Copiar' }}</span> }</div>
                  }
                </div>
                <div class="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white px-3 py-3.5 text-center">
                  <app-icono nombre="camara" class="text-[1.1rem] text-[#002150]" /><b>Sube tu comprobante</b><span class="text-[.66rem] text-[#64748b]">Foto o captura de la transferencia</span>
                </div>
                <div class="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-white px-2.5 py-2"><span>Comprobante · $1,120.00</span><span class="rounded-full bg-[#fff4e0] px-2 py-0.5 text-[.62rem] font-semibold text-[#9a5b00]">En revisión</span></div>
                <p class="px-1 text-center text-[.68rem] text-[#64748b]">El taller lo revisa y lo aplica a tu saldo.</p>
              </div>
            }
            @case (4) {
              <div class="flex animate-entra flex-col gap-2.5 px-3.5 pt-3 text-[.78rem]">
                <app-logo-ejemplo [tamano]="30" />
                <div><div class="flex items-center gap-2"><b class="font-titulo text-[1rem] whitespace-nowrap">Pedido VTA-0342</b><span class="rounded-full bg-[#e7f7ec] px-2 py-0.5 text-[.62rem] font-semibold text-[#1f7a3a]">Entregado</span></div>
                  <p class="text-[#64748b]">¡Gracias por tu preferencia!</p></div>
                <b class="text-[.9rem]">Así quedó tu pedido</b>
                <div class="grid grid-cols-2 gap-1.5">
                  <app-foto-llavero class="col-span-2 aspect-[16/10] overflow-hidden rounded-xl" />
                  <app-foto-llavero class="aspect-square overflow-hidden rounded-xl" [giro]="-14" [fondo]="['#efe6da', '#c9b39a']" />
                  <app-foto-llavero class="aspect-square overflow-hidden rounded-xl" [giro]="10" linea1="Gracias" linea2="POR VENIR" [fondo]="['#e3e8f2', '#a8b4c8']" />
                </div>
                <div class="flex items-center justify-between rounded-xl bg-white/70 px-2.5 py-2"><span class="font-semibold text-[#1f7a3a]">Pagado en su totalidad</span><b>$2,240.00</b></div>
                <div class="grid grid-cols-2 gap-1.5"><span class="flex items-center justify-center gap-1 rounded-lg border border-[#e2e8f0] bg-white py-2 font-semibold"><app-icono nombre="descargar" />Nota PDF</span><span class="flex items-center justify-center gap-1 rounded-lg bg-[#1fa855] py-2 font-semibold text-white"><app-icono nombre="wa" />Escríbenos</span></div>
              </div>
            }
          }
        </div>
      </div>
    </div>

    <!-- En el celular: el paso actual debajo de la maqueta y puntos para cambiar -->
    <div class="mx-auto flex w-full max-w-[420px] flex-col items-center gap-3 text-center lg:hidden">
      <div class="flex gap-1.5" role="tablist" aria-label="Lo que hace tu cliente en su enlace">
        @for (p of pasos; track p.t; let i = $index) {
          <button type="button" role="tab" class="h-2.5 rounded-full transition-all" [class]="i === actual() ? 'w-7 bg-marca' : 'w-2.5 bg-linea'"
            [attr.aria-selected]="i === actual()" [attr.aria-label]="p.t" (click)="elegir(i)"></button>
        }
      </div>
      <div class="min-h-[4.5rem]" aria-live="polite">
        <b class="block text-[1.05rem]">{{ pasos[actual()].t }}</b>
        <span class="block text-tenue">{{ pasos[actual()].d }}</span>
      </div>
    </div>
  `,
})
export class DemoEnlace implements OnInit {
  readonly ms = 5000;
  pasos: Paso[] = [
    { i: 'cotizaciones', t: 'Ve cómo quedaría y acepta', d: 'Tus imágenes de referencia y un botón para aceptar. Te llega el aviso.', url: 'app.grabix…/pedido/k7Qm2' },
    { i: 'ojo', t: 'Aprueba su diseño', d: 'Desde el enlace o con un “sí” por WhatsApp. Queda el registro.', url: 'app.grabix…/pedido/k7Qm2' },
    { i: 'produccion', t: 'Sigue su pedido', d: 'Ve en qué etapa va sin tener que preguntarte.', url: 'app.grabix…/pedido/k7Qm2' },
    { i: 'ventas', t: 'Paga y manda su comprobante', d: 'Copia tus datos de transferencia y sube la captura.', url: 'app.grabix…/pedido/k7Qm2' },
    { i: 'fotos', t: 'Ve cómo quedó', d: 'Fotos del trabajo terminado y su nota en PDF.', url: 'app.grabix…/pedido/k7Qm2' },
  ];
  etapas = ['Recibido', 'Diseño', 'Producción', 'Listo', 'Entregado'];
  datosPago: [string, string, boolean][] = [
    ['Banco', 'Banco Ejemplo', false],
    ['Titular', 'Taller Luna', true],
    ['CLABE', '0000 0000 0000 0000 00', true],
  ];
  actual = signal(0);
  auto = signal(true);
  copiado = computed(() => (this.actual() === 3 ? 'CLABE' : ''));
  private reloj?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.reloj));
  }

  ngOnInit() {
    const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto) { this.auto.set(false); return; }
    this.reloj = setInterval(() => this.actual.update((i) => (i + 1) % this.pasos.length), this.ms);
  }

  elegir(i: number) {
    clearInterval(this.reloj);
    this.auto.set(false);
    this.actual.set(i);
  }
}

/** La cotización en PDF con el logo de la sucursal, imágenes y datos de pago, y el mensaje de WhatsApp. */
@Component({
  selector: 'app-demo-cotizacion',
  imports: [Icono, FotoLlavero, FotoTaza, LogoEjemplo],
  host: { class: 'relative block' },
  template: `
    <div class="pointer-events-none absolute -inset-6 rounded-[3rem] bg-linear-to-br from-[#002150]/15 to-[#67be28]/20 blur-2xl" aria-hidden="true"></div>
    <div class="relative grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_230px]" aria-hidden="true">
      <!-- hoja del PDF -->
      <div class="overflow-hidden rounded-xl bg-white text-[#0f1b2d] shadow-[0_24px_50px_-18px_rgba(0,33,80,.45)] ring-1 ring-black/5 sm:-rotate-1">
        <div class="flex items-start justify-between gap-3 bg-[#3b2a6b] px-4 py-3.5 text-white">
          <app-logo-ejemplo class="[&_span]:!text-white/70" [tamano]="36" sucursal="Sucursal Centro" />
          <div class="text-right"><p class="text-[.62rem] tracking-[.12em] text-white/70 uppercase">Cotización</p><p class="font-titulo text-[1rem] font-bold">COT-0127</p></div>
        </div>
        <div class="flex flex-col gap-3 p-4 text-[.74rem]">
          <div class="grid grid-cols-2 gap-2"><div><p class="text-[.6rem] tracking-[.08em] text-[#64748b] uppercase">Cliente</p><b>Ana Martínez</b></div><div class="text-right"><p class="text-[.6rem] tracking-[.08em] text-[#64748b] uppercase">Válida hasta</p><b>14/11/2026</b></div></div>
          <div class="grid grid-cols-3 gap-1.5">
            <app-foto-llavero class="aspect-square overflow-hidden rounded-lg" />
            <app-foto-taza class="aspect-square overflow-hidden rounded-lg" texto="Ana & Luis" fondo="#f3ece4" />
            <app-foto-taza class="aspect-square overflow-hidden rounded-lg" color="#d98aa0" texto="Gracias" fecha="POR VENIR" fondo="#f8eef2" />
          </div>
          <div class="overflow-hidden rounded-lg border border-[#e2e8f0]">
            @for (r of renglones; track r[1]; let i = $index) {
              <div class="grid grid-cols-[28px_1fr_auto] gap-2 px-2.5 py-1.5" [class.bg-[#f7f9fb]]="i % 2"><span class="font-semibold">{{ r[0] }}</span><span>{{ r[1] }}</span><span class="text-right font-semibold">{{ r[2] }}</span></div>
            }
          </div>
          <div class="grid grid-cols-[1fr_auto] gap-y-0.5 rounded-lg bg-[#3b2a6b] px-3 py-2 text-white"><span class="text-white/75">Total</span><b>$3,920.00</b><span class="text-white/75">Anticipo (50%)</span><b class="text-[#f5c451]">$1,960.00</b></div>
          <div class="rounded-lg border-l-4 border-[#67be28] bg-[#f7f9fb] px-3 py-2"><p class="text-[.6rem] font-bold tracking-[.08em] text-[#64748b] uppercase">Datos para transferencia</p><p>Banco Ejemplo · Taller Luna · CLABE 0000 0000 0000 0000 00</p></div>
        </div>
      </div>

      <!-- WhatsApp -->
      <div class="overflow-hidden rounded-2xl bg-[#efe7dd] text-[.74rem] text-[#111b21] shadow-[0_24px_50px_-18px_rgba(0,0,0,.4)] ring-1 ring-black/5 max-sm:relative max-sm:mx-auto max-sm:-mt-14 max-sm:w-[82%] max-sm:rotate-1 sm:mb-6 sm:rotate-2">
        <div class="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white"><span class="grid size-7 place-items-center rounded-full bg-white/20 text-[.7rem] font-bold">AM</span><b>Ana Martínez</b></div>
        <div class="flex flex-col gap-2 p-2.5">
          <div class="max-w-[95%] self-end overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm">
            <div class="m-1 overflow-hidden rounded-md bg-white/70"><app-foto-llavero class="aspect-[16/9]" /><p class="px-2 py-1 text-[.66rem]"><b class="block">Cotización COT-0127 · Taller Luna</b><span class="text-[#54656f]">app.grabix.elikarsystems.com</span></p></div>
            <p class="px-2 pb-1">Hola Ana, aquí está tu cotización. Puedes aceptarla desde el enlace.</p>
            <p class="px-2 pb-1 text-right text-[.6rem] text-[#54656f]">10:12 ✓✓</p>
          </div>
          <div class="max-w-[85%] self-start rounded-lg rounded-tl-none bg-white px-2 py-1 shadow-sm"><p>¡Me encanta! Ya la acepté</p><p class="text-right text-[.6rem] text-[#54656f]">10:15</p></div>
          <div class="flex items-center gap-1.5 self-center rounded-full bg-white/80 px-2.5 py-1 text-[.64rem] font-semibold text-[#1f7a3a]"><app-icono nombre="ok" />Cotización aceptada</div>
        </div>
      </div>
    </div>
  `,
})
export class DemoCotizacion {
  renglones = [
    ['80', 'Llavero MDF grabado Ø 5 cm', '$2,240.00'],
    ['40', 'Taza blanca sublimada 11 oz', '$1,480.00'],
    ['1', 'Diseño personalizado', '$200.00'],
  ];
}

interface Sugerencia {
  tipo: 'Producto' | 'Servicio' | 'Insumo'; nombre: string; linea: string; unidad: string;
  nota: string; min: number; max: number; precio: number;
  insumos: [string, string][]; minutos?: number; otros?: number; costo: number;
}

/** "Sugerir con IA" al dar de alta un producto, servicio o insumo: llena costo, receta y precio. */
@Component({
  selector: 'app-demo-sugerencia',
  imports: [Icono],
  host: { class: 'relative block' },
  template: `
    <div class="pointer-events-none absolute -inset-6 rounded-[3rem] bg-linear-to-tr from-[#67be28]/20 to-[#002150]/15 blur-2xl" aria-hidden="true"></div>
    <div class="relative flex flex-col gap-3">
      <div class="chips justify-center" role="tablist" aria-label="Ejemplos de sugerencia">
        @for (x of ejemplos; track x.tipo; let i = $index) {
          <button type="button" role="tab" class="chip" [class.on]="i === actual()" [attr.aria-selected]="i === actual()" (click)="elegir(i)">{{ x.tipo }}</button>
        }
      </div>

      @let s = ejemplos[actual()];
      <div class="overflow-hidden rounded-2xl bg-white text-[.8rem] text-[#0f1b2d] shadow-[0_24px_50px_-18px_rgba(0,33,80,.45)] ring-1 ring-black/5" aria-hidden="true">
        <div class="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3"><b class="font-titulo text-[.98rem]">Nuevo {{ s.tipo.toLowerCase() }}</b><span class="text-[#94a3b8]">✕</span></div>
        <div class="flex flex-col gap-3 p-4">
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <span><span class="mb-1 block text-[.66rem] font-semibold text-[#64748b]">Nombre</span><span class="block truncate rounded-lg border border-[#e2e8f0] px-2.5 py-2">{{ s.nombre }}</span></span>
            <span class="flex items-center gap-1.5 rounded-lg border border-[#002150] px-2.5 py-2 font-semibold text-[#002150]"><app-icono nombre="chispa" />Sugerir con IA</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            @for (c of [['Tipo', s.tipo], ['Línea', s.linea], ['Unidad', s.unidad]]; track c[0]) {
              <span class="min-w-0"><span class="mb-1 block text-[.66rem] font-semibold text-[#64748b]">{{ c[0] }}</span><span class="block truncate rounded-lg border border-[#e2e8f0] px-2.5 py-2">{{ c[1] }}</span></span>
            }
          </div>

          @if (!listo()) {
            <div class="flex flex-col gap-2 rounded-xl border border-[#002150] p-3">
              <span class="flex items-center gap-1.5 font-semibold"><app-icono nombre="chispa" class="animate-pulse text-[#3f7a16]" />Calculando con tus costos…</span>
              <span class="h-2.5 w-11/12 animate-pulse rounded bg-[#e2e8f0]"></span><span class="h-2.5 w-3/4 animate-pulse rounded bg-[#e2e8f0]"></span><span class="h-2.5 w-1/2 animate-pulse rounded bg-[#e2e8f0]"></span>
            </div>
          } @else {
            <div class="flex animate-entra flex-col gap-2 rounded-xl border border-[#002150] p-3">
              <div class="flex items-center justify-between gap-2"><b class="flex items-center gap-1.5"><app-icono nombre="chispa" class="text-[#3f7a16]" />Sugerencia de la IA</b>
                <span class="flex gap-1"><span class="rounded-md border border-[#e2e8f0] px-2 py-0.5 text-[.68rem] font-semibold">Limpiar</span><span class="rounded-md border border-[#e2e8f0] px-2 py-0.5 text-[.68rem] font-semibold">Otra vez</span></span></div>
              <p class="leading-relaxed">{{ s.nota }}</p>
              <div>
                <div class="relative mt-1 h-2 rounded-full bg-linear-to-r from-[#e6ecf4] via-[#cfe9bb] to-[#e6ecf4]">
                  <span class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#002150] shadow" [style.left.%]="marca(s)"></span>
                </div>
                <div class="mt-1 flex justify-between text-[.66rem] text-[#64748b]"><span>{{ $(s.min) }}</span><span>En el mercado</span><span>{{ $(s.max) }}</span></div>
              </div>
            </div>
          }

          @if (s.insumos.length) {
            <div class="flex flex-col gap-1.5 rounded-xl border border-[#e2e8f0] p-3">
              <b>¿De qué está hecho?</b>
              @for (x of s.insumos; track x[0]) {
                <div class="grid grid-cols-[minmax(0,1fr)_56px] gap-1.5"><span class="truncate rounded-lg border border-[#e2e8f0] px-2.5 py-1.5">{{ listo() ? x[0] : '\u00a0' }}</span><span class="rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-right">{{ listo() ? x[1] : '\u00a0' }}</span></div>
              }
            </div>
          }

          <div class="grid gap-2" [class]="s.tipo === 'Insumo' ? 'grid-cols-2' : 'grid-cols-3'">
            @for (c of campos(s); track c[0]) {
              <span class="min-w-0"><span class="mb-1 block truncate text-[.66rem] font-semibold text-[#64748b]">{{ c[0] }}</span>
                <span class="block rounded-lg border px-2.5 py-2 transition-colors" [class]="listo() ? 'border-[#67be28] bg-[#f3faee] font-semibold' : 'border-[#e2e8f0] text-transparent'">{{ c[1] }}</span></span>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DemoSugerencia implements OnInit {
  ejemplos: Sugerencia[] = [
    { tipo: 'Producto', nombre: 'Llavero MDF grabado 5 cm', linea: 'Grabado láser', unidad: 'pza', min: 20, max: 40, precio: 28, costo: 16.85, minutos: 2, otros: 1,
      nota: 'MDF $1.35 + argolla $2.50 + 2 min de láser $12 + $1 de empaque = $16.85 de costo. Con tu margen sale en $28, dentro de lo que se cobra.',
      insumos: [['MDF 3 mm (lámina 60×40)', '0.03'], ['Argolla metálica', '1']] },
    { tipo: 'Servicio', nombre: 'Grabado en termo del cliente', linea: 'Grabado láser', unidad: 'servicio', min: 60, max: 120, precio: 75, costo: 39, minutos: 6, otros: 0,
      nota: 'Cinta de transferencia $3 + 6 min de láser $36 = $39 de costo. A $75 cubres el riesgo de trabajar sobre la pieza del cliente.',
      insumos: [['Cinta de transferencia', '1']] },
    { tipo: 'Insumo', nombre: 'Taza blanca 11 oz para sublimar', linea: 'Sublimación', unidad: 'pza', min: 22, max: 35, precio: 0, costo: 26,
      nota: 'Por caja de 36 piezas sale entre $22 y $35 cada una. Si compras al menudeo, cuenta arriba de $30.', insumos: [] },
  ];
  actual = signal(0);
  listo = signal(true);
  private reloj?: ReturnType<typeof setInterval>;
  private espera?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => { clearInterval(this.reloj); clearTimeout(this.espera); });
  }

  ngOnInit() {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.reloj = setInterval(() => this.mostrar((this.actual() + 1) % this.ejemplos.length), 6500);
  }

  elegir(i: number) {
    clearInterval(this.reloj);
    this.mostrar(i);
  }

  /** Cambia de ejemplo con un momento de "calculando", como en el sistema. */
  private mostrar(i: number) {
    clearTimeout(this.espera);
    this.actual.set(i);
    this.listo.set(false);
    this.espera = setTimeout(() => this.listo.set(true), 900);
  }

  campos(s: Sugerencia): [string, string][] {
    if (s.tipo === 'Insumo') return [['Costo de compra', this.$(s.costo)], ['Unidad', s.unidad]];
    return [['Minutos de láser', String(s.minutos)], ['Costo por pieza', this.$(s.costo)], ['Precio de venta', this.$(s.precio)]];
  }

  marca(s: Sugerencia) {
    const v = s.precio || s.costo;
    return Math.min(92, Math.max(8, ((v - s.min) / (s.max - s.min)) * 100));
  }

  $ = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
