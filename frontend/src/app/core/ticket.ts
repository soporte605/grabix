import { dinero, fecha } from './formato';
import { Sucursal, Taller, Venta } from './modelos';

export type AnchoTicket = 58 | 80;

export interface DatosTicket {
  venta: Venta;
  taller: Taller;
  sucursal?: Sucursal;
  ancho: AnchoTicket;
  /** Efectivo recibido y cambio, si se capturaron al cobrar. */
  recibido?: number;
  cambio?: number;
}

const esc = (t: unknown) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Ticket de venta para impresora térmica de 58 u 80 mm. Devuelve un documento HTML completo. */
export function ticketHtml({ venta: v, taller: t, sucursal: s, ancho, recibido, cambio }: DatosTicket) {
  const m = (n: number) => dinero(n, t.moneda || '$');
  const cliente = v.cliente?.nombre || v.clienteNombre || 'Público en general';
  const tel = s?.telefono || t.telefono;
  const dir = s?.direccion || t.direccion;
  const fila = (k: string, val: string, fuerte = false) => `<div class="f${fuerte ? ' b' : ''}"><span>${k}</span><span>${val}</span></div>`;
  const items = v.items
    .map((i) => `<div class="it"><div>${esc(i.descripcion)}</div><div class="f"><span>${+Number(i.cantidad).toFixed(3)} × ${m(i.precio)}</span><span>${m(i.cantidad * i.precio)}</span></div></div>`)
    .join('');
  const saldo = Math.max(0, v.total - v.pagado);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${esc(v.folio)}</title><style>
@page { size: ${ancho}mm auto; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; }
body { width: ${ancho}mm; padding: 4mm ${ancho === 58 ? 2.5 : 4}mm 6mm; font: ${ancho === 58 ? 11 : 12}px/1.35 ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace; }
.c { text-align: center; } .b { font-weight: 700; } .g { font-size: 1.35em; }
.t { font-size: 1.2em; font-weight: 700; margin-bottom: 1mm; }
hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
.f { display: flex; justify-content: space-between; gap: 2mm; } .f span:last-child { text-align: right; white-space: nowrap; }
.it { margin-bottom: 1.2mm; } .it > div:first-child { word-break: break-word; }
.p { margin-top: 3mm; font-size: .92em; }
</style></head><body>
<div class="c"><div class="t">${esc(t.nombre)}</div>
${s ? `<div>${esc(s.nombre)}</div>` : ''}${dir ? `<div>${esc(dir)}</div>` : ''}${tel ? `<div>Tel. ${esc(tel)}</div>` : ''}</div>
<hr>
${fila('Nota de venta', `<b>${esc(v.folio)}</b>`)}
${fila('Fecha', fecha(v.fecha))}
<div>Cliente: ${esc(cliente)}</div>
<hr>
${items}
<hr>
${v.descuento ? fila('Subtotal', m(v.subtotal)) + fila('Descuento', '-' + m(v.descuento)) : ''}
<div class="f b g"><span>TOTAL</span><span>${m(v.total)}</span></div>
${(v.pagos ?? []).map((p) => fila(`Pago ${esc(p.metodo).toLowerCase()}`, m(p.monto))).join('')}
${(v.pagos?.length ?? 0) > 1 ? fila('Total pagado', m(v.pagado)) : ''}
${recibido ? fila('Recibido', m(recibido)) : ''}
${cambio ? fila('Cambio', m(cambio), true) : ''}
${fila('Saldo', m(saldo), saldo > 0)}
${v.entrega ? `<hr>${fila('Entrega', fecha(v.entrega), true)}` : ''}
${v.notas ? `<div class="p">${esc(v.notas)}</div>` : ''}
<hr>
<div class="c">¡Gracias por tu compra!</div>
</body></html>`;
}

/** Imprime el ticket en un iframe oculto, sin abrir otra ventana. */
export function imprimirTicket(html: string) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const w = f.contentWindow!;
  w.document.open();
  w.document.write(html);
  w.document.close();
  const quitar = () => setTimeout(() => f.remove(), 500);
  w.addEventListener('afterprint', quitar);
  setTimeout(() => { w.focus(); w.print(); setTimeout(quitar, 60_000); }, 150);
}

/** Ticket del corte de caja (mismo formato térmico que el de venta). */
export function corteHtml(t: import('./modelos').DetalleTurno, taller: Taller, sucursal: string, ancho: AnchoTicket) {
  const m = (n: number) => dinero(n, taller.moneda || '$');
  const hora = (d: string | null) => (d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const fila = (k: string, val: string, fuerte = false) => `<div class="f${fuerte ? ' b' : ''}"><span>${k}</span><span>${val}</span></div>`;
  const r = t.resumen!;
  const dif = t.diferencia;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Corte ${esc(t.folio)}</title><style>
@page { size: ${ancho}mm auto; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; }
body { width: ${ancho}mm; padding: 4mm ${ancho === 58 ? 2.5 : 4}mm 6mm; font: ${ancho === 58 ? 11 : 12}px/1.35 ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace; }
.c { text-align: center; } .b { font-weight: 700; } .t { font-size: 1.2em; font-weight: 700; margin-bottom: 1mm; }
hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
.f { display: flex; justify-content: space-between; gap: 2mm; } .f span:last-child { text-align: right; white-space: nowrap; }
.s { font-weight: 700; margin: 1mm 0; }
</style></head><body>
<div class="c"><div class="t">${esc(taller.nombre)}</div><div>${esc(sucursal)}</div><div class="b">CORTE DE CAJA ${esc(t.folio)}</div></div>
<hr>
${fila('Abrió', esc(t.abrioNombre))}${fila('Apertura', hora(t.abiertoEn))}
${fila('Cerró', esc(t.cerroNombre || '—'))}${fila('Cierre', hora(t.cerradoEn))}
<hr>
<div class="s">Cobros (${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'})</div>
${Object.entries(r.porMetodo).map(([k, v]) => fila(esc(k), m(v))).join('') || '<div>Sin cobros</div>'}
${fila('Total cobrado', m(r.cobrado), true)}
<hr>
<div class="s">Efectivo</div>
${fila('Fondo inicial', m(t.fondo))}
${fila('Cobros en efectivo', m(r.porMetodo['Efectivo'] ?? 0))}
${r.entradas ? fila('Entradas', m(r.entradas)) : ''}${r.salidas ? fila('Salidas', '-' + m(r.salidas)) : ''}
${fila('Esperado', m(r.esperado), true)}
${fila('Contado', m(t.contado), true)}
${fila(dif === 0 ? 'Cuadra' : dif > 0 ? 'Sobrante' : 'Faltante', m(Math.abs(dif)), true)}
<hr>
${fila('Se deja en caja', m(t.dejado))}${fila('Retiro', m(t.retiro), true)}
${t.movimientos.length ? '<hr><div class="s">Movimientos</div>' + t.movimientos.map((x) => fila(`${x.tipo === 'entrada' ? '+' : '-'} ${esc(x.concepto)}`, m(x.monto))).join('') : ''}
${t.notasCierre ? `<hr><div>${esc(t.notasCierre)}</div>` : ''}
<br><br><div class="c">______________________</div><div class="c">Firma</div>
</body></html>`;
}
