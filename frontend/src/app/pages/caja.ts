import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, hoy, sumarDias } from '../core/formato';
import { Cliente, Producto, Venta } from '../core/modelos';
import { VentaHecha } from '../core/pos.service';
import { SesionService } from '../core/sesion.service';
import { Buscador } from '../ui/buscador';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';
import { VentaHechaVentana } from '../ui/venta-hecha';

interface Linea { productoId: number | null; descripcion: string; precio: number; cantidad: number }
const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro'];
const BILLETES = [10, 50, 100, 500, 1000];

/**
 * Caja: punto de venta de mostrador. Productos en botones grandes, carrito y cobro con cambio.
 * Se puede expandir a pantalla completa (tapa el menú del sistema) y minimizar para volver.
 */
@Component({
  selector: 'app-caja',
  imports: [FormsModule, NgTemplateOutlet, DineroPipe, Icono, Hoja, Buscador, VentaHechaVentana],
  host: { '(document:keydown)': 'atajo($event)', '(document:fullscreenchange)': 'alSalirDePantallaCompleta()' },
  template: `
    <div class="flex flex-col bg-fondo" [class]="grande() ? 'fixed inset-0 z-40 p-3 lg:p-4' : 'h-[calc(100dvh-170px)] min-h-[560px] lg:h-[calc(100dvh-110px)]'">
      <!-- Barra de la caja -->
      <header class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="flex size-10 flex-none items-center justify-center rounded-xl bg-[#002150] text-[1.25rem] text-[#8fd85a]"><app-icono nombre="caja" /></span>
        <div class="min-w-0 flex-1">
          <h1 class="text-[1.3rem] leading-tight">Caja</h1>
          <p class="chico truncate text-tenue">{{ s.nombreSucursal() }} · {{ s.perfil()?.usuario?.nombre }}</p>
        </div>
        <div class="flex items-center gap-2 max-sm:order-last max-sm:w-full">
          <span class="rounded-lg border border-linea bg-superficie px-3 py-1.5 text-[.82rem] text-tenue">Hoy <b class="num text-tinta">{{ hoyResumen().ventas }}</b> {{ hoyResumen().ventas === 1 ? 'venta' : 'ventas' }}</span>
          <span class="rounded-lg border border-linea bg-superficie px-3 py-1.5 text-[.82rem] text-tenue">Cobrado <b class="num text-tinta">{{ hoyResumen().cobrado | dinero }}</b></span>
        </div>
        <button class="btn" (click)="alternarGrande()" [title]="grande() ? 'Minimizar (vuelve al sistema)' : 'Pantalla completa'">
          <app-icono [nombre]="grande() ? 'contraer' : 'expandir'" /><span class="max-sm:hidden">{{ grande() ? 'Minimizar' : 'Pantalla completa' }}</span>
        </button>
      </header>

      @if (!s.sucursal()) {
        <div class="tarjeta p-6 text-center"><b>Elige una sucursal</b><p class="tenue">La caja vende del inventario de una sucursal. Elígela arriba a la izquierda.</p></div>
      } @else {
      <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <!-- Productos -->
        <section class="flex min-h-0 min-w-0 flex-col gap-2.5">
          <div class="flex items-center gap-2">
            <div class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-linea bg-superficie px-3 focus-within:border-marca">
              <app-icono nombre="buscar" class="text-tenue" />
              <input #busqueda class="min-w-0 flex-1 bg-transparent py-2.5 text-[1rem] outline-none" type="search" placeholder="Buscar producto  ( / )" [ngModel]="q()" (ngModelChange)="q.set($event)"
                (keydown.enter)="agregarPrimero()" (keydown.escape)="q.set('')" aria-label="Buscar producto" autocomplete="off">
            </div>
            <button class="btn" (click)="libre()" title="Agregar un concepto que no está en el catálogo"><app-icono nombre="mas1" /><span class="max-sm:hidden">Concepto libre</span></button>
          </div>
          <div class="chips flex-nowrap overflow-x-auto pb-0.5">
            @for (c of categorias(); track c) { <button class="chip flex-none" [class.on]="cat() === c" (click)="cat.set(c)">{{ c }}</button> }
          </div>
          <div class="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(138px,1fr))] gap-2 overflow-y-auto pt-2 pr-2 pb-24 lg:pb-2">
            @for (p of visibles(); track p.id) {
              <button class="group relative flex min-h-[104px] flex-col justify-between gap-1.5 rounded-xl border border-linea bg-superficie p-3 text-left transition hover:-translate-y-px hover:border-marca hover:shadow-caja active:translate-y-0 disabled:opacity-45"
                (click)="agregar(p)" [disabled]="agotado(p)" [class.!border-marca]="enCarrito(p.id)">
                <span class="line-clamp-3 text-[.9rem] leading-snug font-semibold">{{ limpio(p.nombre) }}</span>
                <span class="flex items-end justify-between gap-1">
                  <b class="num text-[1.05rem] text-marca">{{ p.precio | dinero }}</b>
                  @if (p.controlaStock) { <span class="text-[.7rem]" [class]="p.existencia <= p.minimo ? 'font-semibold text-warn' : 'text-tenue'">{{ agotado(p) ? 'Agotado' : p.existencia + ' ' + p.unidad }}</span> }
                </span>
                @if (enCarrito(p.id); as n) { <span class="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-marca text-[.75rem] font-bold text-sobre-marca">{{ n }}</span> }
              </button>
            } @empty {
              <p class="col-span-full p-6 text-center text-tenue">Sin productos{{ q() ? ' para “' + q() + '”' : '' }}. Agrégalos en Inventario o usa Concepto libre.</p>
            }
          </div>
        </section>

        <!-- Carrito (escritorio) -->
        <aside class="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-linea bg-superficie shadow-caja lg:flex">
          <ng-container [ngTemplateOutlet]="carrito" />
        </aside>
      </div>

      <!-- Barra del carrito (celular) -->
      <button class="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-30 flex items-center justify-between gap-3 rounded-2xl bg-[#002150] px-4 py-3 text-white shadow-caja lg:hidden"
        [class.!bottom-3]="grande()" (click)="verCarrito.set(true)">
        <span class="text-left text-[.85rem] text-white/75">{{ piezas() }} artículo{{ piezas() === 1 ? '' : 's' }}<br><b class="num text-[1.35rem] text-white">{{ total() | dinero }}</b></span>
        <span class="rounded-xl bg-[#67be28] px-4 py-2.5 font-semibold text-[#001536]">Ver y cobrar</span>
      </button>
      }
    </div>

    <ng-template #carrito>
      <div class="flex items-center gap-2 border-b border-linea p-3">
        <app-buscador class="flex-1" [opciones]="opsClientes()" [conVacio]="true" vacio="Público en general" placeholder="Buscar cliente…" etiqueta="Cliente" [(ngModel)]="clienteId" (ngModelChange)="guardarLocal()" />
        @if (lineas().length) { <button class="btn sm" (click)="vaciar()" title="Vaciar carrito">Vaciar</button> }
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        @for (l of lineas(); track $index; let i = $index) {
          <div class="rounded-xl border border-linea bg-superficie-2 p-2.5">
            <div class="flex items-start gap-2">
              @if (l.productoId) { <p class="min-w-0 flex-1 text-[.92rem] font-semibold">{{ l.descripcion }}</p> }
              @else { <input class="entrada min-w-0 flex-1 p-1.5 text-[.9rem]" placeholder="Descripción" [ngModel]="l.descripcion" (ngModelChange)="cambiar(i, { descripcion: $event })" aria-label="Descripción"> }
              <button class="text-[1.2rem] leading-none text-tenue hover:text-bad" (click)="quitar(i)" aria-label="Quitar">×</button>
            </div>
            <div class="mt-2 flex items-center gap-2">
              <div class="flex items-center rounded-lg border border-linea bg-superficie">
                <button class="flex size-9 items-center justify-center text-tenue hover:text-tinta" (click)="cambiar(i, { cantidad: l.cantidad - 1 })" aria-label="Menos"><app-icono nombre="menos" /></button>
                <input class="num w-12 bg-transparent text-center outline-none" type="number" inputmode="decimal" [ngModel]="l.cantidad" (ngModelChange)="cambiar(i, { cantidad: +$event })" aria-label="Cantidad">
                <button class="flex size-9 items-center justify-center text-tenue hover:text-tinta" (click)="cambiar(i, { cantidad: l.cantidad + 1 })" aria-label="Más"><app-icono nombre="mas1" /></button>
              </div>
              <span class="text-tenue">×</span>
              <input class="entrada num w-24 p-1.5 text-right" type="number" inputmode="decimal" [ngModel]="l.precio" (ngModelChange)="cambiar(i, { precio: +$event })" aria-label="Precio">
              <b class="num ml-auto">{{ l.cantidad * l.precio | dinero }}</b>
            </div>
          </div>
        } @empty {
          <div class="m-auto flex flex-col items-center gap-2 p-6 text-center text-tenue">
            <span class="text-[2rem]"><app-icono nombre="ventas" /></span>
            <p>Toca un producto para agregarlo.</p>
            <p class="text-[.78rem]">Atajos: <kbd class="rounded border border-linea px-1">/</kbd> buscar · <kbd class="rounded border border-linea px-1">Enter</kbd> agrega el primero · <kbd class="rounded border border-linea px-1">F2</kbd> cobrar</p>
          </div>
        }
      </div>
      <div class="flex flex-col gap-2.5 border-t border-linea bg-superficie p-3">
        <div class="flex flex-wrap items-center gap-2 text-[.88rem]">
          <label class="flex items-center gap-1.5 text-tenue">Descuento
            <input class="entrada num w-16 p-1.5 text-right" type="number" inputmode="decimal" [ngModel]="descuento()" (ngModelChange)="descuento.set(+$event || 0); guardarLocal()" aria-label="Descuento en porcentaje">%</label>
          <label class="ml-auto flex items-center gap-1.5"><input type="checkbox" [ngModel]="despues()" (ngModelChange)="despues.set($event)"> Entregar después</label>
          @if (despues()) { <input class="entrada w-auto p-1.5" type="date" [ngModel]="entrega()" (ngModelChange)="entrega.set($event)" aria-label="Fecha de entrega"> }
        </div>
        @if (descuento()) { <div class="flex justify-between text-[.9rem] text-tenue"><span>Subtotal {{ subtotal() | dinero }}</span><span>Descuento −{{ subtotal() - total() | dinero }}</span></div> }
        <div class="flex items-end justify-between"><span class="text-tenue">Total</span><b class="num text-[2rem] leading-none">{{ total() | dinero }}</b></div>
        <button class="btn pri min-h-14 text-[1.1rem]" (click)="cobrar()" [disabled]="!lineas().length">Cobrar <kbd class="ml-1 rounded max-lg:hidden bg-white/15 px-1.5 text-[.75rem] font-normal">F2</kbd></button>
      </div>
    </ng-template>

    @if (verCarrito()) {
      <app-hoja titulo="Carrito" ancho="520px" (cerrar)="verCarrito.set(false)">
        <div class="-m-4 flex min-h-[60dvh] flex-col"><ng-container [ngTemplateOutlet]="carrito" /></div>
      </app-hoja>
    }

    @if (pago()) {
      <app-hoja [titulo]="'Cobrar ' + (total() | dinero)" ancho="520px" (cerrar)="pago.set(false)">
        <div class="flex flex-col gap-4" (keydown.enter)="$event.preventDefault(); confirmar()">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (m of metodos; track m) {
              <button class="rounded-xl border-2 px-3 py-3 font-semibold" [class]="metodo() === m ? 'border-marca bg-marca-suave text-marca' : 'border-linea'" (click)="metodo.set(m)">{{ m }}</button>
            }
          </div>
          <div class="campos">
            <div class="campo"><label for="c-abona">Paga ahora</label><input id="c-abona" class="num text-[1.1rem]" type="number" inputmode="decimal" [ngModel]="abona()" (ngModelChange)="abona.set(+$event || 0)"></div>
            @if (metodo() === 'Efectivo') {
              <div class="campo"><label for="c-con">Recibe</label><input #campoRecibe id="c-con" class="num text-[1.1rem]" type="number" inputmode="decimal" placeholder="Opcional" [ngModel]="recibe() || null" (ngModelChange)="recibe.set(+$event || 0)"></div>
            }
          </div>
          @if (metodo() === 'Efectivo') {
            <div class="flex flex-wrap gap-2">
              <button class="chip" (click)="recibe.set(abona())">Exacto</button>
              @for (b of billetes(); track b) { <button class="chip num" (click)="recibe.set(b)">{{ b | dinero }}</button> }
            </div>
          }
          <div class="grid grid-cols-2 gap-2.5">
            <div class="rounded-xl bg-superficie-2 p-3.5"><p class="chico tenue">{{ abona() < total() ? 'Queda a deber' : 'Total' }}</p><p class="num text-[1.5rem] font-semibold">{{ (abona() < total() ? total() - abona() : total()) | dinero }}</p></div>
            <div class="rounded-xl p-3.5" [class]="faltaEfectivo() ? 'bg-bad-suave text-bad' : 'bg-ok-suave text-ok'">
              <p class="chico font-semibold">{{ faltaEfectivo() ? 'Falta' : 'Cambio' }}</p>
              <p class="num text-[1.5rem] font-semibold">{{ (faltaEfectivo() ? abona() - recibe() : cambio()) | dinero }}</p>
            </div>
          </div>
          @if (abona() < total()) { <p class="chico rounded-lg bg-warn-suave px-3 py-2 text-warn">Se registra como anticipo y la venta queda con saldo pendiente.</p> }
        </div>
        <ng-container pie>
          <button class="btn" (click)="pago.set(false)">Volver</button>
          <span class="flex-1"></span>
          <button class="btn pri min-h-12 min-w-44 text-[1.05rem]" (click)="confirmar()" [disabled]="ocupado() || faltaEfectivo() || abona() > total() + 0.001">{{ ocupado() ? 'Registrando…' : 'Confirmar cobro' }}</button>
        </ng-container>
      </app-hoja>
    }

    @if (hecha(); as h) {
      <app-venta-hecha [datos]="h" (cerrar)="hecha.set(null); enfocar()" (nueva)="hecha.set(null); enfocar()" />
    }
  `,
})
export class Caja implements OnInit, OnDestroy {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private busqueda = viewChild<ElementRef<HTMLInputElement>>('busqueda');
  private recibeEl = viewChild<ElementRef<HTMLInputElement>>('campoRecibe');

