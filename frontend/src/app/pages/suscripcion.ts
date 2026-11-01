import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, FechaPipe } from '../core/formato';
import { Taller } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { validarFormulario } from '../core/validar';
import { Esqueleto } from '../ui/esqueleto';
import { Icono } from '../ui/icono';

interface Plan { id: string; nombre: string; precioMensual: number; precioAnual: number; sucursales: number; usuarios: number; asistente: number; incluye: string[] }
interface Resumen {
  plan: string; estado: 'prueba' | 'activa' | string; vigente: boolean; vence: string | null; diasRestantes: number | null; pagosEnLinea: boolean;
  uso: { sucursales: { usadas: number; limite: number }; usuarios: { usados: number; limite: number }; asistente: { hoy: number; limite: number; mes: number } };
  totalPagado: number;
  pagos: { id: number; fecha: string; plan: string; periodo: string; monto: number; estado: string; pagadoHasta: string | null; folio: string | null }[];
  planes: Plan[];
}

/** Régimenes fiscales del SAT más comunes para talleres. */
const REGIMENES = [
  ['626', 'Régimen Simplificado de Confianza (RESICO)'],
  ['612', 'Personas Físicas con Actividades Empresariales'],
  ['601', 'General de Ley Personas Morales'],
  ['621', 'Incorporación Fiscal'],
  ['605', 'Sueldos y Salarios'],
  ['616', 'Sin obligaciones fiscales'],
];

