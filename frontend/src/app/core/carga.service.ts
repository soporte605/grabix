import { computed, Injectable, signal } from '@angular/core';

/** Cuenta las peticiones y navegaciones en curso para mostrar la barra de carga global. */
@Injectable({ providedIn: 'root' })
export class CargaService {
  private pendientes = signal(0);
  readonly activa = computed(() => this.pendientes() > 0);
  inicio() { this.pendientes.update((n) => n + 1); }
  fin() { this.pendientes.update((n) => Math.max(0, n - 1)); }
}
