import { Injectable, signal } from '@angular/core';

export interface VentaHecha { id: number; recibido?: number; cambio?: number; nueva: boolean }

/** Pasa la venta recién guardada del editor a la lista, que muestra la ventana de venta realizada y el ticket. */
@Injectable({ providedIn: 'root' })
export class PosService {
  readonly hecha = signal<VentaHecha | null>(null);
}
