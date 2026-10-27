import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe } from '../core/formato';
import { Cliente } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

@Component({
  selector: 'app-clientes',
  imports: [FormsModule, DineroPipe, Hoja, Icono, Confirmar],
  template: `
    <div class="encabezado">
      <div><h1>Clientes</h1><p>{{ clientes().length }} registrados</p></div>
      <button class="btn pri" (click)="abrir()"><app-icono nombre="mas1" />Nuevo cliente</button>
    </div>
    <div style="margin-bottom:12px"><input class="buscar" placeholder="Buscar nombre o teléfono" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Buscar"></div>
    <div class="tarjeta lista">
      @for (c of visibles(); track c.id) {
        <button class="renglon" (click)="abrir(c)">
          <span class="t">{{ c.nombre }} @if (c.empresa) { <span class="m">· {{ c.empresa }}</span> }</span>
          <span class="d num">{{ c.comprado | dinero }}</span>
          <span class="m num">{{ c.telefono || 'Sin teléfono' }}</span>
          <span class="d m">{{ c.pedidos }} pedido{{ c.pedidos === 1 ? '' : 's' }}</span>
        </button>
      } @empty { <div class="vacio"><b>Sin clientes</b>Agrega a tus clientes para cotizar y escribirles por WhatsApp.</div> }
    </div>
    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre ?? '' : 'Nuevo cliente'" (cerrar)="e_.set(null)">
        <div class="campos">
          <div class="campo todo"><label for="c-n">Nombre</label><input id="c-n" [(ngModel)]="e.nombre"></div>
          <div class="campo"><label for="c-t">WhatsApp</label><input id="c-t" type="tel" [(ngModel)]="e.telefono"></div>
          <div class="campo"><label for="c-e">Correo</label><input id="c-e" type="email" [(ngModel)]="e.email"></div>
          <div class="campo todo"><label for="c-em">Empresa o negocio</label><input id="c-em" [(ngModel)]="e.empresa"></div>
          <div class="campo todo"><label for="c-no">Notas</label><textarea id="c-no" [(ngModel)]="e.notas"></textarea></div>
        </div>
        <ng-container pie>
          @if (e.id && s.verCostos()) { <app-confirmar (confirmado)="eliminar()" /> }
          @if (e.telefono) { <a class="btn wa" target="_blank" rel="noopener" [href]="wa(e)"><app-icono nombre="wa" />WhatsApp</a> }
          <span style="flex:1"></span>
          <button class="btn pri" (click)="guardar()">Guardar</button>
        </ng-container>
      </app-hoja>
    }
  `,
})
export class Clientes implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  clientes = signal<Cliente[]>([]);
  q = signal('');
  e_ = signal<Partial<Cliente> | null>(null);
  e = this.e_.asReadonly();
  visibles = computed(() => {
    const q = this.q().toLowerCase();
    return this.clientes().filter((c) => !q || `${c.nombre} ${c.telefono} ${c.empresa}`.toLowerCase().includes(q));
  });

  ngOnInit() { this.cargar(); }
  async cargar() { this.clientes.set(await this.api.get('/clientes')); }
  abrir(c?: Cliente) { this.e_.set(c ? { ...c } : { nombre: '', telefono: '', email: '', empresa: '', notas: '' }); }
  wa(c: Partial<Cliente>) {
    let t = (c.telefono ?? '').replace(/\D/g, '');
    if (t.length === 10) t = (this.s.taller()?.lada ?? '') + t;
    return `https://wa.me/${t}?text=${encodeURIComponent(`Hola ${c.nombre}, `)}`;
  }
  async guardar() {
    const e = this.e()!;
    if (!e.nombre?.trim()) { this.aviso.error('Escribe el nombre'); return; }
    const body = { nombre: e.nombre.trim(), telefono: e.telefono ?? '', email: e.email ?? '', empresa: e.empresa ?? '', notas: e.notas ?? '' };
    try {
      if (e.id) await this.api.put(`/clientes/${e.id}`, body); else await this.api.post('/clientes', body);
      this.e_.set(null);
      this.aviso.ok('Cliente guardado');
      await this.cargar();
    } catch (err) { this.aviso.error(mensajeError(err)); }
  }
  async eliminar() {
    try { await this.api.del(`/clientes/${this.e()!.id}`); this.e_.set(null); await this.cargar(); }
    catch (err) { this.aviso.error(mensajeError(err)); }
  }
}