@Component({
  selector: 'app-suscripcion',
  imports: [FormsModule, DineroPipe, FechaPipe, Esqueleto, Icono],
  template: `
    <div class="encabezado"><div class="titulo"><span class="icono-modulo"><app-icono nombre="rayo" /></span><div><h1>Mi suscripción</h1><p>Tu plan, lo que llevas usado, tus pagos y tus datos de facturación.</p></div></div></div>
    @if (r(); as r) {
      <div class="rejilla max-w-[980px]">
        <section class="caja">
          <div class="fila entre flex-wrap gap-3">
            <div>
              <p class="tenue chico">Plan actual</p>
              <p class="text-2xl font-extrabold">{{ r.estado === 'prueba' ? 'Prueba gratis' : nombrePlan(r.plan) }}
                <span class="pill align-middle" [class]="r.vigente ? (r.estado === 'prueba' ? 'sec' : 'ok') : 'bad'">{{ r.vigente ? (r.estado === 'prueba' ? 'En prueba' : 'Activo') : 'Vencido' }}</span></p>
            </div>
            @if (r.vence) {
              <div class="text-right">
                <p class="tenue chico">{{ r.vigente ? (r.estado === 'prueba' ? 'La prueba termina el' : 'Se renueva el') : 'Venció el' }}</p>
                <p class="text-lg font-bold">{{ r.vence | fecha }}</p>
                @if (r.vigente && r.diasRestantes !== null) { <p class="chico" [class]="r.diasRestantes <= 3 ? 'text-warn font-semibold' : 'tenue'">{{ r.diasRestantes === 0 ? 'Termina hoy' : 'Te quedan ' + r.diasRestantes + (r.diasRestantes === 1 ? ' día' : ' días') }}</p> }
              </div>
            }
          </div>
          @if (r.vigente && r.diasRestantes !== null && r.estado === 'prueba') {
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-superficie-2" role="progressbar" [attr.aria-valuenow]="r.diasRestantes" aria-valuemin="0" [attr.aria-valuemax]="14">
              <div class="h-full rounded-full bg-acento" [style.width.%]="100 - (r.diasRestantes / 14) * 100"></div>
            </div>
          }
        </section>

        <section class="caja">
          <h3>Lo que llevas usado</h3>
          <div class="grid gap-3 sm:grid-cols-3">
            @for (u of usos(); track u.t) {
              <div class="tarjeta pad">
                <p class="tenue chico">{{ u.t }}</p>
                <p class="num text-xl font-bold">{{ u.v }} <span class="tenue text-sm font-medium">de {{ u.l }}</span></p>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-superficie-2"><div class="h-full rounded-full" [class]="u.v >= u.l ? 'bg-bad' : 'bg-marca'" [style.width.%]="u.l ? Math.min(100, (u.v / u.l) * 100) : 0"></div></div>
                @if (u.n) { <p class="tenue chico mt-1.5">{{ u.n }}</p> }
              </div>
            }
          </div>
        </section>

        <section class="caja">
          <div class="fila entre flex-wrap gap-2">
            <h3>{{ r.estado === 'activa' ? 'Renovar o cambiar de plan' : 'Elige tu plan' }}</h3>
            <div class="chips"><button class="chip" [class.on]="!anual()" (click)="anual.set(false)">Mensual</button><button class="chip" [class.on]="anual()" (click)="anual.set(true)">Anual (2 meses gratis)</button></div>
          </div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            @for (p of r.planes; track p.id) {
              <div class="tarjeta pad flex flex-col gap-2" [class]="p.id === r.plan && r.estado === 'activa' ? 'border-2 border-marca' : ''">
                <div class="fila entre"><b class="text-lg">{{ p.nombre }}</b>@if (p.id === r.plan && r.estado === 'activa') { <span class="pill acc">Tu plan</span> }</div>
                <p><span class="num text-2xl font-extrabold">{{ (anual() ? p.precioAnual : p.precioMensual) | dinero }}</span> <span class="tenue chico">{{ anual() ? '/ año' : '/ mes' }}</span></p>
                <ul class="chico flex flex-col gap-1">
                  <li class="fila gap-1.5"><app-icono class="text-acento-2" nombre="ok" />{{ p.sucursales }} {{ p.sucursales === 1 ? 'sucursal' : 'sucursales' }} · {{ p.usuarios }} usuarios</li>
                  @for (x of p.incluye; track x) { <li class="fila gap-1.5"><app-icono class="text-acento-2" nombre="ok" />{{ x }}</li> }
                </ul>
                <button class="btn mt-auto" [class.pri]="!(p.id === r.plan && r.estado === 'activa')" (click)="pagar(p.id)" [disabled]="!!pagando()" [attr.aria-busy]="pagando() === p.id">
                  @if (pagando() === p.id) { <span class="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>Abriendo Mercado Pago… }
                  @else { {{ p.id === r.plan && r.estado === 'activa' ? 'Renovar' : 'Elegir ' + p.nombre }} }
                </button>
              </div>
            }
          </div>
          <p class="tenue chico">
            @if (r.pagosEnLinea) { Pagas en Mercado Pago con tarjeta, OXXO o transferencia SPEI. El plan se activa en cuanto se acredita el pago y los días que te quedaban se suman. }
            @else { Modo demostración: el plan se activa sin cobrar. }
          </p>
        </section>

        <section class="caja">
          <div class="fila entre"><h3>Tus pagos</h3>@if (r.totalPagado) { <span class="chico tenue">Total pagado <b class="num text-tinta">{{ r.totalPagado | dinero }}</b></span> }</div>
          @if (r.pagos.length) {
            <div class="overflow-x-auto">
              <table class="w-full min-w-[640px] text-sm">
                <thead><tr class="border-b border-linea text-left text-xs font-semibold tracking-[.06em] text-tenue uppercase"><th class="py-2.5 pr-3">Fecha</th><th class="px-3 py-2.5">Plan</th><th class="px-3 py-2.5 text-right">Monto</th><th class="px-3 py-2.5">Estado</th><th class="px-3 py-2.5">Cubre hasta</th><th class="py-2.5 pl-3">Folio Mercado Pago</th></tr></thead>
                <tbody>
                  @for (p of r.pagos; track p.id) {
                    <tr class="border-b border-linea last:border-0">
                      <td class="py-2.5 pr-3">{{ p.fecha | fecha }}</td>
                      <td class="px-3 py-2.5">{{ nombrePlan(p.plan) }} · {{ p.periodo }}</td>
                      <td class="px-3 py-2.5 num text-right">{{ p.monto | dinero }}</td>
                      <td><span class="px-3 py-2.5 pill" [class]="p.estado === 'aprobado' ? 'ok' : 'bad'">{{ p.estado === 'aprobado' ? 'Pagado' : 'Rechazado' }}</span></td>
                      <td class="px-3 py-2.5">{{ p.pagadoHasta ? (p.pagadoHasta | fecha) : '—' }}</td>
                      <td class="num py-2.5 pl-3 chico">{{ p.folio ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else { <p class="tenue chico">Todavía no hay pagos. Cuando pagues un plan, aquí aparece cada pago con su folio de Mercado Pago.</p> }
        </section>

        @if (t(); as t) {
          <form class="caja" (submit)="$event.preventDefault()">
            <h3>Datos de facturación</h3>
            <p class="tenue chico">Con estos datos emitimos la factura (CFDI) de tu suscripción. Déjalos vacíos si no necesitas factura.</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="campo"><label for="f-rfc">RFC</label><input id="f-rfc" class="entrada uppercase" name="rfc" maxlength="13" autocomplete="off" [(ngModel)]="t.rfc" (ngModelChange)="t.rfc = $event.toUpperCase().trim()"></div>
              <div class="campo"><label for="f-rs">Razón social o nombre</label><input id="f-rs" class="entrada" name="rs" maxlength="200" [(ngModel)]="t.razonSocial"></div>
              <div class="campo"><label for="f-reg">Régimen fiscal</label>
                <select id="f-reg" class="entrada" name="reg" [(ngModel)]="t.regimenFiscal"><option value="">Selecciona…</option>@for (x of regimenes; track x[0]) { <option [value]="x[0]">{{ x[0] }} · {{ x[1] }}</option> }</select></div>
              <div class="campo"><label for="f-cp">Código postal fiscal</label><input id="f-cp" class="entrada" name="cp" inputmode="numeric" maxlength="5" [(ngModel)]="t.cpFiscal"></div>
              <div class="campo sm:col-span-2"><label for="f-cf">Correo para recibir facturas</label><input id="f-cf" class="entrada" name="cf" type="email" maxlength="120" [placeholder]="s.perfil()?.usuario?.email ?? ''" [(ngModel)]="t.correoFacturas"></div>
            </div>
            <div><button class="btn pri" sin-validar (click)="guardarFiscales(t)" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar datos de facturación' }}</button></div>
          </form>
        }
      </div>
    } @else { <app-esqueleto tipo="formulario" [filas]="4" /> }
  `,
})
export class Suscripcion implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  protected Math = Math;
  regimenes = REGIMENES;
  r = signal<Resumen | null>(null);
  t = signal<(Taller & { rfc: string; razonSocial: string; regimenFiscal: string; cpFiscal: string; correoFacturas: string }) | null>(null);
  anual = signal(false);
  pagando = signal<string | null>(null);
  guardando = signal(false);

  usos = computed(() => {
    const u = this.r()?.uso;
    if (!u) return [];
    return [
      { t: 'Sucursales activas', v: u.sucursales.usadas, l: u.sucursales.limite, n: '' },
      { t: 'Usuarios activos', v: u.usuarios.usados, l: u.usuarios.limite, n: '' },
      { t: 'Preguntas a la IA hoy', v: u.asistente.hoy, l: u.asistente.limite, n: `${u.asistente.mes} en el mes. Se renueva cada día.` },
    ];
  });

  async ngOnInit() {
    // Si regresa con Atrás desde Mercado Pago, los botones vuelven a estar disponibles.
    addEventListener('pageshow', (e) => { if (e.persisted) this.pagando.set(null); });
    await this.regresoDePago();
    await this.cargar();
  }

  private async cargar() {
    const [r, t] = await Promise.all([this.api.get<Resumen>('/taller/suscripcion'), this.api.get<NonNullable<ReturnType<typeof this.t>>>('/taller')]);
    this.r.set(r);
    this.t.set(t);
  }

  nombrePlan(id: string) { return this.r()?.planes.find((p) => p.id === id)?.nombre ?? id; }

  async pagar(plan: string) {
    if (this.pagando()) return;
    this.pagando.set(plan);
    try {
      const r = await this.api.post<{ url?: string }>('/taller/suscripcion', { plan, periodo: this.anual() ? 'anual' : 'mensual' });
      // Se queda bloqueado mientras el navegador abre Mercado Pago.
      if (r?.url) { location.href = r.url; return; }
      await this.s.cargar();
      await this.cargar();
      this.aviso.ok('Plan activado');
      this.pagando.set(null);
    } catch (e) { this.aviso.error(mensajeError(e)); this.pagando.set(null); }
  }

  /** Al volver de Mercado Pago llega ?pago=ID&payment_id=...&status=... */
  private async regresoDePago() {
    const q = new URLSearchParams(location.search);
    const pagoId = Number(q.get('pago'));
    if (!pagoId) return;
    history.replaceState(null, '', location.pathname);
    const mpPagoId = q.get('payment_id') ?? q.get('collection_id') ?? undefined;
    const estado = q.get('status') ?? q.get('collection_status');
    try {
      const r = await this.api.post<{ estado: string }>('/taller/suscripcion/confirmar', { pagoId, mpPagoId: mpPagoId && mpPagoId !== 'null' ? mpPagoId : undefined });
      if (r.estado === 'aprobado') {
        await this.s.cargar();
        this.aviso.ok('¡Gracias! Tu plan quedó activo');
      } else if (r.estado === 'rechazado' || estado === 'rejected') this.aviso.error('El pago no se completó. Puedes intentarlo de nuevo con otra forma de pago.');
      else this.aviso.ok('Tu pago está en proceso. Si pagaste en OXXO o SPEI, el plan se activa en cuanto se acredite.');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }

  async guardarFiscales(t: NonNullable<ReturnType<typeof this.t>>) {
    const form = document.querySelector('form.caja') as HTMLFormElement | null;
    if (form && !validarFormulario(form)) return;
    this.guardando.set(true);
    try {
      await this.api.patch('/taller', { rfc: t.rfc, razonSocial: t.razonSocial.trim(), regimenFiscal: t.regimenFiscal, cpFiscal: t.cpFiscal.trim(), correoFacturas: t.correoFacturas.trim() });
      this.aviso.ok('Datos de facturación guardados');
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.guardando.set(false); }
  }
}