  metodos = METODOS;
  productos = signal<Producto[]>([]);
  clientes = signal<Cliente[]>([]);
  lineas = signal<Linea[]>([]);
  clienteId: number | null = null;
  q = signal('');
  cat = signal('Todos');
  descuento = signal(0);
  despues = signal(false);
  entrega = signal(sumarDias(hoy(), 3));
  grande = signal(false);
  verCarrito = signal(false);
  pago = signal(false);
  metodo = signal('Efectivo');
  abona = signal(0);
  recibe = signal(0);
  ocupado = signal(false);
  hecha = signal<VentaHecha | null>(null);
  hoyResumen = signal({ ventas: 0, cobrado: 0 });

  private vendibles = computed(() => this.productos().filter((p) => p.activo && p.tipo !== 'insumo'));
  categorias = computed(() => {
    const cs = [...new Set(this.vendibles().map((p) => p.categoria).filter(Boolean))].sort();
    return ['Todos', ...(this.vendibles().some((p) => p.tipo === 'servicio') ? ['Servicios'] : []), ...cs];
  });
  visibles = computed(() => {
    const q = norm(this.q().trim()), c = this.cat();
    return this.vendibles().filter((p) => {
      if (c === 'Servicios' && p.tipo !== 'servicio') return false;
      if (c !== 'Todos' && c !== 'Servicios' && p.categoria !== c) return false;
      return !q || q.split(/\s+/).every((t) => norm(p.nombre).includes(t));
    });
  });
  opsClientes = computed(() => this.clientes().map((c) => ({ valor: c.id, texto: c.nombre, detalle: c.telefono || undefined })));
  subtotal = computed(() => r2(this.lineas().reduce((a, l) => a + l.cantidad * l.precio, 0)));
  total = computed(() => r2(this.subtotal() * (1 - Math.min(100, Math.max(0, this.descuento())) / 100)));
  piezas = computed(() => this.lineas().reduce((a, l) => a + l.cantidad, 0));
  cambio = computed(() => (this.metodo() === 'Efectivo' && this.recibe() > this.abona() ? r2(this.recibe() - this.abona()) : 0));
  faltaEfectivo = computed(() => this.metodo() === 'Efectivo' && this.recibe() > 0 && this.recibe() < this.abona());
  billetes = computed(() => {
    // Montos con los que suelen pagar: redondeos hacia arriba a 10, 50, 100, 500 y 1000.
    const t = this.abona();
    return [...new Set(BILLETES.map((b) => Math.ceil(t / b) * b))].filter((b) => b > t).slice(0, 4);
  });

