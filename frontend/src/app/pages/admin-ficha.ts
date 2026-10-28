import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ESTADOS_SUSCRIPCION, PLANES, rutaPanel } from '../core/admin-host';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { FechaPipe } from '../core/formato';
import { Rol, ROLES } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { validarFormulario } from '../core/validar';
import { Esqueleto } from '../ui/esqueleto';
import { Icono } from '../ui/icono';

interface TallerFicha {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  plan: string;
  estadoSuscripcion: string;
  pruebaHasta: string | null;
  pagadoHasta: string | null;
  bloqueado: boolean;
  eliminarEn: string | null;
  creadoEn: string;
}

interface UsuarioApi {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  sucursalId: number | null;
  activo: boolean;
  emailVerificado: boolean;
}

interface UsuarioEdit extends UsuarioApi { sucursalTexto: string }

interface CorreoAdmin {
  id: number;
  para: string;
  asunto: string;
  tipo: string;
  estado: string;
  error: string | null;
  creadoEn: string;
}

const TIPOS_CORREO: Record<string, string> = {
  activacion: 'Confirmación',
  invitacion: 'Invitación',
  recuperacion: 'Recuperación',
};
const ESTADOS_CORREO: Record<string, string> = {
  enviado: 'Enviado',
  fallido: 'Fallido',
  simulado: 'Simulado',
};

