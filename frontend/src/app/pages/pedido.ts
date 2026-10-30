import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { dinero, fecha, sumarDias } from '../core/formato';
import { FotoLista, FotosService } from '../core/fotos.service';
import { EtapaTaller } from '../core/modelos';
import { Icono } from '../ui/icono';
import { Logo } from '../ui/logo';
import { FotoVisor, VisorFotos } from '../ui/visor-fotos';

interface DisenoCliente {
  id: number; version: number; estado: 'pendiente' | 'aprobado' | 'cambios'; nota: string | null; respuesta: string | null;
  respondidoPor: string | null; via: string | null; respondidoEn: string | null; creadoEn: string; ancho: number; alto: number; url: string; mini: string;
}
interface PedidoCliente {
  tipo: 'venta' | 'cotizacion'; folio: string; fecha: string; estado: string; etapa: EtapaTaller | null; entrega: string | null; vigenciaDias: number | null;
  cliente: string; taller: { nombre: string; moneda: string; lada: string };
  sucursal: { nombre: string; direccion: string; telefono: string; condiciones: string | null } | null;
  items: { descripcion: string; cantidad: number; precio: number }[];
  subtotal: number; descuento: number; total: number; pagado: number; saldo: number;
  anticipo: { pct: number; monto: number; texto: string } | null;
  transferencia: [string, string][]; indicacionesPago: string | null; puedeSubirComprobante: boolean; pdf: string;
  disenos: DisenoCliente[];
  fotos: { id: number; ancho: number; alto: number; url: string; mini: string }[];
  comprobantes: { id: number; estado: 'pendiente' | 'aplicado' | 'descartado'; monto: number; creadoEn: string }[];
}

const PASOS = ['Recibido', 'Diseño', 'En producción', 'Listo', 'Entregado'];
const cuando = (f: string) => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
const VIA: Record<string, string> = { enlace: 'en este enlace', whatsapp: 'por WhatsApp', mostrador: 'en el taller' };
const COMPROBANTE: Record<string, [string, string]> = { pendiente: ['En revisión', 'warn'], aplicado: ['Pago recibido', 'ok'], descartado: ['No válido', 'mut'] };

/**
 * Página del cliente (sin sesión) a la que llega desde WhatsApp: su nota o cotización, el avance,
 * el diseño para aprobar, las fotos del trabajo terminado y el comprobante de su transferencia.
 */
