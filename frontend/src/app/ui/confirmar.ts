import { Component, input, output, signal } from '@angular/core';

/** Botón de dos toques para acciones destructivas. */
@Component({
  selector: 'app-confirmar',
  template: `<button type="button" class="btn peligro" [class.armado]="armado()" [class.sm]="chico()" (click)="toque()">{{ armado() ? 'Toca de nuevo para confirmar' : texto() }}</button>`,
})
export class Confirmar {
  texto = input('Eliminar');
  chico = input(false);
  confirmado = output();
  armado = signal(false);
  private t?: ReturnType<typeof setTimeout>;
  toque() {
    if (this.armado()) { this.armado.set(false); this.confirmado.emit(); return; }
    this.armado.set(true);
    clearTimeout(this.t);
    this.t = setTimeout(() => this.armado.set(false), 4000);
  }
}