  private get claveLocal() { return `grabix.caja.${this.s.perfil()?.usuario.id}.${this.s.sucursal()}`; }

  constructor() {
    // Si cambian de sucursal, se recargan productos (existencias) y carrito de esa sucursal.
    effect(() => {
      this.s.sucursal();
      queueMicrotask(() => { this.cargar(); this.leerLocal(); });
    });
  }

  ngOnInit() {
    this.api.get<Cliente[]>('/clientes').then((c) => this.clientes.set(c), () => {});
    setTimeout(() => this.enfocar(), 300);
  }

  ngOnDestroy() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  async cargar() {
    try {
      this.productos.set(await this.api.get<Producto[]>('/productos'));
      const h = hoy();
      const vs = await this.api.get<Venta[]>('/ventas', { desde: h, hasta: h });
      const validas = vs.filter((v) => v.estado !== 'cancelada');
      this.hoyResumen.set({ ventas: validas.length, cobrado: r2(validas.reduce((a, v) => a + v.pagado, 0)) });
    } catch (e) {
      this.aviso.error(mensajeError(e));
    }
  }

  limpio(n: string) { return n.replace(/ \(ejemplo\)$/, ''); }
  enCarrito(id: number) { return this.lineas().filter((l) => l.productoId === id).reduce((a, l) => a + l.cantidad, 0); }
  agotado(p: Producto) { return p.controlaStock && p.existencia - this.enCarrito(p.id) <= 0; }

