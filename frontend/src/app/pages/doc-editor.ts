import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { DineroPipe, FechaPipe, hoy, PctPipe, sumarDias } from '../core/formato';
import { Cliente, Cotizacion, EST_COT, EST_VTA, Producto, Promocion, Renglon, Venta } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

interface Form {
  clienteId: number | null; clienteNombre: string; clienteTelefono: string; guardarCliente: boolean;
  fecha: string; estado: string; vigenciaDias: number; entrega: string;
  descuentoTipo: 'pct' | 'monto'; descuentoValor: number; promocionId: number | null; notas: string;
  items: Renglon[]; anticipo: number; metodo: string;
}

@Component({
  selector: 'app-doc-editor',
  imports: [FormsModule, DineroPipe, FechaPipe, PctPipe, Icono, Confirmar, Hoja],
  template: `
    <app-hoja [titulo]="titulo()" ancho="1000px" (cerrar)="cerrar()">
      @if (doc(); as d) {
        <ng-container cabeza><span class="pill" [class]="mapa[f.estado][1]">{{ mapa[f.estado][0] }}</span>
        <span class="chico tenue">Creada el {{ d.fecha | fecha }} @if (esVenta && $any(d).cotizacionId) { · desde una cotización }</span></ng-container>
      }
      <section class="caja">
        <h3>Cliente</h3>
        <div class="campos c3">
          <div class="campo todo">
            <label for="d-cli">Cliente</label>
            <select id="d-cli" [(ngModel)]="f.clienteId" (ngModelChange)="tocar()">
              <option [ngValue]="null">— Cliente nuevo o de mostrador —</option>
              @for (c of clientes(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
            </select>
          </div>
          @if (f.clienteId == null) {
            <div class="campo"><label for="d-cn">Nombre</label><input id="d-cn" [(ngModel)]="f.clienteNombre" (ngModelChange)="tocar()"></div>
            <div class="campo"><label for="d-ct">WhatsApp</label><input id="d-ct" type="tel" [(ngModel)]="f.clienteTelefono" (ngModelChange)="tocar()"></div>
            <label class="fila chico self-end pb-2"><input type="checkbox" [(ngModel)]="f.guardarCliente"> Guardar en mis clientes</label>
          }
        </div>
        <div class="campos c3">
          <div class="campo"><label for="d-f">Fecha</label><input id="d-f" type="date" [(ngModel)]="f.fecha" (ngModelChange)="tocar()"></div>
          @if (esVenta) {
            <div class="campo"><label for="d-e">Fecha de entrega</label><input id="d-e" type="date" [(ngModel)]="f.entrega" (ngModelChange)="tocar()"></div>
          } @else {
            <div class="campo"><label for="d-v">Vigencia (días)</label><input id="d-v" type="number" [(ngModel)]="f.vigenciaDias" (ngModelChange)="tocar()"></div>
          }
          <div class="campo"><label for="d-es">Estado</label>
            <select id="d-es" [(ngModel)]="f.estado" (ngModelChange)="tocar()">@for (k of estados; track k) { <option [value]="k">{{ mapa[k][0] }}</option> }</select>
          </div>
        </div>
      </section>

      <section class="caja">
        <h3>Conceptos</h3>
        @for (it of f.items; track $index; let i = $index) {
          <div class="grid grid-cols-[minmax(0,1fr)_30px] gap-1.5 rounded-[10px] border border-linea bg-superficie-2 p-2.5">
            <div class="grid grid-cols-6 gap-1.5">
              <select class="entrada col-span-6 p-2 sm:col-span-3" [(ngModel)]="it.productoId" (ngModelChange)="elegir(it)" aria-label="Artículo">
                <option [ngValue]="null">Concepto libre</option>
                @for (g of grupos(); track g.t) {
                  <optgroup [label]="g.t">@for (p of g.ps; track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }</optgroup>
                }
              </select>
              <input class="entrada col-span-6 p-2 sm:col-span-3" [(ngModel)]="it.descripcion" (ngModelChange)="tocar()" placeholder="Descripción" aria-label="Descripción">
              <input class="entrada col-span-2 p-2" type="number" inputmode="decimal" [(ngModel)]="it.cantidad" (ngModelChange)="tocar()" placeholder="Cant." aria-label="Cantidad">
              <input class="entrada col-span-2 p-2" type="number" inputmode="decimal" [(ngModel)]="it.precio" (ngModelChange)="tocar()" placeholder="Precio c/u" aria-label="Precio unitario">
              <span class="num col-span-2 flex flex-col self-center text-right text-[.9rem]">{{ (it.cantidad || 0) * (it.precio || 0) | dinero }}
                @if (s.verCostos() && it.productoId) { <small class="text-[.72rem] text-tenue">costo {{ costoDe(it) | dinero }}</small> }</span>
            </div>
            <button class="text-[1.4rem] text-bad" (click)="quitar(i)" aria-label="Quitar concepto">×</button>
          </div>
        }
        <div><button class="btn sm" (click)="agregar()"><app-icono nombre="mas1" />Agregar concepto</button></div>
      </section>

      <section class="caja">
        <h3>Descuento</h3>
        <div class="campos c3">
          <div class="campo"><label for="d-pr">Promoción</label>
            <select id="d-pr" [(ngModel)]="f.promocionId" (ngModelChange)="aplicarPromo()">
              <option [ngValue]="null">Ninguna</option>
              @for (p of promos(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
            </select>
          </div>
          <div class="campo"><label for="d-dt">Tipo</label>
            <select id="d-dt" [(ngModel)]="f.descuentoTipo" (ngModelChange)="tocar()"><option value="pct">Porcentaje</option><option value="monto">Cantidad</option></select>
          </div>
          <div class="campo"><label for="d-dv">Descuento</label><input id="d-dv" type="number" inputmode="decimal" [(ngModel)]="f.descuentoValor" (ngModelChange)="tocar()"></div>
        </div>
      </section>

      @if (esVenta && !id) {
        <section class="caja">
          <h3>Anticipo</h3>
          <div class="campos">
            <div class="campo"><label for="d-an">Monto recibido</label><input id="d-an" type="number" inputmode="decimal" [(ngModel)]="f.anticipo"></div>
            <div class="campo"><label for="d-me">Forma de pago</label><select id="d-me" [(ngModel)]="f.metodo">@for (m of metodos; track m) { <option>{{ m }}</option> }</select></div>
          </div>
        </section>
      }

      <div class="campo"><label for="d-no">Notas {{ esVenta ? 'del pedido' : '(aparecen en el PDF)' }}</label><textarea id="d-no" [(ngModel)]="f.notas" (ngModelChange)="tocar()"></textarea></div>

      <section class="caja">
        <div class="totales">
          <span class="k">Subtotal</span><span>{{ t().sub | dinero }}</span>
          @if (t().desc) { <span class="k">Descuento</span><span>−{{ t().desc | dinero }}</span> }
          <span class="k grande">Total</span><span class="grande">{{ t().total | dinero }}</span>
          @if (venta(); as v) {
            <span class="k">Pagado</span><span>{{ v.pagado | dinero }}</span>
            <span class="k">Saldo</span><span class="grande">{{ t().total - v.pagado > 0 ? (t().total - v.pagado | dinero) : (0 | dinero) }}</span>
          }
          @if (s.verCostos()) {
            <span class="k interno">Costo estimado (solo tú lo ves)</span><span class="interno">{{ t().costo | dinero }}</span>
            <span class="k">Ganancia</span><span [class]="t().total - t().costo < 0 ? 'text-bad' : 'text-ok'">{{ t().total - t().costo | dinero }} · {{ t().total ? ((t().total - t().costo) / t().total | pct) : '—' }}</span>
          }
        </div>
      </section>

      @if (venta(); as v) {
        <section class="caja">
          <h3>Pagos</h3>
          @for (p of v.pagos; track p.id) {
            <div class="fila entre chico"><span>{{ p.fecha | fecha }} · {{ p.metodo }}</span><span class="num">{{ p.monto | dinero }}</span></div>
          } @empty { <p class="tenue chico">Sin pagos registrados.</p> }
          @if (v.estado !== 'cancelada') {
            <div class="fila">
              <input class="entrada max-w-[140px] p-2" type="number" inputmode="decimal" placeholder="Monto" [(ngModel)]="pago" aria-label="Monto del pago">
              <select class="entrada max-w-40 p-2" [(ngModel)]="metodoPago" aria-label="Forma de pago">@for (m of metodos; track m) { <option>{{ m }}</option> }</select>
              <button class="btn sm" (click)="registrarPago()" [disabled]="!pago">Registrar pago</button>
            </div>
          }
        </section>
      }

      <ng-container pie>
        @if (id) { <app-confirmar [pregunta]="esVenta ? '¿Eliminar esta venta?' : '¿Eliminar esta cotización?'" [detalle]="esVenta ? 'El inventario que descontó se devuelve. No se puede deshacer.' : 'No se puede deshacer.'" (confirmado)="eliminar()" /> }
        <button class="btn" (click)="pdf()" [disabled]="ocupado()"><app-icono nombre="pdf" />PDF</button>
        <button class="btn wa" (click)="whatsapp()" [disabled]="ocupado()"><app-icono nombre="wa" />WhatsApp</button>
        @if (!esVenta && id && f.estado !== 'aceptada') { <button class="btn" (click)="convertir()" [disabled]="ocupado()">Convertir en venta</button> }
        <span class="flex-1"></span>
        <button class="btn pri" (click)="guardar(true)" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class DocEditor implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private router = inject(Router);
  private ruta = inject(ActivatedRoute);
  private confirmar = inject(ConfirmarService);
  private lista = this.ruta.snapshot.data['tipo'] === 'ventas' ? '/app/ventas' : '/app/cotizaciones';
  esVenta = this.ruta.snapshot.data['tipo'] === 'ventas';
  base = this.esVenta ? '/ventas' : '/cotizaciones';
  id = Number(this.ruta.snapshot.paramMap.get('id')) || null;
  mapa: Record<string, [string, string]> = this.esVenta ? EST_VTA : EST_COT;
  estados = Object.keys(this.mapa);
  metodos = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];

  clientes = signal<Cliente[]>([]);
  productos = signal<Producto[]>([]);
  promosTodas = signal<Promocion[]>([]);
  doc = signal<Cotizacion | Venta | null>(null);
  venta = computed(() => (this.esVenta ? (this.doc() as Venta | null) : null));
  ocupado = signal(false);
  cambios = signal(0);
  sucio = false;
  pago: number | null = null;
  metodoPago = 'Efectivo';

  f: Form = {
    clienteId: null, clienteNombre: '', clienteTelefono: '', guardarCliente: true,
    fecha: hoy(), estado: this.esVenta ? 'pendiente' : 'borrador', vigenciaDias: this.s.taller()?.vigenciaDias ?? 15,
    entrega: sumarDias(hoy(), 3), descuentoTipo: 'pct', descuentoValor: 0, promocionId: null,
    notas: this.esVenta ? '' : (this.s.taller()?.notasCotizacion ?? ''), items: [{ productoId: null, descripcion: '', cantidad: 1, precio: 0 }],
    anticipo: 0, metodo: 'Efectivo',
  };

  titulo = computed(() => {
    const d = this.doc();
    return d ? `${this.esVenta ? 'Venta' : 'Cotización'} ${d.folio}` : this.esVenta ? 'Nueva venta' : 'Nueva cotización';
  });
  grupos = computed(() => {
    const ps = this.productos().filter((p) => p.activo);
    const g = (tipo: string, t: string) => ({ t, ps: ps.filter((p) => p.tipo === tipo) });
    return [g('producto', 'Productos'), g('servicio', 'Servicios'), g('insumo', 'Insumos')].filter((x) => x.ps.length);
  });
  promos = computed(() => {
    const h = hoy();
    return this.promosTodas().filter((p) => (p.activa && (!p.inicio || p.inicio <= h) && (!p.fin || p.fin >= h)) || p.id === this.f.promocionId);
  });
  t = computed(() => {
    this.cambios();
    const sub = this.f.items.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precio) || 0), 0);
    let desc = this.f.descuentoTipo === 'pct' ? (sub * (Number(this.f.descuentoValor) || 0)) / 100 : Number(this.f.descuentoValor) || 0;
    desc = Math.max(0, Math.min(desc, sub));
    const costo = this.f.items.reduce((a, i) => a + (Number(i.cantidad) || 0) * this.costoDe(i), 0);
    return { sub, desc, total: sub - desc, costo };
  });

  async ngOnInit() {
    const [cl, pr, po] = await Promise.all([
      this.api.get<Cliente[]>('/clientes'),
      this.api.get<Producto[]>('/productos'),
      this.api.get<Promocion[]>('/promociones'),
    ]);
    this.clientes.set(cl);
    this.productos.set(pr);
    this.promosTodas.set(po);
    if (this.id) await this.cargar();
    // Si el modal ya está abierto y llega otra venta por enlace (asistente, inicio), carga la nueva.
    this.ruta.paramMap.subscribe((m) => {
      const id = Number(m.get('id')) || null;
      if (id && id !== this.id) { this.id = id; this.cargar(); }
    });
  }

  /** Cierra el modal y vuelve a la lista. Si hay cambios sin guardar, pregunta antes. */
  async cerrar() {
    if (this.sucio && !(await this.confirmar.preguntar({ titulo: '¿Salir sin guardar?', texto: 'Tienes cambios que no se han guardado.', accion: 'Salir sin guardar', peligro: true }))) return;
    this.router.navigate([this.lista]);
  }

  private async cargar() {
    const d = await this.api.get<Cotizacion | Venta>(`${this.base}/${this.id}`);
    this.doc.set(d);
    Object.assign(this.f, {
      clienteId: d.clienteId, clienteNombre: d.clienteNombre, clienteTelefono: d.clienteTelefono, guardarCliente: false,
      fecha: String(d.fecha).slice(0, 10), estado: d.estado, descuentoTipo: d.descuentoTipo, descuentoValor: d.descuentoValor,
      promocionId: d.promocionId, notas: d.notas ?? '', items: d.items.map((i) => ({ ...i })),
      vigenciaDias: (d as Cotizacion).vigenciaDias ?? 15, entrega: (d as Venta).entrega ?? '',
    });
    this.sucio = false;
    this.cambios.update((x) => x + 1);
  }

  tocar() { this.sucio = true; this.cambios.update((x) => x + 1); }
  costoDe(i: Renglon) { return this.productos().find((p) => p.id === i.productoId)?.costoUnitario ?? i.costo ?? 0; }
  agregar() { this.f.items.push({ productoId: null, descripcion: '', cantidad: 1, precio: 0 }); this.tocar(); }
  quitar(i: number) { this.f.items.splice(i, 1); this.tocar(); }
  elegir(it: Renglon) {
    const p = this.productos().find((x) => x.id === it.productoId);
    if (p) { it.descripcion = p.nombre.replace(/ \(ejemplo\)$/, ''); it.precio = p.precio; }
    this.tocar();
  }
  aplicarPromo() {
    const p = this.promosTodas().find((x) => x.id === this.f.promocionId);
    if (p) { this.f.descuentoTipo = p.tipo; this.f.descuentoValor = p.valor; }
    this.tocar();
  }

  /** Guarda y devuelve el id. Si "salir" es true, regresa a la lista. */
  async guardar(salir = false): Promise<number | null> {
    const items = this.f.items.filter((i) => i.descripcion || i.productoId).map((i) => ({
      productoId: i.productoId, descripcion: i.descripcion, cantidad: Number(i.cantidad) || 0, precio: Number(i.precio) || 0,
    }));
    if (!items.length) { this.aviso.error('Agrega al menos un concepto'); return null; }
    this.ocupado.set(true);
    try {
      if (this.f.clienteId == null && this.f.guardarCliente && this.f.clienteNombre.trim()) {
        const c = await this.api.post<Cliente>('/clientes', { nombre: this.f.clienteNombre.trim(), telefono: this.f.clienteTelefono.trim() });
        this.clientes.update((x) => [...x, c]);
        this.f.clienteId = c.id;
      }
      const body: Record<string, unknown> = {
        clienteId: this.f.clienteId, clienteNombre: this.f.clienteNombre, clienteTelefono: this.f.clienteTelefono,
        fecha: this.f.fecha, descuentoTipo: this.f.descuentoTipo, descuentoValor: Number(this.f.descuentoValor) || 0,
        promocionId: this.f.promocionId, notas: this.f.notas, items, estado: this.f.estado,
      };
      if (this.esVenta) {
        body['entrega'] = this.f.entrega || null;
        if (!this.id && this.f.anticipo > 0) body['anticipo'] = { monto: Number(this.f.anticipo), metodo: this.f.metodo };
      } else body['vigenciaDias'] = Number(this.f.vigenciaDias) || 15;
      const r = this.id ? await this.api.put<{ id: number }>(`${this.base}/${this.id}`, body) : await this.api.post<{ id: number }>(this.base, body);
      this.sucio = false;
      this.aviso.ok(this.esVenta ? 'Venta guardada' : 'Cotización guardada');
      if (salir) this.router.navigate([this.lista]);
      else if (!this.id) {
        this.id = r.id;
        this.router.navigate([this.lista, r.id], { replaceUrl: true });
        await this.cargar();
      }
      return r.id;
    } catch (e) {
      this.aviso.error(mensajeError(e));
      return null;
    } finally {
      this.ocupado.set(false);
    }
  }

  private async asegurar() {
    return this.id && !this.sucio ? this.id : this.guardar(false);
  }

  async pdf() {
    const id = await this.asegurar();
    if (id) await this.api.abrirPdf(`${this.base}/${id}/pdf`).catch((e) => this.aviso.error(mensajeError(e)));
  }

  async whatsapp() {
    const id = await this.asegurar();
    if (!id) return;
    try {
      await this.api.whatsapp(`${this.base}/${id}/whatsapp`);
      if (!this.esVenta && this.f.estado === 'borrador') this.f.estado = 'enviada';
    } catch (e) {
      this.aviso.error(mensajeError(e));
    }
  }

  async convertir() {
    const id = await this.asegurar();
    if (!id) return;
    try {
      const v = await this.api.post<{ id: number; folio: string }>(`/cotizaciones/${id}/convertir`);
      this.aviso.ok(`Venta ${v.folio} creada`);
      this.router.navigate(['/app/ventas', v.id]);
    } catch (e) {
      this.aviso.error(mensajeError(e));
    }
  }

  async registrarPago() {
    try {
      await this.api.post(`/ventas/${this.id}/pagos`, { monto: Number(this.pago), metodo: this.metodoPago });
      this.pago = null;
      this.aviso.ok('Pago registrado');
      await this.cargar();
    } catch (e) {
      this.aviso.error(mensajeError(e));
    }
  }

  async eliminar() {
    try {
      await this.api.del(`${this.base}/${this.id}`);
      this.aviso.ok('Eliminado');
      this.router.navigate([this.lista]);
    } catch (e) {
      this.aviso.error(mensajeError(e));
    }
  }
}
