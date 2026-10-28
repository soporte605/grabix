import { Esqueleto } from '../ui/esqueleto';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe } from '../core/formato';
import { Cliente } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Confirmar } from '../ui/confirmar';
import { ConfirmarService } from '../core/confirmar.service';
import { pagina, Paginador } from '../ui/paginador';
import { Hoja } from '../ui/hoja';
import { WhatsappCliente } from '../ui/whatsapp-cliente';
import { Icono } from '../ui/icono';

@Component({
  selector: 'app-clientes',
  imports: [FormsModule, DineroPipe, Hoja, Icono, Confirmar, Esqueleto, Paginador, WhatsappCliente],
  template: `
    <div class="encabezado">
      <div class="titulo"><span class="icono-modulo"><app-icono nombre="clientes" /></span><div><h1>Clientes</h1><p>{{ clientes().length }} registrados</p></div></div>
      <button class="btn pri" (click)="abrir()"><app-icono nombre="mas1" />Nuevo cliente</button>
    </div>
    <div class="mb-3"><input class="buscar" placeholder="Buscar nombre o teléfono" [ngModel]="q()" (ngModelChange)="q.set($event); pagina.set(1)" aria-label="Buscar"></div>
    <div class="tarjeta lista">
      @if (!listo()) { <app-esqueleto /> } @else {
      @for (c of enPagina(); track c.id) {
        <div class="con-acciones">
          <button class="renglon" (click)="abrir(c)">
            <span class="t">{{ c.nombre }} @if (c.empresa) { <span class="m">· {{ c.empresa }}</span> }</span>
            <span class="d num">{{ c.comprado | dinero }}</span>
            <span class="m num">{{ c.telefono || 'Sin teléfono' }}</span>
            <span class="d m">{{ c.pedidos }} pedido{{ c.pedidos === 1 ? '' : 's' }}</span>
          </button>
          <span class="acciones">
            @if (c.telefono) { <button type="button" class="ico text-wa" (click)="waDe.set(c)" title="Mandar WhatsApp" aria-label="WhatsApp a {{ c.nombre }}"><app-icono nombre="wa" /></button> }
            <button type="button" class="ico max-sm:hidden" title="Editar" aria-label="Editar {{ c.nombre }}" (click)="abrir(c)"><app-icono nombre="editar" /></button>
            @if (s.verCostos()) { <button type="button" class="ico peligro" title="Eliminar" aria-label="Eliminar {{ c.nombre }}" (click)="preguntarEliminar(c)"><app-icono nombre="basura" /></button> }
          </span>
        </div>
      } @empty { <div class="vacio"><b>Sin clientes</b>Agrega a tus clientes para cotizar y escribirles por WhatsApp.</div> }
    }
    </div>
    <app-paginador [total]="visibles().length" [(pagina)]="pagina" />
    @if (waDe(); as c) { <app-whatsapp-cliente [cliente]="c" (cerrar)="waDe.set(null)" /> }
    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre ?? '' : 'Nuevo cliente'" (cerrar)="e_.set(null)">
        <div class="campos">
          <div class="campo todo"><label for="c-n">Nombre</label><input id="c-n" name="nombre" required maxlength="160" [(ngModel)]="e.nombre"></div>
          <div class="campo"><label for="c-t">WhatsApp</label><input id="c-t" type="tel" [(ngModel)]="e.telefono"></div>
          <div class="campo"><label for="c-e">Correo</label><input id="c-e" name="email" type="email" [(ngModel)]="e.email"></div>
          <div class="campo todo"><label for="c-em">Empresa o negocio</label><input id="c-em" [(ngModel)]="e.empresa"></div>
          <div class="campo todo"><label for="c-no">Notas</label><textarea id="c-no" [(ngModel)]="e.notas"></textarea></div>
        </div>
        <ng-container pie>
          @if (e.id && s.verCostos()) { <app-confirmar pregunta="¿Eliminar este cliente?" detalle="Sus cotizaciones y ventas se conservan. No se puede deshacer." (confirmado)="eliminar()" /> }
          @if (e.id && e.telefono) { <button class="btn wa" (click)="waDe.set($any(e)); e_.set(null)"><app-icono nombre="wa" />WhatsApp</button> }
          <span class="flex-1"></span>
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
  private confirmar = inject(ConfirmarService);
  clientes = signal<Cliente[]>([]);
  listo = signal(false);
  q = signal('');
  e_ = signal<Partial<Cliente> | null>(null);
  e = this.e_.asReadonly();
  visibles = computed(() => {
    const q = this.q().toLowerCase();
    return this.clientes().filter((c) => !q || `${c.nombre} ${c.telefono} ${c.empresa}`.toLowerCase().includes(q));
  });

  pagina = signal(1);
  waDe = signal<Cliente | null>(null);
  enPagina = computed(() => pagina(this.visibles(), this.pagina()));

  ngOnInit() { this.cargar(); }
  async cargar() { this.clientes.set(await this.api.get('/clientes')); this.listo.set(true); }
  abrir(c?: Cliente) { this.e_.set(c ? { ...c } : { nombre: '', telefono: '', email: '', empresa: '', notas: '' }); }
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
  async preguntarEliminar(c: Cliente) {
    if (await this.confirmar.preguntar({ titulo: `¿Eliminar a ${c.nombre}?`, texto: 'Sus cotizaciones y ventas se conservan. No se puede deshacer.', accion: 'Eliminar', peligro: true })) {
      this.e_.set({ ...c });
      await this.eliminar();
    }
  }
  async eliminar() {
    try { await this.api.del(`/clientes/${this.e()!.id}`); this.e_.set(null); this.aviso.ok('Cliente eliminado'); await this.cargar(); }
    catch (err) { this.aviso.error(mensajeError(err)); }
  }
}
