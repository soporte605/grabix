import { Esqueleto } from '../ui/esqueleto';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe, fecha, FechaPipe, hoy, sumarDias } from '../core/formato';
import { Cliente, Promocion } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { ConfirmarService } from '../core/confirmar.service';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

@Component({
  selector: 'app-promociones',
  imports: [FormsModule, DineroPipe, FechaPipe, Hoja, Icono, Confirmar, Esqueleto],
  template: `
    <div class="encabezado">
      <div><h1>Promociones</h1><p>Descuentos para tus cotizaciones y ventas, listos para mandar por WhatsApp.</p></div>
      @if (s.verCostos()) { <button class="btn pri" (click)="abrir()"><app-icono nombre="mas1" />Nueva promoción</button> }
    </div>
    <div class="tarjeta lista">
      @if (!listo()) { <app-esqueleto /> } @else {
      @for (p of promos(); track p.id) {
        <div class="con-acciones">
          <button class="renglon" (click)="abrir(p)">
            <span class="t">{{ p.nombre }}</span>
            <span class="d">@let st = estado(p); <span class="pill" [class]="st.clase" [title]="st.ayuda">{{ st.texto }}</span></span>
            <span class="m">{{ p.tipo === 'pct' ? p.valor + '% de descuento' : (p.valor | dinero) + ' de descuento' }} @if (p.fin) { · hasta {{ p.fin | fecha }} }</span><span></span>
          </button>
          @if (s.verCostos()) {
            <span class="acciones">
              <button type="button" class="ico max-sm:hidden" title="Editar" aria-label="Editar {{ p.nombre }}" (click)="abrir(p)"><app-icono nombre="editar" /></button>
              <button type="button" class="ico peligro" title="Eliminar" aria-label="Eliminar {{ p.nombre }}" (click)="preguntarEliminar(p)"><app-icono nombre="basura" /></button>
            </span>
          }
        </div>
      } @empty { <div class="vacio"><b>Sin promociones</b>Crea una, por ejemplo “10% en tazas para el Día de las Madres”.</div> }
    }
    </div>
    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre! : 'Nueva promoción'" (cerrar)="e_.set(null)">
        <div class="campos">
          <div class="campo todo"><label for="r-n">Nombre</label><input id="r-n" name="nombre" required [(ngModel)]="e.nombre" [disabled]="!s.verCostos()"></div>
          <div class="campo"><label for="r-t">Tipo</label><select id="r-t" [(ngModel)]="e.tipo" [disabled]="!s.verCostos()"><option value="pct">Porcentaje</option><option value="monto">Cantidad fija</option></select></div>
          <div class="campo"><label for="r-v">Valor</label><input id="r-v" name="valor" required min="0" type="number" [(ngModel)]="e.valor" [disabled]="!s.verCostos()"></div>
          <div class="campo"><label for="r-i">Desde</label><input id="r-i" name="inicio" type="date" [(ngModel)]="e.inicio" [disabled]="!s.verCostos()"></div>
          <div class="campo"><label for="r-f">Hasta</label><input id="r-f" name="fin" type="date" [(ngModel)]="e.fin" [disabled]="!s.verCostos()"></div>
          <div class="campo todo"><label for="r-m">Mensaje para WhatsApp (usa {{ '{' }}cliente{{ '}' }} para el nombre)</label><textarea id="r-m" [(ngModel)]="e.mensaje" [disabled]="!s.verCostos()"></textarea></div>
          <label class="fila chico"><input type="checkbox" [(ngModel)]="e.activa" [disabled]="!s.verCostos()"> Activa</label>
        </div>
        @if (e.id) {
          <div class="caja">
            <h3>Enviar a clientes</h3>
            <p class="tenue chico">Se abre un chat por cliente con el mensaje listo.</p>
            @for (c of conTelefono(); track c.id) {
              <div class="fila entre"><span>{{ c.nombre }} <span class="tenue num chico">{{ c.telefono }}</span></span>
                <a class="btn sm wa" target="_blank" rel="noopener" [href]="wa(e, c)"><app-icono nombre="wa" />Enviar</a></div>
            } @empty { <p class="tenue chico">Ningún cliente tiene teléfono.</p> }
          </div>
        }
        <ng-container pie>
          @if (s.verCostos()) {
            @if (e.id) { <app-confirmar pregunta="¿Eliminar esta promoción?" (confirmado)="eliminar()" /> }
            <span class="flex-1"></span><button class="btn pri" (click)="guardar()">Guardar</button>
          }
        </ng-container>
      </app-hoja>
    }
  `,
})
export class Promociones implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  promos = signal<Promocion[]>([]);
  listo = signal(false);
  clientes = signal<Cliente[]>([]);
  e_ = signal<Partial<Promocion> | null>(null);
  e = this.e_.asReadonly();
  conTelefono = () => this.clientes().filter((c) => c.telefono);

  async ngOnInit() {
    this.promos.set(await this.api.get('/promociones'));
    this.listo.set(true);
    this.clientes.set(await this.api.get('/clientes'));
  }
  /** Por qué una promoción aplica o no hoy: pausada, aún no empieza, ya terminó o vigente. */
  estado(p: Promocion): { texto: string; clase: string; ayuda: string } {
    const h = hoy();
    if (!p.activa) return { texto: 'Pausada', clase: 'mut', ayuda: 'Está desactivada' };
    if (p.inicio && p.inicio > h) return { texto: `Empieza ${fecha(p.inicio)}`, clase: 'warn', ayuda: 'Aún no inicia' };
    if (p.fin && p.fin < h) return { texto: 'Terminó', clase: 'mut', ayuda: `Terminó el ${fecha(p.fin)}` };
    return { texto: 'Vigente', clase: 'ok', ayuda: 'Se puede aplicar hoy' };
  }
  vigente(p: Promocion) { const h = hoy(); return p.activa && (!p.inicio || p.inicio <= h) && (!p.fin || p.fin >= h); }
  abrir(p?: Promocion) { this.e_.set(p ? { ...p } : { nombre: '', tipo: 'pct', valor: 10, inicio: hoy(), fin: sumarDias(hoy(), 30), activa: true, mensaje: '' }); }
  wa(p: Partial<Promocion>, c: Cliente) {
    const t = this.s.taller();
    const desc = p.tipo === 'pct' ? `${p.valor}%` : `${t?.moneda ?? '$'}${p.valor}`;
    const txt = (p.mensaje || `¡Hola {cliente}! En ${t?.nombre} tenemos la promoción "${p.nombre}": ${desc} de descuento${p.fin ? ' hasta el ' + p.fin.split('-').reverse().join('/') : ''}. ¿Te cotizo algo?`).replace(/\{cliente\}/g, c.nombre);
    let tel = c.telefono.replace(/\D/g, '');
    if (tel.length === 10) tel = (t?.lada ?? '') + tel;
    return `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;
  }
  async guardar() {
    const e = this.e()!;
    const body = { nombre: e.nombre, tipo: e.tipo, valor: Number(e.valor) || 0, inicio: e.inicio || null, fin: e.fin || null, activa: !!e.activa, mensaje: e.mensaje ?? '' };
    try {
      if (e.id) await this.api.put(`/promociones/${e.id}`, body); else await this.api.post('/promociones', body);
      this.e_.set(null);
      this.promos.set(await this.api.get('/promociones'));
    } catch (err) { this.aviso.error(mensajeError(err)); }
  }
  async preguntarEliminar(p: Promocion) {
    if (!(await this.confirmar.preguntar({ titulo: `¿Eliminar ${p.nombre}?`, texto: 'Esta acción no se puede deshacer.', accion: 'Eliminar', peligro: true }))) return;
    this.e_.set({ ...p });
    await this.eliminar();
  }
  async eliminar() {
    await this.api.del(`/promociones/${this.e()!.id}`);
    this.e_.set(null);
    this.promos.set(await this.api.get('/promociones'));
  }
}