@Component({
  selector: 'app-admin-ficha',
  imports: [FormsModule, RouterLink, DatePipe, FechaPipe, Esqueleto, Icono],
  template: `
    <div class="mx-auto w-full max-w-[900px] py-6 margen-x">
      @if (!listo()) { <app-esqueleto tipo="formulario" [filas]="4" /> }
      @else if (taller(); as t) {
        <div class="encabezado">
          <div class="titulo">
            <span class="icono-modulo"><app-icono nombre="ajustes" /></span>
            <div>
              <h1>{{ t.nombre }}</h1>
              <p>Alta {{ t.creadoEn | fecha }}@if (t.bloqueado) { · <span class="font-semibold text-bad">Bloqueado</span> }</p>
            </div>
          </div>
          <div class="fila">
            <a class="btn" [routerLink]="lista">Volver</a>
            <button class="btn pri" (click)="entrar()" [disabled]="ocupado()">Entrar como dueño</button>
          </div>
        </div>
        @if (!tieneDueno()) { <p class="error mb-3">Este taller no tiene un dueño activo.</p> }

        <div class="rejilla">
          <form class="caja" (ngSubmit)="guardarDatos($event)">
            <h3>Datos</h3>
            <div class="campos">
              <div class="campo todo"><label for="t-n">Nombre</label><input id="t-n" name="nombre" required minlength="2" maxlength="120" [(ngModel)]="t.nombre"></div>
              <div class="campo"><label for="t-t">Teléfono</label><input id="t-t" name="telefono" type="tel" [(ngModel)]="t.telefono"></div>
              <div class="campo"><label for="t-e">Correo</label><input id="t-e" name="email" type="email" [(ngModel)]="t.email"></div>
              <div class="campo todo"><label for="t-d">Dirección</label><input id="t-d" name="direccion" [(ngModel)]="t.direccion"></div>
            </div>
            <div><button class="btn pri" [disabled]="ocupado()">Guardar</button></div>
          </form>

          <section class="caja">
            <h3>Suscripción</h3>
            <p class="tenue chico">
              Prueba hasta {{ t.pruebaHasta ? (t.pruebaHasta | fecha) : '—' }}.
              Pagado hasta {{ t.pagadoHasta ? (t.pagadoHasta | fecha) : '—' }}.
              @if (t.eliminarEn) { Se elimina el {{ t.eliminarEn | fecha }}. }
            </p>
            <div class="campos">
              <div class="campo"><label for="t-plan">Plan</label>
                <select id="t-plan" name="plan" [(ngModel)]="t.plan">
                  @for (p of planes; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
                  @if (planRaro(t.plan)) { <option [value]="t.plan">{{ t.plan }}</option> }
                </select>
              </div>
              <div class="campo"><label for="t-est">Estado</label>
                <select id="t-est" name="estado" [(ngModel)]="t.estadoSuscripcion">
                  @for (e of estados; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
                  @if (estadoRaro(t.estadoSuscripcion)) { <option [value]="t.estadoSuscripcion">{{ t.estadoSuscripcion }}</option> }
                </select>
              </div>
              <div class="campo"><label for="t-dias">Días para alargar</label><input id="t-dias" name="dias" type="number" min="1" [(ngModel)]="dias"></div>
            </div>
            <div class="fila">
              <button type="button" class="btn pri sm" (click)="guardarSuscripcion()" [disabled]="ocupado()">Guardar</button>
              <button type="button" class="btn sm" (click)="alargar()" [disabled]="ocupado()">Alargar</button>
              <button type="button" class="btn sm" (click)="renovar('mensual')" [disabled]="ocupado()">Renovar 30 días</button>
              <button type="button" class="btn sm" (click)="renovar('anual')" [disabled]="ocupado()">Renovar 365 días</button>
              @if (t.eliminarEn) { <button type="button" class="btn sm" (click)="cancelarEliminacion()" [disabled]="ocupado()">Cancelar eliminación</button> }
              <button type="button" class="btn sm" [class.peligro]="!t.bloqueado" (click)="bloqueo()" [disabled]="ocupado()">{{ t.bloqueado ? 'Reactivar' : 'Bloquear' }}</button>
            </div>
          </section>

          <section class="caja">
            <h3>Usuarios</h3>
            @for (u of usuarios(); track u.id) {
              <form class="rounded-lg border border-linea p-3" (ngSubmit)="guardarUsuario(u, $event)">
                <div class="fila mb-2">
                  <span class="pill" [class]="u.emailVerificado ? 'ok' : 'warn'">{{ u.emailVerificado ? 'Correo confirmado' : 'Sin confirmar' }}</span>
                  <span class="pill" [class]="u.activo ? 'ok' : 'mut'">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
                </div>
                <div class="campos">
                  <div class="campo"><label [for]="'u-n-' + u.id">Nombre</label><input [id]="'u-n-' + u.id" name="nombre" required minlength="2" [(ngModel)]="u.nombre"></div>
                  <div class="campo"><label [for]="'u-e-' + u.id">Correo</label><input [id]="'u-e-' + u.id" name="email" type="email" required [(ngModel)]="u.email"></div>
                  <div class="campo"><label [for]="'u-r-' + u.id">Rol</label>
                    <select [id]="'u-r-' + u.id" name="rol" [(ngModel)]="u.rol">
                      @for (r of roles; track r[0]) { <option [value]="r[0]">{{ r[1].nombre }}</option> }
                    </select>
                  </div>
                  <div class="campo"><label [for]="'u-s-' + u.id">Sucursal</label><input [id]="'u-s-' + u.id" name="sucursalId" inputmode="numeric" [(ngModel)]="u.sucursalTexto" placeholder="Vacío si no tiene"></div>
                  <label class="fila chico"><input type="checkbox" [(ngModel)]="u.activo" [name]="'activo-' + u.id"> Activo</label>
                </div>
                <div class="fila mt-2">
                  <button type="button" class="btn sm" (click)="correo(u, 'activacion')" [disabled]="ocupado()">Reenviar confirmación</button>
                  <button type="button" class="btn sm" (click)="correo(u, 'invitacion')" [disabled]="ocupado()">Reenviar invitación</button>
                  <button type="button" class="btn sm" (click)="correo(u, 'recuperacion')" [disabled]="ocupado()">Enviar enlace de recuperación</button>
                  <span class="flex-1"></span>
                  <button class="btn sm pri" [disabled]="ocupado()">Guardar</button>
                </div>
              </form>
            } @empty { <div class="vacio">Este taller no tiene usuarios.</div> }
          </section>

          <section class="caja">
            <h3>Correos</h3>
            <div class="tarjeta lista">
              @for (c of correos(); track c.id) {
                <div class="renglon">
                  <span class="t">{{ tipoCorreo(c.tipo) }}</span>
                  <span class="d"><span class="pill" [class]="c.estado === 'fallido' ? 'bad' : c.estado === 'enviado' ? 'ok' : 'mut'">{{ estadoCorreo(c.estado) }}</span></span>
                  <span class="m">{{ c.para }} · {{ c.creadoEn | date: 'dd/MM/yyyy HH:mm' }}@if (c.error) { · {{ c.error }} }</span>
                </div>
              } @empty { <div class="vacio">Este taller no tiene correos.</div> }
            </div>
          </section>
        </div>
      } @else {
        <div class="vacio">No pude cargar este taller.</div>
        <a class="btn" [routerLink]="lista">Volver</a>
      }
    </div>
  `,
})
export class AdminFicha implements OnInit {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private sesion = inject(SesionService);
  private router = inject(Router);
  id = input.required<string>();
  readonly lista = rutaPanel();
  readonly planes = PLANES;
  readonly estados = ESTADOS_SUSCRIPCION;
  readonly roles = Object.entries(ROLES) as [Rol, { nombre: string; desc: string }][];
  taller = signal<TallerFicha | null>(null);
  usuarios = signal<UsuarioEdit[]>([]);
  correos = signal<CorreoAdmin[]>([]);
  listo = signal(false);
  ocupado = signal(false);
  dias: number | null = null;
  tieneDueno = computed(() => this.usuarios().some((u) => u.rol === 'dueno' && u.activo));

  ngOnInit() { void this.cargar(); }
  planRaro(id: string) { return !PLANES.some((p) => p.id === id); }
  /** El alta deja el plan en "prueba"; la API solo acepta Taller, Pro o Empresa. */
  private planComercial(plan: string) {
    return plan === 'basico' || plan === 'pro' || plan === 'empresa' ? { plan } : {};
  }
  estadoRaro(id: string) { return !ESTADOS_SUSCRIPCION.some((e) => e.id === id); }
  tipoCorreo(t: string) { return TIPOS_CORREO[t] ?? t; }
  estadoCorreo(e: string) { return ESTADOS_CORREO[e] ?? e; }

