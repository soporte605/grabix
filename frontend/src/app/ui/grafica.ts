import { Component, computed, inject, input } from '@angular/core';
import { MESES, dinero } from '../core/formato';
import { SesionService } from '../core/sesion.service';

/** Barras pareadas de ventas y ganancia por mes. */
@Component({
  selector: 'app-grafica',
  template: `
    <svg class="block h-auto w-full fill-tenue text-xs" [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Ventas y ganancia por mes">
      @for (g of g().guias; track g.y) {
        <line [attr.x1]="L" [attr.x2]="W" [attr.y1]="g.y" [attr.y2]="g.y" class="stroke-linea" />
        <text [attr.x]="L - 6" [attr.y]="g.y + 4" text-anchor="end">{{ g.t }}</text>
      }
      @for (b of g().barras; track b.x) {
        <rect class="fill-marca" [attr.x]="b.x - b.w - 1" [attr.y]="b.yv" [attr.width]="b.w" [attr.height]="b.hv" rx="2"><title>Ventas {{ b.tv }}</title></rect>
        @if (mostrarGanancia()) {
          <rect class="fill-acento" [attr.x]="b.x + 1" [attr.y]="b.yg" [attr.width]="b.w" [attr.height]="b.hg" rx="2"><title>Ganancia {{ b.tg }}</title></rect>
        }
        <text [attr.x]="b.x" [attr.y]="H - 8" text-anchor="middle">{{ b.mes }}</text>
      }
    </svg>
  `,
})
export class Grafica {
  private s = inject(SesionService);
  serie = input.required<{ mes: string; ventas: number; ganancia: number }[]>();
  mostrarGanancia = input(true);
  W = 640; H = 220; L = 58; B = 26; T = 10;

  g = computed(() => {
    const d = this.serie();
    const mx = Math.max(1, ...d.map((x) => Math.max(x.ventas, x.ganancia)));
    const paso = Math.pow(10, Math.floor(Math.log10(mx)));
    const tope = Math.ceil(mx / paso) * paso;
    const y = (v: number) => this.H - this.B - (Math.max(0, v) / tope) * (this.H - this.B - this.T);
    const cw = (this.W - this.L) / d.length;
    const w = Math.min(18, cw / 3);
    const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k` : String(Math.round(v)));
    return {
      guias: [0, 1, 2, 3, 4].map((i) => ({ y: y((tope * i) / 4), t: fmt((tope * i) / 4) })),
      barras: d.map((x, i) => ({
        x: this.L + cw * i + cw / 2, w,
        yv: y(x.ventas), hv: this.H - this.B - y(x.ventas),
        yg: y(x.ganancia), hg: this.H - this.B - y(x.ganancia),
        mes: MESES[Number(x.mes.slice(5, 7)) - 1],
        tv: dinero(x.ventas, this.s.moneda()), tg: dinero(x.ganancia, this.s.moneda()),
      })),
    };
  });
}
