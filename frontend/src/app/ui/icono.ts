import { Component, computed, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { inject } from '@angular/core';

const P: Record<string, string> = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cotizaciones: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  ventas: '<path d="M3 5h2l2.4 10h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>',
  inventario: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  compras: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  promociones: '<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  sucursales: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
  usuarios: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.2-6.5 8-6.5s7 2 8 6.5"/>',
  bitacora: '<path d="M5 3h11l3 3v15H5z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2.2 2.3 4.3 4.6 4.8l1.1-1.1 1.8.8c-.2 1.2-1.1 1.8-2.2 1.8C11 15.8 8.2 13 8.2 9.7c0-1.1.6-2 1.8-2.2l.8 1.8z"/>',
  pdf: '<path d="M7 3h7l5 5v13H7z"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
  mas1: '<path d="M12 5v14M5 12h14"/>',
  salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  produccion: '<path d="M4 20h16M6 20V10l4 3V10l4 3V6l4 3v11"/>',
};

@Component({
  selector: 'app-icono',
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="svg()"></svg>`,
  styles: `:host { display: inline-flex; } svg { width: 1.2em; height: 1.2em; }`,
})
export class Icono {
  private san = inject(DomSanitizer);
  nombre = input.required<string>();
  svg = computed(() => this.san.bypassSecurityTrustHtml(P[this.nombre()] ?? ''));
}
