import { Esqueleto } from '../ui/esqueleto';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AsistenteService, SugerenciaProducto } from '../core/asistente.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, PctPipe } from '../core/formato';
import { Componente, Producto, TIPOS, TipoProducto } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { ConfirmarService } from '../core/confirmar.service';
import { pagina, Paginador } from '../ui/paginador';
import { TrabajosProducto } from '../ui/trabajos-producto';
import { Buscador } from '../ui/buscador';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

type Edit = Omit<Producto, 'id' | 'existencia' | 'minimo' | 'controlaStock'> & { id?: number; stockInicial?: number; minimo?: number };
const CATEGORIAS = ['Sublimación', 'Corte láser', 'Grabado láser', 'Otro'];

@Component({
  selector: 'app-inventario',
  imports: [FormsModule, Buscador, DineroPipe, PctPipe, Hoja, Icono, Confirmar, Esqueleto, Paginador, TrabajosProducto],
  template: `
    <div class="encabezado">
      <div class="titulo"><span class="icono-modulo"><app-icono nombre="inventario" /></span><div><h1>Inventario</h1><p>{{ s.nombreSucursal() }} @if (s.verCostos()) { · Valor <span class="num">{{ valor() | dinero }}</span> }</p></div></div>
      <div class="fila">
        @if (s.verCostos() && s.multiSucursal() && s.sucursal()) { <button class="btn" (click)="abrirTraspaso()">Traspasar</button> }
        @if (s.verCostos()) { <button class="btn pri" (click)="abrir()"><app-icono nombre="mas1" />Nuevo artículo</button> }
      </div>
    </div>
    <div class="fila entre mb-3">
      <div class="chips">
        @for (t of filtros; track t[0]) { <button class="chip" [class.on]="tipo() === t[0]" (click)="tipo.set(t[0]); pagina.set(1)">{{ t[1] }}</button> }
        <button class="chip" [class.on]="soloBajo()" (click)="soloBajo.set(!soloBajo()); pagina.set(1)">Stock bajo</button>
      </div>
      <input class="buscar" placeholder="Buscar" [ngModel]="q()" (ngModelChange)="q.set($event); pagina.set(1)" aria-label="Buscar">
    </div>
    <div class="tarjeta lista">
      @if (!listo()) { <app-esqueleto /> } @else {
      @for (p of enPagina(); track p.id) {
        <div class="con-acciones">
          <button class="renglon" (click)="s.verCostos() ? abrir(p) : p.tipo !== 'insumo' && trabajos.set(p)">
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
          <span class="acciones">
            @if (p.tipo !== 'insumo') { <button type="button" class="ico" title="Trabajos hechos" aria-label="Fotos de trabajos de {{ p.nombre }}" (click)="trabajos.set(p)"><app-icono nombre="fotos" /></button> }
            @if (s.verCostos()) {
              <button type="button" class="ico max-sm:hidden" title="Editar" aria-label="Editar {{ p.nombre }}" (click)="abrir(p)"><app-icono nombre="editar" /></button>
              <button type="button" class="ico peligro" title="Desactivar" aria-label="Desactivar {{ p.nombre }}" (click)="preguntarDesactivar(p)"><app-icono nombre="basura" /></button>
            }
          </span>
        </div>
      } @empty { <div class="vacio"><b>Sin artículos</b>Registra tus tazas, papel de sublimación, MDF, acrílico y servicios de corte.</div> }
    }
    </div>
    <app-paginador [total]="visibles().length" [(pagina)]="pagina" />

    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre : 'Nuevo artículo'" (cerrar)="e_.set(null)">
        <div class="campos c3">
          <div class="campo todo"><label for="p-n">Nombre</label><input id="p-n" name="nombre" required maxlength="160" [(ngModel)]="e.nombre"></div>
          <div class="campo"><label for="p-t">Tipo</label><select id="p-t" [(ngModel)]="e.tipo" (ngModelChange)="calc()">@for (t of tiposLista; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }</select></div>
          <div class="campo"><label for="p-c">Línea</label><select id="p-c" [(ngModel)]="e.categoria">@for (c of categorias; track c) { <option>{{ c }}</option> }</select></div>
          <div class="campo"><label for="p-u">Unidad</label><input id="p-u" [(ngModel)]="e.unidad"></div>
        </div>
        @if (!e.id && ia.estado()?.disponible) {
          <div class="caja" [class.!border-marca]="sug()">
            @if (sug(); as g) {
              <div class="fila entre"><h3 class="flex items-center gap-1.5"><app-icono nombre="chispa" />Sugerencia de la IA</h3><span class="fila"><button class="btn sm" (click)="limpiar()" [disabled]="pensando()">Limpiar</button><button class="btn sm" (click)="sugerir()" [disabled]="pensando()">{{ pensando() ? 'Pensando…' : 'Otra vez' }}</button></span></div>
              <p>{{ g.nota }}</p>
              @if (g.precioMax) { <p class="tenue chico">En el mercado se cobra entre <span class="num">{{ g.precioMin | dinero }}</span> y <span class="num">{{ g.precioMax | dinero }}</span>.</p> }
              <p class="tenue chico">Ya llené los campos de abajo. Revísalos y ajústalos a tu taller antes de guardar. Con "Limpiar" quedan como estaban y puedes cambiar el nombre o los detalles para preguntar de nuevo.</p>
            } @else {
              <h3 class="flex items-center gap-1.5"><app-icono nombre="chispa" />¿No sabes cuánto cobrar?</h3>
              <p class="tenue chico">Escribe el nombre y la IA propone costo, minutos de máquina, receta y precio usando tus insumos y tu tarifa.</p>
              <div class="fila">
                <input class="entrada flex-1" placeholder="Detalles opcionales: medidas, material, acabado" maxlength="400" [(ngModel)]="detalles" aria-label="Detalles para la IA">
                <button class="btn" (click)="sugerir()" [disabled]="pensando()"><app-icono nombre="chispa" />{{ pensando() ? 'Pensando…' : 'Sugerir con IA' }}</button>
              </div>
            }
          </div>
        }
        @if (e.tipo !== 'insumo') {
          <div class="caja">
            <h3>{{ e.tipo === 'servicio' ? '¿Qué insumos lleva?' : '¿De qué está hecho?' }}</h3>
            <p class="tenue chico">{{ e.tipo === 'servicio'
              ? 'Si el servicio incluye material (un grabado que lleva la libreta, un corte que lleva el MDF), agrégalo. Al venderlo se descuenta del inventario. Si el cliente trae su material, déjalo vacío.'
              : 'Si lo armas con insumos (una taza sublimada = 1 taza blanca + 1 hoja de papel), agrégalos. Al venderlo se descuentan del inventario.' }}</p>
            @for (c of e.componentes; track $index; let i = $index) {
              <div class="fila">
                <app-buscador class="flex-1" [opciones]="opsInsumos()" vacio="Elige insumo" etiqueta="Insumo" [(ngModel)]="c.insumoId" (ngModelChange)="calc()" />
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
            @if (!tieneReceta()) { <div class="campo"><label for="p-co">Costo de compra</label><input id="p-co" name="costo" min="0" type="number" inputmode="decimal" [(ngModel)]="e.costo" (ngModelChange)="calc()"></div> }
            <div class="campo"><label for="p-mi">Minutos de láser / plancha</label><input id="p-mi" name="minutos" min="0" type="number" inputmode="decimal" [(ngModel)]="e.minutos" (ngModelChange)="calc()"></div>
            <div class="campo"><label for="p-ex">Otros costos por pieza</label><input id="p-ex" name="extra" min="0" type="number" inputmode="decimal" [(ngModel)]="e.extra" (ngModelChange)="calc()"></div>
            <div class="campo"><label for="p-pr">Precio de venta</label><input id="p-pr" name="precio" min="0" type="number" inputmode="decimal" [(ngModel)]="e.precio" (ngModelChange)="calc()"></div>
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
                <div class="campo"><label for="p-mn">Avisarme cuando queden</label><input id="p-mn" name="minimo" min="0" type="number" inputmode="decimal" [(ngModel)]="e.minimo"></div>
              </div>
            }
          </div>
        }
        <ng-container pie>
          @if (e.id) { <app-confirmar texto="Desactivar" pregunta="¿Desactivar este artículo?" detalle="Ya no aparecerá para cotizar ni vender. Su historial se conserva." (confirmado)="desactivar()" /> }
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
            <app-buscador class="flex-1" [opciones]="opsConStock()" etiqueta="Artículo" [(ngModel)]="i.productoId" />
            <input class="entrada w-[90px]" type="number" [(ngModel)]="i.cantidad" aria-label="Cantidad">
            <button class="btn sm peligro" (click)="t.items.splice(k, 1)">×</button>
          </div>
        }
        <div><button class="btn sm" (click)="t.items.push({ productoId: conStock()[0]?.id ?? 0, cantidad: 1 })"><app-icono nombre="mas1" />Agregar</button></div>
        <ng-container pie><span class="flex-1"></span><button class="btn pri" (click)="traspasar()">Traspasar</button></ng-container>
      </app-hoja>
    }
    @if (trabajos(); as t) { <app-trabajos-producto [productoId]="t.id" [nombre]="t.nombre" [esServicio]="t.tipo === 'servicio'" (cerrar)="trabajos.set(null)" /> }
  `,
})
export class Inventario implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  ia = inject(AsistenteService);
  /** Última sugerencia de la IA para el artículo que se está creando. */
  sug = signal<SugerenciaProducto | null>(null);
  pensando = signal(false);
  detalles = '';
  /** Campos como estaban antes de la primera sugerencia, para "Limpiar". */
  private antes: Partial<Edit> | null = null;
  /** Producto cuya galería de trabajos está abierta. */
  trabajos = signal<Producto | null>(null);
  tipos = TIPOS;
  tiposLista = Object.entries(TIPOS);
  categorias = CATEGORIAS;
  filtros: [string, string][] = [['todos', 'Todos'], ['producto', 'Productos'], ['insumo', 'Insumos'], ['servicio', 'Servicios']];
  productos = signal<Producto[]>([]);
  listo = signal(false);
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
  opsInsumos = computed(() => this.insumos().map((p) => ({ valor: p.id, texto: p.nombre })));
  opsConStock = computed(() => this.conStock().map((p) => ({ valor: p.id, texto: p.nombre, detalle: `${p.existencia} en existencia` })));
  destinos = computed(() => (this.s.perfil()?.sucursales ?? []).filter((x) => x.id !== this.s.sucursal()));
  tieneReceta = computed(() => { this.rev(); const e = this.e(); return !!e && e.tipo !== 'insumo' && e.componentes.some((c) => c.insumoId); });
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

  pagina = signal(1);
  enPagina = computed(() => pagina(this.visibles(), this.pagina()));

  ngOnInit() { this.cargar(); }
  async cargar() { this.productos.set(await this.api.get<Producto[]>('/productos')); this.listo.set(true); }
  calc() { this.rev.update((x) => x + 1); }

  abrir(p?: Producto) {
    this.sug.set(null);
    this.detalles = '';
    this.antes = null;
    if (!p && !this.ia.estado()) this.ia.cargarEstado();
    this.e_.set(p
      ? { ...p, componentes: p.componentes.map((c: Componente) => ({ ...c })), stockInicial: p.controlaStock ? p.existencia : undefined, minimo: p.minimo }
      : { nombre: '', tipo: 'producto' as TipoProducto, categoria: 'Sublimación', unidad: 'pza', costo: 0, precio: 0, minutos: 0, extra: 0, activo: true, componentes: [] });
    this.calc();
  }

  async sugerir() {
    const e = this.e();
    if (!e || this.pensando()) return;
    if (e.nombre.trim().length < 3) { this.aviso.error('Escribe primero el nombre del artículo'); return; }
    this.pensando.set(true);
    try {
      const g = await this.ia.sugerirProducto(e.nombre, this.detalles);
      this.antes ??= { tipo: e.tipo, categoria: e.categoria, unidad: e.unidad, costo: e.costo, minutos: e.minutos, extra: e.extra, precio: e.precio, componentes: e.componentes };
      Object.assign(e, { tipo: g.tipo, categoria: g.categoria, unidad: g.unidad, costo: g.costo, minutos: g.minutos, extra: g.extra, precio: g.precio, componentes: g.componentes });
      this.sug.set(g);
      this.calc();
    } catch (err) { this.aviso.error(mensajeError(err)); }
    finally { this.pensando.set(false); }
  }

  /** Deshace lo que llenó la IA y vuelve a mostrar el recuadro para preguntar. */
  limpiar() {
    const e = this.e();
    if (e && this.antes) Object.assign(e, this.antes, { componentes: (this.antes.componentes ?? []).map((c) => ({ ...c })) });
    this.antes = null;
    this.sug.set(null);
    this.calc();
  }

  async guardar() {
    const e = this.e()!;
    if (!e.nombre.trim()) { this.aviso.error('Escribe el nombre'); return; }
    const body = {
      nombre: e.nombre.trim(), tipo: e.tipo, categoria: e.categoria, unidad: e.unidad, costo: Number(e.costo) || 0, precio: Number(e.precio) || 0,
      minutos: Number(e.minutos) || 0, extra: Number(e.extra) || 0,
      componentes: e.tipo !== 'insumo' ? e.componentes.filter((c) => c.insumoId).map((c) => ({ insumoId: c.insumoId, cantidad: Number(c.cantidad) || 0 })) : [],
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

  async preguntarDesactivar(p: Producto) {
    if (!(await this.confirmar.preguntar({ titulo: `¿Desactivar ${p.nombre}?`, texto: 'Ya no aparecerá para cotizar ni vender. Su historial se conserva.', accion: 'Desactivar', peligro: true }))) return;
    this.e_.set({ ...p } as never);
    await this.desactivar();
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
