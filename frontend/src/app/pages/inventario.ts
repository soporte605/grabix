import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, PctPipe } from '../core/formato';
import { Componente, Producto, TIPOS, TipoProducto } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

type Edit = Omit<Producto, 'id' | 'existencia' | 'minimo' | 'controlaStock'> & { id?: number; stockInicial?: number; minimo?: number };
const CATEGORIAS = ['Sublimación', 'Corte láser', 'Grabado láser', 'Otro'];

@Component({
  selector: 'app-inventario',
  imports: [FormsModule, DineroPipe, PctPipe, Hoja, Icono, Confirmar],
  template: `
    <div class="encabezado">
      <div><h1>Inventario</h1><p>{{ s.nombreSucursal() }} @if (s.verCostos()) { · Valor <span class="num">{{ valor() | dinero }}</span> }</p></div>
      <div class="fila">
        @if (s.verCostos() && s.multiSucursal() && s.sucursal()) { <button class="btn" (click)="abrirTraspaso()">Traspasar</button> }
        @if (s.verCostos()) { <button class="btn pri" (click)="abrir()"><app-icono nombre="mas1" />Nuevo artículo</button> }
      </div>
    </div>
    <div class="fila entre mb-3">
      <div class="chips">
        @for (t of filtros; track t[0]) { <button class="chip" [class.on]="tipo() === t[0]" (click)="tipo.set(t[0])">{{ t[1] }}</button> }
        <button class="chip" [class.on]="soloBajo()" (click)="soloBajo.set(!soloBajo())">Stock bajo</button>
      </div>
      <input class="buscar" placeholder="Buscar" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Buscar">
    </div>
    <div class="tarjeta lista">
      @for (p of visibles(); track p.id) {
        <button class="renglon" (click)="s.verCostos() && abrir(p)">
          <span class="t">{{ p.nombre }} <span class="pill" [class]="p.tipo === 'insumo' ? 'mut' : p.tipo === 'servicio' ? 'acc' : 'sec'">{{ tipos[p.tipo] }}</span></span>
          <span class="d">
            @if (p.controlaStock) { <span class="num" [class]="p.existencia <= p.minimo && p.minimo > 0 ? 'font-semibold text-bad' : ''">{{ p.existencia }} {{ p.unidad }}</span> }
            @else if (p.componentes.length) { <span class="m">Receta de {{ p.componentes.length }} insumo{{ p.componentes.length > 1 ? 's' : '' }}</span> }
            @else { <span class="m">Servicio</span> }
          </span>
          <span class="m">
            @if (s.verCostos()) { Costo <span class="num">{{ p.costoUnitario | dinero }}</span> · }
            Precio <span class="num">{{ p.precio | dinero }}</span> · {{ p.categoria }}
          </span>
          <span class="d m">@if (s.verCostos() && p.margen != null) { Margen {{ p.margen | pct }} }</span>
        </button>
      } @empty { <div class="vacio"><b>Sin artículos</b>Registra tus tazas, papel de sublimación, MDF, acrílico y servicios de corte.</div> }
    </div>

    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre : 'Nuevo artículo'" (cerrar)="e_.set(null)">
        <div class="campos c3">
          <div class="campo todo"><label for="p-n">Nombre</label><input id="p-n" [(ngModel)]="e.nombre"></div>
          <div class="campo"><label for="p-t">Tipo</label><select id="p-t" [(ngModel)]="e.tipo" (ngModelChange)="calc()">@for (t of tiposLista; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }</select></div>
          <div class="campo"><label for="p-c">Línea</label><select id="p-c" [(ngModel)]="e.categoria">@for (c of categorias; track c) { <option>{{ c }}</option> }</select></div>
          <div class="campo"><label for="p-u">Unidad</label><input id="p-u" [(ngModel)]="e.unidad"></div>
        </div>
        @if (e.tipo === 'producto') {
          <div class="caja">
            <h3>¿De qué está hecho?</h3>
            <p class="tenue chico">Si lo armas con insumos (una taza sublimada = 1 taza blanca + 1 hoja de papel), agrégalos. Al venderlo se descuentan del inventario.</p>
            @for (c of e.componentes; track $index; let i = $index) {
              <div class="fila">
                <select class="entrada flex-1" [(ngModel)]="c.insumoId" (ngModelChange)="calc()" aria-label="Insumo">
                  <option [ngValue]="0">Elige insumo</option>
                  @for (x of insumos(); track x.id) { <option [ngValue]="x.id">{{ x.nombre }}</option> }
                </select>
                <input class="entrada w-[90px]" type="number" inputmode="decimal" [(ngModel)]="c.cantidad" (ngModelChange)="calc()" aria-label="Cantidad">
                <button class="btn sm peligro" (click)="e.componentes.splice(i, 1); calc()" aria-label="Quitar">×</button>
              </div>
            }
            <div><button class="btn sm" (click)="e.componentes.push({ insumoId: 0, cantidad: 1 })"><app-icono nombre="mas1" />Agregar insumo</button></div>
          </div>
        }
        <div class="caja">
          <h3>Costo y precio</h3>
          <div class="campos c3">
            @if (!tieneReceta()) { <div class="campo"><label for="p-co">Costo de compra</label><input id="p-co" type="number" inputmode="decimal" [(ngModel)]="e.costo" (ngModelChange)="calc()"></div> }
            <div class="campo"><label for="p-mi">Minutos de láser / plancha</label><input id="p-mi" type="number" inputmode="decimal" [(ngModel)]="e.minutos" (ngModelChange)="calc()"></div>
            <div class="campo"><label for="p-ex">Otros costos por pieza</label><input id="p-ex" type="number" inputmode="decimal" [(ngModel)]="e.extra" (ngModelChange)="calc()"></div>
            <div class="campo"><label for="p-pr">Precio de venta</label><input id="p-pr" type="number" inputmode="decimal" [(ngModel)]="e.precio" (ngModelChange)="calc()"></div>
          </div>
          <div class="totales">
            <span class="k">Costo por pieza</span><span>{{ costo() | dinero }}</span>
            <span class="k">Precio sugerido ({{ s.taller()?.margenObjetivo }}% de margen)</span>
            <span>{{ sugerido() | dinero }} <button class="btn sm" (click)="e.precio = sugerido(); calc()">Usar</button></span>
            <span class="k">Margen con tu precio</span><span class="grande">{{ e.precio ? ((e.precio - costo()) / e.precio | pct) : '—' }}</span>
          </div>
        </div>
        @if (e.tipo !== 'servicio' && !tieneReceta()) {
          <div class="caja">
            <h3>Existencias en {{ s.nombreSucursal() }}</h3>
            @if (!s.sucursal()) { <p class="tenue chico">Elige una sucursal arriba para capturar existencias.</p> }
            @else {
              <div class="campos">
                <div class="campo"><label for="p-st">{{ e.id ? 'Conteo físico (ajuste)' : 'Existencia inicial' }}</label><input id="p-st" type="number" inputmode="decimal" [(ngModel)]="e.stockInicial"></div>
                <div class="campo"><label for="p-mn">Avisarme cuando queden</label><input id="p-mn" type="number" inputmode="decimal" [(ngModel)]="e.minimo"></div>
              </div>
            }
          </div>
        }
        <ng-container pie>
          @if (e.id) { <app-confirmar texto="Desactivar" (confirmado)="desactivar()" /> }
          <span class="flex-1"></span>
          <button class="btn pri" (click)="guardar()">Guardar</button>
        </ng-container>
      </app-hoja>
    }

    @if (traspaso(); as t) {
      <app-hoja titulo="Traspasar inventario" (cerrar)="traspaso.set(null)">
        <p class="tenue">Sale de <b>{{ s.nombreSucursal() }}</b> y entra a la sucursal destino.</p>
        <div class="campo"><label for="tr-d">Destino</label>
          <select id="tr-d" [(ngModel)]="t.destinoId">@for (x of destinos(); track x.id) { <option [ngValue]="x.id">{{ x.nombre }}</option> }</select>
        </div>
        @for (i of t.items; track $index; let k = $index) {
          <div class="fila">
            <select class="entrada flex-1" [(ngModel)]="i.productoId" aria-label="Artículo">@for (p of conStock(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }} ({{ p.existencia }})</option> }</select>
            <input class="entrada w-[90px]" type="number" [(ngModel)]="i.cantidad" aria-label="Cantidad">
            <button class="btn sm peligro" (click)="t.items.splice(k, 1)">×</button>
          </div>
        }
        <div><button class="btn sm" (click)="t.items.push({ productoId: conStock()[0]?.id ?? 0, cantidad: 1 })"><app-icono nombre="mas1" />Agregar</button></div>
        <ng-container pie><span class="flex-1"></span><button class="btn pri" (click)="traspasar()">Traspasar</button></ng-container>
      </app-hoja>
    }
  `,
})
export class Inventario implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  tipos = TIPOS;
  tiposLista = Object.entries(TIPOS);
  categorias = CATEGORIAS;
  filtros: [string, string][] = [['todos', 'Todos'], ['producto', 'Productos'], ['insumo', 'Insumos'], ['servicio', 'Servicios']];
  productos = signal<Producto[]>([]);
  tipo = signal('todos');
  q = signal('');
  soloBajo = signal(false);
  e_ = signal<Edit | null>(null);
  e = this.e_.asReadonly();
  rev = signal(0);
  traspaso = signal<{ destinoId: number; items: { productoId: number; cantidad: number }[] } | null>(null);

  visibles = computed(() => {
    const q = this.q().toLowerCase();
    return this.productos().filter((p) => p.activo && (this.tipo() === 'todos' || p.tipo === this.tipo()) && (!q || p.nombre.toLowerCase().includes(q))
      && (!this.soloBajo() || (p.controlaStock && p.minimo > 0 && p.existencia <= p.minimo)));
  });
  valor = computed(() => this.productos().filter((p) => p.controlaStock).reduce((a, p) => a + Math.max(0, p.existencia) * (p.costoUnitario ?? 0), 0));
  insumos = computed(() => this.productos().filter((p) => p.tipo === 'insumo' && p.activo && p.id !== this.e()?.id));
  conStock = computed(() => this.productos().filter((p) => p.controlaStock && p.existencia > 0));
  destinos = computed(() => (this.s.perfil()?.sucursales ?? []).filter((x) => x.id !== this.s.sucursal()));
  tieneReceta = computed(() => { this.rev(); const e = this.e(); return !!e && e.tipo === 'producto' && e.componentes.some((c) => c.insumoId); });
  costo = computed(() => {
    this.rev();
    const e = this.e();
    if (!e) return 0;
    const tarifa = this.s.taller()?.tarifaMinuto ?? 0;
    const cu = (id: number) => this.productos().find((p) => p.id === id)?.costoUnitario ?? 0;
    const base = this.tieneReceta() ? e.componentes.reduce((a, c) => a + cu(c.insumoId) * (Number(c.cantidad) || 0), 0) : Number(e.costo) || 0;
    return base + (Number(e.minutos) || 0) * tarifa + (Number(e.extra) || 0);
  });
  sugerido = computed(() => Math.ceil(this.costo() / (1 - Math.min(95, this.s.taller()?.margenObjetivo ?? 60) / 100)));

  ngOnInit() { this.cargar(); }
  async cargar() { this.productos.set(await this.api.get<Producto[]>('/productos')); }
  calc() { this.rev.update((x) => x + 1); }

  abrir(p?: Producto) {
    this.e_.set(p
      ? { ...p, componentes: p.componentes.map((c: Componente) => ({ ...c })), stockInicial: p.controlaStock ? p.existencia : undefined, minimo: p.minimo }
      : { nombre: '', tipo: 'producto' as TipoProducto, categoria: 'Sublimación', unidad: 'pza', costo: 0, precio: 0, minutos: 0, extra: 0, activo: true, componentes: [] });
    this.calc();
  }

  async guardar() {
    const e = this.e()!;
    if (!e.nombre.trim()) { this.aviso.error('Escribe el nombre'); return; }
    const body = {
      nombre: e.nombre.trim(), tipo: e.tipo, categoria: e.categoria, unidad: e.unidad, costo: Number(e.costo) || 0, precio: Number(e.precio) || 0,
      minutos: Number(e.minutos) || 0, extra: Number(e.extra) || 0,
      componentes: e.tipo === 'producto' ? e.componentes.filter((c) => c.insumoId).map((c) => ({ insumoId: c.insumoId, cantidad: Number(c.cantidad) || 0 })) : [],
      ...(e.id ? {} : { stockInicial: Number(e.stockInicial) || 0, minimo: Number(e.minimo) || 0 }),
    };
    try {
      if (e.id) {
        await this.api.put(`/productos/${e.id}`, body);
        const antes = this.productos().find((p) => p.id === e.id);
        if (this.s.sucursal() && antes?.controlaStock && (Number(e.stockInicial) !== antes.existencia || Number(e.minimo) !== antes.minimo))
          await this.api.patch(`/productos/${e.id}/existencia`, { cantidad: Number(e.stockInicial) || 0, minimo: Number(e.minimo) || 0 });
      } else await this.api.post('/productos', body);
      this.e_.set(null);
      this.aviso.ok('Artículo guardado');
      await this.cargar();
    } catch (err) { this.aviso.error(mensajeError(err)); }
  }

  async desactivar() {
    await this.api.del(`/productos/${this.e()!.id}`);
    this.e_.set(null);
    this.aviso.ok('Artículo desactivado');
    await this.cargar();
  }

  abrirTraspaso() {
    this.traspaso.set({ destinoId: this.destinos()[0]?.id ?? 0, items: [{ productoId: this.conStock()[0]?.id ?? 0, cantidad: 1 }] });
  }

  async traspasar() {
    const t = this.traspaso()!;
    try {
      await this.api.post('/inventario/traspasos', { destinoId: t.destinoId, items: t.items.filter((i) => i.productoId && i.cantidad > 0).map((i) => ({ productoId: i.productoId, cantidad: Number(i.cantidad) })) });
      this.traspaso.set(null);
      this.aviso.ok('Traspaso registrado');
      await this.cargar();
    } catch (err) { this.aviso.error(mensajeError(err)); }
  }
}
