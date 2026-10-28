import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { dinero, fecha, hoy } from '../core/formato';
import { Cliente, Cotizacion, Promocion, Venta } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Hoja } from './hoja';
import { Icono } from './icono';

interface Plantilla { id: string; titulo: string; detalle: string; texto: string }

/** Nombre sin la marca "(ejemplo)" de los datos de muestra. */
const limpio = (s: string) => s.replace(/\s*\(ejemplo\)\s*$/i, '').trim();

/**
 * Mensaje de WhatsApp para un cliente: propone textos según lo que tiene pendiente
 * (pedido listo, saldo, cotización enviada, promoción vigente). El texto se puede editar antes de abrir WhatsApp.
 */
@Component({
  selector: 'app-whatsapp-cliente',
  imports: [FormsModule, Hoja, Icono],
  template: `
    <app-hoja [titulo]="'WhatsApp a ' + nombre()" ancho="600px" (cerrar)="cerrar.emit()">
      @if (cargando()) { <p class="tenue">Revisando pedidos y cotizaciones…</p> }
      @else {
        <div class="flex flex-col gap-1.5" role="radiogroup" aria-label="Tipo de mensaje">
          @for (p of plantillas(); track p.id) {
            <button type="button" role="radio" [attr.aria-checked]="elegida() === p.id"
              class="flex items-start gap-3 rounded-xl border bg-superficie p-3 text-left"
              [class]="elegida() === p.id ? 'border-marca ring-1 ring-marca' : 'border-linea hover:border-tenue'" (click)="elegir(p)">
              <span class="mt-0.5 grid size-4 flex-none place-items-center rounded-full border-2" [class]="elegida() === p.id ? 'border-marca' : 'border-linea'">
                @if (elegida() === p.id) { <span class="size-2 rounded-full bg-marca"></span> }
              </span>
              <span class="min-w-0"><b class="block text-[.95rem]">{{ p.titulo }}</b><span class="block text-[.84rem] text-tenue">{{ p.detalle }}</span></span>
            </button>
          }
        </div>
        <div class="campo"><label for="wa-t">Mensaje (puedes editarlo)</label><textarea id="wa-t" rows="5" [(ngModel)]="texto"></textarea></div>
        @if (!telefono()) { <p class="text-bad chico">Este cliente no tiene WhatsApp registrado. Agrégalo en su ficha.</p> }
      }
      <ng-container pie>
        <span class="tenue chico self-center">{{ cliente().telefono }}</span>
        <span class="flex-1"></span>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button>
        <a class="btn wa" target="_blank" rel="noopener" [class.pointer-events-none]="!telefono() || !texto.trim()" [class.opacity-55]="!telefono() || !texto.trim()"
          [href]="enlace()" (click)="cerrar.emit()"><app-icono nombre="wa" />Abrir WhatsApp</a>
      </ng-container>
    </app-hoja>
  `,
})
export class WhatsappCliente implements OnInit {
  private api = inject(Api);
  private s = inject(SesionService);
  cliente = input.required<Cliente>();
  cerrar = output();

  cargando = signal(true);
  plantillas = signal<Plantilla[]>([]);
  elegida = signal('');
  texto = '';
  nombre = computed(() => limpio(this.cliente().nombre));
  telefono = computed(() => {
    let t = (this.cliente().telefono ?? '').replace(/\D/g, '');
    if (t.length === 10) t = (this.s.taller()?.lada ?? '') + t;
    return t;
  });

  enlace() { return `https://wa.me/${this.telefono()}?text=${encodeURIComponent(this.texto)}`; }
  elegir(p: Plantilla) { this.elegida.set(p.id); this.texto = p.texto; }

  async ngOnInit() {
    const c = this.cliente();
    const id = String(c.id);
    const [ventas, cots, promos] = await Promise.all([
      this.api.get<Venta[]>('/ventas', { clienteId: id, estado: 'pendiente,produccion,lista,entregada' }).catch(() => [] as Venta[]),
      this.api.get<Cotizacion[]>('/cotizaciones', { clienteId: id, estado: 'enviada,borrador' }).catch(() => [] as Cotizacion[]),
      this.api.get<Promocion[]>('/promociones').catch(() => [] as Promocion[]),
    ]);
    const taller = limpio(this.s.taller()?.nombre ?? '');
    const m = this.s.taller()?.moneda ?? '$';
    const hola = `Hola ${this.nombre()}`;
    const pdf = (t?: string) => (t ? `\n\nAquí puedes verla: ${location.origin}/api/publico/documentos/${t}.pdf` : '');
    const ps: Plantilla[] = [];

    const listas = ventas.filter((v) => v.estado === 'lista');
    if (listas.length) {
      const v = listas[0];
      ps.push({
        id: 'lista', titulo: 'Pedido listo para recoger', detalle: `${v.folio}${v.saldo > 0 ? ` · saldo ${dinero(v.saldo, m)}` : ''}`,
        texto: `${hola}, tu pedido ${v.folio} ya está listo para recoger en ${taller}.${v.saldo > 0 ? ` Queda un saldo de ${dinero(v.saldo, m)}.` : ''} ¡Te esperamos!`,
      });
    }
    const conSaldo = ventas.filter((v) => v.saldo > 0);
    if (conSaldo.length) {
      const total = conSaldo.reduce((a, v) => a + v.saldo, 0);
      const folios = conSaldo.map((v) => v.folio).join(', ');
      ps.push({
        id: 'saldo', titulo: 'Recordatorio de saldo pendiente', detalle: `${dinero(total, m)} en ${folios}`,
        texto: `${hola}, te escribimos de ${taller}. Te recordamos que tienes un saldo pendiente de ${dinero(total, m)} (${folios}). Puedes pagarlo en tienda o por transferencia. ¡Gracias!`,
      });
    }
    if (cots.length) {
      const q = cots[0];
      ps.push({
        id: 'cotizacion', titulo: 'Seguimiento de cotización', detalle: `${q.folio} · ${dinero(q.total, m)} · ${fecha(q.fecha)}`,
        texto: `${hola}, ¿pudiste revisar la cotización ${q.folio} por ${dinero(q.total, m)}? Si quieres ajustar algo o confirmar tu pedido, aquí estamos.${pdf(q.tokenPublico)}`,
      });
    }
    const h = hoy();
    const promo = promos.find((p) => p.activa && (!p.inicio || p.inicio <= h) && (!p.fin || p.fin >= h));
    if (promo) {
      const desc = promo.tipo === 'pct' ? `${promo.valor}%` : dinero(promo.valor, m);
      const nom = limpio(promo.nombre);
      ps.push({
        id: 'promo', titulo: `Promoción: ${nom}`, detalle: `${desc} de descuento${promo.fin ? ' hasta el ' + fecha(promo.fin) : ''}`,
        texto: promo.mensaje?.trim()
          ? promo.mensaje.replace(/\{cliente\}/g, this.nombre())
          : `${hola}, en ${taller} tenemos la promoción "${nom}": ${desc} de descuento${promo.fin ? ' hasta el ' + fecha(promo.fin) : ''}. ¿Te cotizo algo?`,
      });
    }
    ps.push({ id: 'saludo', titulo: 'Mensaje libre', detalle: 'Solo el saludo, tú escribes el resto', texto: `${hola}, te escribimos de ${taller}. ` });

    this.plantillas.set(ps);
    this.elegir(ps[0]);
    this.cargando.set(false);
  }
}
