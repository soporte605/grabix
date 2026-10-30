import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CLAVE_ADMIN, leerAdminToken, rutaPanel } from './admin-host';

export interface AdminYo { id: number; nombre: string; email: string }

const guardar = (v: string | null) => {
  try { v == null ? localStorage.removeItem(CLAVE_ADMIN) : localStorage.setItem(CLAVE_ADMIN, v); } catch { /* sin almacenamiento */ }
};

/** Sesión del panel. No usa grabix.token. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(leerAdminToken());
  readonly admin = signal<AdminYo | null>(null);

  async entrar(email: string, password: string) {
    const r = await firstValueFrom(this.http.post<{ token: string; admin: AdminYo }>('/api/admin/entrar', { email, password }));
    this.token.set(r.token);
    guardar(r.token);
    this.admin.set(r.admin);
  }

  async yo() {
    if (!this.token()) return null;
    try {
      const a = await firstValueFrom(this.http.get<AdminYo>('/api/admin/yo'));
      this.admin.set(a);
      return a;
    } catch {
      return null;
    }
  }

  /** Borra solo el token del panel. `navegar` manda al login, salvo que ya estés ahí. */
  cerrarSesion(navegar = true) {
    this.token.set(null);
    this.admin.set(null);
    guardar(null);
    if (!navegar) return;
    const destino = rutaPanel('entrar');
    if (this.router.url.split('?')[0] !== destino) void this.router.navigateByUrl(destino);
  }
}
