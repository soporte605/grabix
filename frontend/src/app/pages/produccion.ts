import { Component, inject, OnInit, signal } from '@angular/core';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { FechaPipe } from '../core/formato';
import { EST_VTA, EstadoVenta, Venta } from '../core/modelos';
import { Icono } from '../ui/icono';

const COLUMNAS: EstadoVenta[] = ['pendiente', 'produccion', 'lista'];
const SIGUIENTE: Partial<Record<EstadoVenta, [EstadoVenta, string]>> = {
  pendiente: ['produccion', 'Empezar'],
  produccion: ['lista', 'Terminado'],
  lista: ['entregada', 'Entregar'],
};

/** Tablero de pedidos por hacer: pendiente → en producción → listo → entregado. */
@Component({
  selector: 'app-produccion',
  imports: [FechaPipe, Icono],
  template: `
    <div class="encabezado"><div><h1>Producción</h1><p>Pedidos por hacer, ordenados por fecha de entrega.</p></div></div>
    <div class="tablero">
      @for (c of columnas; track c) {
        <section class="columna">
          <h2>{{ est[c][0] }} <span class="pill" [class]="est[c][1]">{{ de(c).length }}</span></h2>
          @for (v of de(c); track v.id) {
            <article class="tarjeta pedido" [class.tarde]="v.entrega && v.entrega < hoy">
              <div class="fila entre"><b class="num">{{ v.folio }}</b><span class="chico" [class.rojo]="v.entrega && v.entrega < hoy">Entrega {{ v.entrega ? (v.entrega | fecha) : 'sin fecha' }}</span></div>
              <div>{{ v.cliente?.nombre || v.clienteNombre || 'Mostrador' }}</div>
              <ul>@for (i of v.items; track $index) { <li><b>{{ i.cantidad }}</b> × {{ i.descripcion }}</li> }</ul>
              @if (v.notas) { <p class="chico tenue">{{ v.notas }}</p> }
              <div class="fila">
                <button class="btn sm pri" (click)="mover(v, siguiente[c]![0])">{{ siguiente[c]![1] }}</button>
                <button class="btn sm" (click)="pdf(v)"><app-icono nombre="pdf" />Orden</button>
              </div>
            </article>
          } @empty { <p class="tenue chico">Nada aquí.</p> }
        </section>
      }
    </div>
  `,
  styles: `
    .tablero { display: grid; gap: 14px; }
    @media (min-width: 900px) { .tablero { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .columna { display: flex; flex-direction: column; gap: 10px; }
    .columna h2 { display: flex; gap: 8px; align-items: center; font-size: 1rem; }
    .pedido { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .pedido.tarde { border-color: var(--bad); }
    .rojo { color: var(--bad); font-weight: 600; }
    ul { margin: 0; padding-left: 1.1em; font-size: .9rem; }
    p { margin: 0; }
  `,
})
export class Produccion implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  est = EST_VTA;
  columnas = COLUMNAS;
  siguiente = SIGUIENTE;
  hoy = new Date().toISOString().slice(0, 10);
  ventas = signal<Venta[]>([]);

  ngOnInit() { this.cargar(); }
  async cargar() {
    const vs = await this.api.get<Venta[]>('/ventas', { estado: COLUMNAS.join(',') });
    this.ventas.set(vs.sort((a, b) => String(a.entrega ?? '9').localeCompare(String(b.entrega ?? '9'))));
  }
  de(e: EstadoVenta) { return this.ventas().filter((v) => v.estado === e); }
  async mover(v: Venta, estado: EstadoVenta) {
    try {
      await this.api.patch(`/ventas/${v.id}/estado`, { estado });
      this.aviso.ok(`${v.folio}: ${EST_VTA[estado][0]}`);
      await this.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
  pdf(v: Venta) { this.api.abrirPdf(`/ventas/${v.id}/pdf`).catch((e) => this.aviso.error(mensajeError(e))); }
}
