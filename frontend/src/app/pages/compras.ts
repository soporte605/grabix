import { Esqueleto } from '../ui/esqueleto';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, FechaPipe, hoy } from '../core/formato';
import { Compra, CompraItem, Producto } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { ConfirmarService } from '../core/confirmar.service';
import { Paginador } from '../ui/paginador';
import { Buscador } from '../ui/buscador';
import { FiltroFechas, Rango } from '../ui/filtro-fechas';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

@Component({
  selector: 'app-compras',
  imports: [FormsModule, FiltroFechas, Buscador, DineroPipe, FechaPipe, Hoja, Icono, Confirmar, Esqueleto, Paginador],
  template: `
    <div class="encabezado">
      <div><h1>Compras</h1><p>Cada compra suma existencias en {{ s.nombreSucursal() }} y actualiza el costo promedio.</p></div>
      <button class="btn pri" (click)="nueva()" [disabled]="!s.sucursal()"><app-icono nombre="mas1" />Registrar compra</button>
    </div>
    @if (!s.sucursal()) { <p class="tenue">Elige una sucursal arriba para registrar compras.</p> }
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <input class="buscar min-w-0 flex-1" type="search" placeholder="Buscar por folio o proveedor" [(ngModel)]="q" (ngModelChange)="buscar()" aria-label="Buscar">
      <app-filtro-fechas [rango]="rango" (rangoChange)="rango = $event; pagina.set(1); cargar()" />
    </div>
    <div class="tarjeta lista">
      @if (!listo()) { <app-esqueleto /> } @else {
      @for (c of compras(); track c.id) {
        <div class="con-acciones">
          <button class="renglon" (click)="ver.set(c)">
            <span class="t">{{ c.proveedor || 'Proveedor' }}</span><span class="d num">{{ c.total | dinero }}</span>
            <span class="m"><span class="num">{{ c.folio }}</span> · {{ c.fecha | fecha }} · {{ c.items.length }} concepto{{ c.items.length === 1 ? '' : 's' }}</span><span></span>
          </button>
          <span class="acciones">
            <button type="button" class="ico" title="Ver detalle" aria-label="Ver {{ c.folio }}" (click)="ver.set(c)"><app-icono nombre="ojo" /></button>
            @if (s.gerencia()) { <button type="button" class="ico peligro" title="Eliminar" aria-label="Eliminar {{ c.folio }}" (click)="preguntarEliminar(c)"><app-icono nombre="basura" /></button> }
          </span>
        </div>
      } @empty { <div class="vacio"><b>Sin compras</b>{{ q || rango.desde || rango.hasta ? 'Prueba con otra búsqueda o cambia las fechas.' : 'Registra lo que compras a tus proveedores para conocer tu costo real.' }}</div> }
    }
    </div>
    <app-paginador [total]="totalLista()" [pagina]="pagina()" (paginaChange)="pagina.set($event); cargar()" />

    @if (f(); as f) {
      <app-hoja titulo="Registrar compra" (cerrar)="f_.set(null)">
        <div class="campos">
          <div class="campo"><label for="b-p">Proveedor</label><input id="b-p" [(ngModel)]="f.proveedor"></div>
          <div class="campo"><label for="b-f">Fecha</label><input id="b-f" type="date" [(ngModel)]="f.fecha"></div>
        </div>
        <div class="caja">
          <h3>Qué compraste</h3>
          <p class="tenue chico">Si eliges un artículo del inventario se suman existencias. Si no, queda como gasto (luz, mantenimiento, etc.).</p>
          @for (i of f.items; track $index; let k = $index) {
            <div class="grid grid-cols-2 gap-1.5 rounded-[10px] border border-linea bg-superficie-2 p-2.5 min-[700px]:grid-cols-[2fr_2fr_1fr_1fr_auto]">
              <app-buscador [opciones]="opsComprables()" [conVacio]="true" vacio="Gasto u otro concepto" etiqueta="Artículo" [(ngModel)]="i.productoId" (ngModelChange)="elegir(i)" />
              <input class="entrada" [(ngModel)]="i.descripcion" placeholder="Descripción" aria-label="Descripción">
              <input class="entrada" type="number" inputmode="decimal" [(ngModel)]="i.cantidad" placeholder="Cant." aria-label="Cantidad">
              <input class="entrada" type="number" inputmode="decimal" [(ngModel)]="i.costo" placeholder="Costo c/u" aria-label="Costo unitario">
              <button class="btn sm peligro" (click)="f.items.splice(k, 1)" aria-label="Quitar">×</button>
            </div>
          }
          <div><button class="btn sm" (click)="f.items.push(vacio())"><app-icono nombre="mas1" />Agregar concepto</button></div>
        </div>
        <div class="campo"><label for="b-n">Notas</label><textarea id="b-n" [(ngModel)]="f.notas"></textarea></div>
        <div class="totales"><span class="k grande">Total</span><span class="grande">{{ total(f.items) | dinero }}</span></div>
        <ng-container pie><span class="flex-1"></span><button class="btn pri" (click)="guardar()">Guardar compra</button></ng-container>
      </app-hoja>
    }

    @if (ver(); as c) {
      <app-hoja [titulo]="'Compra ' + c.folio" (cerrar)="ver.set(null)">
        <p class="tenue">{{ c.proveedor }} · {{ c.fecha | fecha }}</p>
        @for (i of c.items; track $index) { <div class="fila entre"><span>{{ i.cantidad }} × {{ i.descripcion }}</span><span class="num">{{ i.cantidad * i.costo | dinero }}</span></div> }
        <div class="totales"><span class="k grande">Total</span><span class="grande">{{ c.total | dinero }}</span></div>
        @if (c.notas) { <p class="tenue">{{ c.notas }}</p> }
        <ng-container pie>@if (s.gerencia()) { <app-confirmar texto="Eliminar y revertir inventario" pregunta="¿Eliminar esta compra?" detalle="Se restarán del inventario las piezas que sumó. No se puede deshacer." (confirmado)="eliminar(c)" /> }</ng-container>
      </app-hoja>
    }
  `,
})
export class Compras implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  compras = signal<Compra[]>([]);
  listo = signal(false);
  productos = signal<Producto[]>([]);
  f_ = signal<{ proveedor: string; fecha: string; notas: string; items: CompraItem[] } | null>(null);
  f = this.f_.asReadonly();
  ver = signal<Compra | null>(null);
  comprables = computed(() => this.productos().filter((p) => p.activo && p.controlaStock));
  opsComprables = computed(() => this.comprables().map((p) => ({ valor: p.id, texto: p.nombre, grupo: p.tipo === 'insumo' ? 'Insumos' : 'Productos' })).sort((a, b) => a.grupo.localeCompare(b.grupo)));

  async ngOnInit() {
    await this.cargar();
    this.productos.set(await this.api.get('/productos'));
  }
  pagina = signal(1);
  totalLista = signal(0);
  q = '';
  rango: Rango = { desde: '', hasta: '' };
  private t?: ReturnType<typeof setTimeout>;
  buscar() { clearTimeout(this.t); this.t = setTimeout(() => { this.pagina.set(1); this.cargar(); }, 250); }
  async cargar(): Promise<void> {
    const p: Record<string, string> = { pagina: String(this.pagina()), por: '20' };
    if (this.q.trim()) p['q'] = this.q.trim();
    if (this.rango.desde) p['desde'] = this.rango.desde;
    if (this.rango.hasta) p['hasta'] = this.rango.hasta;
    const r = await this.api.get<{ items: Compra[]; total: number }>('/compras', p);
    if (!r.items.length && this.pagina() > 1) { this.pagina.update((n) => n - 1); return this.cargar(); }
    this.compras.set(r.items);
    this.totalLista.set(r.total);
    this.listo.set(true);
  }
  vacio(): CompraItem { return { productoId: null, descripcion: '', cantidad: 1, costo: 0 }; }
  nueva() { this.f_.set({ proveedor: '', fecha: hoy(), notas: '', items: [this.vacio()] }); }
  elegir(i: CompraItem) { const p = this.productos().find((x) => x.id === i.productoId); if (p) { i.descripcion = p.nombre; i.costo = p.costo ?? 0; } }
  total(items: CompraItem[]) { return items.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.costo) || 0), 0); }
  async guardar() {
    const f = this.f()!;
    const items = f.items.filter((i) => i.productoId || i.descripcion).map((i) => ({ ...i, cantidad: Number(i.cantidad) || 0, costo: Number(i.costo) || 0 }));
    try {
      await this.api.post('/compras', { proveedor: f.proveedor, fecha: f.fecha, notas: f.notas, items });
      this.f_.set(null);
      this.aviso.ok('Compra registrada');
      await this.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
  async preguntarEliminar(c: Compra) {
    if (await this.confirmar.preguntar({ titulo: `¿Eliminar la compra ${c.folio}?`, texto: 'Se restarán del inventario las piezas que sumó. No se puede deshacer.', accion: 'Eliminar', peligro: true })) this.eliminar(c);
  }
  async eliminar(c: Compra) {
    try { await this.api.del(`/compras/${c.id}`); this.ver.set(null); this.aviso.ok('Compra eliminada'); await this.cargar(); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
