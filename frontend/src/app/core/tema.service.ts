import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type Tema = 'sistema' | 'claro' | 'oscuro';
const K = 'grabix.tema';

/** Modo claro/oscuro. "sistema" sigue la preferencia del dispositivo. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private doc = inject(DOCUMENT);
  readonly tema = signal<Tema>(this.leer());

  constructor() { this.aplicar(this.tema()); }

  elegir(t: Tema) {
    this.tema.set(t);
    try { localStorage.setItem(K, t); } catch { /* sin almacenamiento */ }
    this.aplicar(t);
  }

  /** Recorre sistema → claro → oscuro. */
  siguiente() {
    const orden: Tema[] = ['sistema', 'claro', 'oscuro'];
    this.elegir(orden[(orden.indexOf(this.tema()) + 1) % orden.length]);
  }

  private aplicar(t: Tema) {
    const r = this.doc.documentElement;
    if (t === 'sistema') r.removeAttribute('data-tema');
    else r.setAttribute('data-tema', t);
  }

  private leer(): Tema {
    try {
      const v = localStorage.getItem(K);
      return v === 'claro' || v === 'oscuro' ? v : 'sistema';
    } catch {
      return 'sistema';
    }
  }
}
