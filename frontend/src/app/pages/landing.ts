import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  imports: [FormsModule, RouterLink],
  template: `
    <header class="barra">
      <div class="contenedor fila entre">
        <a class="logo" routerLink="/"><span class="marca-ico"></span>Grabix</a>
        <nav class="fila">
          <a href="#precios" class="btn sm enlace">Precios</a>
          <a routerLink="/entrar" class="btn sm">Entrar</a>
          <a routerLink="/registro" class="btn sm pri">Prueba gratis</a>
        </nav>
      </div>
    </header>

    <section class="heroe">
      <div class="contenedor heroe-rejilla">
        <div class="mensaje">
          <p class="eyebrow">Para talleres de corte láser y sublimación</p>
          <h1>¿Cuánto cobrar por esa pieza? Calcúlalo en 30 segundos.</h1>
          <p class="sub">Material, minutos de máquina y tu margen. Después cotiza, manda el PDF por WhatsApp, descuenta tu inventario y ve cuánto ganas cada mes.</p>
          <ul class="puntos">
            <li>Cotizaciones con PDF y WhatsApp</li>
            <li>Inventario con recetas: una taza descuenta la taza y el papel</li>
            <li>Varias sucursales, roles y estadísticas de ganancia</li>
          </ul>
        </div>

        <div class="simulador tarjeta" id="simulador">
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

          <div class="resultado">
            <div>
              <span class="k">Precio sugerido por pieza</span>
              <span class="precio num">{{ $(r().precioPieza) }}</span>
              <span class="k">Total del pedido: <b class="num">{{ $(r().precioTotal) }}</b></span>
            </div>
            <dl class="desglose">
              @if (e().tipo === 'laser') {
                <dt>Piezas por lámina</dt><dd class="num">{{ r().piezasPorHoja || 'No cabe' }}</dd>
                <dt>Láminas necesarias</dt><dd class="num">{{ r().hojas }}</dd>
              }
              <dt>Material</dt><dd class="num">{{ $(r().material) }}</dd>
              <dt>Tiempo de máquina</dt><dd class="num">{{ $(r().maquina) }}</dd>
              <dt>Costo por pieza</dt><dd class="num">{{ $(r().costoPieza) }}</dd>
              <dt>Tu ganancia</dt><dd class="num gan">{{ $(r().ganancia) }}</dd>
            </dl>
          </div>
          <div class="cta fila entre">
            <span class="tenue chico">¿Te sirvió? Guarda esta cotización, descárgala en PDF y mándala por WhatsApp.</span>
            <a routerLink="/registro" class="btn sec">Crear cuenta gratis</a>
          </div>
        </div>
      </div>
    </section>

    <section class="contenedor seccion">
      <h2 class="titulo-sec">Todo tu taller en un solo lugar</h2>
      <div class="beneficios">
        @for (b of beneficios; track b.t) {
          <article class="tarjeta pad"><h3>{{ b.t }}</h3><p>{{ b.d }}</p></article>
        }
      </div>
    </section>

    <section class="contenedor seccion" id="precios">
      <h2 class="titulo-sec">Planes</h2>
      <p class="tenue centrado">{{ diasPrueba() }} días gratis con todas las funciones. Sin tarjeta para empezar.</p>
      <div class="chips centrado-chips">
        <button class="chip" [class.on]="!anual()" (click)="anual.set(false)">Mensual</button>
        <button class="chip" [class.on]="anual()" (click)="anual.set(true)">Anual (2 meses gratis)</button>
      </div>
      <div class="planes">
        @for (p of planes(); track p.id; let i = $index) {
          <article class="tarjeta plan" [class.recomendado]="i === 1">
            @if (i === 1) { <span class="pill sec">El más elegido</span> }
            <h3>{{ p.nombre }}</h3>
            <p class="precio-plan"><span class="num">{{ $(anual() ? p.precioAnual : p.precioMensual) }}</span> <span class="tenue">/ {{ anual() ? 'año' : 'mes' }}</span></p>
            <p class="tenue chico">{{ p.sucursales }} sucursal{{ p.sucursales > 1 ? 'es' : '' }} · {{ p.usuarios }} usuarios</p>
            <ul>@for (x of p.incluye; track x) { <li>{{ x }}</li> }</ul>
            <a routerLink="/registro" class="btn" [class.pri]="i === 1">Empezar prueba</a>
          </article>
        }
      </div>
    </section>

    <footer class="pie contenedor fila entre">
      <span>Grabix · Software para talleres de corte láser y sublimación</span>
      <span class="tenue">Hecho por Elikar Systems</span>
    </footer>
  `,
  styles: `
    :host { display: block; background: var(--fondo); }
    .contenedor { max-width: 1160px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
    .barra { position: sticky; top: 0; z-index: 10; background: var(--superficie); border-bottom: 1px solid var(--linea); padding-block: 10px; }
    .logo { display: flex; align-items: center; gap: 9px; font: 800 1.3rem var(--f-titulo); color: var(--tinta); text-decoration: none; }
    .marca-ico { width: 26px; height: 26px; border-radius: 7px; background: linear-gradient(180deg, var(--marca) 0 72%, var(--acento) 72%); }
    .enlace { border-color: transparent; }
    @media (max-width: 520px) { .enlace { display: none; } }
    .heroe { background: linear-gradient(180deg, var(--marca-suave), var(--fondo)); padding-block: 36px 40px; }
    .heroe-rejilla { display: grid; gap: 28px; align-items: start; }
    @media (min-width: 980px) { .heroe-rejilla { grid-template-columns: 0.9fr 1.1fr; gap: 40px; } .mensaje { padding-top: 24px; } }
    .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .78rem; font-weight: 700; color: var(--marca); margin: 0 0 10px; }
    h1 { font-size: clamp(1.9rem, 4.5vw, 2.9rem); line-height: 1.1; }
    .sub { font-size: 1.08rem; color: var(--tenue); max-width: 52ch; }
    .puntos { padding-left: 1.1em; display: grid; gap: 6px; }
    .simulador { padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--sombra); }
    .resultado { display: grid; gap: 14px; background: var(--superficie-2); border: 1px solid var(--linea); border-radius: 12px; padding: 14px; }
    @media (min-width: 560px) { .resultado { grid-template-columns: 1fr 1fr; align-items: center; } }
    .resultado > div { display: flex; flex-direction: column; gap: 2px; }
    .k { color: var(--tenue); font-size: .85rem; }
    .precio { font-size: 2.2rem; color: var(--marca); font-weight: 600; line-height: 1.15; }
    .desglose { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; margin: 0; font-size: .88rem; }
    dt { color: var(--tenue); } dd { margin: 0; text-align: right; }
    .gan { color: var(--ok); font-weight: 600; }
    .cta { gap: 10px; }
    .seccion { padding-block: 44px 8px; }
    .titulo-sec { font-size: 1.6rem; text-align: center; margin-bottom: 18px; }
    .centrado { text-align: center; margin-top: -8px; }
    .centrado-chips { justify-content: center; margin: 12px 0 18px; }
    .beneficios { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .beneficios p { color: var(--tenue); margin: 6px 0 0; }
    .planes { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); align-items: start; }
    .plan { padding: 20px; display: flex; flex-direction: column; gap: 8px; }
    .plan.recomendado { border: 2px solid var(--acento); }
    .plan .pill { align-self: flex-start; }
    .precio-plan { margin: 0; font-size: 1.6rem; font-weight: 600; }
    .plan ul { padding-left: 1.1em; margin: 4px 0 10px; display: grid; gap: 4px; font-size: .92rem; }
    .pie { padding-block: 40px 28px; color: var(--tenue); font-size: .88rem; gap: 6px; }
  `,
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
