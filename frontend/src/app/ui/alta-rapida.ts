import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AsistenteService, SugerenciaProducto } from '../core/asistente.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { DineroPipe } from '../core/formato';
import { Cliente, Producto, Promocion } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Hoja } from './hoja';
import { Icono } from './icono';

/*
 * Altas rápidas desde una cotización, venta o la caja: lo mínimo para seguir vendiendo
 * sin salir del documento. Lo demás (receta, tiempo de máquina, fechas) se completa en su módulo.
 */

@Component({
  selector: 'app-alta-cliente',
  imports: [FormsModule, Hoja],
  template: `
    <app-hoja titulo="Nuevo cliente" ancho="480px" (cerrar)="cerrar.emit()">
      <div class="campo"><label for="ar-cn">Nombre</label><input id="ar-cn" name="nombre" required minlength="2" maxlength="160" [(ngModel)]="nombre" (keydown.enter)="guardar()"></div>
      <div class="campos">
        <div class="campo"><label for="ar-ct">WhatsApp</label><input id="ar-ct" type="tel" inputmode="tel" maxlength="40" [(ngModel)]="telefono"></div>
        <div class="campo"><label for="ar-ce">Correo</label><input id="ar-ce" name="email" type="email" maxlength="160" [(ngModel)]="email"></div>
      </div>
      <div class="campo"><label for="ar-cm">Empresa o escuela (opcional)</label><input id="ar-cm" maxlength="160" [(ngModel)]="empresa"></div>
      <ng-container pie>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button><span class="flex-1"></span>
        <button class="btn pri" (click)="guardar()" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar y usar' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class AltaCliente implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  inicial = input('');
  cerrar = output();
  creado = output<Cliente>();
  nombre = '';
  telefono = '';
  email = '';
  empresa = '';
  ocupado = signal(false);

  ngOnInit() {
    // Si lo que se buscaba parece teléfono, va al campo de WhatsApp.
    const t = this.inicial().trim();
    if (/^[\d\s+()-]{7,}$/.test(t)) this.telefono = t;
    else this.nombre = t;
  }

  async guardar() {
    if (this.ocupado() || this.nombre.trim().length < 2) return;
    this.ocupado.set(true);
    try {
      const c = await this.api.post<Cliente>('/clientes', { nombre: this.nombre.trim(), telefono: this.telefono.trim(), email: this.email.trim(), empresa: this.empresa.trim() });
      this.aviso.ok('Cliente guardado');
      this.creado.emit(c);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}

@Component({
  selector: 'app-alta-producto',
  imports: [FormsModule, Hoja, Icono, DineroPipe],
  template: `
    <app-hoja titulo="Nuevo producto o servicio" ancho="520px" (cerrar)="cerrar.emit()">
      <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
        @for (t of tipos; track t[0]) {
          <button type="button" role="radio" class="rounded-xl border-2 px-3 py-2.5 text-left" [attr.aria-checked]="tipo() === t[0]"
            [class]="tipo() === t[0] ? 'border-marca bg-marca-suave' : 'border-linea'" (click)="tipo.set(t[0])">
            <span class="block font-semibold" [class.text-marca]="tipo() === t[0]">{{ t[1] }}</span><span class="chico tenue">{{ t[2] }}</span>
          </button>
        }
      </div>
      <div class="campo"><label for="ar-pn">Nombre</label><input id="ar-pn" name="nombre" required minlength="2" maxlength="160" [(ngModel)]="nombre" [placeholder]="tipo() === 'servicio' ? 'Ej. Grabado láser en madera' : 'Ej. Llavero MDF grabado'"></div>
      @if (s.verCostos() && ia.estado()?.disponible) {
        @if (sug(); as g) {
          <div class="caja !border-marca">
            <div class="fila entre"><h3 class="flex items-center gap-1.5"><app-icono nombre="chispa" />Sugerencia de la IA</h3><div class="fila"><button type="button" class="btn sm" (click)="limpiar()" [disabled]="pensando()">Limpiar</button><button type="button" class="btn sm" (click)="sugerir()" [disabled]="pensando()">{{ pensando() ? 'Pensando…' : 'Otra vez' }}</button></div></div>
            <p>{{ g.nota }}</p>
            @if (g.precioMax) { <p class="chico tenue">En el mercado se cobra entre <span class="num">{{ g.precioMin | dinero }}</span> y <span class="num">{{ g.precioMax | dinero }}</span>. Revisa los datos antes de guardar.</p> }
          </div>
        } @else {
          <button type="button" class="btn self-start" (click)="sugerir()" [disabled]="pensando()"><app-icono nombre="chispa" />{{ pensando() ? 'Pensando…' : '¿No sabes cuánto cobrar? Sugerir con IA' }}</button>
        }
      }
      <div class="campos">
        <div class="campo"><label for="ar-pp">Precio de venta</label><input id="ar-pp" name="precio" required min="0" class="num" type="number" inputmode="decimal" [(ngModel)]="precio"></div>
        @if (s.verCostos()) { <div class="campo"><label for="ar-pc">Costo (opcional)</label><input id="ar-pc" min="0" class="num" type="number" inputmode="decimal" [(ngModel)]="costo"></div> }
      </div>
      <div class="campos">
        <div class="campo"><label for="ar-pk">Categoría (opcional)</label><input id="ar-pk" maxlength="60" [(ngModel)]="categoria" placeholder="Ej. Grabado láser" list="ar-cats">
          <datalist id="ar-cats">@for (c of categorias(); track c) { <option [value]="c"></option> }</datalist></div>
        <div class="campo"><label for="ar-pu">Unidad</label><input id="ar-pu" maxlength="20" [(ngModel)]="unidad"></div>
      </div>
      <p class="chico tenue">{{ sug()?.componentes?.length || sug()?.minutos ? 'La receta y el tiempo de máquina sugeridos se guardan también; puedes ajustarlos en Inventario.' : 'La receta de insumos y el tiempo de máquina los puedes completar después en Inventario.' }}</p>
      <ng-container pie>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button><span class="flex-1"></span>
        <button class="btn pri" (click)="guardar()" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar y usar' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class AltaProducto implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  inicial = input('');
  categorias = input<string[]>([]);
  cerrar = output();
  creado = output<Producto>();
  tipos: ['servicio' | 'producto', string, string][] = [
    ['servicio', 'Servicio', 'Grabado, corte, diseño'],
    ['producto', 'Producto', 'Artículo que vendes'],
  ];
  tipo = signal<'servicio' | 'producto'>('servicio');
  nombre = '';
  precio: number | null = null;
  costo: number | null = null;
  categoria = '';
  unidad = 'pza';
  ocupado = signal(false);
  ia = inject(AsistenteService);
  sug = signal<SugerenciaProducto | null>(null);
  pensando = signal(false);

  ngOnInit() {
    this.nombre = this.inicial().trim();
    if (this.s.verCostos() && !this.ia.estado()) this.ia.cargarEstado();
  }

  async sugerir() {
    if (this.pensando()) return;
    if (this.nombre.trim().length < 3) { this.aviso.error('Escribe primero el nombre'); return; }
    this.pensando.set(true);
    try {
      const g = await this.ia.sugerirProducto(this.nombre, undefined, this.tipo());
      // Desde aquí solo se dan de alta productos o servicios, no insumos.
      this.tipo.set(g.tipo === 'servicio' ? 'servicio' : 'producto');
      this.precio = g.precio;
      this.costo = g.componentes.length ? null : g.costo;
      this.categoria = g.categoria;
      this.unidad = g.unidad;
      this.sug.set(g);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.pensando.set(false); }
  }

  /** Quita la sugerencia y lo que llenó, para volver a preguntar. */
  limpiar() {
    this.precio = null;
    this.costo = null;
    this.categoria = '';
    this.unidad = 'pza';
    this.sug.set(null);
  }

  async guardar() {
    if (this.ocupado() || this.nombre.trim().length < 2) return;
    this.ocupado.set(true);
    try {
      const p = await this.api.post<Producto>('/productos', {
        nombre: this.nombre.trim(), tipo: this.tipo(), precio: Number(this.precio) || 0, costo: Number(this.costo) || 0,
        categoria: this.categoria.trim(), unidad: this.unidad.trim() || 'pza',
        ...(this.sug() ? { minutos: this.sug()!.minutos, extra: this.sug()!.extra, componentes: this.tipo() === 'producto' ? this.sug()!.componentes : [] } : {}),
      });
      this.aviso.ok(this.tipo() === 'servicio' ? 'Servicio guardado' : 'Producto guardado');
      this.creado.emit(p);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}

@Component({
  selector: 'app-alta-promocion',
  imports: [FormsModule, Hoja],
  template: `
    <app-hoja titulo="Nueva promoción" ancho="460px" (cerrar)="cerrar.emit()">
      <div class="campo"><label for="ar-mn">Nombre</label><input id="ar-mn" name="nombre" required minlength="2" maxlength="160" [(ngModel)]="nombre" placeholder="Ej. Regreso a clases"></div>
      <div class="campos">
        <div class="campo"><label for="ar-mt">Tipo</label>
          <select id="ar-mt" [(ngModel)]="tipo"><option value="pct">Porcentaje</option><option value="monto">Cantidad fija</option></select></div>
        <div class="campo"><label for="ar-mv">{{ tipo === 'pct' ? 'Descuento (%)' : 'Descuento ($)' }}</label>
          <input id="ar-mv" name="valor" required min="0.01" [attr.max]="tipo === 'pct' ? 100 : null" class="num" type="number" inputmode="decimal" [(ngModel)]="valor"></div>
      </div>
      <p class="chico tenue">Queda vigente desde hoy y sin fecha de fin. Puedes ajustar fechas y mensaje en Promociones.</p>
      <ng-container pie>
        <button class="btn" (click)="cerrar.emit()">Cancelar</button><span class="flex-1"></span>
        <button class="btn pri" (click)="guardar()" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar y aplicar' }}</button>
      </ng-container>
    </app-hoja>
  `,
})
export class AltaPromocion {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  cerrar = output();
  creado = output<Promocion>();
  nombre = '';
  tipo: 'pct' | 'monto' = 'pct';
  valor: number | null = null;
  ocupado = signal(false);

  async guardar() {
    if (this.ocupado() || this.nombre.trim().length < 2 || !(Number(this.valor) > 0)) return;
    this.ocupado.set(true);
    try {
      const p = await this.api.post<Promocion>('/promociones', { nombre: this.nombre.trim(), tipo: this.tipo, valor: Number(this.valor), activa: true });
      this.aviso.ok('Promoción guardada');
      this.creado.emit(p);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}
