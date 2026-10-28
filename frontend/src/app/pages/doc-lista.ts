import { Esqueleto } from '../ui/esqueleto';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { PosService } from '../core/pos.service';
import { VentaHechaVentana } from '../ui/venta-hecha';
import { Api } from '../core/api.service';
import { DineroPipe, FechaPipe } from '../core/formato';
import { Cotizacion, EST_COT, EST_VTA, Venta } from '../core/modelos';
import { FiltroFechas, Rango } from '../ui/filtro-fechas';
import { Icono } from '../ui/icono';
import { Paginador } from '../ui/paginador';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { SesionService } from '../core/sesion.service';

/** Lista de cotizaciones o de ventas (según la ruta). */
@Component({
  selector: 'app-doc-lista',
  imports: [FormsModule, VentaHechaVentana, FiltroFechas, RouterLink, RouterOutlet, DineroPipe, FechaPipe, Icono, Esqueleto, Paginador],
  template: `
    <div class="encabezado">
      <div class="titulo"><span class="icono-modulo"><app-icono [nombre]="esVenta ? 'ventas' : 'cotizaciones'" /></span><div>
        <h1>{{ esVenta ? 'Ventas' : 'Cotizaciones' }}</h1>
        <p>{{ esVenta ? 'Órdenes de venta: producción, anticipos, saldos y entregas.' : 'Arma precios, descarga el PDF y envíalo por WhatsApp.' }}</p>
      </div></div>
      <a class="btn pri" routerLink="nueva"><app-icono nombre="mas1" />{{ esVenta ? 'Nueva venta' : 'Nueva cotización' }}</a>
    </div>
    <div class="mb-3 flex flex-col gap-2.5">
      <div class="flex flex-wrap items-center gap-2">
        <input class="buscar min-w-0 flex-1" type="search" placeholder="Buscar por folio o cliente" [(ngModel)]="q" (ngModelChange)="buscar()" aria-label="Buscar">
        <app-filtro-fechas [rango]="rango" (rangoChange)="rango = $event; pagina.set(1); cargar()" />
      </div>
      <div class="chips">
        <button class="chip" [class.on]="!estado()" (click)="filtrar('')">Todas</button>
        @for (k of estados; track k) { <button class="chip" [class.on]="estado() === k" (click)="filtrar(k)">{{ mapa[k][0] }}</button> }
      </div>
    </div>
    <div class="tarjeta lista">
      @if (cargando()) { <app-esqueleto /> } @else {
      @for (d of docs(); track d.id) {
        <div class="con-acciones">
          <a class="renglon" [routerLink]="[d.id]">
            <span class="t">{{ d.cliente?.nombre || d.clienteNombre || 'Mostrador' }}</span>
            <span class="d num">{{ d.total | dinero }}</span>
            <span class="m"><span class="num">{{ d.folio }}</span> · {{ d.fecha | fecha }}
              @if (esVenta && $any(d).saldo > 0 && d.estado !== 'cancelada') { · Saldo <span class="num">{{ $any(d).saldo | dinero }}</span> }</span>
            <span class="d"><span class="pill" [class]="mapa[d.estado][1]">{{ mapa[d.estado][0] }}</span></span>
          </a>
          <span class="acciones">
            <a class="ico max-sm:hidden" [routerLink]="[d.id]" title="Editar" aria-label="Editar {{ d.folio }}"><app-icono nombre="editar" /></a>
            <button type="button" class="ico max-sm:hidden" title="Descargar PDF" aria-label="Descargar PDF de {{ d.folio }}" (click)="pdf(d)"><app-icono nombre="descargar" /></button>
            @if (puedeEliminar()) {
              <button type="button" class="ico peligro" title="Eliminar" aria-label="Eliminar {{ d.folio }}" (click)="eliminar(d)"><app-icono nombre="basura" /></button>
            }
          </span>
        </div>
      } @empty {
        <div class="vacio"><b>Sin resultados</b>{{ q || rango.desde || rango.hasta || estado() ? 'Prueba con otra búsqueda o cambia las fechas.' : 'Crea el primero con el botón de arriba.' }}</div>
      }
    }
    </div>
    <app-paginador [total]="total()" [por]="por" [pagina]="pagina()" (paginaChange)="pagina.set($event); cargar()" />
    @if (esVenta && resumen(); as r) {
      @if (total()) { <p class="tenue chico mt-2">{{ total() }} {{ total() === 1 ? 'venta' : 'ventas' }} · Total {{ r.total | dinero }} · Saldo por cobrar {{ r.saldo | dinero }}</p> }
    }
    <!-- Nueva, editar y ver se abren en un modal encima de la lista; al cerrarlo se actualiza la lista. -->
    <router-outlet (deactivate)="cargar()" />
    @if (esVenta && pos.hecha(); as h) {
      <app-venta-hecha [datos]="h" (cerrar)="pos.hecha.set(null)" (nueva)="pos.hecha.set(null); router.navigate(['/app/ventas/nueva'])" />
    }
  `,
})
export class DocLista implements OnInit {
  private api = inject(Api);
  pos = inject(PosService);
  router = inject(Router);
  esVenta = inject(ActivatedRoute).snapshot.data['tipo'] === 'ventas';
  mapa: Record<string, [string, string]> = this.esVenta ? EST_VTA : EST_COT;
  estados = Object.keys(this.mapa);
  docs = signal<(Cotizacion | Venta)[]>([]);
  estado = signal('');
  cargando = signal(true);
  q = '';
  rango: Rango = { desde: '', hasta: '' };
  private t?: ReturnType<typeof setTimeout>;
  total = signal(0);
  resumen = signal<{ total: number; saldo: number } | null>(null);
  pagina = signal(1);
  por = 20;
  private s = inject(SesionService);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  puedeEliminar = computed(() => (this.esVenta ? this.s.gerencia() : this.s.verCostos()));

