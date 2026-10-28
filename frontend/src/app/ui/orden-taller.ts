import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { FechaPipe } from '../core/formato';
import { EtapaTaller, ETAPAS, Maquina, OrdenTaller, RenglonTaller } from '../core/modelos';
import { FotosPedido } from './fotos-pedido';
import { Hoja } from './hoja';
import { Icono } from './icono';

/** Detalle de un pedido en el taller: etapa, máquina, responsable, prioridad y avance de cada renglón. */
@Component({
  selector: 'app-orden-taller',
  imports: [FormsModule, Hoja, Icono, FechaPipe, FotosPedido],
  template: `
    @let o = orden();
    <app-hoja [titulo]="o.folio + ' · ' + cliente()" ancho="620px" (cerrar)="cerrar.emit()">
      @if (o.urgente) { <span cabeza class="pill bad">Urgente</span> }

      <div class="flex flex-col gap-1.5">
        <p class="chico font-semibold tenue">Etapa</p>
        <div class="chips" role="radiogroup" aria-label="Etapa">
          @for (e of etapas; track e) {
            <button type="button" role="radio" class="chip" [class.on]="o.etapa === e" [attr.aria-checked]="o.etapa === e" (click)="cambiar({ etapa: e })" [disabled]="ocupado()">{{ nombre[e].nombre }}</button>
          }
        </div>
      </div>

      <div class="campos">
        <div class="campo"><label for="ot-m">Máquina</label>
          <select id="ot-m" [ngModel]="o.maquinaId" (ngModelChange)="cambiar({ maquinaId: $event })">
            <option [ngValue]="null">Sin asignar</option>
            @for (m of maquinas(); track m.id) { @if (m.activa || m.id === o.maquinaId) { <option [ngValue]="m.id">{{ m.nombre }}</option> } }
          </select></div>
        <div class="campo"><label for="ot-r">Responsable</label>
          <select id="ot-r" [ngModel]="o.responsableId" (ngModelChange)="cambiar({ responsableId: $event })">
            <option [ngValue]="null">Sin asignar</option>
            @for (u of equipo(); track u.id) { <option [ngValue]="u.id">{{ u.nombre }}</option> }
          </select></div>
        <label class="fila todo cursor-pointer"><input type="checkbox" [ngModel]="o.urgente" (ngModelChange)="cambiar({ urgente: $event })"> Urgente: va primero en su columna</label>
      </div>

      <section>
        <div class="mb-1.5 flex items-baseline justify-between gap-2"><h3 class="text-base">Avance</h3>
          <span class="chico tenue num">{{ o.hechas }} de {{ o.piezas }} piezas · Entrega {{ o.entrega ? (o.entrega | fecha) : 'sin fecha' }}</span></div>
        <div class="tarjeta lista">
          @for (i of o.items; track i.id) {
            <div class="flex items-center gap-3 px-3.5 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="leading-snug">{{ i.descripcion }}</p>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-superficie-2"><div class="h-full rounded-full bg-acento transition-[width]" [style.width.%]="i.cantidad ? i.hechos / i.cantidad * 100 : 0"></div></div>
              </div>
              <div class="flex flex-none items-center gap-1">
                <button type="button" class="ico" (click)="avance(i, i.hechos - 1)" [disabled]="i.hechos <= 0" aria-label="Una pieza menos">−</button>
                <span class="num min-w-14 text-center font-semibold">{{ i.hechos }}/{{ i.cantidad }}</span>
                <button type="button" class="ico" (click)="avance(i, i.hechos + 1)" [disabled]="i.hechos >= i.cantidad" aria-label="Una pieza más">+</button>
                <button type="button" class="btn sm ml-1" (click)="avance(i, i.cantidad)" [disabled]="i.hechos >= i.cantidad">Todo</button>
              </div>
            </div>
          }
        </div>
      </section>
      <app-fotos-pedido [ventaId]="o.id" [folio]="o.folio" />
      @if (o.notas) { <section class="rounded-xl border border-linea bg-superficie p-3"><p class="chico mb-0.5 font-semibold tenue">Notas del pedido</p><p class="whitespace-pre-line">{{ o.notas }}</p></section> }

      <ng-container pie>
        <button class="btn" (click)="verOrden.emit()"><app-icono nombre="ojo" />Ver orden</button>
        <span class="flex-1"></span>
        @if (siguiente(); as sg) { <button class="btn pri" sin-validar (click)="cambiar({ etapa: sg[0] })" [disabled]="ocupado()">{{ sg[1] }}<app-icono nombre="der" /></button> }
        @else { <button class="btn pri" sin-validar (click)="cerrar.emit()">Listo</button> }
      </ng-container>
    </app-hoja>
  `,
})
export class OrdenTallerVentana {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  orden = input.required<OrdenTaller>();
  maquinas = input<Maquina[]>([]);
  equipo = input<{ id: number; nombre: string }[]>([]);
  cerrar = output();
  verOrden = output();
  /** Algo cambió: el tablero debe actualizar la tarjeta (y avisar si quedó lista). */
  cambio = output<{ orden: OrdenTaller; antes: EtapaTaller }>();

  etapas = Object.keys(ETAPAS) as EtapaTaller[];
  nombre = ETAPAS;
  ocupado = signal(false);
  cliente = computed(() => this.orden().cliente?.nombre || this.orden().clienteNombre || 'Mostrador');
  siguiente = computed(() => ETAPAS[this.orden().etapa].siguiente);

  async cambiar(c: Partial<Pick<OrdenTaller, 'etapa' | 'maquinaId' | 'responsableId' | 'urgente'>>) {
    const o = this.orden();
    this.ocupado.set(true);
    try {
      await this.api.patch(`/produccion/${o.id}`, c);
      this.cambio.emit({ orden: { ...o, ...c }, antes: o.etapa });
    } catch (e) { this.aviso.error(mensajeError(e)); }
    this.ocupado.set(false);
  }

  async avance(i: RenglonTaller, n: number) {
    const o = this.orden();
    const hechos = Math.max(0, Math.min(i.cantidad, n));
    try {
      await this.api.patch(`/produccion/${o.id}/items/${i.id}`, { hechos });
      const items = o.items.map((x) => (x.id === i.id ? { ...x, hechos } : x));
      const minutos = Math.round(items.reduce((a, x) => a + x.minutosPieza * (x.cantidad - x.hechos), 0) * 100) / 100;
      this.cambio.emit({ orden: { ...o, items, minutos, hechas: items.reduce((a, x) => a + x.hechos, 0) }, antes: o.etapa });
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
