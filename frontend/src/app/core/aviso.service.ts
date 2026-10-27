import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AvisoService {
  readonly mensaje = signal<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
  private t?: ReturnType<typeof setTimeout>;

  ok(texto: string) { this.mostrar(texto, 'ok'); }
  error(texto: string) { this.mostrar(texto, 'error'); }

  private mostrar(texto: string, tipo: 'ok' | 'error') {
    this.mensaje.set({ texto, tipo });
    clearTimeout(this.t);
    this.t = setTimeout(() => this.mensaje.set(null), 3800);
  }
}

/** Mensaje legible a partir de un error HTTP de la API. */
export function mensajeError(e: unknown): string {
  const err = e as { status?: number; error?: { message?: string | string[] } };
  if (err?.status === 0) return 'No hay conexión con el servidor';
  const m = err?.error?.message;
  return Array.isArray(m) ? m[0] : m || 'Algo salió mal, intenta de nuevo';
}
