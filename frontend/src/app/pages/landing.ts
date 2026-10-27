import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Logo } from '../ui/logo';
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
  imports: [FormsModule, RouterLink, Logo],
  template: `
    <header class="sticky top-0 z-10 border-b border-linea bg-superficie py-2.5">
      <div class="mx-auto max-w-[1160px] margen-x fila entre">
        <a class="no-underline" routerLink="/" aria-label="Grabix, inicio"><app-logo [tamano]="30" /></a>
        <nav class="fila">
          <a href="#precios" class="btn sm border-transparent max-[520px]:hidden">Precios</a>
          <a routerLink="/entrar" class="btn sm">Entrar</a>
          <a routerLink="/registro" class="btn sm pri">Prueba gratis</a>
        </nav>
      </div>
    </header>

    <section class="bg-linear-to-b from-marca-suave to-fondo pt-9 pb-10">
      <div class="mx-auto max-w-[1160px] margen-x grid items-start gap-7 min-[980px]:grid-cols-[.9fr_1.1fr] min-[980px]:gap-10">
        <div class="flex flex-col gap-4 min-[980px]:pt-6">
          <p class="text-[.78rem] font-bold tracking-[.08em] text-marca uppercase">Para talleres de corte láser y sublimación</p>
          <h1 class="-mt-1.5 text-[clamp(1.9rem,4.5vw,2.9rem)] leading-[1.1]">¿Cuánto cobrar por esa pieza? Calcúlalo en 30 segundos.</h1>
          <p class="max-w-[52ch] text-[1.08rem] text-tenue">Material, minutos de máquina y tu margen. Después cotiza, manda el PDF por WhatsApp, descuenta tu inventario y ve cuánto ganas cada mes.</p>
          <ul class="grid list-disc gap-1.5 pl-[1.1em]">
            <li>Cotizaciones con PDF y WhatsApp</li>
            <li>Inventario con recetas: una taza descuenta la taza y el papel</li>
            <li>Varias sucursales, roles y estadísticas de ganancia</li>
          </ul>
        </div>

        <div class="tarjeta flex flex-col gap-3.5 p-[18px] shadow-caja" id="simulador">
          <div class="fila entre">
            <h2>Simulador de precio</h2>
            <div class="chips">
              <button class="chip" [class.on]="e().tipo === 'laser'" (click)="tipo('laser')">Corte / grabado láser</button>
              <button class="chip" [class.on]="e().tipo === 'sublimacion'" (click)="tipo('sublimacion')">Sublimación</button>
            </div>
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
              <div class="campo"><label for="s-m">Minutos de láser por pieza</label><input id="s-m" type="number" inputmode="decimal" [ngModel]="e().minutos" (ngModelChange)="set('minutos', $event)"></div>
            } @else {
              <div class="campo"><label for="s-cb">Costo de la pieza en blanco</label><input id="s-cb" type="number" inputmode="decimal" [ngModel]="e().costoBase" (ngModelChange)="set('costoBase', $event)"></div>
              <div class="campo"><label for="s-cp">Papel y tinta por pieza</label><input id="s-cp" type="number" inputmode="decimal" [ngModel]="e().costoPapel" (ngModelChange)="set('costoPapel', $event)"></div>
              <div class="campo"><label for="s-mp">Minutos de plancha y armado</label><input id="s-mp" type="number" inputmode="decimal" [ngModel]="e().minutos" (ngModelChange)="set('minutos', $event)"></div>
              <div class="campo"><label for="s-ex">Empaque u otros por pieza</label><input id="s-ex" type="number" inputmode="decimal" [ngModel]="e().extra" (ngModelChange)="set('extra', $event)"></div>
            }
            <div class="campo"><label for="s-q">Cantidad</label><input id="s-q" type="number" inputmode="numeric" [ngModel]="e().cantidad" (ngModelChange)="set('cantidad', $event)"></div>
            <div class="campo"><label for="s-d">Diseño (cobro único)</label><input id="s-d" type="number" inputmode="decimal" [ngModel]="e().diseno" (ngModelChange)="set('diseno', $event)"></div>
            <div class="campo"><label for="s-t">Tu costo por minuto de máquina</label><input id="s-t" type="number" inputmode="decimal" [ngModel]="e().tarifaMinuto" (ngModelChange)="set('tarifaMinuto', $event)"></div>
            <div class="campo"><label for="s-mg">Margen que quieres ganar: {{ e().margen }}%</label><input id="s-mg" type="range" min="20" max="80" step="5" [ngModel]="e().margen" (ngModelChange)="set('margen', $event)"></div>
          </div>

          <div class="grid gap-3.5 rounded-xl border border-linea bg-superficie-2 p-3.5 min-[560px]:grid-cols-2 min-[560px]:items-center">
            <div class="flex flex-col gap-0.5">
              <span class="text-[.85rem] text-tenue">Precio sugerido por pieza</span>
              <span class="num text-[2.2rem] leading-[1.15] font-semibold text-marca">{{ $(r().precioPieza) }}</span>
              <span class="text-[.85rem] text-tenue">Total del pedido: <b class="num">{{ $(r().precioTotal) }}</b></span>
            </div>
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
          <div class="fila entre gap-2.5">
            <span class="tenue chico">¿Te sirvió? Guarda esta cotización, descárgala en PDF y mándala por WhatsApp.</span>
            <a routerLink="/registro" class="btn sec">Crear cuenta gratis</a>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-[1160px] margen-x pt-11 pb-2">
      <h2 class="mb-[18px] text-center text-[1.6rem]">Todo tu taller en un solo lugar</h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
        @for (b of beneficios; track b.t) {
          <article class="tarjeta pad"><h3>{{ b.t }}</h3><p class="mt-1.5 text-tenue">{{ b.d }}</p></article>
        }
      </div>
    </section>

    <section class="mx-auto max-w-[1160px] margen-x pt-11 pb-2" id="precios">
      <h2 class="mb-2.5 text-center text-[1.6rem]">Planes</h2>
      <p class="tenue text-center">{{ diasPrueba() }} días gratis con todas las funciones. Sin tarjeta para empezar.</p>
      <div class="chips mt-3 mb-[18px] justify-center">
        <button class="chip" [class.on]="!anual()" (click)="anual.set(false)">Mensual</button>
        <button class="chip" [class.on]="anual()" (click)="anual.set(true)">Anual (2 meses gratis)</button>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] items-start gap-3.5">
        @for (p of planes(); track p.id; let i = $index) {
          <article class="tarjeta flex flex-col gap-2 p-5" [class]="i === 1 ? 'border-2 border-acento' : ''">
            @if (i === 1) { <span class="pill sec self-start">El más elegido</span> }
            <h3>{{ p.nombre }}</h3>
            <p class="text-[1.6rem] font-semibold"><span class="num">{{ $(anual() ? p.precioAnual : p.precioMensual) }}</span> <span class="tenue">/ {{ anual() ? 'año' : 'mes' }}</span></p>
            <p class="tenue chico">{{ p.sucursales }} sucursal{{ p.sucursales > 1 ? 'es' : '' }} · {{ p.usuarios }} usuarios</p>
            <ul class="mt-1 mb-2.5 grid list-disc gap-1 pl-[1.1em] text-[.92rem]">@for (x of p.incluye; track x) { <li>{{ x }}</li> }</ul>
            <a routerLink="/registro" class="btn" [class.pri]="i === 1">Empezar prueba</a>
          </article>
        }
      </div>
    </section>

    <footer class="mx-auto max-w-[1160px] margen-x fila entre gap-1.5 pt-10 pb-7 text-[.88rem] text-tenue">
      <span>Grabix · Software para talleres de corte láser y sublimación</span>
      <span class="tenue">Hecho por Elikar Systems</span>
    </footer>
  `,
  host: { class: 'block bg-fondo' },
})
export class Landing implements OnInit {
  private api = inject(Api);
  beneficios = [
    { t: 'Cotiza y envía por WhatsApp', d: 'Folio, descuentos y promociones. El cliente recibe el resumen y la liga a su PDF.' },
    { t: 'Inventario que se descuenta solo', d: 'Arma recetas: una taza sublimada usa una taza blanca y una hoja de papel. Al vender se descuentan.' },
    { t: 'Costos reales', d: 'Material, minutos de máquina y extras. Sabes cuánto ganas en cada pedido antes de aceptarlo.' },
    { t: 'Ventas, anticipos y saldos', d: 'Del pedido a producción y entrega, con pagos parciales y lo que te deben.' },
    { t: 'Sucursales y roles', d: 'Inventario y folios por sucursal, traspasos, y permisos: el vendedor no ve tus costos.' },
    { t: 'Estadísticas', d: 'Ventas, ganancia y margen por mes, lo que más te deja y alertas de stock bajo.' },
  ];

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
