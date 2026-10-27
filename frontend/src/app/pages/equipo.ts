import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { Bitacora, Rol, ROLES, Sucursal, Usuario } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { Hoja } from '../ui/hoja';
import { Icono } from '../ui/icono';

@Component({
  selector: 'app-sucursales',
  imports: [FormsModule, Hoja, Icono],
  template: `
    <div class="encabezado">
      <div><h1>Sucursales</h1><p>Tu plan permite {{ s.perfil()?.suscripcion?.limites?.sucursales }} sucursal(es). Cada una lleva su inventario y sus ventas.</p></div>
      <button class="btn pri" (click)="e_.set({ nombre: '', direccion: '', telefono: '', activa: true })"><app-icono nombre="mas1" />Nueva sucursal</button>
    </div>
    <div class="tarjeta lista">
      @for (x of lista(); track x.id) {
        <button class="renglon" (click)="editar(x)">
          <span class="t">{{ x.nombre }}</span><span class="d"><span class="pill" [class]="x.activa ? 'ok' : 'mut'">{{ x.activa ? 'Activa' : 'Inactiva' }}</span></span>
          <span class="m">{{ x.direccion || 'Sin dirección' }} @if (x.telefono) { · {{ x.telefono }} }</span><span></span>
        </button>
      }
    </div>
    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre! : 'Nueva sucursal'" (cerrar)="e_.set(null)">
        <div class="campos">
          <div class="campo todo"><label for="s-n">Nombre</label><input id="s-n" [(ngModel)]="e.nombre"></div>
          <div class="campo todo"><label for="s-d">Dirección</label><input id="s-d" [(ngModel)]="e.direccion"></div>
          <div class="campo"><label for="s-t">Teléfono / WhatsApp</label><input id="s-t" type="tel" [(ngModel)]="e.telefono"></div>
          @if (e.id) { <label class="fila chico"><input type="checkbox" [(ngModel)]="e.activa"> Activa</label> }
        </div>
        <ng-container pie><span style="flex:1"></span><button class="btn pri" (click)="guardar()">Guardar</button></ng-container>
      </app-hoja>
    }
  `,
})
export class Sucursales implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  lista = signal<Sucursal[]>([]);
  e_ = signal<Partial<Sucursal> | null>(null);
  e = this.e_.asReadonly();
  async ngOnInit() { this.lista.set(await this.api.get('/sucursales')); }
  editar(x: Sucursal) { this.e_.set({ ...x }); }
  invitando = signal(false);
  async invitar(id: number) {
    this.invitando.set(true);
    try {
      await this.api.post(`/usuarios/${id}/invitar`);
      this.aviso.ok('Invitación reenviada');
    } catch (err) { this.aviso.error(mensajeError(err)); }
    finally { this.invitando.set(false); }
  }
  async guardar() {
    const e = this.e()!;
    const body = { nombre: e.nombre, direccion: e.direccion ?? '', telefono: e.telefono ?? '', activa: e.activa ?? true };
    try {
      if (e.id) await this.api.put(`/sucursales/${e.id}`, body); else await this.api.post('/sucursales', body);
      this.e_.set(null);
      this.lista.set(await this.api.get('/sucursales'));
      await this.s.cargar();
      this.aviso.ok('Sucursal guardada');
    } catch (err) { this.aviso.error(mensajeError(err)); }
  }
}

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, Hoja, Icono],
  template: `
    <div class="encabezado">
      <div><h1>Usuarios y roles</h1><p>Tu plan permite {{ s.perfil()?.suscripcion?.limites?.usuarios }} usuarios.</p></div>
      <button class="btn pri" (click)="abrir()"><app-icono nombre="mas1" />Nuevo usuario</button>
    </div>
    <div class="tarjeta lista">
      @for (u of lista(); track u.id) {
        <button class="renglon" (click)="abrir(u)">
          <span class="t">{{ u.nombre }}</span><span class="d"><span class="pill" [class]="u.activo ? 'acc' : 'mut'">{{ roles[u.rol].nombre }}</span></span>
          <span class="m">{{ u.email }}@if (u.activo && !u.emailVerificado) { · <span class="pend">sin activar</span> }</span><span class="d m">{{ sucursal(u.sucursalId) }}</span>
        </button>
      }
    </div>
    <div class="tarjeta pad" style="margin-top:14px">
      <h2>Qué puede hacer cada rol</h2>
      <dl class="roles">@for (r of rolesLista; track r[0]) { <dt>{{ r[1].nombre }}</dt><dd>{{ r[1].desc }}</dd> }</dl>
    </div>
    @if (e(); as e) {
      <app-hoja [titulo]="e.id ? e.nombre : 'Nuevo usuario'" (cerrar)="e_.set(null)">
        <div class="campos">
          <div class="campo todo"><label for="u-n">Nombre</label><input id="u-n" [(ngModel)]="e.nombre"></div>
          <div class="campo todo"><label for="u-e">Correo (con este entra)</label><input id="u-e" type="email" [(ngModel)]="e.email"></div>
          <div class="campo"><label for="u-r">Rol</label>
            <select id="u-r" [(ngModel)]="e.rol">@for (r of rolesPermitidos(); track r[0]) { <option [value]="r[0]">{{ r[1].nombre }}</option> }</select>
          </div>
          @if (e.rol !== 'dueno' && e.rol !== 'admin') {
            <div class="campo"><label for="u-s">Sucursal</label>
              <select id="u-s" [(ngModel)]="e.sucursalId"><option [ngValue]="null">Todas</option>@for (x of s.perfil()!.sucursales; track x.id) { <option [ngValue]="x.id">{{ x.nombre }}</option> }</select>
            </div>
          }
          <div class="campo"><label for="u-p">{{ e.id ? 'Nueva contraseña (opcional)' : 'Contraseña inicial (opcional)' }}</label><input id="u-p" type="password" autocomplete="new-password" [(ngModel)]="e.password"></div>
          @if (!e.id) { <p class="tenue chico todo">Si la dejas vacía, le enviamos un correo de invitación para que cree la suya.</p> }
          @if (e.id) { <label class="fila chico"><input type="checkbox" [(ngModel)]="e.activo"> Activo</label> }
        </div>
        <p class="tenue chico">{{ roles[e.rol].desc }}</p>
        <ng-container pie>
          @if (e.id && e.activo && !e.emailVerificado) { <button class="btn" (click)="invitar(e.id)" [disabled]="invitando()">{{ invitando() ? 'Enviando…' : 'Reenviar invitación' }}</button> }
          <span style="flex:1"></span><button class="btn pri" (click)="guardar()">Guardar</button>
        </ng-container>
      </app-hoja>
    }
  `,
  styles: `.pend { color: var(--warn); font-weight: 600; } .roles { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 10px 0 0; } dt { font-weight: 600; } dd { margin: 0; color: var(--tenue); }`,
})
export class Usuarios implements OnInit {
  s = inject(SesionService);
  private api = inject(Api);
  private aviso = inject(AvisoService);
  roles = ROLES;
  rolesLista = Object.entries(ROLES) as [Rol, { nombre: string; desc: string }][];
  rolesPermitidos = computed(() => this.rolesLista.filter(([r]) => r !== 'dueno' || this.s.rol() === 'dueno'));
  lista = signal<Usuario[]>([]);
  e_ = signal<(Omit<Usuario, 'id'> & { id?: number; password?: string }) | null>(null);
  e = this.e_.asReadonly();
  async ngOnInit() { this.lista.set(await this.api.get('/usuarios')); }
  sucursal(id: number | null) { return id ? this.s.perfil()?.sucursales.find((x) => x.id === id)?.nombre ?? '' : 'Todas las sucursales'; }
  abrir(u?: Usuario) { this.e_.set(u ? { ...u, password: '' } : { nombre: '', email: '', rol: 'vendedor', sucursalId: this.s.sucursal(), activo: true, password: '' }); }
  invitando = signal(false);
  async invitar(id: number) {
    this.invitando.set(true);
    try {
      await this.api.post(`/usuarios/${id}/invitar`);
      this.aviso.ok('Invitación reenviada');
    } catch (err) { this.aviso.error(mensajeError(err)); }
    finally { this.invitando.set(false); }
  }
  async guardar() {
    const e = this.e()!;
    const body = { nombre: e.nombre, email: e.email, rol: e.rol, sucursalId: e.sucursalId, activo: e.activo, ...(e.password ? { password: e.password } : {}) };
    try {
      const r = e.id ? await this.api.put<{ invitado?: boolean }>(`/usuarios/${e.id}`, body) : await this.api.post<{ invitado?: boolean }>('/usuarios', body);
      this.e_.set(null);
      this.lista.set(await this.api.get('/usuarios'));
      this.aviso.ok(r.invitado ? `Invitación enviada a ${e.email}` : 'Usuario guardado');
    } catch (err) { this.aviso.error(mensajeError(err)); }
  }
}

