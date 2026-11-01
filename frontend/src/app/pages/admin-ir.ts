import { Component } from '@angular/core';
import { ADMIN_HOST } from '../core/admin-host';

/** En un dominio de clientes, /admin se va al host del panel. */
@Component({
  selector: 'app-admin-ir',
  template: '',
})
export class AdminIr {
  constructor() {
    location.href = `https://${ADMIN_HOST}/`;
  }
}