  agregar(p: Producto) {
    if (this.agotado(p)) return;
    const i = this.lineas().findIndex((l) => l.productoId === p.id);
    if (i >= 0) this.cambiar(i, { cantidad: this.lineas()[i].cantidad + 1 });
    else this.lineas.update((ls) => [...ls, { productoId: p.id, descripcion: this.limpio(p.nombre), precio: p.precio, cantidad: 1 }]);
    this.guardarLocal();
  }

  /** Enter en el buscador: agrega el primer resultado (sirve también con lector de código). */
  agregarPrimero() {
    const p = this.visibles()[0];
    if (p && this.q().trim()) { this.agregar(p); this.q.set(''); }
  }

  libre() {
    this.lineas.update((ls) => [...ls, { productoId: null, descripcion: '', precio: 0, cantidad: 1 }]);
    if (window.innerWidth < 1024) this.verCarrito.set(true);
  }

  cambiar(i: number, c: Partial<Linea>) {
    this.lineas.update((ls) => ls.map((l, k) => (k === i ? { ...l, ...c } : l)).filter((l) => l.cantidad > 0));
    this.guardarLocal();
  }

  quitar(i: number) {
    this.lineas.update((ls) => ls.filter((_, k) => k !== i));
    this.guardarLocal();
  }

  vaciar() {
    this.lineas.set([]);
    this.clienteId = null;
    this.descuento.set(0);
    this.despues.set(false);
    this.guardarLocal();
  }

