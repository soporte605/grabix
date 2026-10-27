import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { DineroPipe, FechaPipe } from '../core/formato';
import { Cotizacion, EST_COT, EST_VTA, Venta } from '../core/modelos';
import { Icono } from '../ui/icono';

/** Lista de cotizaciones o de ventas (según la ruta). */
@Component({
  selector: 'app-doc-lista',
  imports: [FormsModule, RouterLink, DineroPipe, FechaPipe, Icono],
  template: `
    <div class="encabezado">
      <div>
        <h1>{{ esVenta ? 'Ventas' : 'Cotizaciones' }}</h1>
        <p>{{ esVenta ? 'Órdenes de venta: producción, anticipos, saldos y entregas.' : 'Arma precios, descarga el PDF y envíalo por WhatsApp.' }}</p>
      </div>
      <a class="btn pri" routerLink="nueva"><app-icono nombre="mas1" />{{ esVenta ? 'Nueva venta' : 'Nueva cotización' }}</a>
    </div>
    <div class="fila entre" style="margin-bottom:12px">
      <div class="chips">
        <button class="chip" [class.on]="!estado()" (click)="filtrar('')">Todas</button>
        @for (k of estados; track k) { <button class="chip" [class.on]="estado() === k" (click)="filtrar(k)">{{ mapa[k][0] }}</button> }
      </div>
      <input class="buscar" placeholder="Buscar por folio o cliente" [(ngModel)]="q" (ngModelChange)="buscar()" aria-label="Buscar">
    </div>
    <div class="tarjeta lista">
      @for (d of docs(); track d.id) {
        <a class="renglon" [routerLink]="[d.id]">
          <span class="t">{{ d.cliente?.nombre || d.clienteNombre || 'Mostrador' }}</span>
          <span class="d num">{{ d.total | dinero }}</span>
          <span class="m"><span class="num">{{ d.folio }}</span> · {{ d.fecha | fecha }}
            @if (esVenta && $any(d).saldo > 0 && d.estado !== 'cancelada') { · Saldo <span class="num">{{ $any(d).saldo | dinero }}</span> }</span>
          <span class="d"><span class="pill" [class]="mapa[d.estado][1]">{{ mapa[d.estado][0] }}</span></span>
        </a>
      } @empty {
        <div class="vacio"><b>{{ cargando() ? 'Cargando…' : 'Sin resultados' }}</b>{{ cargando() ? '' : 'Crea el primero con el botón de arriba.' }}</div>
      }
    </div>
    @if (esVenta && docs().length) {
      <p class="tenue chico">{{ docs().length }} ventas · Total {{ total() | dinero }} · Saldo por cobrar {{ saldo() | dinero }}</p>
    }
  `,
  styles: `a.renglon { text-decoration: none; }`,
})
export class DocLista implements OnInit {
  private api = inject(Api);
  esVenta = inject(ActivatedRoute).snapshot.data['tipo'] === 'ventas';
  mapa: Record<string, [string, string]> = this.esVenta ? EST_VTA : EST_COT;
  estados = Object.keys(this.mapa);
  docs = signal<(Cotizacion | Venta)[]>([]);
  estado = signal('');
  cargando = signal(true);
  q = '';
  private t?: ReturnType<typeof setTimeout>;
  total = computed(() => this.docs().filter((d) => d.estado !== 'cancelada').reduce((a, d) => a + d.total, 0));
  saldo = computed(() => this.docs().filter((d) => d.estado !== 'cancelada').reduce((a, d) => a + ((d as Venta).saldo ?? 0), 0));

  ngOnInit() { this.cargar(); }
  filtrar(e: string) { this.estado.set(e); this.cargar(); }
  buscar() { clearTimeout(this.t); this.t = setTimeout(() => this.cargar(), 250); }
  async cargar() {
    const p: Record<string, string> = {};
    if (this.estado()) p['estado'] = this.estado();
    if (this.q.trim()) p['q'] = this.q.trim();
    this.docs.set(await this.api.get(this.esVenta ? '/ventas' : '/cotizaciones', p));
    this.cargando.set(false);
  }
}
