import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { claseEstado, nombreEstado, nombrePlan, rutaPanel } from '../core/admin-host';
import { AdminService } from '../core/admin.service';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { FechaPipe } from '../core/formato';
import { AdminMenu } from '../ui/admin-menu';
import { Esqueleto } from '../ui/esqueleto';
import { Icono } from '../ui/icono';

export interface TallerAdmin {
  id: number;
  nombre: string;
  emailDueno: string | null;
  plan: string;
  estadoSuscripcion: string;
  vence: string | null;
  bloqueado: boolean;
  creadoEn: string;
}

@Component({
  selector: 'app-admin-talleres',
  imports: [RouterLink, FechaPipe, Esqueleto, Icono, AdminMenu],
  template: `
    <div class="mx-auto w-full max-w-[1100px] py-6 margen-x">
      <app-admin-menu />
      <div class="encabezado">
        <div class="titulo">
          <span class="icono-modulo"><app-icono nombre="sucursales" /></span>
          <div>
            <h1>Talleres</h1>
            <p>{{ admin.admin()?.nombre ? 'Hola, ' + admin.admin()!.nombre + '.' : 'Todos los talleres de Grabix.' }}</p>
          </div>
        </div>
        <button class="btn" (click)="salir()">Salir</button>
      </div>
      <div class="mb-3">
        <input class="buscar" type="search" placeholder="Buscar nombre o correo" [value]="q()" (input)="buscar($any($event.target).value)" aria-label="Buscar por nombre o correo">
      </div>
      <div class="tarjeta lista">
        @if (!listo()) { <app-esqueleto /> } @else {
          @for (t of lista(); track t.id) {
            <a class="renglon" [routerLink]="ficha(t.id)">
              <span class="t">{{ t.nombre }}</span>
              <span class="d flex flex-wrap justify-end gap-1">
                <span class="pill acc">{{ plan(t.plan) }}</span>
                <span class="pill" [class]="estadoClase(t.estadoSuscripcion)">{{ estado(t.estadoSuscripcion) }}</span>
                <span class="pill" [class]="t.bloqueado ? 'bad' : 'mut'">{{ t.bloqueado ? 'Bloqueado' : 'Sin bloqueo' }}</span>
              </span>
              <span class="m">{{ t.emailDueno || 'Sin dueño' }}</span>
              <span class="d m">{{ t.vence ? (t.vence | fecha) : 'Sin vencimiento' }} · alta {{ t.creadoEn | fecha }}</span>
            </a>
          } @empty { <div class="vacio">No hay talleres con esa búsqueda.</div> }
        }
      </div>
    </div>
  `,
})
export class AdminTalleres implements OnInit, OnDestroy {
  admin = inject(AdminService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  q = signal('');
  lista = signal<TallerAdmin[]>([]);
  listo = signal(false);
  plan = nombrePlan;
  estado = nombreEstado;
  estadoClase = claseEstado;
  private timer?: ReturnType<typeof setTimeout>;
  private serie = 0;

  ngOnInit() { void this.cargar(); }
  ngOnDestroy() { clearTimeout(this.timer); }
  ficha(id: number) { return rutaPanel('talleres/' + id); }
  salir() { this.admin.cerrarSesion(); }

  buscar(v: string) {
    this.q.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.cargar(), 250);
  }

  async cargar() {
    const n = ++this.serie;
    try {
      const lista = await this.api.get<TallerAdmin[]>('/admin/talleres', { q: this.q().trim() });
      if (n !== this.serie) return;
      this.lista.set(lista ?? []);
    } catch (e) {
      if (n !== this.serie) return;
      this.aviso.error(mensajeError(e));
    } finally {
      if (n === this.serie) this.listo.set(true);
    }
  }
}
