import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Cotizacion, Sucursal, Venta } from '../entities';
import { sumarDias } from '../common/suscripcion';
import { DocumentosService } from './documentos.service';

type Datos = Awaited<ReturnType<DocumentosService['paraImprimir']>>;

const TINTA = '#13222b';
const GRIS = '#5a6a74';
const LINEA = '#d6dee2';
/** Colores de marca; se reemplazan al definir la identidad visual. */
const ACENTO = process.env.PDF_COLOR_ACENTO ?? '#002150';

/** CLABE en bloques (banco, plaza, cuenta, verificador) y tarjeta de 4 en 4, más fáciles de dictar y copiar. */
export const fmtClabe = (c: string) => (c.length === 18 ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 17)} ${c.slice(17)}` : c);
export const fmtTarjeta = (t: string) => t.replace(/(\d{4})(?=\d)/g, '$1 ');

/** Datos para transferencia de la sucursal, en el orden en que se muestran. */
export function datosTransferencia(suc?: Pick<Sucursal, 'banco' | 'titular' | 'clabe' | 'cuenta' | 'tarjeta'> | null): [string, string][] {
  if (!suc) return [];
  return ([
    ['Banco', suc.banco],
    ['Titular', suc.titular],
    ['CLABE', suc.clabe ? fmtClabe(suc.clabe) : ''],
    ['Cuenta', suc.cuenta],
    ['Tarjeta', suc.tarjeta ? fmtTarjeta(suc.tarjeta) : ''],
  ] as [string, string][]).filter(([, v]) => v);
}

/** Anticipo que pide la sucursal para empezar el trabajo. */
export const anticipoDe = (total: number, pct?: number | null) => (pct && pct > 0 ? Math.round(total * pct) / 100 : 0);

export const fmtFecha = (f?: string | null) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '');

@Injectable()
export class PdfService {
  money(n: number, moneda: string) {
    return moneda + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Nota de venta o cotización con diseño sobrio, como factura: fondo blanco, un solo color de acento
   * (azul de la marca) para títulos y total, líneas finas y datos alineados en columnas.
   */
  generar({ tipo, d, taller, sucursal, cliente, promocion }: Datos): Promise<Buffer> {
    const m = (n: number) => this.money(n, taller.moneda);
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, bufferPages: true, info: { Title: `${d.folio} ${taller.nombre}`, Author: taller.nombre } });
    const out: Buffer[] = [];
    doc.on('data', (b: Buffer) => out.push(b));
    const fin = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(out))));
    const W = doc.page.width, H = doc.page.height;
    const L = 54, R = W - 54, AN = R - L;
    const esVenta = tipo === 'venta';
    const v = esVenta ? (d as Venta) : null;
    const saldo = v ? Math.max(0, v.total - v.pagado) : 0;
    const vence = esVenta ? '' : fmtFecha(sumarDias(String(d.fecha).slice(0, 10), (d as Cotizacion).vigenciaDias));
    const etiqueta = (t: string, x: number, y: number, w?: number, align: 'left' | 'right' = 'left') =>
      doc.font('Helvetica-Bold').fontSize(7).fillColor(GRIS).text(t.toUpperCase(), x, y, { width: w, align, characterSpacing: 0.9 });

    doc.rect(0, 0, W, 4).fill(ACENTO);

    /* Encabezado: taller a la izquierda, documento a la derecha. */
    doc.font('Helvetica-Bold').fontSize(17).fillColor(ACENTO).text(taller.nombre, L, 44, { width: 300 });
    const nomSuc = sucursal && sucursal.nombre !== 'Matriz' ? (/^sucursal\b/i.test(sucursal.nombre) ? sucursal.nombre : `Sucursal ${sucursal.nombre}`) : '';
    const contacto = [
      nomSuc,
      sucursal?.direccion || taller.direccion,
      [sucursal?.telefono || taller.telefono ? `Tel. ${sucursal?.telefono || taller.telefono}` : '', taller.email].filter(Boolean).join('  ·  '),
    ].filter(Boolean);
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(contacto.join('\n'), L, doc.y + 4, { width: 290, lineGap: 2 });
    const finIzq = doc.y;

    const DX = R - 200;
    etiqueta(esVenta ? 'Nota de venta' : 'Cotización', DX, 46, 200, 'right');
    doc.font('Helvetica-Bold').fontSize(20).fillColor(TINTA).text(d.folio, DX, 57, { width: 200, align: 'right' });
    let my = 86;
    const meta = (k: string, val: string) => {
      doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(k, DX, my, { width: 95 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TINTA).text(val, DX + 95, my, { width: 105, align: 'right' });
      my += 14;
    };
    meta('Fecha', fmtFecha(d.fecha));
    if (esVenta) meta('Entrega', v!.entrega ? fmtFecha(v!.entrega) : 'Por definir');
    else meta('Válida hasta', vence);
    meta('Estado', this.estado(tipo, d.estado, saldo));

    let y = Math.max(finIzq, my) + 18;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(TINTA).lineWidth(1).stroke();
    y += 16;

    /* Cliente. */
    etiqueta(esVenta ? 'Cliente' : 'Cotización para', L, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA).text(cliente?.nombre || d.clienteNombre || 'Público en general', L, y + 12, { width: AN / 2 });
    const datosCli = [cliente?.empresa, cliente?.telefono || d.clienteTelefono, cliente?.email].filter(Boolean) as string[];
    if (datosCli.length) doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(datosCli.join('  ·  '), L, doc.y + 2, { width: AN / 2 });
    y = doc.y + 22;

    /* Conceptos. */
    const cols = [
      { t: 'Cant.', x: L, w: 46, a: 'left' as const },
      { t: 'Descripción', x: L + 46, w: AN - 46 - 180, a: 'left' as const },
      { t: 'Precio unitario', x: R - 180, w: 90, a: 'right' as const },
      { t: 'Importe', x: R - 90, w: 90, a: 'right' as const },
    ];
    const encabezado = (yy: number) => {
      cols.forEach((c, n) => etiqueta(c.t, c.x + (n === 0 ? 0 : 6), yy, c.w - (n === 3 ? 6 : 12), c.a));
      doc.moveTo(L, yy + 14).lineTo(R, yy + 14).strokeColor(TINTA).lineWidth(0.8).stroke();
      return yy + 14;
    };
    y = encabezado(y);
    for (const i of d.items) {
      const vals = [String(+Number(i.cantidad).toFixed(4)), i.descripcion, m(i.precio), m(i.cantidad * i.precio)];
      doc.font('Helvetica').fontSize(9.5);
      const h = doc.heightOfString(i.descripcion, { width: cols[1].w - 12 }) + 16;
      if (y + h > H - 200) {
        doc.addPage();
        doc.rect(0, 0, W, 4).fill(ACENTO);
        y = encabezado(54);
      }
      vals.forEach((x, n) =>
        doc.font('Helvetica').fontSize(9.5).fillColor(TINTA).text(x, cols[n].x + (n === 0 ? 0 : 6), y + 8, { width: cols[n].w - (n === 3 ? 6 : 12), align: cols[n].a }),
      );
      y += h;
      doc.moveTo(L, y).lineTo(R, y).strokeColor(LINEA).lineWidth(0.6).stroke();
    }
    y += 18;
    if (y > H - 240) { doc.addPage(); doc.rect(0, 0, W, 4).fill(ACENTO); y = 54; }

    /* Totales (derecha). */
    const TX = R - 210, TW = 210;
    let ty = y;
    const fila = (k: string, val: string, fuerte = false, nota = '') => {
      doc.font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 10 : 9.5).fillColor(fuerte ? TINTA : GRIS).text(k, TX, ty, { width: TW - 100, lineBreak: false });
      doc.font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 10 : 9.5).fillColor(TINTA).text(val, TX + TW - 100, ty, { width: 100, align: 'right' });
      if (nota) { ty += 12; doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text(nota, TX, ty, { width: TW - 100, height: 10, ellipsis: true }); }
      ty += 17;
    };
    fila('Subtotal', m(d.subtotal));
    if (d.descuento) fila('Descuento', `-${m(d.descuento)}`, false, promocion ? promocion.nombre.replace(/ \(ejemplo\)$/, '') : '');
    ty += 2;
    doc.moveTo(TX, ty).lineTo(R, ty).strokeColor(TINTA).lineWidth(0.8).stroke();
    ty += 9;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA).text('Total', TX, ty + 2, { width: TW - 120 });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(ACENTO).text(m(d.total), TX + TW - 140, ty, { width: 140, align: 'right' });
    ty += 28;
    const pct = sucursal?.anticipoPct ?? 0;
    const anticipo = anticipoDe(d.total, pct);
    if (v) {
      fila('Pagado', m(v.pagado));
      fila(saldo > 0 ? 'Saldo pendiente' : 'Saldo', m(saldo), true);
      if (anticipo && v.pagado < anticipo && v.estado !== 'cancelada') fila('Falta para iniciar', m(anticipo - v.pagado), false, `Anticipo del ${pct}%`);
    } else if (anticipo) {
      fila('Anticipo para iniciar', m(anticipo), true, `${pct}% del total`);
    }

    /* Pagos, condiciones y notas (izquierda). */
    const IW = TX - L - 30;
    let iy = y;
    const bloque = (t: string) => { etiqueta(t, L, iy); iy += 13; };
    if (v?.pagos?.length) {
      bloque('Pagos recibidos');
      for (const p of [...v.pagos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
        doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(`${fmtFecha(p.fecha)}  ·  ${p.metodo}`, L, iy, { width: IW - 80 });
        doc.font('Helvetica').fontSize(8.5).fillColor(TINTA).text(m(p.monto), L + IW - 80, iy, { width: 80, align: 'right' });
        iy += 13;
      }
      iy += 10;
    }
    const condiciones = [
      esVenta ? '' : `Precios válidos hasta el ${vence}. Para confirmar tu pedido responde este mensaje o llámanos.`,
      sucursal?.condiciones?.trim() ?? '',
    ].filter(Boolean);
    if (condiciones.length) {
      bloque('Condiciones');
      doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(condiciones.join('\n'), L, iy, { width: IW, lineGap: 2 });
      iy = doc.y + 12;
    }
    if (d.notas) {
      bloque('Notas');
      doc.font('Helvetica').fontSize(8.5).fillColor(TINTA).text(d.notas, L, iy, { width: IW, lineGap: 2 });
      iy = doc.y + 12;
    }

    /* Datos para transferencia: recuadro a todo lo ancho, solo si hay algo por pagar. */
    const banco = datosTransferencia(sucursal);
    const porPagar = esVenta ? saldo > 0 && v!.estado !== 'cancelada' : d.total > 0;
    if (banco.length && porPagar) {
      const ind = sucursal?.indicacionesPago?.trim() ?? '';
      const porFila = 3, colW = (AN - 32) / porFila;
      const filas = Math.ceil(banco.length / porFila);
      doc.font('Helvetica').fontSize(8.5);
      const altoInd = ind ? doc.heightOfString(ind, { width: AN - 32, lineGap: 2 }) + 8 : 0;
      const alto = 30 + filas * 30 + altoInd + 6;
      let by = Math.max(iy, ty) + 8;
      if (by + alto > H - 74) { doc.addPage(); doc.rect(0, 0, W, 4).fill(ACENTO); by = 54; }
      doc.roundedRect(L, by, AN, alto, 6).fillAndStroke('#f4f7fa', LINEA);
      doc.rect(L, by + 6, 3, alto - 12).fill(ACENTO);
      etiqueta('Datos para transferencia o depósito', L + 16, by + 12);
      banco.forEach(([k, val], n) => {
        const cx = L + 16 + (n % porFila) * colW, cy = by + 28 + Math.floor(n / porFila) * 30;
        doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text(k, cx, cy, { width: colW - 10 });
        doc.font(k === 'CLABE' || k === 'Tarjeta' || k === 'Cuenta' ? 'Courier-Bold' : 'Helvetica-Bold').fontSize(k === 'CLABE' ? 10 : 9.5).fillColor(TINTA)
          .text(val, cx, cy + 10, { width: colW - 10, lineBreak: false, ellipsis: true });
      });
      if (ind) doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(ind, L + 16, by + 28 + filas * 30 + 2, { width: AN - 32, lineGap: 2 });
    }

    /* Pie en cada página. */
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.moveTo(L, H - 62).lineTo(R, H - 62).strokeColor(LINEA).lineWidth(0.6).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(`Gracias por tu preferencia  ·  ${taller.nombre}`, L, H - 50, { width: AN * 0.7, lineBreak: false });
      doc.text(`${d.folio}  ·  ${i - rango.start + 1} / ${rango.count}`, L + AN * 0.7, H - 50, { width: AN * 0.3, align: 'right', lineBreak: false });
    }
    doc.end();
    return fin;
  }

  /** Estado en palabras para el encabezado. */
  private estado(tipo: 'cotizacion' | 'venta', estado: string, saldo: number) {
    if (tipo === 'cotizacion') return ({ borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada' } as Record<string, string>)[estado] ?? estado;
    if (estado === 'cancelada') return 'Cancelada';
    const e = ({ pendiente: 'Pendiente', produccion: 'En producción', lista: 'Lista', entregada: 'Entregada' } as Record<string, string>)[estado] ?? estado;
    return saldo > 0 ? e : `${e} · Pagada`;
  }

  /** Texto listo para WhatsApp, con liga al PDF. */
  whatsapp({ tipo, d, taller, sucursal, cliente }: Datos, urlPdf: string) {
    const m = (n: number) => this.money(n, taller.moneda);
    const nombre = cliente?.nombre || d.clienteNombre;
    const lineas = d.items.map((i) => `• ${+i.cantidad.toFixed(4)} × ${i.descripcion}: ${m(i.cantidad * i.precio)}`).join('\n');
    let t = `Hola${nombre ? ' ' + nombre : ''},\n`;
    t += tipo === 'venta' ? `Confirmamos tu pedido *${d.folio}* en ${taller.nombre}:\n\n` : `Te comparto la cotización *${d.folio}* de ${taller.nombre}:\n\n`;
    t += lineas + '\n\n';
    if (d.descuento) t += `Subtotal: ${m(d.subtotal)}\nDescuento: -${m(d.descuento)}\n`;
    t += `*Total: ${m(d.total)}*\n`;
    if (tipo === 'venta') {
      const v = d as Venta;
      if (v.pagado) t += `Pagado: ${m(v.pagado)}\n`;
      t += `Saldo: ${m(Math.max(0, v.total - v.pagado))}\n`;
      if (v.entrega) t += `Entrega: ${fmtFecha(v.entrega)}\n`;
    } else {
      t += `Vigencia: hasta el ${fmtFecha(sumarDias(String(d.fecha).slice(0, 10), (d as Cotizacion).vigenciaDias))}\n`;
    }
    const v = tipo === 'venta' ? (d as Venta) : null;
    const anticipo = anticipoDe(d.total, sucursal?.anticipoPct);
    if (anticipo && (!v || (v.pagado < anticipo && v.estado !== 'cancelada')))
      t += `${v ? 'Falta para iniciar' : 'Anticipo para iniciar'} (${sucursal!.anticipoPct}%): ${m(v ? anticipo - v.pagado : anticipo)}\n`;
    const banco = datosTransferencia(sucursal);
    const porPagar = v ? v.total - v.pagado > 0 && v.estado !== 'cancelada' : d.total > 0;
    if (banco.length && porPagar) {
      t += `\n*Datos para transferencia*\n${banco.map(([k, val]) => `${k}: ${val}`).join('\n')}\n`;
      if (sucursal?.indicacionesPago?.trim()) t += `${sucursal.indicacionesPago.trim()}\n`;
    }
    if (sucursal?.condiciones?.trim()) t += `\n_${sucursal.condiciones.trim().replace(/\n+/g, ' ')}_\n`;
    t += `\nPDF: ${urlPdf}\n\n¡Gracias por tu preferencia!`;
    let tel = (cliente?.telefono || d.clienteTelefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = (taller.lada || '') + tel;
    return { telefono: tel, texto: t, url: `https://wa.me/${tel}?text=${encodeURIComponent(t)}` };
  }
}