const ACCIONES: Record<string, string> = {
  invitar: 'Reenvió invitación a',
  crear: 'Creó', actualizar: 'Modificó', eliminar: 'Eliminó', desactivar: 'Desactivó', estado: 'Cambió estado de', pago: 'Registró pago en',
  'ajuste-inventario': 'Ajustó inventario de', traspaso: 'Traspasó', 'activar-plan': 'Activó plan',
};

@Component({
  selector: 'app-bitacora',
  imports: [DatePipe, JsonPipe],
  template: `
    <div class="encabezado"><div><h1>Bitácora</h1><p>Quién hizo qué y cuándo.</p></div></div>
    <div class="tarjeta lista">
      @for (b of lista(); track b.id) {
        <details class="renglon">
          <summary><b>{{ b.usuarioNombre }}</b> {{ accion(b.accion) }} {{ b.entidad }} @if (b.entidadId) { #{{ b.entidadId }} }
            <span class="tenue chico"> · {{ b.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</span></summary>
          <pre>{{ b.detalle | json }}</pre>
        </details>
      } @empty { <div class="vacio">Sin movimientos</div> }
    </div>
    <div class="fila" style="margin-top:12px">
      @if (pagina() > 1) { <button class="btn" (click)="ir(pagina() - 1)">Más recientes</button> }
      @if (lista().length === 50) { <button class="btn" (click)="ir(pagina() + 1)">Anteriores</button> }
    </div>
  `,
  styles: `details.renglon { display: block; cursor: default; } summary { cursor: pointer; } pre { font-size: .78rem; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--tenue); margin: 8px 0 0; }`,
})
export class BitacoraPagina implements OnInit {
  private api = inject(Api);
  lista = signal<Bitacora[]>([]);
  pagina = signal(1);
  ngOnInit() { this.ir(1); }
  accion(a: string) { return ACCIONES[a] ?? a; }
  async ir(p: number) { this.pagina.set(p); this.lista.set(await this.api.get('/bitacora', { pagina: String(p) })); }
}
