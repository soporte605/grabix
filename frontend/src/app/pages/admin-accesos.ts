import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rutaPanel } from '../core/admin-host';
import { AdminService } from '../core/admin.service';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { Esqueleto } from '../ui/esqueleto';
import { Icono } from '../ui/icono';
import { AdminMenu } from '../ui/admin-menu';
import { Paginador } from '../ui/paginador';

interface Fila {
  id: number;
  creadoEn: string;
  email: string;
  nombre: string;
  tipo: string;
  exito: boolean;
  motivo: string;
  ip: string;
  tallerId: number | null;
  tallerNombre: string;
}

const MOTIVOS: Record<string, string> = {
  ok: 'Entró',
  clave: 'Clave incorrecta',
  inactivo: 'Usuario inactivo',
  bloqueado: 'Cuenta suspendida',
  eliminacion: 'Cuenta en eliminación',
};

@Component({
  selector: 'app-admin-accesos',
  imports: [DatePipe, RouterLink, Esqueleto, Icono, AdminMenu, Paginador],
  template: `
    <div class="mx-auto w-full max-w-[1100px] py-6 margen-x">
      <app-admin-menu />
      <div class="encabezado">
        <div class="titulo">
          <span class="icono-modulo"><app-icono nombre="usuarios" /></span>
          <div>
            <h1>Accesos</h1>
            <p>Inicios de sesión del panel y de los talleres. Los anteriores a hoy no están, porque no se guardaban.</p>
          </div>
        </div>
        <button class="btn" (click)="salir()">Salir</button>
      </div>
      <div class="mb-3">
        <input class="buscar" type="search" placeholder="Buscar correo, nombre o IP" [value]="q()" (input)="buscar($any($event.target).value)" aria-label="Buscar accesos">
      </div>
      <div class="tarjeta lista">
        @if (!listo()) { <app-esqueleto /> } @else {
          @for (f of lista(); track f.id) {
            <div class="renglon">
              <span class="t">{{ f.nombre || f.email }}</span>
              <span class="d flex flex-wrap justify-end gap-1">
                <span class="pill" [class]="f.exito ? 'ok' : 'bad'">{{ motivo(f) }}</span>
                <span class="pill mut">{{ f.tipo === 'panel' ? 'Panel' : 'Taller' }}</span>
              </span>
              <span class="m">
                {{ f.email }}
                @if (f.tallerId) { · <a class="enlace" [routerLink]="ficha(f.tallerId)">{{ f.tallerNombre || 'Taller ' + f.tallerId }}</a> }
                · {{ f.ip || 'sin IP' }} · {{ f.creadoEn | date: 'dd/MM/yyyy HH:mm' }}
              </span>
            </div>
          } @empty { <div class="vacio">Todavía no hay inicios de sesión.</div> }
        }
      </div>
      <app-paginador [total]="total()" [por]="50" [pagina]="pagina()" (paginaChange)="pagina.set($event); cargar()" />
    </div>
  `,
})
export class AdminAccesos implements OnInit, OnDestroy {
  admin = inject(AdminService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  q = signal('');
  pagina = signal(1);
  total = signal(0);
  lista = signal<Fila[]>([]);
  listo = signal(false);
  private timer?: ReturnType<typeof setTimeout>;
  private serie = 0;

  ngOnInit() { void this.cargar(); }
  ngOnDestroy() { clearTimeout(this.timer); }
  ficha(id: number) { return rutaPanel('talleres/' + id); }
  salir() { this.admin.cerrarSesion(); }
  motivo(f: Fila) { return MOTIVOS[f.motivo] ?? (f.exito ? 'Entró' : 'No entró'); }

  buscar(v: string) {
    this.q.set(v);
    this.pagina.set(1);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.cargar(), 250);
  }

  async cargar() {
    const n = ++this.serie;
    try {
      const r = await this.api.get<{ total: number; items: Fila[] }>('/admin/accesos', {
        q: this.q().trim(),
        pagina: String(this.pagina()),
      });
      if (n !== this.serie) return;
      this.total.set(r.total ?? 0);
      this.lista.set(r.items ?? []);
    } catch (e) {
      if (n !== this.serie) return;
      this.aviso.error(mensajeError(e));
    } finally {
      if (n === this.serie) this.listo.set(true);
    }
  }
}
