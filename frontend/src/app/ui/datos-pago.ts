import { Component, computed, inject, input } from '@angular/core';
import { AvisoService } from '../core/aviso.service';
import { Sucursal } from '../core/modelos';

export const fmtClabe = (c: string) => (c.length === 18 ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 17)} ${c.slice(17)}` : c);
export const fmtTarjeta = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ');

/** Datos de una sucursal para transferencia o depósito, igual que en el PDF, con botón para copiar. */
export function datosTransferencia(s?: Partial<Sucursal> | null) {
  if (!s) return [];
  return [
    { k: 'Banco', v: s.banco ?? '', copia: '' },
    { k: 'Titular', v: s.titular ?? '', copia: s.titular ?? '' },
    { k: 'CLABE', v: s.clabe ? fmtClabe(s.clabe) : '', copia: s.clabe ?? '' },
    { k: 'Cuenta', v: s.cuenta ?? '', copia: s.cuenta ?? '' },
    { k: 'Tarjeta', v: s.tarjeta ? fmtTarjeta(s.tarjeta) : '', copia: s.tarjeta ?? '' },
  ].filter((x) => x.v);
}

@Component({
  selector: 'app-datos-pago',
  template: `
    @if (filas().length) {
      <section class="relative overflow-hidden rounded-xl border border-linea bg-superficie p-3.5 pl-5">
        <span class="absolute inset-y-2 left-0 w-1 rounded-r bg-[#002150] dark:bg-[#67BE28]"></span>
        <p class="mb-2 text-xs font-bold tracking-[.08em] text-tenue uppercase">Datos para transferencia o depósito</p>
        <div class="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          @for (f of filas(); track f.k) {
            <div class="flex min-w-0 items-center gap-2">
              <div class="min-w-0 flex-1"><p class="chico tenue">{{ f.k }}</p>
                <p class="truncate font-semibold" [class.num]="f.k !== 'Banco' && f.k !== 'Titular'">{{ f.v }}</p></div>
              @if (copiable() && f.copia) { <button type="button" class="btn sm flex-none" (click)="copiar(f.k, f.copia)" [attr.aria-label]="'Copiar ' + f.k">Copiar</button> }
            </div>
          }
        </div>
        @if (sucursal()?.indicacionesPago?.trim(); as ind) { <p class="chico mt-2.5 whitespace-pre-line tenue">{{ ind }}</p> }
      </section>
    }
  `,
})
export class DatosPago {
  private aviso = inject(AvisoService);
  sucursal = input<Partial<Sucursal> | null | undefined>(null);
  copiable = input(true);
  filas = computed(() => datosTransferencia(this.sucursal()));

  async copiar(k: string, v: string) {
    try { await navigator.clipboard.writeText(v); this.aviso.ok(`Copiado: ${k}`); }
    catch { this.aviso.error('No se pudo copiar; selecciónalo a mano'); }
  }
}
