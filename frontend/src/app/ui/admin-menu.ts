import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { rutaPanel } from '../core/admin-host';

/** Enlaces del panel: talleres, bitácora y accesos. */
@Component({
  selector: 'app-admin-menu',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="mb-4 flex flex-wrap gap-2" aria-label="Panel">
      <a class="btn sm" [routerLink]="ruta()" routerLinkActive="pri" [routerLinkActiveOptions]="{ exact: true }">Talleres</a>
      <a class="btn sm" [routerLink]="ruta('bitacora')" routerLinkActive="pri">Bitácora</a>
      <a class="btn sm" [routerLink]="ruta('accesos')" routerLinkActive="pri">Accesos</a>
    </nav>
  `,
})
export class AdminMenu {
  ruta = rutaPanel;
}
