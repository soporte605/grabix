import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../core/api.service';
import { AsistenteService } from '../core/asistente.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { PosService } from '../core/pos.service';
import { dinero, DineroPipe, FechaPipe, hoy, PctPipe, sumarDias } from '../core/formato';
import { Cliente, Cotizacion, EST_COT, EST_VTA, Producto, Promocion, Renglon, Venta } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { AltaCliente, AltaProducto, AltaPromocion } from '../ui/alta-rapida';
import { Buscador } from '../ui/buscador';
import { Hoja } from '../ui/hoja';
import { VistaDocumento } from '../ui/vista-documento';
import { Icono } from '../ui/icono';
import { ImagenesCotizacion } from '../ui/imagenes-cotizacion';

interface Form {
  clienteId: number | null; clienteNombre: string; clienteTelefono: string; guardarCliente: boolean;
  fecha: string; estado: string; vigenciaDias: number; entrega: string;
  descuentoTipo: 'pct' | 'monto'; descuentoValor: number; promocionId: number | null; notas: string;
  items: Renglon[]; anticipo: number; metodo: string;
}

@Component({
  selector: 'app-doc-editor',
  imports: [FormsModule, Buscador, DineroPipe, FechaPipe, PctPipe, Icono, Confirmar, Hoja, VistaDocumento, AltaCliente, AltaProducto, AltaPromocion, ImagenesCotizacion],
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
            <app-buscador idCampo="d-cli" [opciones]="opsClientes()" [conVacio]="true" vacio="Cliente nuevo o de mostrador" placeholder="Buscar por nombre o teléfono…" crear="Nuevo cliente" (nuevo)="altaCliente.set($event)" [(ngModel)]="f.clienteId" (ngModelChange)="tocar()" />
          </div>
          @if (f.clienteId == null) {
            <div class="campo"><label for="d-cn">Nombre</label><input id="d-cn" [(ngModel)]="f.clienteNombre" (ngModelChange)="tocar()"></div>
            <div class="campo"><label for="d-ct">WhatsApp</label><input id="d-ct" type="tel" [(ngModel)]="f.clienteTelefono" (ngModelChange)="tocar()"></div>
            <label class="fila chico self-end pb-2"><input type="checkbox" [(ngModel)]="f.guardarCliente"> Guardar en mis clientes</label>
          }
        </div>
        <div class="campos c3">
          <div class="campo"><label for="d-f">Fecha</label><input id="d-f" name="fecha" type="date" [(ngModel)]="f.fecha" (ngModelChange)="tocar()"></div>
          @if (esVenta) {
            <div class="campo"><label for="d-e">Fecha de entrega</label><input id="d-e" name="entrega" type="date" [(ngModel)]="f.entrega" (ngModelChange)="tocar()"></div>
          } @else {
            <div class="campo"><label for="d-v">Vigencia (días)</label><input id="d-v" name="vigenciaDias" min="1" max="365" type="number" [(ngModel)]="f.vigenciaDias" (ngModelChange)="tocar()"></div>
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
              <app-buscador class="col-span-6 sm:col-span-3" [opciones]="opsProductos()" [conVacio]="true" vacio="Concepto libre" etiqueta="Artículo" placeholder="Buscar producto o servicio…" [crear]="s.verCostos() ? 'Nuevo producto o servicio' : ''" (nuevo)="altaProducto.set({ it, q: $event })" [(ngModel)]="it.productoId" (ngModelChange)="elegir(it)" />
              <input class="entrada col-span-6 p-2 sm:col-span-3" [(ngModel)]="it.descripcion" (ngModelChange)="tocar()" placeholder="Descripción" aria-label="Descripción">
              <input class="entrada col-span-2 p-2" type="number" inputmode="decimal" [(ngModel)]="it.cantidad" (ngModelChange)="tocar()" placeholder="Cant." aria-label="Cantidad">
              <div class="col-span-2 flex gap-1">
                <input class="entrada min-w-0 flex-1 p-2" type="number" inputmode="decimal" [(ngModel)]="it.precio" (ngModelChange)="tocar()" placeholder="Precio c/u" aria-label="Precio unitario">
                @if (!it.productoId && s.verCostos() && ia.estado()?.disponible) {
                  <button type="button" class="ico shrink-0" [disabled]="pensandoEn() === it" title="Sugerir precio con IA" aria-label="Sugerir precio con IA" (click)="sugerirPrecio(it)"><app-icono nombre="chispa" /></button>
                }
              </div>
              <span class="num col-span-2 flex flex-col self-center text-right text-base">{{ (it.cantidad || 0) * (it.precio || 0) | dinero }}
                @if (s.verCostos() && it.productoId) { <small class="text-xs text-tenue">costo {{ costoDe(it) | dinero }}</small> }</span>
              @if (!it.productoId && notasIA().get(it); as n) {
                <div class="col-span-6 flex items-start gap-1.5 text-sm text-tenue"><app-icono nombre="chispa" class="mt-0.5 shrink-0 text-marca" /><p class="flex-1">{{ n.texto }}</p>
                  <button type="button" class="btn sm shrink-0" (click)="limpiarSugerencia(it)">Limpiar</button></div>
              }
            </div>
            <button class="text-2xl text-bad" (click)="quitar(i)" aria-label="Quitar concepto">×</button>
          </div>
        }
        <div><button class="btn sm" (click)="agregar()"><app-icono nombre="mas1" />Agregar concepto</button></div>
      </section>

      <section class="caja">
        <h3>Descuento</h3>
        <div class="campos c3">
          <div class="campo"><div class="flex items-baseline justify-between gap-2"><label for="d-pr">Promoción</label>@if (s.verCostos()) { <button type="button" class="chico font-semibold text-marca" (click)="altaPromo.set(true)">+ Nueva</button> }</div>
            <select id="d-pr" [(ngModel)]="f.promocionId" (ngModelChange)="aplicarPromo()">
              <option [ngValue]="null">Ninguna</option>
              @for (p of promos(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
            </select>
          </div>
          <div class="campo"><label for="d-dt">Tipo</label>
            <select id="d-dt" [(ngModel)]="f.descuentoTipo" (ngModelChange)="tocar()"><option value="pct">Porcentaje</option><option value="monto">Cantidad</option></select>
          </div>
          <div class="campo"><label for="d-dv">Descuento</label><input id="d-dv" name="descuentoValor" min="0" type="number" inputmode="decimal" [(ngModel)]="f.descuentoValor" (ngModelChange)="tocar()"></div>
        </div>
      </section>

      <div class="campo"><label for="d-no">Notas {{ esVenta ? 'del pedido' : '(aparecen en el PDF)' }}</label><textarea id="d-no" [(ngModel)]="f.notas" (ngModelChange)="tocar()"></textarea></div>

      @if (!esVenta) { <app-imagenes-cotizacion [cotizacionId]="id" [asegurar]="asegurarFn" /> }

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

      @if (esVenta && !id) {
        <section class="caja">
          <div class="fila entre"><h3>Cobro</h3>
            <div class="chips" role="group" aria-label="Cuánto paga">
              <button class="chip" [class.on]="f.anticipo > 0 && f.anticipo === r2(t().total)" (click)="abonar(1)">Paga todo</button>
              <button class="chip" [class.on]="f.anticipo > 0 && f.anticipo === r2(t().total / 2)" (click)="abonar(.5)">Anticipo 50%</button>
              <button class="chip" [class.on]="!f.anticipo" (click)="abonar(0)">Sin pago</button>
            </div>
          </div>
          <div class="campos c3">
            <div class="campo"><label for="d-me">Forma de pago</label><select id="d-me" [(ngModel)]="f.metodo" (ngModelChange)="tocar()">@for (m of metodos; track m) { <option>{{ m }}</option> }</select></div>
            <div class="campo"><label for="d-an">Abona ahora</label><input id="d-an" name="anticipo" min="0" type="number" inputmode="decimal" [(ngModel)]="f.anticipo" (ngModelChange)="tocar()"></div>
            @if (f.metodo === 'Efectivo') {
              <div class="campo"><label for="d-pc">Paga con (efectivo)</label><input id="d-pc" min="0" type="number" inputmode="decimal" placeholder="Opcional" [(ngModel)]="pagaCon" (ngModelChange)="tocar()"></div>
            }
          </div>
          @if (cobro().cambio > 0 || cobro().falta > 0) {
            <div class="flex flex-wrap gap-2.5">
              @if (cobro().cambio > 0) { <p class="rounded-xl bg-ok-suave px-3.5 py-2 text-ok">Cambio <b class="num text-xl">{{ cobro().cambio | dinero }}</b></p> }
              @if (cobro().falta > 0) { <p class="rounded-xl bg-warn-suave px-3.5 py-2 text-warn">Le faltan <b class="num">{{ cobro().falta | dinero }}</b> para cubrir lo que abona</p> }
            </div>
          }
        </section>
      }

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
        <button class="btn" (click)="pdf()" [disabled]="ocupado()"><app-icono nombre="ojo" />Vista previa</button>
        <button class="btn wa" (click)="whatsapp()" [disabled]="ocupado()"><app-icono nombre="wa" />WhatsApp</button>
        @if (esVenta && id) { <button class="btn" (click)="ticket()" [disabled]="ocupado()"><app-icono nombre="imprimir" />Ticket</button> }
        @if (!esVenta && id && f.estado !== 'aceptada') { <button class="btn" (click)="convertir()" [disabled]="ocupado()">Convertir en venta</button> }
        <span class="flex-1"></span>
        <button class="btn pri min-w-32 max-sm:flex-1" (click)="guardar(true)" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : esVenta && !id ? 'Registrar venta' : 'Guardar' }}</button>
      </ng-container>
    </app-hoja>
    @if (vista(); as v) { <app-vista-documento [venta]="v" [tipo]="esVenta ? 'venta' : 'cotizacion'" [conCancelar]="false" (cerrar)="vista.set(null)" /> }
    @if (altaCliente() !== null) { <app-alta-cliente [inicial]="altaCliente()!" (cerrar)="altaCliente.set(null)" (creado)="clienteCreado($event)" /> }
    @if (altaProducto(); as a) { <app-alta-producto [inicial]="a.q" [categorias]="categorias()" (cerrar)="altaProducto.set(null)" (creado)="productoCreado(a.it, $event)" /> }
    @if (altaPromo()) { <app-alta-promocion (cerrar)="altaPromo.set(false)" (creado)="promoCreada($event)" /> }
  `,
})
export class DocEditor implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private router = inject(Router);
  private ruta = inject(ActivatedRoute);
  private confirmar = inject(ConfirmarService);
  private pos = inject(PosService);
  ia = inject(AsistenteService);
  /** Renglón libre para el que la IA está calculando precio. */
  pensandoEn = signal<Renglon | null>(null);
  /** Explicación de la IA por renglón; solo se ve en el editor, no sale en el PDF. */
  notasIA = signal(new Map<Renglon, { texto: string; precioAntes: number }>());
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
  pagaCon: number | null = null;
  r2 = (n: number) => Math.round(n * 100) / 100;
  cobro = computed(() => {
    this.cambios();
    const abona = Number(this.f.anticipo) || 0, con = Number(this.pagaCon) || 0;
    if (this.f.metodo !== 'Efectivo' || !con) return { cambio: 0, falta: 0 };
    return { cambio: this.r2(Math.max(0, con - abona)), falta: this.r2(Math.max(0, abona - con)) };
  });

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
  opsClientes = computed(() => this.clientes().map((c) => ({ valor: c.id, texto: c.nombre, detalle: c.telefono || undefined })));
  opsProductos = computed(() => {
    const m = this.s.moneda();
    return this.grupos().flatMap((g) => g.ps.map((p) => ({ valor: p.id, texto: p.nombre, grupo: g.t, detalle: dinero(p.precio, m) })));
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
    if (this.s.verCostos() && !this.ia.estado()) this.ia.cargarEstado();
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

  abonar(p: number) { this.f.anticipo = this.r2(this.t().total * p); this.tocar(); }

  /** Abre el ticket de esta venta (guarda antes si hay cambios). */
  async ticket() {
    const id = await this.asegurar();
    if (!id) return;
    this.pos.hecha.set({ id, nueva: false });
    this.router.navigate([this.lista]);
  }

  /** Precio sugerido por la IA para un concepto libre, con los insumos y la tarifa del taller. */
  async sugerirPrecio(it: Renglon) {
    if (this.pensandoEn()) return;
    if ((it.descripcion ?? '').trim().length < 3) { this.aviso.error('Escribe primero la descripción del concepto'); return; }
    this.pensandoEn.set(it);
    try {
      const g = await this.ia.sugerirProducto(it.descripcion);
      const precioAntes = this.notasIA().get(it)?.precioAntes ?? it.precio;
      it.precio = g.precio;
      this.tocar();
      const rango = g.precioMax ? ` En el mercado: ${dinero(g.precioMin, this.s.moneda())} a ${dinero(g.precioMax, this.s.moneda())}.` : '';
      this.notasIA.update((m) => new Map(m).set(it, { texto: `${g.nota}${rango} Costo estimado: ${dinero(g.costoTotal, this.s.moneda())} por pieza.`, precioAntes }));
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.pensandoEn.set(null); }
  }

  /** Quita la nota de la IA y regresa el precio que tenía el renglón. */
  limpiarSugerencia(it: Renglon) {
    const n = this.notasIA().get(it);
    if (!n) return;
    it.precio = n.precioAntes;
    this.notasIA.update((m) => { const x = new Map(m); x.delete(it); return x; });
    this.tocar();
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
  /* Altas rápidas sin salir del documento. */
  altaCliente = signal<string | null>(null);
  altaProducto = signal<{ it: Renglon; q: string } | null>(null);
  altaPromo = signal(false);
  categorias = computed(() => [...new Set(this.productos().map((p) => p.categoria).filter(Boolean))].sort());
  clienteCreado(c: Cliente) {
    this.clientes.update((l) => [...l, c].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    this.f.clienteId = c.id;
    this.altaCliente.set(null);
    this.tocar();
  }
  async productoCreado(it: Renglon, p: Producto) {
    // Se recarga la lista para traer el costo calculado del nuevo artículo.
    this.productos.set(await this.api.get<Producto[]>('/productos').catch(() => [...this.productos(), p]));
    it.productoId = p.id;
    this.altaProducto.set(null);
    this.elegir(it);
  }
  promoCreada(p: Promocion) {
    this.promosTodas.update((l) => [...l, p]);
    this.f.promocionId = p.id;
    this.altaPromo.set(false);
    this.aplicarPromo();
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
      if (!(salir && this.esVenta && !this.id)) this.aviso.ok(this.esVenta ? 'Venta guardada' : 'Cotización guardada');
      if (salir && this.esVenta && !this.id) {
        // Venta nueva: se cierra el editor y se muestra la ventana de venta realizada con el ticket.
        const c = this.cobro();
        this.pos.hecha.set({ id: r.id, nueva: true, recibido: c.cambio > 0 ? Number(this.pagaCon) : undefined, cambio: c.cambio || undefined });
        this.router.navigate([this.lista]);
      } else if (salir) this.router.navigate([this.lista]);
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

  asegurarFn = () => this.asegurar();
  private async asegurar() {
    return this.id && !this.sucio ? this.id : this.guardar(false);
  }

  /** Guarda si hace falta y muestra la vista previa con PDF, imprimir y WhatsApp. */
  vista = signal<Cotizacion | Venta | null>(null);
  async pdf() {
    const id = await this.asegurar();
    if (!id) return;
    try { this.vista.set(await this.api.get<Cotizacion | Venta>(`${this.base}/${id}`)); }
    catch (e) { this.aviso.error(mensajeError(e)); }
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
