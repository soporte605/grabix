import { Injectable, signal } from '@angular/core';

export interface Pregunta { titulo: string; texto?: string; accion?: string; peligro?: boolean }

/** Ventana de confirmación para acciones que no se pueden deshacer. `preguntar` resuelve true si se acepta. */
@Injectable({ providedIn: 'root' })
export class ConfirmarService {
  readonly actual = signal<(Pregunta & { responder: (ok: boolean) => void }) | null>(null);

  preguntar(p: Pregunta): Promise<boolean> {
    this.actual()?.responder(false);
    return new Promise((res) => this.actual.set({ ...p, responder: (ok) => { this.actual.set(null); res(ok); } }));
  }
}
