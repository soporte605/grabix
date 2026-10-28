import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Cotizacion, Venta } from '../entities';
import { sumarDias } from '../common/suscripcion';
import { DocumentosService } from './documentos.service';

type Datos = Awaited<ReturnType<DocumentosService['paraImprimir']>>;

const TINTA = '#13222b';
const GRIS = '#5a6a74';
const LINEA = '#d6dee2';
const SUAVE = '#f2f5f8';
/** Colores de marca; se reemplazan al definir la identidad visual. */
const ACENTO = process.env.PDF_COLOR_ACENTO ?? '#002150';
const SEGUNDO = process.env.PDF_COLOR_SECUNDARIO ?? '#67BE28';

export const fmtFecha = (f?: string | null) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '');

@Injectable()
export class PdfService {
  money(n: number, moneda: string) {
    return moneda + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  generar({ tipo, d, taller, sucursal, cliente, promocion }: Datos): Promise<Buffer> {
    const m = (n: number) => this.money(n, taller.moneda);
    const doc = new PDFDocument({ size: 'LETTER', margin: 48, bufferPages: true, info: { Title: `${d.folio} ${taller.nombre}`, Author: taller.nombre } });
    const out: Buffer[] = [];
    doc.on('data', (b: Buffer) => out.push(b));
    const fin = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(out))));
    const W = doc.page.width, H = doc.page.height;
    const L = 48, R = W - 48, AN = R - L;
    const esVenta = tipo === 'venta';
    const v = esVenta ? (d as Venta) : null;
    const saldo = v ? Math.max(0, v.total - v.pagado) : 0;

    /* Encabezado: banda azul con el taller a la izquierda y el documento a la derecha. */
    doc.rect(0, 0, W, 112).fill(ACENTO);
    doc.rect(0, 112, W, 4).fill(SEGUNDO);
    const iniciales = taller.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'G';
    doc.roundedRect(L, 30, 48, 48, 10).fill(SEGUNDO);
    doc.font('Helvetica-Bold').fontSize(iniciales.length > 1 ? 18 : 22).fillColor(ACENTO).text(iniciales, L, 30 + (iniciales.length > 1 ? 15 : 13), { width: 48, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text(taller.nombre, L + 62, 30, { width: 290, lineBreak: false, ellipsis: true });
    const contacto = [
      sucursal && sucursal.nombre !== 'Matriz' ? `Sucursal ${sucursal.nombre}` : '',
      sucursal?.direccion || taller.direccion,
      [sucursal?.telefono || taller.telefono ? `Tel. ${sucursal?.telefono || taller.telefono}` : '', taller.email].filter(Boolean).join('   ·   '),
    ].filter(Boolean);
    doc.font('Helvetica').fontSize(8.5).fillColor('#c9d4e3').text(contacto.join('\n'), L + 62, 53, { width: 290, lineGap: 1.5 });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(SEGUNDO).text(esVenta ? 'NOTA DE VENTA' : 'COTIZACIÓN', 360, 32, { width: R - 360, align: 'right', characterSpacing: 1.2 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(d.folio, 360, 46, { width: R - 360, align: 'right' });
    const pill = this.estado(tipo, d.estado, saldo);
    doc.font('Helvetica-Bold').fontSize(8);
    const pw = doc.widthOfString(pill.t) + 18;
    doc.roundedRect(R - pw, 78, pw, 17, 8.5).fill(pill.bg);
    doc.fillColor(pill.c).text(pill.t, R - pw, 82.5, { width: pw, align: 'center' });

    /* Tarjetas: cliente y fechas. */
    let y = 136;
    const tarjeta = (x: number, w: number, titulo: string, lineas: { t: string; f?: boolean }[]) => {
      doc.font('Helvetica').fontSize(9.5);
      const alto = 30 + lineas.reduce((a, l) => a + doc.heightOfString(l.t, { width: w - 24 }) + 2, 0);
      doc.roundedRect(x, y, w, Math.max(alto, 62), 8).fill(SUAVE);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(GRIS).text(titulo, x + 12, y + 11, { width: w - 24, characterSpacing: 0.8 });
      let yy = y + 25;
      for (const l of lineas) {
        doc.font(l.f ? 'Helvetica-Bold' : 'Helvetica').fontSize(l.f ? 11 : 9).fillColor(l.f ? TINTA : GRIS).text(l.t, x + 12, yy, { width: w - 24 });
        yy = doc.y + 2;
      }
      return Math.max(alto, 62);
    };
    const datosCli = [cliente?.empresa, cliente?.telefono || d.clienteTelefono, cliente?.email].filter(Boolean) as string[];
    const fechas = [
      { t: `Fecha: ${fmtFecha(d.fecha)}` },
      esVenta
        ? { t: v!.entrega ? `Entrega: ${fmtFecha(v!.entrega)}` : 'Entrega: por definir' }
        : { t: `Válida hasta: ${fmtFecha(sumarDias(String(d.fecha).slice(0, 10), (d as Cotizacion).vigenciaDias))}` },
    ];
    const h1 = tarjeta(L, AN * 0.62 - 6, 'CLIENTE', [{ t: cliente?.nombre || d.clienteNombre || 'Público en general', f: true }, ...datosCli.map((t) => ({ t }))]);
    const h2 = tarjeta(L + AN * 0.62 + 6, AN * 0.38 - 6, esVenta ? 'PEDIDO' : 'VIGENCIA', fechas);
    y += Math.max(h1, h2) + 18;

    /* Tabla de conceptos. */
    const cols = [
      { t: '#', x: L, w: 26, a: 'center' as const },
      { t: 'Cant.', x: L + 26, w: 48, a: 'center' as const },
      { t: 'Descripción', x: L + 74, w: AN - 74 - 184, a: 'left' as const },
      { t: 'Precio unitario', x: R - 184, w: 92, a: 'right' as const },
      { t: 'Importe', x: R - 92, w: 92, a: 'right' as const },
    ];
    const encabezado = (yy: number) => {
      doc.roundedRect(L, yy, AN, 24, 6).fill(ACENTO);
      cols.forEach((c) => doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text(c.t, c.x + 6, yy + 8, { width: c.w - 12, align: c.a }));
      return yy + 24;
    };
    y = encabezado(y);
    d.items.forEach((i, k) => {
      const vals = [String(k + 1), String(+Number(i.cantidad).toFixed(4)), i.descripcion, m(i.precio), m(i.cantidad * i.precio)];
      doc.font('Helvetica').fontSize(9.5);
      const h = Math.max(...vals.map((x, n) => doc.heightOfString(x, { width: cols[n].w - 12 }))) + 14;
      if (y + h > H - 190) {
        doc.addPage();
        y = encabezado(48);
      }
      if (k % 2 === 1) doc.rect(L, y, AN, h).fill(SUAVE);
      vals.forEach((x, n) =>
        doc.font(n === 4 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(n === 0 ? GRIS : TINTA).text(x, cols[n].x + 6, y + 7, { width: cols[n].w - 12, align: cols[n].a }),
      );
      y += h;
    });
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINEA).lineWidth(1).stroke();
    y += 16;
    if (y > H - 230) { doc.addPage(); y = 48; }

    /* Totales a la derecha; pagos o condiciones a la izquierda. */
    const TX = R - 220, TW = 220;
    let ty = y;
    const fila = (k: string, val: string, color = GRIS) => {
      doc.font('Helvetica').fontSize(10).fillColor(color).text(k, TX + 14, ty, { width: TW - 118, lineBreak: false, ellipsis: true });
      doc.font('Helvetica').fontSize(10).fillColor(color === GRIS ? TINTA : color).text(val, TX + TW - 104, ty, { width: 90, align: 'right' });
      ty += 17;
    };
    fila('Subtotal', m(d.subtotal));
    if (d.descuento) fila(promocion ? `Desc. ${promocion.nombre}` : 'Descuento', `-${m(d.descuento)}`, '#b42318');
    ty += 3;
    doc.roundedRect(TX, ty, TW, 34, 8).fill(ACENTO);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('TOTAL', TX + 14, ty + 11.5, { width: 80 });
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text(m(d.total), TX + 90, ty + 9.5, { width: TW - 104, align: 'right' });
    ty += 44;
    if (v) {
      fila('Pagado', m(v.pagado));
      doc.roundedRect(TX, ty - 2, TW, 28, 8).fill(saldo > 0 ? '#fff4e5' : '#e8f6dd');
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(saldo > 0 ? '#9a5b00' : '#2f6b12').text(saldo > 0 ? 'Saldo pendiente' : 'Pagada', TX + 14, ty + 7, { width: 110 });
      doc.text(m(saldo), TX + 110, ty + 7, { width: TW - 124, align: 'right' });
      ty += 34;
    }

    const IW = TX - L - 24;
    let iy = y;
    const titulo = (t: string) => {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(GRIS).text(t, L, iy, { characterSpacing: 0.8 });
      iy = doc.y + 5;
    };
    if (v?.pagos?.length) {
      titulo('PAGOS RECIBIDOS');
      for (const p of [...v.pagos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
        doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(`${fmtFecha(p.fecha)}   ${p.metodo}`, L, iy, { width: IW - 90 });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text(m(p.monto), L + IW - 90, iy, { width: 90, align: 'right' });
        iy += 15;
      }
      iy += 8;
    }
    if (!esVenta) {
      titulo('CONDICIONES');
      const cond = [
        `Precios en ${taller.moneda === '$' ? 'pesos' : taller.moneda}, válidos hasta el ${fmtFecha(sumarDias(String(d.fecha).slice(0, 10), (d as Cotizacion).vigenciaDias))}.`,
        'Para confirmar tu pedido responde este mensaje o llámanos.',
      ];
      doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(cond.join('\n'), L, iy, { width: IW, lineGap: 2 });
      iy = doc.y + 10;
    }
    if (d.notas) {
      titulo('NOTAS');
      doc.font('Helvetica').fontSize(9);
      const hn = doc.heightOfString(d.notas, { width: IW - 22 }) + 16;
      doc.rect(L, iy, 3, hn).fill(SEGUNDO);
      doc.rect(L + 3, iy, IW - 3, hn).fill(SUAVE);
      doc.fillColor(TINTA).text(d.notas, L + 14, iy + 8, { width: IW - 22 });
      iy += hn + 8;
    }

    /* Pie en cada página. */
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.moveTo(L, H - 58).lineTo(R, H - 58).strokeColor(LINEA).lineWidth(1).stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text('¡Gracias por tu preferencia!', L, H - 48, { width: AN / 2, lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor('#9aa6ad').text(`${d.folio}  ·  Página ${i - rango.start + 1} de ${rango.count}`, L + AN / 2, H - 47, { width: AN / 2, align: 'right', lineBreak: false });
      doc.text('Documento generado con Grabix', L, H - 34, { width: AN / 2, lineBreak: false });
    }
    doc.end();
    return fin;
  }

  /** Etiqueta y colores del estado para el encabezado. */
  private estado(tipo: 'cotizacion' | 'venta', estado: string, saldo: number) {
    const ok = { bg: SEGUNDO, c: '#002150' }, neutro = { bg: '#ffffff', c: '#002150' }, mal = { bg: '#f3d1cf', c: '#8a1c13' };
    if (tipo === 'cotizacion') {
      const t: Record<string, [string, typeof ok]> = { borrador: ['BORRADOR', neutro], enviada: ['ENVIADA', neutro], aceptada: ['ACEPTADA', ok], rechazada: ['RECHAZADA', mal] };
      const [txt, col] = t[estado] ?? ['COTIZACIÓN', neutro];
      return { t: txt, ...col };
    }
    if (estado === 'cancelada') return { t: 'CANCELADA', ...mal };
    if (saldo <= 0) return { t: 'PAGADA', ...ok };
    const e: Record<string, string> = { pendiente: 'PENDIENTE', produccion: 'EN PRODUCCIÓN', lista: 'LISTA PARA ENTREGA', entregada: 'ENTREGADA' };
    return { t: `${e[estado] ?? 'PEDIDO'}  ·  SALDO PENDIENTE`, ...neutro };
  }

  /** Texto listo para WhatsApp, con liga al PDF. */
  whatsapp({ tipo, d, taller, cliente }: Datos, urlPdf: string) {
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
    t += `\nPDF: ${urlPdf}\n\n¡Gracias por tu preferencia!`;
    let tel = (cliente?.telefono || d.clienteTelefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = (taller.lada || '') + tel;
    return { telefono: tel, texto: t, url: `https://wa.me/${tel}?text=${encodeURIComponent(t)}` };
  }
}