@Component({
  selector: 'app-pedido',
  imports: [FormsModule, Icono, Logo, VisorFotos],
  host: { class: 'block min-h-dvh bg-fondo' },
  template: `
    <main class="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-10 pt-5 sm:pt-8">
      @if (error()) {
        <div class="caja mt-10 items-center text-center">
          <h1 class="text-xl">No encontramos este pedido</h1>
          <p class="tenue">Revisa que el enlace esté completo o pídele uno nuevo al taller.</p>
        </div>
      } @else if (!p()) {
        <div class="h-24 animate-pulse rounded-xl bg-superficie-2"></div>
        <div class="h-72 animate-pulse rounded-xl bg-superficie-2"></div>
      } @else {
        @let d = p()!;
        <header class="flex flex-col gap-1">
          <p class="font-semibold text-marca">{{ d.taller.nombre }}</p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 class="text-2xl">{{ esVenta() ? 'Pedido' : 'Cotización' }} {{ d.folio }}</h1>
            <span class="pill" [class]="estado()[1]">{{ estado()[0] }}</span>
          </div>
          <p class="tenue">@if (d.cliente) { {{ d.cliente }} · }{{ esVenta() ? 'Pedido el' : 'Hecha el' }} {{ fecha(d.fecha) }}
            @if (d.entrega && esVenta()) { · Entrega {{ fecha(d.entrega) }} }
            @if (!esVenta()) { · Válida hasta {{ fecha(vence()) }} }</p>
        </header>

        <!-- Diseño por aprobar: lo primero que tiene que ver -->
        @if (porAprobar(); as x) {
          <section class="caja border-2 border-marca">
            <div class="flex items-baseline justify-between gap-2"><h2 class="text-lg">Revisa tu diseño</h2>@if (x.version > 1) { <span class="chico tenue">Versión {{ x.version }}</span> }</div>
            <button type="button" class="block overflow-hidden rounded-lg bg-white" (click)="verDiseno(x)" aria-label="Ver el diseño en grande">
              <img [src]="x.url" alt="Diseño para aprobar" class="max-h-[60vh] w-full object-contain"></button>
            @if (x.nota) { <p class="whitespace-pre-line">{{ x.nota }}</p> }
            <p class="chico tenue">Revisa nombres, fechas, ortografía, tamaño y posición. Lo producimos tal como lo apruebes.</p>
            @if (modo() === 'cambios') {
              <div class="campo"><label for="pc-c">¿Qué hay que cambiar?</label>
                <textarea id="pc-c" rows="3" maxlength="1000" [(ngModel)]="comentario" placeholder="Ej. El nombre va con acento: María. La fecha más pequeña."></textarea></div>
            } @else {
              <label class="fila cursor-pointer items-start"><input type="checkbox" class="mt-1" [(ngModel)]="revisado"> <span>Lo revisé y está correcto</span></label>
            }
            <div class="campo"><label for="pc-n">Tu nombre</label><input id="pc-n" maxlength="120" [(ngModel)]="nombre" autocomplete="name"></div>
            @if (modo() === 'cambios') {
              <div class="grid grid-cols-2 gap-2">
                <button type="button" class="btn justify-center" (click)="modo.set('aprobar')" [disabled]="ocupado()">Volver</button>
                <button type="button" class="btn pri justify-center" (click)="responder(x, false)" [disabled]="ocupado() || comentario.trim().length < 3 || nombre.trim().length < 2">Enviar cambios</button>
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-2">
                <button type="button" class="btn justify-center" (click)="modo.set('cambios')" [disabled]="ocupado()">Pedir cambios</button>
                <button type="button" class="btn pri justify-center" (click)="responder(x, true)" [disabled]="ocupado() || !revisado || nombre.trim().length < 2"><app-icono nombre="ok" />Aprobar diseño</button>
              </div>
            }
          </section>
        }

        @if (esVenta()) {
          @if (d.estado === 'cancelada') {
            <p class="caja bg-bad-suave">Este pedido se canceló. Si tienes dudas, escríbenos.</p>
          } @else {
            <section class="caja" aria-label="Avance del pedido">
              <ol class="grid grid-cols-5 gap-1">
                @for (t of pasos; track t; let i = $index) {
                  <li class="flex flex-col items-center gap-1.5 text-center">
                    <span class="grid size-8 place-items-center rounded-full text-sm font-bold"
                      [class]="i < paso() ? 'bg-acento text-white' : i === paso() ? 'bg-marca text-white ring-4 ring-marca-suave' : 'bg-superficie-2 text-tenue'">
                      @if (i < paso()) { <app-icono nombre="ok" class="size-4" /> } @else { {{ i + 1 }} }</span>
                    <span class="text-xs leading-tight" [class]="i === paso() ? 'font-bold' : 'tenue'">{{ t }}</span>
                  </li>
                }
              </ol>
              <p class="text-center">{{ mensaje() }}</p>
            </section>
          }
        }

        @if (cambiosPedidos(); as x) {
          <section class="caja">
            <h2 class="text-lg">Pediste cambios al diseño</h2>
            <p class="whitespace-pre-line">“{{ x.respuesta }}”</p>
            <p class="chico tenue">Te mandaremos una nueva versión para que la revises.</p>
          </section>
        }

        @if (aprobado(); as x) {
          <section class="caja">
            <div class="flex items-center gap-3">
              <button type="button" class="size-20 flex-none overflow-hidden rounded-lg bg-white" (click)="verDiseno(x)" aria-label="Ver el diseño aprobado"><img [src]="x.mini" alt="Diseño aprobado" class="size-full object-contain"></button>
              <div><h2 class="text-base">Diseño aprobado</h2>
                <p class="chico tenue">Por {{ x.respondidoPor }} {{ via[x.via ?? ''] }} el {{ cuando(x.respondidoEn!) }}</p></div>
            </div>
          </section>
        }

        @if (d.fotos.length) {
          <section class="flex flex-col gap-2">
            <h2 class="text-lg">Así quedó tu pedido</h2>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              @for (f of d.fotos; track f.id; let i = $index) {
                <button type="button" class="aspect-square overflow-hidden rounded-xl bg-superficie-2" (click)="verFoto(i)" [attr.aria-label]="'Ver foto ' + (i + 1)">
                  <img [src]="f.mini" [alt]="'Foto ' + (i + 1) + ' del trabajo'" class="size-full object-cover" loading="lazy"></button>
              }
            </div>
          </section>
        }

        <section class="flex flex-col gap-2">
          <h2 class="text-lg">{{ esVenta() ? 'Tu nota' : 'Conceptos' }}</h2>
          <div class="tarjeta lista">
            @for (i of d.items; track $index) {
              <div class="flex items-start gap-3 px-3.5 py-2.5">
                <span class="num grid min-w-9 flex-none place-items-center rounded-lg bg-superficie-2 px-1.5 py-1 font-semibold">{{ +i.cantidad.toFixed(4) }}</span>
                <span class="min-w-0 flex-1 pt-0.5">{{ i.descripcion }}</span>
                <span class="pt-0.5 text-right"><span class="num block">{{ m(i.cantidad * i.precio) }}</span>
                  @if (i.cantidad !== 1) { <span class="num block text-sm text-tenue">{{ m(i.precio) }} c/u</span> }</span>
              </div>
            }
          </div>
          <div class="totales rounded-xl bg-superficie-2 p-3">
            @if (d.descuento) {
              <span class="k">Subtotal</span><span class="num text-right">{{ m(d.subtotal) }}</span>
              <span class="k">Descuento</span><span class="num text-right">−{{ m(d.descuento) }}</span>
            }
            <span class="k">Total</span><span class="num text-right font-semibold">{{ m(d.total) }}</span>
            @if (esVenta()) {
              @if (d.saldo > 0) {
                @if (d.pagado) { <span class="k">Pagado</span><span class="num text-right">{{ m(d.pagado) }}</span> }
                <span class="k">Saldo</span><span class="num text-right font-semibold">{{ m(d.saldo) }}</span>
              } @else if (d.estado !== 'cancelada') { <span class="k col-span-2 font-semibold text-ok">Pagado en su totalidad</span> }
            }
            @if (d.anticipo; as a) { <span class="k">{{ a.texto }} ({{ a.pct }}%)</span><span class="num text-right font-semibold text-marca">{{ m(a.monto) }}</span> }
          </div>
        </section>

        @if (!esVenta() && d.estado !== 'rechazada') {
          <section class="caja">
            @if (d.estado === 'aceptada') {
              <h2 class="text-lg">Cotización aceptada</h2>
              <p class="tenue">Gracias. Te contactamos para confirmar los detalles y empezar.</p>
            } @else {
              <h2 class="text-lg">¿Te late?</h2>
              <p class="chico tenue">Al aceptarla le avisamos al taller para preparar tu pedido.@if (d.anticipo) { Para iniciar se pide un anticipo del {{ d.anticipo.pct }}%. }</p>
              <div class="campo"><label for="pc-a">Tu nombre</label><input id="pc-a" maxlength="120" [(ngModel)]="nombre" autocomplete="name"></div>
              <button type="button" class="btn pri justify-center" (click)="aceptar()" [disabled]="ocupado() || nombre.trim().length < 2"><app-icono nombre="ok" />Aceptar cotización</button>
            }
          </section>
        }

        @if (d.transferencia.length || d.puedeSubirComprobante || d.comprobantes.length) {
          <section class="caja">
            <h2 class="text-lg">{{ d.transferencia.length ? 'Datos para transferencia o depósito' : 'Pagos' }}</h2>
            @if (!d.transferencia.length && d.puedeSubirComprobante) { <p class="chico tenue">Si ya hiciste una transferencia o depósito, manda aquí la foto o captura del comprobante.</p> }
            <div class="grid gap-x-5 gap-y-2 sm:grid-cols-2">
              @for (f of d.transferencia; track f[0]) {
                <div class="flex min-w-0 items-center gap-2">
                  <div class="min-w-0 flex-1"><p class="chico tenue">{{ f[0] }}</p><p class="truncate font-semibold" [class.num]="f[0] !== 'Banco' && f[0] !== 'Titular'">{{ f[1] }}</p></div>
                  @if (f[0] !== 'Banco') { <button type="button" class="btn sm flex-none" (click)="copiar(f[0], f[1])" [attr.aria-label]="'Copiar ' + f[0]">Copiar</button> }
                </div>
              }
            </div>
            @if (d.indicacionesPago) { <p class="chico whitespace-pre-line tenue">{{ d.indicacionesPago }}</p> }

            @if (d.puedeSubirComprobante) {
              <div [class]="d.transferencia.length ? 'mt-1 border-t border-linea pt-3' : ''">
                @if (comprobante(); as c) {
                  <div class="flex items-start gap-3">
                    <img [src]="c.miniatura" alt="Comprobante por enviar" class="size-20 flex-none rounded-lg bg-white object-cover">
                    <div class="campo flex-1"><label for="pc-m">¿Cuánto pagaste?</label>
                      <input id="pc-m" class="num" type="number" inputmode="decimal" min="0" [(ngModel)]="monto"></div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" class="btn justify-center" (click)="comprobante.set(null)" [disabled]="ocupado()">Cancelar</button>
                    <button type="button" class="btn pri justify-center" (click)="enviarComprobante()" [disabled]="ocupado()">{{ ocupado() ? 'Enviando…' : 'Enviar comprobante' }}</button>
                  </div>
                } @else {
                  <button type="button" class="btn w-full justify-center" (click)="elegir.click()"><app-icono nombre="camara" />Ya pagué: subir comprobante</button>
                }
                <input #elegir type="file" accept="image/*" class="hidden" (change)="prepararComprobante($event)" aria-label="Elegir comprobante">
              </div>
            }
            @for (c of d.comprobantes; track c.id) {
              <p class="chico flex items-center gap-2"><span class="pill" [class]="estadoComprobante[c.estado][1]">{{ estadoComprobante[c.estado][0] }}</span>
                Comprobante del {{ cuando(c.creadoEn) }}@if (c.monto) { · {{ m(c.monto) }} }</p>
            }
          </section>
        }

        @if (d.sucursal?.condiciones?.trim(); as c) {
          <section class="rounded-xl border border-linea bg-superficie p-3"><p class="chico mb-0.5 font-semibold tenue">Condiciones</p><p class="chico whitespace-pre-line">{{ c }}</p></section>
        }

        <div class="grid grid-cols-2 gap-2">
          <a class="btn justify-center" [href]="d.pdf" target="_blank" rel="noopener"><app-icono nombre="descargar" />{{ esVenta() ? 'Nota en PDF' : 'Cotización en PDF' }}</a>
          @if (whatsappTaller(); as w) { <a class="btn wa justify-center" [href]="w" target="_blank" rel="noopener"><app-icono nombre="wa" />Escríbenos</a> }
        </div>
        @if (d.sucursal; as s) {
          <p class="chico text-center tenue">{{ d.taller.nombre }}@if (s.nombre && s.nombre !== d.taller.nombre) { · {{ s.nombre }} }@if (s.direccion) { · {{ s.direccion }} }</p>
        }
        <a href="https://grabix.elikarsystems.com" target="_blank" rel="noopener" class="mx-auto mt-2 flex items-center gap-1.5 text-xs tenue">Hecho con <app-logo [tamano]="16" /></a>
      }
    </main>
    @if (visor(); as v) {
      <app-visor-fotos [fotos]="v.fotos" [indice]="v.indice" (indiceChange)="moverVisor($event)" (cerrar)="visor.set(null)" />
    }
  `,
})
export class Pedido implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private fotos = inject(FotosService);
  private ruta = inject(ActivatedRoute);
  private titulo = inject(Title);

  token = '';
  p = signal<PedidoCliente | null>(null);
  error = signal(false);
  ocupado = signal(false);
  modo = signal<'aprobar' | 'cambios'>('aprobar');
  comprobante = signal<FotoLista | null>(null);
  visor = signal<{ fotos: FotoVisor[]; indice: number } | null>(null);
  nombre = '';
  comentario = '';
  revisado = false;
  monto: number | null = null;
  pasos = PASOS;
  via = VIA;
  estadoComprobante = COMPROBANTE;
  fecha = fecha;
  cuando = cuando;

  esVenta = computed(() => this.p()?.tipo === 'venta');
  porAprobar = computed(() => this.p()?.disenos.find((x) => x.estado === 'pendiente') ?? null);
  /** Lo último que pasó con el diseño, si no hay uno esperando respuesta. */
  private ultimo = computed(() => (this.porAprobar() ? null : (this.p()?.disenos[0] ?? null)));
  aprobado = computed(() => (this.ultimo()?.estado === 'aprobado' ? this.ultimo() : null));
  cambiosPedidos = computed(() => (this.ultimo()?.estado === 'cambios' ? this.ultimo() : null));
  vence = computed(() => sumarDias(String(this.p()?.fecha ?? '').slice(0, 10), this.p()?.vigenciaDias ?? 15));

  paso = computed(() => {
    const d = this.p();
    if (!d) return 0;
    if (d.estado === 'entregada') return 4;
    if (d.estado === 'lista' || d.etapa === 'lista') return 3;
    if (d.etapa === 'diseno' || d.etapa === 'aprobacion') return 1;
    return 2;
  });
  mensaje = computed(() => {
    const d = this.p()!;
    if (this.porAprobar()) return 'Tu diseño está listo. Revísalo y apruébalo para empezar.';
    if (this.cambiosPedidos()) return 'Estamos ajustando tu diseño.';
    return [
      'Recibimos tu pedido.',
      d.etapa === 'aprobacion' ? 'Estamos por mandarte el diseño.' : 'Estamos preparando tu diseño.',
      d.etapa === 'cola' ? 'Tu pedido está en la fila del taller.' : 'Estamos trabajando en tu pedido.',
      'Tu pedido está listo. Ya puedes pasar por él.',
      'Pedido entregado. ¡Gracias por tu preferencia!',
    ][this.paso()];
  });
  estado = computed<[string, string]>(() => {
    const d = this.p()!;
    if (d.tipo === 'cotizacion') {
      if (d.estado === 'aceptada') return ['Aceptada', 'ok'];
      if (d.estado === 'rechazada') return ['No vigente', 'mut'];
      return this.vence() < new Date().toISOString().slice(0, 10) ? ['Vencida', 'warn'] : ['Por aceptar', 'acc'];
    }
    return ({ pendiente: ['En proceso', 'acc'], produccion: ['En producción', 'acc'], lista: ['Listo', 'ok'], entregada: ['Entregado', 'ok'], cancelada: ['Cancelado', 'bad'] } as Record<string, [string, string]>)[d.estado] ?? [d.estado, 'mut'];
  });
  whatsappTaller = computed(() => {
    const d = this.p();
    let tel = (d?.sucursal?.telefono ?? '').replace(/\D/g, '');
    if (!d || tel.length < 10) return null;
    if (tel.length === 10) tel = (d.taller.lada || '52') + tel;
    return `https://wa.me/${tel}?text=${encodeURIComponent(`Hola, te escribo por mi ${d.tipo === 'venta' ? 'pedido' : 'cotización'} ${d.folio}`)}`;
  });

  m(n: number) { return dinero(n, this.p()?.taller.moneda); }

  ngOnInit() {
    this.token = this.ruta.snapshot.paramMap.get('token') ?? '';
    void this.cargar(true);
  }

  private async cargar(primera = false) {
    try {
      const d = await this.api.get<PedidoCliente>(`/publico/pedido/${encodeURIComponent(this.token)}`);
      this.p.set(d);
      if (primera) {
        this.nombre = d.cliente;
        this.monto = d.anticipo?.monto ?? (d.saldo || null);
        this.titulo.setTitle(`${d.tipo === 'venta' ? 'Pedido' : 'Cotización'} ${d.folio} · ${d.taller.nombre}`);
      }
    } catch { if (primera) this.error.set(true); }
  }

  verDiseno(x: DisenoCliente) {
    this.visor.set({ fotos: [{ id: x.id, src: x.url, titulo: `Diseño ${this.p()!.folio}`, nota: x.nota }], indice: 0 });
  }
  verFoto(i: number) {
    this.visor.set({ fotos: this.p()!.fotos.map((f, k) => ({ id: f.id, src: f.url, titulo: `Foto ${k + 1} de ${this.p()!.fotos.length}` })), indice: i });
  }
  moverVisor(i: number) { this.visor.update((v) => (v ? { ...v, indice: i } : v)); }

  async responder(x: DisenoCliente, aprobado: boolean) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.api.post(`/publico/pedido/${this.token}/disenos/${x.id}/respuesta`, { aprobado, nombre: this.nombre.trim(), comentario: this.comentario.trim() });
      this.aviso.ok(aprobado ? '¡Gracias! Tu diseño quedó aprobado y pasa a producción.' : 'Gracias. Le pasamos tus cambios al taller.');
      this.comentario = '';
      this.revisado = false;
      this.modo.set('aprobar');
      await this.cargar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  async aceptar() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.api.post(`/publico/pedido/${this.token}/aceptar`, { nombre: this.nombre.trim() });
      this.aviso.ok('¡Gracias! Le avisamos al taller.');
      await this.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  async copiar(k: string, v: string) {
    const valor = k === 'Titular' ? v : v.replace(/\s/g, '');
    try {
      await navigator.clipboard.writeText(valor);
      this.aviso.ok(`${k} copiado`);
    } catch { this.aviso.info(valor, k); }
  }

  async prepararComprobante(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const a = el.files?.[0];
    el.value = '';
    if (!a) return;
    try { this.comprobante.set(await this.fotos.preparar(a)); }
    catch (e) { this.aviso.error(e instanceof Error ? e.message : mensajeError(e)); }
  }

  async enviarComprobante() {
    const c = this.comprobante();
    if (!c || this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.api.post(`/publico/pedido/${this.token}/comprobantes`, { ...c, monto: Number(this.monto) || 0 });
      this.comprobante.set(null);
      this.aviso.ok('Recibimos tu comprobante. El taller lo confirma en cuanto vea el depósito.');
      await this.cargar();
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }
}
