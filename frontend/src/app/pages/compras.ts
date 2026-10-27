import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, FechaPipe, hoy } from '../core/formato';
import { Compra, CompraItem, Producto } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

@Component({
  selector: 'app-compras',
  imports: [FormsModule, DineroPipe, FechaPipe, Hoja, Icono, Confirmar],
  template: `
    <div class="encabezado">
      <div><h1>Compras</h1><p>Cada compra suma existencias en {{ s.nombreSucursal() }} y actualiza el costo promedio.</p></div>
      <button class="btn pri" (click)="nueva()" [disabled]="!s.sucursal()"><app-icono nombre="mas1" />Registrar compra</button>
    </div>
    @if (!s.sucursal()) { <p class="tenue">Elige una sucursal arriba para registrar compras.</p> }
    <div class="tarjeta lista">
      @for (c of compras(); track c.id) {
        <button class="renglon" (click)="ver.set(c)">
          <span class="t">{{ c.proveedor || 'Proveedor' }}</span><span class="d num">{{ c.total | dinero }}</span>
          <span class="m"><span class="num">{{ c.folio }}</span> · {{ c.fecha | fecha }} · {{ c.items.length }} concepto{{ c.items.length === 1 ? '' : 's' }}</span><span></span>
        </button>
      } @empty { <div class="vacio"><b>Sin compras</b>Registra lo que compras a tus proveedores para conocer tu costo real.</div> }
    </div>

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
            <div class="concepto">
              <select class="entrada" [(ngModel)]="i.productoId" (ngModelChange)="elegir(i)" aria-label="Artículo">
                <option [ngValue]="null">Gasto u otro concepto</option>
                @for (p of comprables(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
              </select>
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
        <ng-container pie><span style="flex:1"></span><button class="btn pri" (click)="guardar()">Guardar compra</button></ng-container>
      </app-hoja>
    }

    @if (ver(); as c) {
      <app-hoja [titulo]="'Compra ' + c.folio" (cerrar)="ver.set(null)">
        <p class="tenue">{{ c.proveedor }} · {{ c.fecha | fecha }}</p>
        @for (i of c.items; track $index) { <div class="fila entre"><span>{{ i.cantidad }} × {{ i.descripcion }}</span><span class="num">{{ i.cantidad * i.costo | dinero }}</span></div> }
        <div class="totales"><span class="k grande">Total</span><span class="grande">{{ c.total | dinero }}</span></div>
        @if (c.notas) { <p class="tenue">{{ c.notas }}</p> }
        <ng-container pie>@if (s.gerencia()) { <app-confirmar texto="Eliminar y revertir inventario" (confirmado)="eliminar(c)" /> }</ng-container>
      </app-hoja>
    }
  `,
  styles: `
    .concepto { display: grid; gap: 6px; grid-template-columns: 1fr 1fr; padding: 10px; border: 1px solid var(--linea); border-radius: 10px; background: var(--superficie-2); }
    @media (min-width: 700px) { .concepto { grid-template-columns: 2fr 2fr 1fr 1fr auto; } }
  `,
})
export class Compras implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  compras = signal<Compra[]>([]);
  productos = signal<Producto[]>([]);
  f_ = signal<{ proveedor: string; fecha: string; notas: string; items: CompraItem[] } | null>(null);
  f = this.f_.asReadonly();
  ver = signal<Compra | null>(null);
  comprables = computed(() => this.productos().filter((p) => p.activo && p.controlaStock));

  async ngOnInit() {
    await this.cargar();
    this.productos.set(await this.api.get('/productos'));
  }
  async cargar() { this.compras.set(await this.api.get('/compras')); }
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
  async eliminar(c: Compra) {
    try { await this.api.del(`/compras/${c.id}`); this.ver.set(null); this.aviso.ok('Compra eliminada'); await this.cargar(); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
