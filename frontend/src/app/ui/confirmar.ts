import { Component, inject, input, output } from '@angular/core';
import { ConfirmarService } from '../core/confirmar.service';

/** Botón para acciones destructivas: pide confirmación en una ventana antes de emitir `confirmado`. */
@Component({
  selector: 'app-confirmar',
  template: `<button type="button" class="btn peligro" [class.sm]="chico()" (click)="preguntar()">{{ texto() }}</button>`,
})
export class Confirmar {
  private confirmar = inject(ConfirmarService);
  texto = input('Eliminar');
  pregunta = input('¿Seguro que quieres eliminarlo?');
  detalle = input('Esta acción no se puede deshacer.');
  chico = input(false);
  confirmado = output();

  async preguntar() {
    if (await this.confirmar.preguntar({ titulo: this.pregunta(), texto: this.detalle(), accion: this.texto(), peligro: true })) this.confirmado.emit();
  }
}
