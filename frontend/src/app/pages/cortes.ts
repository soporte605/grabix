import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe } from '../core/formato';
import { CajaTurno, DetalleTurno, Usuario } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Buscador } from '../ui/buscador';
import { Esqueleto } from '../ui/esqueleto';
import { FiltroFechas, Rango } from '../ui/filtro-fechas';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';
import { Paginador } from '../ui/paginador';
import { imprimirCorte } from '../ui/turno-caja';

/** Historial de turnos y cortes de caja. */
@Component({
  selector: 'app-cortes',
  imports: [FormsModule, DineroPipe, FiltroFechas, Buscador, Hoja, Icono, Paginador, Esqueleto],
  template: `
    <div class="encabezado">
      <div class="titulo"><span class="icono-modulo"><app-icono nombre="cortes" /></span><div><h1>Cortes de caja</h1><p>Cada turno: quién abrió y cerró, cuánto se cobró y si cuadró el efectivo.</p></div></div>
    </div>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <app-filtro-fechas [rango]="rango" (rangoChange)="rango = $event; pagina.set(1); cargar()" />
      @if (s.gerencia()) {
        <app-buscador class="min-w-[220px]" [opciones]="opsUsuarios()" [conVacio]="true" vacio="Todos los cajeros" etiqueta="Cajero" [(ngModel)]="usuarioId" (ngModelChange)="pagina.set(1); cargar()" />
      }
    </div>
    <div class="tarjeta lista">
      @if (!listo()) { <app-esqueleto /> } @else {
        @for (t of turnos(); track t.id) {
          <div class="con-acciones">
            <button class="renglon" (click)="ver(t)">
              <span class="t">{{ t.folio }} · {{ fechaHora(t.abiertoEn) }}
                <span class="pill ml-1" [class]="t.estado === 'abierto' ? 'ok' : 'mut'">{{ t.estado === 'abierto' ? 'Abierto' : 'Cerrado' }}</span></span>
              <span class="d num">{{ (t.resumen?.cobrado ?? 0) | dinero }}</span>
              <span class="m">{{ t.abrioNombre }}@if (t.cerroNombre && t.cerroNombre !== t.abrioNombre) { → {{ t.cerroNombre }} } · {{ sucursal(t.sucursalId) }}
                @if (t.cerradoEn) { · cerró {{ hora(t.cerradoEn) }} }</span>
              <span class="d m">
                @if (t.estado === 'cerrado') {
                  <span [class]="t.diferencia === 0 ? 'text-ok' : t.diferencia > 0 ? 'text-warn' : 'font-semibold text-bad'">{{ t.diferencia === 0 ? 'Cuadró' : t.diferencia > 0 ? 'Sobró ' + (t.diferencia | dinero) : 'Faltó ' + (-t.diferencia | dinero) }}</span>
                } @else { En curso }
              </span>
            </button>
            <span class="acciones">
              <button type="button" class="ico" title="Ver detalle" aria-label="Ver {{ t.folio }}" (click)="ver(t)"><app-icono nombre="ojo" /></button>
              @if (t.estado === 'cerrado') { <button type="button" class="ico max-sm:hidden" title="Imprimir corte" aria-label="Imprimir {{ t.folio }}" (click)="imprimir(t)"><app-icono nombre="imprimir" /></button> }
            </span>
          </div>
        } @empty { <div class="vacio"><b>Sin turnos</b>{{ rango.desde || usuarioId ? 'Prueba con otras fechas o cajero.' : 'Abre la caja desde Caja para empezar tu primer turno.' }}</div> }
      }
    </div>
    <app-paginador [total]="total()" [pagina]="pagina()" (paginaChange)="pagina.set($event); cargar()" />

    @if (detalle(); as d) {
      <app-hoja [titulo]="'Turno ' + d.folio" ancho="720px" (cerrar)="detalle.set(null)">
        <span cabeza class="pill" [class]="d.estado === 'abierto' ? 'ok' : 'mut'">{{ d.estado === 'abierto' ? 'Abierto' : 'Cerrado' }}</span>
        <div class="grid gap-x-6 gap-y-1 text-base sm:grid-cols-2">
          <div class="flex justify-between"><span class="text-tenue">Abrió</span><span>{{ d.abrioNombre }} · {{ fechaHora(d.abiertoEn) }}</span></div>
          <div class="flex justify-between"><span class="text-tenue">Cerró</span><span>{{ d.cerradoEn ? d.cerroNombre + ' · ' + fechaHora(d.cerradoEn) : '—' }}</span></div>
          <div class="flex justify-between"><span class="text-tenue">Sucursal</span><span>{{ sucursal(d.sucursalId) }}</span></div>
          <div class="flex justify-between"><span class="text-tenue">Fondo inicial</span><span class="num">{{ d.fondo | dinero }}</span></div>
        </div>
        @if (d.resumen; as r) {
          <div class="grid gap-3 sm:grid-cols-2">
            <section class="rounded-xl border border-linea bg-superficie p-3">
              <h3 class="mb-1.5 text-base">Cobros</h3>
              @for (k of llaves(r.porMetodo); track k) { <div class="flex justify-between text-base"><span class="text-tenue">{{ k }}</span><span class="num">{{ r.porMetodo[k] | dinero }}</span></div> }
              @empty { <p class="chico tenue">Sin cobros.</p> }
              <div class="mt-1.5 flex justify-between border-t border-linea pt-1.5 font-semibold"><span>Total ({{ r.ventas }} {{ r.ventas === 1 ? 'venta' : 'ventas' }})</span><span class="num">{{ r.cobrado | dinero }}</span></div>
            </section>
            <section class="rounded-xl border border-linea bg-superficie p-3">
              <h3 class="mb-1.5 text-base">Efectivo</h3>
              <div class="flex justify-between text-base"><span class="text-tenue">Esperado</span><span class="num">{{ r.esperado | dinero }}</span></div>
              @if (d.estado === 'cerrado') {
                <div class="flex justify-between text-base"><span class="text-tenue">Contado</span><span class="num">{{ d.contado | dinero }}</span></div>
                <div class="flex justify-between text-base font-semibold" [class]="d.diferencia === 0 ? 'text-ok' : d.diferencia > 0 ? 'text-warn' : 'text-bad'"><span>{{ d.diferencia === 0 ? 'Cuadró' : d.diferencia > 0 ? 'Sobrante' : 'Faltante' }}</span><span class="num">{{ (d.diferencia < 0 ? -d.diferencia : d.diferencia) | dinero }}</span></div>
                <div class="mt-1.5 flex justify-between border-t border-linea pt-1.5 text-base"><span class="text-tenue">Se dejó en caja</span><span class="num">{{ d.dejado | dinero }}</span></div>
                <div class="flex justify-between text-base font-semibold"><span>Retiro</span><span class="num">{{ d.retiro | dinero }}</span></div>
              }
            </section>
          </div>
        }
        @if (d.movimientos.length) {
          <section><h3 class="mb-1.5 text-base">Entradas y salidas</h3>
            <div class="tarjeta lista">
              @for (m of d.movimientos; track m.id) {
                <div class="renglon cursor-default hover:bg-transparent"><span class="t">{{ m.concepto }}</span><span class="d num" [class]="m.tipo === 'salida' ? 'text-bad' : 'text-ok'">{{ m.tipo === 'salida' ? '−' : '+' }}{{ m.monto | dinero }}</span>
                  <span class="m">{{ m.usuarioNombre }} · {{ hora(m.creadoEn) }}</span><span></span></div>
              }
            </div>
          </section>
        }
        <section><h3 class="mb-1.5 text-base">Cobros del turno</h3>
          <div class="tarjeta lista">
            @for (p of d.pagos; track p.id) {
              <div class="renglon cursor-default hover:bg-transparent"><span class="t">{{ p.cliente }}</span><span class="d num">{{ p.monto | dinero }}</span>
                <span class="m"><span class="num">{{ p.folio }}</span> · {{ p.metodo }} · {{ hora(p.creadoEn) }}</span><span></span></div>
            } @empty { <div class="vacio">Sin cobros en este turno.</div> }
          </div>
        </section>
        @if (d.notasApertura || d.notasCierre) {
          <p class="chico tenue">@if (d.notasApertura) { Apertura: {{ d.notasApertura }}. } @if (d.notasCierre) { Cierre: {{ d.notasCierre }} }</p>
        }
        <ng-container pie>
          @if (d.estado === 'cerrado') { <button class="btn" (click)="imprimirDetalle(d)"><app-icono nombre="imprimir" />Imprimir corte</button> }
          <span class="flex-1"></span><button class="btn pri" (click)="detalle.set(null)">Listo</button>
        </ng-container>
      </app-hoja>
    }
  `,
})
export class Cortes implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  turnos = signal<CajaTurno[]>([]);
  total = signal(0);
  pagina = signal(1);
  listo = signal(false);
  rango: Rango = { desde: '', hasta: '' };
  usuarioId: number | null = null;
  opsUsuarios = signal<{ valor: number; texto: string }[]>([]);
  detalle = signal<DetalleTurno | null>(null);

  async ngOnInit() {
    await this.cargar();
    if (this.s.gerencia()) {
      const us = await this.api.get<Usuario[]>('/usuarios').catch(() => [] as Usuario[]);
      this.opsUsuarios.set(us.map((u) => ({ valor: u.id, texto: u.nombre })));
    }
  }

  async cargar() {
    const p: Record<string, string> = { pagina: String(this.pagina()) };
    if (this.rango.desde) p['desde'] = this.rango.desde;
    if (this.rango.hasta) p['hasta'] = this.rango.hasta;
    if (this.usuarioId) p['usuarioId'] = String(this.usuarioId);
    try {
      const r = await this.api.get<{ items: CajaTurno[]; total: number }>('/caja/turnos', p);
      this.turnos.set(r.items);
      this.total.set(r.total);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.listo.set(true);
  }

  async ver(t: CajaTurno) {
    try { this.detalle.set(await this.api.get<DetalleTurno>(`/caja/turnos/${t.id}`)); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }
  async imprimir(t: CajaTurno) {
    try { imprimirCorte(await this.api.get<DetalleTurno>(`/caja/turnos/${t.id}`), this.s); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }
  imprimirDetalle(d: DetalleTurno) { imprimirCorte(d, this.s); }

  llaves(o: Record<string, number>) { return Object.keys(o); }
  sucursal(id: number) { return this.s.perfil()?.sucursales.find((x) => x.id === id)?.nombre ?? ''; }
  hora(d: string) { return new Date(d).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }); }
  fechaHora(d: string) { return new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
}
