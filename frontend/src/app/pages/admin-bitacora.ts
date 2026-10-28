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
  quien: string;
  accion: string;
  entidad: string;
  tallerId: number | null;
  tallerNombre: string;
  detalle: unknown;
}

const ACCIONES: Record<string, string> = {
  actualizar: 'Actualizó',
  bloquear: 'Bloqueó la cuenta',
  reactivar: 'Reactivó la cuenta',
  suscripcion: 'Cambió la suscripción',
  reenviar: 'Reenvió un correo',
  entrar: 'Entró como dueño',
  salir: 'Salió del taller',
  crear: 'Creó',
  eliminar: 'Eliminó',
  invitar: 'Invitó',
  'activar-plan': 'Activó un plan',
  abrir: 'Abrió',
  cerrar: 'Cerró',
  etapa: 'Cambió la etapa de',
  foto: 'Subió una foto de',
  eliminar_foto: 'Quitó una foto de',
  estado: 'Cambió el estado de',
  pago: 'Registró un pago de',
  restaurar: 'Restauró',
  desactivar: 'Desactivó',
  'ajuste-inventario': 'Ajustó el inventario de',
  traspaso: 'Traspasó',
};

const CON_ENTIDAD = new Set([
  'crear', 'eliminar', 'actualizar', 'abrir', 'cerrar', 'invitar', 'restaurar', 'desactivar',
  'etapa', 'foto', 'eliminar_foto', 'estado', 'pago', 'ajuste-inventario', 'traspaso',
]);

const ENTIDADES: Record<string, string> = {
  taller: 'el taller',
  sucursal: 'una sucursal',
  usuario: 'un usuario',
  producto: 'un producto',
  cliente: 'un cliente',
  promocion: 'una promoción',
  cotizacion: 'una cotización',
  venta: 'una venta',
  compra: 'una compra',
  caja: 'la caja',
  caja_movimiento: 'un movimiento de caja',
  inventario: 'el inventario',
  cuenta: 'la cuenta',
};

@Component({
  selector: 'app-admin-bitacora',
  imports: [DatePipe, RouterLink, Esqueleto, Icono, AdminMenu, Paginador],
  template: `
    <div class="mx-auto w-full max-w-[1100px] py-6 margen-x">
      <app-admin-menu />
      <div class="encabezado">
        <div class="titulo">
          <span class="icono-modulo"><app-icono nombre="bitacora" /></span>
          <div>
            <h1>Bitácora</h1>
            <p>{{ admin.admin()?.nombre ? 'Hola, ' + admin.admin()!.nombre + '.' : 'Qué se ha cambiado.' }}</p>
          </div>
        </div>
        <button class="btn" (click)="salir()">Salir</button>
      </div>
      <div class="mb-3 flex flex-wrap gap-2">
        <button type="button" class="btn sm" [class.pri]="origen() === 'panel'" (click)="cambiar('panel')">Del panel</button>
        <button type="button" class="btn sm" [class.pri]="origen() === 'talleres'" (click)="cambiar('talleres')">De los talleres</button>
        <input class="buscar min-w-60 flex-1" type="search" placeholder="Buscar persona, acción o entidad" [value]="q()" (input)="buscar($any($event.target).value)" aria-label="Buscar en la bitácora">
      </div>
      <div class="tarjeta lista">
        @if (!listo()) { <app-esqueleto /> } @else {
          @for (f of lista(); track f.id) {
            <div class="renglon">
              <span class="t" [title]="texto(f.detalle)">{{ frase(f) }}</span>
              <span class="d">
                @if (f.tallerId) { <a class="enlace" [routerLink]="ficha(f.tallerId)">{{ f.tallerNombre || 'Taller ' + f.tallerId }}</a> }
                @else { <span class="tenue">Sin taller</span> }
              </span>
              <span class="m">{{ f.quien || '—' }} · {{ f.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
            </div>
          } @empty { <div class="vacio">No hay movimientos con esa búsqueda.</div> }
        }
      </div>
      <app-paginador [total]="total()" [por]="50" [pagina]="pagina()" (paginaChange)="pagina.set($event); cargar()" />
    </div>
  `,
})
export class AdminBitacoraPage implements OnInit, OnDestroy {
  admin = inject(AdminService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  q = signal('');
  origen = signal<'panel' | 'talleres'>('panel');
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
  frase(f: Fila) {
    const accion = ACCIONES[f.accion] ?? f.accion;
    if (!CON_ENTIDAD.has(f.accion)) return accion;
    const entidad = ENTIDADES[f.entidad] ?? f.entidad;
    return entidad ? `${accion} ${entidad}` : accion;
  }
  texto(d: unknown) {
    if (d == null || d === '') return '';
    try { return typeof d === 'string' ? d : JSON.stringify(d); } catch { return ''; }
  }

  cambiar(origen: 'panel' | 'talleres') {
    this.origen.set(origen);
    this.pagina.set(1);
    void this.cargar();
  }

  buscar(v: string) {
    this.q.set(v);
    this.pagina.set(1);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.cargar(), 250);
  }

  async cargar() {
    const n = ++this.serie;
    try {
      const r = await this.api.get<{ total: number; items: Fila[] }>('/admin/bitacora', {
        q: this.q().trim(),
        origen: this.origen(),
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