  async cargar() {
    try {
      const r = await this.api.get<{ taller: TallerFicha; usuarios: UsuarioApi[]; correos: CorreoAdmin[] }>(`/admin/talleres/${this.id()}`);
      const t = r.taller;
      this.taller.set({
        nombre: t.nombre ?? '',
        telefono: t.telefono ?? '',
        email: t.email ?? '',
        direccion: t.direccion ?? '',
        plan: t.plan,
        estadoSuscripcion: t.estadoSuscripcion,
        pruebaHasta: t.pruebaHasta,
        pagadoHasta: t.pagadoHasta,
        bloqueado: !!t.bloqueado,
        eliminarEn: t.eliminarEn,
        creadoEn: t.creadoEn,
      });
      this.usuarios.set((r.usuarios ?? []).map((u) => ({ ...u, sucursalTexto: u.sucursalId == null ? '' : String(u.sucursalId) })));
      this.correos.set(r.correos ?? []);
    } catch (e) {
      this.taller.set(null);
      this.aviso.error(mensajeError(e));
    } finally {
      this.listo.set(true);
    }
  }

  private async hacer(trabajo: () => Promise<void>, ok: string) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await trabajo();
      this.aviso.ok(ok);
      await this.cargar();
    } catch (e) {
      this.aviso.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  guardarDatos(ev: Event) {
    if (!validarFormulario(ev.target as ParentNode)) return;
    const t = this.taller()!;
    void this.hacer(async () => {
      await this.api.patch(`/admin/talleres/${this.id()}`, {
        nombre: t.nombre, telefono: t.telefono ?? '', email: t.email ?? '', direccion: t.direccion ?? '',
      });
    }, 'Datos guardados');
  }

  guardarSuscripcion() {
    const t = this.taller()!;
    void this.hacer(async () => {
      await this.api.post(`/admin/talleres/${this.id()}/suscripcion`, { estado: t.estadoSuscripcion, ...this.planComercial(t.plan) });
    }, 'Suscripción guardada');
  }

  alargar() {
    const dias = Number(this.dias);
    if (!Number.isInteger(dias) || dias < 1) return this.aviso.error('Escribe cuántos días quieres sumar.');
    void this.hacer(async () => {
      await this.api.post(`/admin/talleres/${this.id()}/suscripcion`, { dias });
      this.dias = null;
    }, 'Plazo alargado');
  }

  renovar(renovar: 'mensual' | 'anual') {
    const t = this.taller()!;
    void this.hacer(async () => {
      await this.api.post(`/admin/talleres/${this.id()}/suscripcion`, { renovar, ...this.planComercial(t.plan) });
    }, renovar === 'mensual' ? 'Renovado 30 días' : 'Renovado 365 días');
  }

  cancelarEliminacion() {
    void this.hacer(async () => {
      await this.api.post(`/admin/talleres/${this.id()}/suscripcion`, { cancelarEliminacion: true });
    }, 'Eliminación cancelada');
  }

  bloqueo() {
    const bloqueado = !this.taller()!.bloqueado;
    void this.hacer(async () => {
      await this.api.post(`/admin/talleres/${this.id()}/bloqueo`, { bloqueado });
    }, bloqueado ? 'Taller bloqueado' : 'Taller reactivado');
  }

  guardarUsuario(u: UsuarioEdit, ev: Event) {
    if (!validarFormulario(ev.target as ParentNode)) return;
    const texto = u.sucursalTexto.trim();
    const sucursalId = texto === '' ? null : Number(texto);
    if (texto !== '' && !Number.isInteger(sucursalId)) return this.aviso.error('La sucursal tiene que ser un número.');
    void this.hacer(async () => {
      await this.api.patch(`/admin/usuarios/${u.id}`, {
        nombre: u.nombre, email: u.email, rol: u.rol, sucursalId, activo: u.activo,
      });
    }, 'Usuario guardado');
  }

  correo(u: UsuarioEdit, tipo: 'activacion' | 'invitacion' | 'recuperacion') {
    const texto = tipo === 'activacion' ? 'Confirmación reenviada' : tipo === 'invitacion' ? 'Invitación reenviada' : 'Enlace de recuperación enviado';
    void this.hacer(async () => {
      await this.api.post(`/admin/usuarios/${u.id}/correo`, { tipo });
    }, texto);
  }

  async entrar() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      const r = await this.api.post<{ token: string }>(`/admin/talleres/${this.id()}/entrar`);
      this.sesion.marcarSoporte(Number(this.id()));
      this.sesion.adoptarToken(r.token);
      if (await this.sesion.cargar()) {
        await this.router.navigateByUrl('/app');
        return;
      }
      if (this.sesion.enSoporte()) {
        this.sesion.restaurarTrasSoporte(false);
        this.aviso.error('No pude abrir el taller.');
      }
    } catch (e) {
      this.aviso.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
