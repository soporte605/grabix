import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Cotizacion, Venta } from '../entities';
import { sumarDias } from '../common/suscripcion';
import { DocumentosService } from './documentos.service';

type Datos = Awaited<ReturnType<DocumentosService['paraImprimir']>>;

const TINTA = '#13222b';
const GRIS = '#5a6a74';
const LINEA = '#d6dee2';
/** Colores de marca; se reemplazan al definir la identidad visual. */
const ACENTO = process.env.PDF_COLOR_ACENTO ?? '#0b6670';
const SEGUNDO = process.env.PDF_COLOR_SECUNDARIO ?? '#c56a12';

export const fmtFecha = (f?: string | null) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '');

@Injectable()
export class PdfService {
  money(n: number, moneda: string) {
    return moneda + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  generar({ tipo, d, taller, sucursal, cliente, promocion }: Datos): Promise<Buffer> {
    const m = (n: number) => this.money(n, taller.moneda);
    const doc = new PDFDocument({ size: 'LETTER', margin: 48, info: { Title: `${d.folio} ${taller.nombre}` } });
    const out: Buffer[] = [];
    doc.on('data', (b: Buffer) => out.push(b));
    const fin = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(out))));
    const W = doc.page.width;
    const L = 48;
    const R = W - 48;

    doc.rect(0, 0, W, 8).fill(ACENTO);
    doc.rect(0, 8, W, 3).fill(SEGUNDO);

    doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(18).text(taller.nombre, L, 36, { width: 300 });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS);
    const contacto = [
      sucursal && sucursal.nombre !== 'Matriz' ? `Sucursal ${sucursal.nombre}` : '',
      sucursal?.direccion || taller.direccion,
      [sucursal?.telefono || taller.telefono ? `Tel/WhatsApp: ${sucursal?.telefono || taller.telefono}` : '', taller.email].filter(Boolean).join('  ·  '),
    ].filter(Boolean);
    doc.text(contacto.join('\n'), L, doc.y + 2, { width: 300 });

    doc.font('Helvetica-Bold').fontSize(13).fillColor(ACENTO).text(tipo === 'venta' ? 'ORDEN DE VENTA' : 'COTIZACIÓN', 330, 36, { width: R - 330, align: 'right' });
    doc.font('Courier-Bold').fontSize(12).fillColor(TINTA).text(d.folio, 330, doc.y + 2, { width: R - 330, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(`Fecha: ${fmtFecha(d.fecha)}`, 330, doc.y + 2, { width: R - 330, align: 'right' });
    const extra =
      tipo === 'venta'
        ? (d as Venta).entrega ? `Entrega: ${fmtFecha((d as Venta).entrega)}` : ''
        : `Válida hasta: ${fmtFecha(sumarDias(String(d.fecha).slice(0, 10), (d as Cotizacion).vigenciaDias))}`;
    if (extra) doc.text(extra, 330, doc.y + 1, { width: R - 330, align: 'right' });

    let y = Math.max(doc.y, 100) + 14;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINEA).lineWidth(1).stroke();
    y += 10;
    doc.fontSize(8).fillColor(GRIS).text('CLIENTE', L, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA).text(cliente?.nombre || d.clienteNombre || 'Público en general', L, y + 11);
    const datosCli = [cliente?.empresa, cliente?.telefono || d.clienteTelefono, cliente?.email].filter(Boolean).join('  ·  ');
    if (datosCli) doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(datosCli, L, doc.y + 1);
    y = doc.y + 16;

    // Tabla de conceptos
    const cols = [
      { t: 'Cant.', x: L, w: 44, a: 'center' as const },
      { t: 'Descripción', x: L + 44, w: R - L - 44 - 180, a: 'left' as const },
      { t: 'Precio unitario', x: R - 180, w: 90, a: 'right' as const },
      { t: 'Importe', x: R - 90, w: 90, a: 'right' as const },
    ];
    const fila = (vals: string[], yy: number, head = false) => {
      const h = Math.max(...vals.map((v, i) => doc.font(head ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).heightOfString(v, { width: cols[i].w - 12 }))) + 12;
      if (head) doc.rect(L, yy, R - L, h).fill(ACENTO);
      vals.forEach((v, i) =>
        doc.fillColor(head ? '#ffffff' : TINTA).font(head ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).text(v, cols[i].x + 6, yy + 6, { width: cols[i].w - 12, align: cols[i].a }),
      );
      if (!head) doc.moveTo(L, yy + h).lineTo(R, yy + h).strokeColor(LINEA).stroke();
      return yy + h;
    };
    y = fila(cols.map((c) => c.t), y, true);
    for (const i of d.items) {
      if (y > doc.page.height - 160) {
        doc.addPage();
        y = 48;
        y = fila(cols.map((c) => c.t), y, true);
      }
      y = fila([String(+i.cantidad.toFixed(4)), i.descripcion, m(i.precio), m(i.cantidad * i.precio)], y);
    }

    // Totales
    y += 12;
    const tot = (k: string, v: string, fuerte = false) => {
      doc.font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 12 : 10).fillColor(fuerte ? TINTA : GRIS);
      doc.text(k, R - 250, y, { width: 150, align: 'right' });
      doc.text(v, R - 100, y, { width: 100, align: 'right' });
      y += fuerte ? 20 : 15;
    };
    tot('Subtotal', m(d.subtotal));
    if (d.descuento) tot(`Descuento${promocion ? ` (${promocion.nombre})` : ''}`, `-${m(d.descuento)}`);
    tot('Total', m(d.total), true);
    if (tipo === 'venta') {
      const v = d as Venta;
      tot('Pagado', m(v.pagado));
      tot('Saldo', m(Math.max(0, v.total - v.pagado)), true);
    }
    if (d.notas) {
      y += 8;
      doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(d.notas, L, y, { width: R - L });
    }
    doc.fontSize(8).fillColor('#9aa6ad').text('Gracias por su preferencia', L, doc.page.height - 60, { width: R - L, align: 'center' });
    doc.end();
    return fin;
  }

  /** Texto listo para WhatsApp, con liga al PDF. */
  whatsapp({ tipo, d, taller, cliente }: Datos, urlPdf: string) {
    const m = (n: number) => this.money(n, taller.moneda);
    const nombre = cliente?.nombre || d.clienteNombre;
    const lineas = d.items.map((i) => `• ${+i.cantidad.toFixed(4)} × ${i.descripcion}: ${m(i.cantidad * i.precio)}`).join('\n');
    let t = `Hola${nombre ? ' ' + nombre : ''} 👋\n`;
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
    t += `\nPDF: ${urlPdf}\n\n¡Gracias por tu preferencia!`;
    let tel = (cliente?.telefono || d.clienteTelefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = (taller.lada || '') + tel;
    return { telefono: tel, texto: t, url: `https://wa.me/${tel}?text=${encodeURIComponent(t)}` };
  }
}
