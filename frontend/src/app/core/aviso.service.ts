import { Injectable, signal } from '@angular/core';
import { marcarErroresServidor } from './validar';

export type TipoAviso = 'ok' | 'error' | 'info';
export interface Aviso { id: number; texto: string; tipo: TipoAviso; titulo: string }

const TITULOS: Record<TipoAviso, string> = { ok: 'Listo', error: 'No se pudo completar', info: 'Aviso' };
const DURACION: Record<TipoAviso, number> = { ok: 3500, info: 5000, error: 7000 };

/** Notificaciones flotantes (toasts). Se apilan, se cierran solas y también con la ×. */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  readonly avisos = signal<Aviso[]>([]);
  private sig = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  ok(texto: string, titulo?: string) { this.mostrar('ok', texto, titulo); }
  error(texto: string, titulo?: string) { this.mostrar('error', texto, titulo); }
  info(texto: string, titulo?: string) { this.mostrar('info', texto, titulo); }

  cerrar(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.avisos.update((l) => l.filter((a) => a.id !== id));
  }

  /** Detiene el cierre automático mientras el puntero está encima. */
  pausar(id: number) { clearTimeout(this.timers.get(id)); }
  reanudar(a: Aviso) { this.programar(a.id, 2500); }

  private mostrar(tipo: TipoAviso, texto: string, titulo?: string) {
    // Si el mismo mensaje ya está en pantalla, solo reinicia su tiempo.
    const igual = this.avisos().find((a) => a.texto === texto && a.tipo === tipo);
    if (igual) return this.programar(igual.id, DURACION[tipo]);
    const a: Aviso = { id: ++this.sig, tipo, texto, titulo: titulo ?? TITULOS[tipo] };
    this.avisos.update((l) => [...l.slice(-2), a]);
    this.programar(a.id, DURACION[tipo]);
  }

  private programar(id: number, ms: number) {
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => this.cerrar(id), ms));
  }
}

/** Mensaje legible a partir de un error HTTP de la API. */
export function mensajeError(e: unknown): string {
  const err = e as { status?: number; error?: { message?: string | string[]; campos?: Record<string, string> } };
  if (err?.status === 0) return 'No hay conexión con el servidor';
  // Si el servidor dice qué campos rechazó, también se marcan en el formulario abierto.
  if (err?.error?.campos) marcarErroresServidor(err.error.campos);
  const m = err?.error?.message;
  return Array.isArray(m) ? m[0] : m || 'Algo salió mal, intenta de nuevo';
}