  cobrar() {
    if (!this.lineas().length || this.pago()) return;
    if (this.lineas().some((l) => !l.descripcion.trim())) { this.aviso.error('Escribe la descripción del concepto libre'); this.verCarrito.set(true); return; }
    this.verCarrito.set(false);
    this.metodo.set('Efectivo');
    this.abona.set(this.total());
    this.recibe.set(0);
    this.pago.set(true);
    setTimeout(() => this.recibeEl()?.nativeElement.focus(), 100);
  }

  async confirmar() {
    if (this.ocupado() || this.faltaEfectivo()) return;
    const cliente = this.clientes().find((c) => c.id === this.clienteId);
    const abona = Math.min(this.abona(), this.total());
    this.ocupado.set(true);
    try {
      const r = await this.api.post<{ id: number }>('/ventas', {
        clienteId: this.clienteId, clienteNombre: cliente?.nombre ?? '', clienteTelefono: cliente?.telefono ?? '',
        fecha: hoy(), descuentoTipo: 'pct', descuentoValor: this.descuento(), promocionId: null, notas: '',
        items: this.lineas().map((l) => ({ productoId: l.productoId, descripcion: l.descripcion.trim(), cantidad: l.cantidad, precio: l.precio })),
        estado: this.despues() ? 'pendiente' : 'entregada',
        entrega: this.despues() ? this.entrega() : hoy(),
        ...(abona > 0 ? { anticipo: { monto: abona, metodo: this.metodo() } } : {}),
      });
      this.hecha.set({ id: r.id, nueva: true, recibido: this.cambio() ? this.recibe() : undefined, cambio: this.cambio() || undefined });
      this.pago.set(false);
      this.vaciar();
      await this.cargar();
    } catch (e) {
      this.aviso.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Pantalla completa: tapa el menú del sistema y, si el navegador lo permite, ocupa todo el monitor. */
  async alternarGrande() {
    if (this.grande()) {
      this.grande.set(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    } else {
      this.grande.set(true);
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
    this.enfocar();
  }

  alSalirDePantallaCompleta() {
    if (!document.fullscreenElement && this.grande()) this.grande.set(false);
  }

  enfocar() {
    if (window.innerWidth >= 1024) setTimeout(() => this.busqueda()?.nativeElement.focus({ preventScroll: true }));
  }

  atajo(ev: KeyboardEvent) {
    if (this.hecha()) return;
    if (ev.key === 'F2') { ev.preventDefault(); this.cobrar(); return; }
    const t = ev.target as HTMLElement;
    const escribiendo = t.closest('input, textarea, select, [contenteditable]');
    if (ev.key === '/' && !escribiendo && !this.pago()) { ev.preventDefault(); this.busqueda()?.nativeElement.focus(); }
  }

  guardarLocal() {
    try {
      sessionStorage.setItem(this.claveLocal, JSON.stringify({ lineas: this.lineas(), clienteId: this.clienteId, descuento: this.descuento() }));
    } catch { /* sin almacenamiento */ }
  }

  private leerLocal() {
    try {
      const d = JSON.parse(sessionStorage.getItem(this.claveLocal) ?? 'null');
      this.lineas.set(d?.lineas ?? []);
      this.clienteId = d?.clienteId ?? null;
      this.descuento.set(d?.descuento ?? 0);
    } catch { this.lineas.set([]); }
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
