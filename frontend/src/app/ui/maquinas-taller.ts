import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { Maquina, TIPOS_MAQUINA, TipoMaquina } from '../core/modelos';
import { Icono } from './icono';

/** Alta y edición de las máquinas del taller (Ajustes). Se usan en Producción para repartir el trabajo. */
@Component({
  selector: 'app-maquinas-taller',
  imports: [FormsModule, Icono],
  template: `
    <section class="caja">
      <h3>Máquinas del taller</h3>
      <p class="tenue chico">En Producción asignas cada pedido a una máquina y ves cuánto trabajo tiene programado.</p>
      <div class="tarjeta lista">
        @for (m of maquinas(); track m.id) {
          <div class="flex flex-wrap items-center gap-2 px-3 py-2">
            <input class="entrada min-w-0 flex-1 basis-40" [(ngModel)]="m.nombre" [attr.aria-label]="'Nombre de ' + m.nombre" (change)="guardar(m)">
            <div class="flex min-w-0 flex-1 basis-56 items-center gap-2">
              <select class="entrada min-w-0 flex-1" [(ngModel)]="m.tipo" (ngModelChange)="guardar(m)" aria-label="Tipo">
                @for (t of tipos; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }
              </select>
              <label class="fila chico flex-none"><input type="checkbox" [(ngModel)]="m.activa" (ngModelChange)="guardar(m)"> Activa</label>
              <button type="button" class="ico peligro flex-none" title="Eliminar" [attr.aria-label]="'Eliminar ' + m.nombre" (click)="eliminar(m)"><app-icono nombre="basura" /></button>
            </div>
          </div>
        } @empty { <div class="vacio">Sin máquinas todavía.</div> }
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <div class="campo min-w-0 flex-1 basis-48"><label for="mq-n">Nueva máquina</label><input id="mq-n" [(ngModel)]="nueva" placeholder="Ej. Láser CO2 60W" (keydown.enter)="agregar()"></div>
        <select class="entrada w-auto" [(ngModel)]="tipoNueva" aria-label="Tipo de la nueva máquina">
          @for (t of tipos; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }
        </select>
        <button class="btn" (click)="agregar()" [disabled]="nueva.trim().length < 2"><app-icono nombre="mas1" />Agregar</button>
      </div>
    </section>
  `,
})
export class MaquinasTaller implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private confirmar = inject(ConfirmarService);
  tipos = Object.entries(TIPOS_MAQUINA) as [TipoMaquina, string][];
  maquinas = signal<Maquina[]>([]);
  nueva = '';
  tipoNueva: TipoMaquina = 'laser';

  async ngOnInit() {
    try { this.maquinas.set(await this.api.get<Maquina[]>('/maquinas')); } catch (e) { this.aviso.error(mensajeError(e)); }
  }

  async guardar(m: Maquina) {
    if (m.nombre.trim().length < 2) return this.aviso.error('El nombre debe tener al menos 2 caracteres');
    try { await this.api.put(`/maquinas/${m.id}`, { nombre: m.nombre, tipo: m.tipo, activa: m.activa }); this.aviso.ok('Máquina guardada'); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }

  async agregar() {
    if (this.nueva.trim().length < 2) return;
    try {
      const m = await this.api.post<Maquina>('/maquinas', { nombre: this.nueva, tipo: this.tipoNueva });
      this.maquinas.update((l) => [...l, m]);
      this.nueva = '';
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }

  async eliminar(m: Maquina) {
    const ok = await this.confirmar.preguntar({ titulo: `¿Eliminar ${m.nombre}?`, texto: 'Los pedidos asignados a esta máquina quedan sin máquina.', accion: 'Eliminar', peligro: true });
    if (!ok) return;
    try { await this.api.del(`/maquinas/${m.id}`); this.maquinas.update((l) => l.filter((x) => x.id !== m.id)); }
    catch (e) { this.aviso.error(mensajeError(e)); }
  }
}
