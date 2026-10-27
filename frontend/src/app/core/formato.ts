import { inject, Pipe, PipeTransform } from '@angular/core';
import { SesionService } from './sesion.service';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const hoy = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const sumarDias = (f: string, n: number) => {
  const d = new Date(f + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const fecha = (f?: string | null) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '');
export const dinero = (n: number | null | undefined, moneda = '$') =>
  moneda + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number | null | undefined) => (n == null || !isFinite(n) ? '—' : `${Math.round(n * 100)}%`);

@Pipe({ name: 'dinero' })
export class DineroPipe implements PipeTransform {
  private s = inject(SesionService);
  transform(n: number | null | undefined) { return dinero(n, this.s.moneda()); }
}

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(f?: string | null) { return fecha(f); }
}

@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  transform(n: number | null | undefined) { return pct(n); }
}
