import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Perfil, Rol } from './modelos';

const K_TOKEN = 'grabix.token';
const K_SUC = 'grabix.sucursal';
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

@Injectable({ providedIn: 'root' })
export class SesionService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(leer(K_TOKEN));
  readonly perfil = signal<Perfil | null>(null);
  /** Sucursal con la que se trabaja; null = todas (solo dueño/admin). */
  readonly sucursal = signal<number | null>(Number(leer(K_SUC)) || null);

  readonly rol = computed<Rol | null>(() => this.perfil()?.usuario.rol ?? null);
  readonly taller = computed(() => this.perfil()?.taller ?? null);
  readonly moneda = computed(() => this.perfil()?.taller.moneda ?? '$');
  readonly verCostos = computed(() => ['dueno', 'admin', 'encargado'].includes(this.rol() ?? ''));
  readonly gerencia = computed(() => ['dueno', 'admin'].includes(this.rol() ?? ''));
  readonly multiSucursal = computed(() => this.perfil()?.usuario.sucursalId == null && (this.perfil()?.sucursales.length ?? 0) > 1);
  readonly nombreSucursal = computed(() => this.perfil()?.sucursales.find((s) => s.id === this.sucursal())?.nombre ?? 'Todas las sucursales');

  async login(email: string, password: string) {
    this.aplicar(await firstValueFrom(this.http.post<Perfil & { token: string }>('/api/auth/login', { email, password })));
  }

  async registro(datos: { taller: string; nombre: string; email: string; password: string; telefono?: string; conEjemplos?: boolean }) {
    this.aplicar(await firstValueFrom(this.http.post<Perfil & { token: string }>('/api/auth/registro', datos)));
  }

  /** Confirma el correo con el enlace que llegó por correo. */
  async verificarCorreo(token: string) {
    await firstValueFrom(this.http.post('/api/auth/correo/verificar', { token }));
    if (this.token()) await this.cargar();
  }

  reenviarActivacion() {
    return firstValueFrom(this.http.post<{ enviado?: boolean; yaVerificado?: boolean }>('/api/auth/correo/reenviar', {}));
  }

  olvide(email: string) {
    return firstValueFrom(this.http.post('/api/auth/contrasena/olvide', { email }));
  }

  /** A quién pertenece un enlace de recuperación o invitación. */
  enlace(token: string) {
    return firstValueFrom(this.http.post<{ tipo: 'recuperacion' | 'invitacion'; nombre: string; email: string; taller: string }>('/api/auth/contrasena/enlace', { token }));
  }

  /** Guarda la contraseña nueva desde el enlace y deja la sesión iniciada. */
  async restablecer(token: string, password: string) {
    this.aplicar(await firstValueFrom(this.http.post<Perfil & { token: string }>('/api/auth/contrasena/restablecer', { token, password })));
  }

  /** Cambia la contraseña con sesión; las demás sesiones se cierran y esta recibe un token nuevo. */
  async cambiarContrasena(actual: string, nueva: string) {
    this.aplicar(await firstValueFrom(this.http.post<Perfil & { token: string }>('/api/auth/contrasena', { actual, nueva })));
  }

  /** Recarga el perfil (rol, sucursales, suscripción). Devuelve false si la sesión ya no es válida. */
  async cargar(): Promise<boolean> {
    if (!this.token()) return false;
    try {
      this.ajustarSucursal(await firstValueFrom(this.http.get<Perfil>('/api/auth/yo')));
      return true;
    } catch {
      this.salir(false);
      return false;
    }
  }

  elegirSucursal(id: number | null) {
    this.sucursal.set(id);
    guardar(K_SUC, id == null ? null : String(id));
  }

  salir(navegar = true) {
    this.token.set(null);
    this.perfil.set(null);
    guardar(K_TOKEN, null);
    if (navegar) this.router.navigateByUrl('/entrar');
  }

  private aplicar(r: Perfil & { token: string }) {
    const { token, ...perfil } = r;
    this.token.set(token);
    guardar(K_TOKEN, token);
    this.ajustarSucursal(perfil);
  }

  private ajustarSucursal(p: Perfil) {
    this.perfil.set(p);
    const ids = p.sucursales.map((s) => s.id);
    const actual = this.sucursal();
    if (p.usuario.sucursalId) this.elegirSucursal(p.usuario.sucursalId);
    else if (actual == null || !ids.includes(actual)) this.elegirSucursal(ids[0] ?? null);
  }
}
