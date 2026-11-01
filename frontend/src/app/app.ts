import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicoService } from './core/publico.service';
import { TemaService } from './core/tema.service';
import { Capas } from './ui/capas';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Capas],
  template: '<router-outlet /><app-capas />',
})
export class App {
  // Aplica el modo claro/oscuro guardado desde el primer momento.
  private tema = inject(TemaService);

  constructor() {
    // Pixel de Meta en la landing y el registro (solo si el servidor tiene META_PIXEL_ID).
    inject(PublicoService).iniciarMedicion();
  }
}