  ngOnInit() { this.cargar(); }
  filtrar(e: string) { this.estado.set(e); this.pagina.set(1); this.cargar(); }
  buscar() { clearTimeout(this.t); this.t = setTimeout(() => { this.pagina.set(1); this.cargar(); }, 250); }
  async cargar(): Promise<void> {
    const p: Record<string, string> = { pagina: String(this.pagina()), por: String(this.por) };
    if (this.estado()) p['estado'] = this.estado();
    if (this.q.trim()) p['q'] = this.q.trim();
    if (this.rango.desde) p['desde'] = this.rango.desde;
    if (this.rango.hasta) p['hasta'] = this.rango.hasta;
    const r = await this.api.get<{ items: (Cotizacion | Venta)[]; total: number; resumen?: { total: number; saldo: number } }>(this.esVenta ? '/ventas' : '/cotizaciones', p);
    // Si se borró lo último de la página, regresa a la anterior.
    if (!r.items.length && this.pagina() > 1) { this.pagina.update((n) => n - 1); return this.cargar(); }
    this.docs.set(r.items);
    this.total.set(r.total);
    this.resumen.set(r.resumen ?? null);
    this.cargando.set(false);
  }
  pdf(d: Cotizacion | Venta) {
    const base = this.esVenta ? 'ventas' : 'cotizaciones';
    this.api.descargarPdf(`/${base}/${d.id}/pdf`, `${d.folio}.pdf`).catch((e) => this.aviso.error(mensajeError(e)));
  }
  async eliminar(d: Cotizacion | Venta) {
    const ok = await this.confirmar.preguntar({
      titulo: `¿Eliminar ${this.esVenta ? 'la venta' : 'la cotización'} ${d.folio}?`,
      texto: this.esVenta ? 'El inventario que descontó se devuelve. No se puede deshacer.' : 'No se puede deshacer.',
      accion: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await this.api.del(`/${this.esVenta ? 'ventas' : 'cotizaciones'}/${d.id}`);
      this.aviso.ok(`${d.folio} eliminada`);
      await this.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
