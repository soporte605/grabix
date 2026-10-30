import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { DataSource, Not } from 'typeorm';
import { BitacoraService } from '../common/bitacora.service';
import { Publico, Roles, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { DocumentosModule } from '../documentos/documentos.module';
import { DocumentosService } from '../documentos/documentos.service';
import { anticipoDe, datosTransferencia } from '../documentos/pdf.service';
import {
  Comprobante, Cotizacion, Diseno, EstadoComprobante, EstadoCotizacion, EstadoDiseno, EstadoVenta, EtapaTaller, Foto, Rol, Venta,
} from '../entities';
import { DIR, imagenDe, nombre, ruta } from '../fotos/fotos.module';
import { etapaDe } from '../produccion/produccion.module';

/*
 * Enlace del pedido para el cliente (/p/:token): ve su nota y el avance, aprueba el diseño o pide cambios,
 * mira las fotos del trabajo y sube su comprobante de transferencia. El taller sube las pruebas de diseño,
 * las manda por WhatsApp (la imagen sale en la vista previa del enlace) y puede registrar una aprobación
 * que llegó por WhatsApp o en mostrador.
 */

const MAX_VERSIONES = 20;
const MAX_COMPROBANTES = 20;
const MAX_PENDIENTES = 5;
const base = () => (process.env.PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, '');
export const urlPedido = (token: string, version?: number) => `${base()}/p/${token}${version ? `?d=${version}` : ''}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const sinEjemplo = (t: string) => t.replace(/\s*\(ejemplo\)\s*$/i, '');

export class DisenoDto {
  @IsString() @MaxLength(6_000_000) imagen: string;
  @IsString() @MaxLength(1_000_000) miniatura: string;
  @IsString() @MaxLength(1_500_000) vista: string;
  @IsInt() @Min(1) @Max(10000) ancho: number;
  @IsInt() @Min(1) @Max(10000) alto: number;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

export class AprobarDto {
  @IsIn(['whatsapp', 'mostrador']) via: 'whatsapp' | 'mostrador';
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

export class RespuestaDto {
  @IsBoolean() aprobado: boolean;
  @IsString() @MinLength(2, { message: 'Escribe tu nombre' }) @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(1000) comentario?: string;
}

export class AceptarDto {
  @IsString() @MinLength(2, { message: 'Escribe tu nombre' }) @MaxLength(120) nombre: string;
}

export class ComprobanteDto {
  @IsString() @MaxLength(6_000_000) imagen: string;
  @IsString() @MaxLength(1_000_000) miniatura: string;
  @IsInt() @Min(1) @Max(10000) ancho: number;
  @IsInt() @Min(1) @Max(10000) alto: number;
  @IsOptional() @IsNumber() @Min(0) monto?: number;
  @IsOptional() @IsString() @MaxLength(200) nota?: string;
}

export class AplicarDto {
  @IsNumber() @Min(0.01) monto: number;
}

/** Cliente que respondió por el enlace, para la bitácora. */
const comoCliente = (tallerId: number, nombre: string) => ({ tallerId, usuarioId: null, nombre: `${nombre} (cliente, por el enlace)` }) as unknown as Sesion;

async function guardar(tallerId: number, dataUrl: string) {
  const img = imagenDe(dataUrl);
  const archivo = nombre(img.ext);
  await mkdir(join(DIR, String(tallerId)), { recursive: true });
  await writeFile(ruta(tallerId, archivo), img.buf);
  return { archivo, bytes: img.buf.length };
}

const borrar = (tallerId: number, ...archivos: string[]) =>
  Promise.all(archivos.map((a) => unlink(ruta(tallerId, a)).catch(() => undefined)));

@Injectable()
export class EnlaceService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    private docs: DocumentosService,
    private bitacora: BitacoraService,
  ) {}

  /* ---------- taller ---------- */

  private async venta(s: Sesion, id: number) {
    const v = await this.ds.manager.findOne(Venta, { where: { id, tallerId: s.tallerId }, relations: { items: false, pagos: false } });
    if (!v || (s.sucursal && v.sucursalId !== s.sucursal)) throw new NotFoundException('No encontramos ese pedido');
    return v;
  }

  private archivoUrl(token: string, tipo: 'disenos' | 'fotos' | 'comprobantes', id: number, t?: 'mini' | 'vista') {
    return `/api/publico/pedido/${token}/${tipo}/${id}${t ? `?t=${t}` : ''}`;
  }

  private conUrls(token: string, d: Diseno) {
    const { archivo: _a, miniatura: _m, vista: _v, ...resto } = d;
    return { ...resto, url: this.archivoUrl(token, 'disenos', d.id), mini: this.archivoUrl(token, 'disenos', d.id, 'mini') };
  }

  async disenos(s: Sesion, ventaId: number) {
    const v = await this.venta(s, ventaId);
    const ds = await this.ds.manager.find(Diseno, { where: { tallerId: s.tallerId, ventaId }, order: { version: 'DESC' } });
    return { enlace: urlPedido(v.tokenPublico), disenos: ds.map((d) => this.conUrls(v.tokenPublico, d)) };
  }

  async subirDiseno(s: Sesion, ventaId: number, dto: DisenoDto) {
    const em = this.ds.manager;
    const v = await this.venta(s, ventaId);
    if (v.estado === EstadoVenta.Cancelada || v.estado === EstadoVenta.Entregada) throw new BadRequestException('Ese pedido ya está cerrado');
    const n = await em.count(Diseno, { where: { tallerId: s.tallerId, ventaId } });
    if (n >= MAX_VERSIONES) throw new BadRequestException(`Un pedido puede tener hasta ${MAX_VERSIONES} versiones de diseño`);
    const vista = imagenDe(dto.vista);
    if (vista.ext !== 'jpg') throw new BadRequestException('La vista previa debe ser JPEG');
    const [g, m, p] = await Promise.all([guardar(s.tallerId, dto.imagen), guardar(s.tallerId, dto.miniatura), guardar(s.tallerId, dto.vista)]);
    const ultima = await em.findOne(Diseno, { where: { tallerId: s.tallerId, ventaId }, order: { version: 'DESC' } });
    // Una versión nueva deja sin efecto la anterior que seguía esperando respuesta.
    await em.update(Diseno, { tallerId: s.tallerId, ventaId, estado: EstadoDiseno.Pendiente }, { estado: EstadoDiseno.Reemplazado });
    const d = await em.save(em.create(Diseno, {
      tallerId: s.tallerId, ventaId, version: (ultima?.version ?? 0) + 1, archivo: g.archivo, miniatura: m.archivo, vista: p.archivo,
      ancho: dto.ancho, alto: dto.alto, nota: dto.nota?.trim() || null, usuarioId: s.usuarioId, usuarioNombre: s.nombre,
    }));
    // El pedido pasa a "Esperando aprobación" si todavía no entra a máquina.
    await this.moverEtapa(v, [EtapaTaller.Diseno, EtapaTaller.Cola], EtapaTaller.Aprobacion);
    await this.bitacora.registrar(s, 'diseno', 'venta', ventaId, { folio: v.folio, version: d.version });
    return this.conUrls(v.tokenPublico, d);
  }

  /** Aprobación que el cliente dio por WhatsApp o en persona. */
  async aprobar(s: Sesion, id: number, dto: AprobarDto) {
    const em = this.ds.manager;
    const d = await em.findOneBy(Diseno, { id, tallerId: s.tallerId });
    if (!d) throw new NotFoundException('No encontramos ese diseño');
    const v = await this.venta(s, d.ventaId);
    if (d.estado === EstadoDiseno.Aprobado) throw new BadRequestException('Ese diseño ya está aprobado');
    if (d.estado === EstadoDiseno.Reemplazado) throw new BadRequestException('Hay una versión más nueva de este diseño');
    Object.assign(d, { estado: EstadoDiseno.Aprobado, via: dto.via, respuesta: dto.nota?.trim() || null, respondidoPor: s.nombre, respondidoEn: new Date() });
    await em.save(d);
    await this.moverEtapa(v, [EtapaTaller.Diseno, EtapaTaller.Aprobacion], EtapaTaller.Cola);
    await this.bitacora.registrar(s, 'aprobar_diseno', 'venta', v.id, { folio: v.folio, version: d.version, via: dto.via });
    return this.conUrls(v.tokenPublico, d);
  }

  async eliminarDiseno(s: Sesion, id: number) {
    const em = this.ds.manager;
    const d = await em.findOneBy(Diseno, { id, tallerId: s.tallerId });
    if (!d) throw new NotFoundException('No encontramos ese diseño');
    const v = await this.venta(s, d.ventaId);
    if (!VEN_COSTOS.includes(s.rol) && d.usuarioId !== s.usuarioId) throw new ForbiddenException('Solo puedes borrar los diseños que tú subiste');
    if (d.estado === EstadoDiseno.Aprobado) throw new BadRequestException('Un diseño aprobado se conserva como registro');
    await em.delete(Diseno, { id });
    await borrar(s.tallerId, d.archivo, d.miniatura, d.vista);
    await this.bitacora.registrar(s, 'eliminar_diseno', 'venta', v.id, { folio: v.folio, version: d.version });
    return { ok: true };
  }

  /** Texto de WhatsApp para pedir la aprobación de la última versión. */
  async whatsappDiseno(s: Sesion, ventaId: number) {
    const v = await this.venta(s, ventaId);
    const d = await this.ds.manager.findOne(Diseno, { where: { tallerId: s.tallerId, ventaId }, order: { version: 'DESC' } });
    if (!d) throw new BadRequestException('Primero sube el diseño');
    const { taller, cliente } = await this.docs.paraImprimir('venta', v);
    const nom = sinEjemplo(cliente?.nombre || v.clienteNombre || '');
    let t = `Hola${nom ? ' ' + nom : ''},\n`;
    t += `Te comparto el diseño de tu pedido *${v.folio}*${d.version > 1 ? ` (versión ${d.version})` : ''} para que lo revises.\n`;
    if (d.nota) t += `${d.nota}\n`;
    t += `Revisa nombres, fechas, ortografía, tamaño y posición. Responde *Sí* para aprobarlo o dime qué cambiar.\n`;
    t += `Verlo y aprobar: ${urlPedido(v.tokenPublico, d.version)}\n`;
    t += sinEjemplo(taller.nombre);
    let tel = (cliente?.telefono || v.clienteTelefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = (taller.lada || '') + tel;
    return { telefono: tel, texto: t, url: `https://wa.me/${tel}?text=${encodeURIComponent(t)}` };
  }

  async comprobantes(s: Sesion, ventaId: number) {
    const v = await this.venta(s, ventaId);
    const cs = await this.ds.manager.find(Comprobante, { where: { tallerId: s.tallerId, ventaId }, order: { id: 'DESC' } });
    return cs.map(({ archivo: _a, miniatura: _m, ...c }) => ({
      ...c, url: this.archivoUrl(v.tokenPublico, 'comprobantes', c.id), mini: this.archivoUrl(v.tokenPublico, 'comprobantes', c.id, 'mini'),
    }));
  }

  /** Registra el pago de un comprobante (va a la caja abierta como cualquier cobro). */
  async aplicar(s: Sesion, id: number, dto: AplicarDto) {
    const em = this.ds.manager;
    const c = await em.findOneBy(Comprobante, { id, tallerId: s.tallerId });
    if (!c) throw new NotFoundException('No encontramos ese comprobante');
    await this.venta(s, c.ventaId);
    if (c.estado !== EstadoComprobante.Pendiente) throw new BadRequestException('Ese comprobante ya se revisó');
    const r = await this.docs.registrarPago(s, c.ventaId, { monto: r2(dto.monto), metodo: 'Transferencia' });
    await em.update(Comprobante, { id }, { estado: EstadoComprobante.Aplicado, pagoId: r.pagoId, revisadoPor: s.nombre, revisadoEn: new Date() });
    return r;
  }

  async descartar(s: Sesion, id: number) {
    const em = this.ds.manager;
    const c = await em.findOneBy(Comprobante, { id, tallerId: s.tallerId });
    if (!c) throw new NotFoundException('No encontramos ese comprobante');
    const v = await this.venta(s, c.ventaId);
    if (c.estado !== EstadoComprobante.Pendiente) throw new BadRequestException('Ese comprobante ya se revisó');
    await em.update(Comprobante, { id }, { estado: EstadoComprobante.Descartado, revisadoPor: s.nombre, revisadoEn: new Date() });
    await this.bitacora.registrar(s, 'descartar_comprobante', 'venta', v.id, { folio: v.folio, comprobante: id });
    return { ok: true };
  }

  /** Cambia la etapa solo mientras el pedido sigue antes de máquina (no toca el estado de la venta). */
  private async moverEtapa(v: Venta, desde: EtapaTaller[], a: EtapaTaller) {
    if (v.estado !== EstadoVenta.Pendiente) return;
    const actual = etapaDe(v);
    if (actual === a || (actual && !desde.includes(actual))) return;
    await this.ds.manager.update(Venta, { id: v.id }, { etapa: a, etapaEn: new Date() });
  }

  /* ---------- cliente (sin sesión) ---------- */

  private async porToken(token: string) {
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) throw new NotFoundException('No encontramos ese pedido');
    const r = await this.docs.porToken(token);
    if (!r) throw new NotFoundException('No encontramos ese pedido');
    return r;
  }

  async pedido(token: string) {
    const em = this.ds.manager;
    const { tipo, d, taller, sucursal, cliente } = await this.porToken(token);
    const v = tipo === 'venta' ? (d as Venta) : null;
    const c = tipo === 'cotizacion' ? (d as Cotizacion) : null;
    const [disenos, fotos, comprobantes] = v
      ? await Promise.all([
          em.find(Diseno, { where: { tallerId: v.tallerId, ventaId: v.id, estado: Not(EstadoDiseno.Reemplazado) }, order: { version: 'DESC' } }),
          em.find(Foto, { where: { tallerId: v.tallerId, ventaId: v.id }, order: { id: 'ASC' } }),
          em.find(Comprobante, { where: { tallerId: v.tallerId, ventaId: v.id }, order: { id: 'DESC' } }),
        ])
      : [[], [], []];
    const pagado = v?.pagado ?? 0;
    const saldo = v ? r2(Math.max(0, v.total - pagado)) : d.total;
    const abierto = v ? v.estado !== EstadoVenta.Cancelada && v.estado !== EstadoVenta.Entregada : true;
    const porPagar = v ? v.estado !== EstadoVenta.Cancelada && saldo > 0 : d.total > 0;
    const pct = sucursal?.anticipoPct ?? 0;
    const anticipo = anticipoDe(d.total, pct);
    return {
      tipo, folio: d.folio, fecha: d.fecha, estado: d.estado,
      etapa: v ? etapaDe(v) : null, entrega: v?.entrega ?? null, vigenciaDias: c?.vigenciaDias ?? null,
      cliente: sinEjemplo(cliente?.nombre || d.clienteNombre || ''),
      taller: { nombre: sinEjemplo(taller.nombre), moneda: taller.moneda, lada: taller.lada },
      sucursal: sucursal ? { nombre: sucursal.nombre, direccion: sucursal.direccion, telefono: sucursal.telefono || taller.telefono, condiciones: sucursal.condiciones } : null,
      items: d.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precio: i.precio })),
      subtotal: d.subtotal, descuento: d.descuento, total: d.total, pagado, saldo,
      anticipo: anticipo && porPagar && pagado < anticipo ? { pct, monto: r2(anticipo - pagado), texto: v ? 'Falta para iniciar' : 'Anticipo para iniciar' } : null,
      transferencia: porPagar ? datosTransferencia(sucursal) : [],
      indicacionesPago: porPagar ? sucursal?.indicacionesPago?.trim() || null : null,
      puedeSubirComprobante: !!v && abierto && porPagar,
      pdf: `/api/publico/documentos/${token}.pdf`,
      disenos: disenos.map((x) => ({
        id: x.id, version: x.version, estado: x.estado, nota: x.nota, respuesta: x.respuesta, respondidoPor: x.respondidoPor, via: x.via,
        respondidoEn: x.respondidoEn, creadoEn: x.creadoEn, ancho: x.ancho, alto: x.alto,
        url: this.archivoUrl(token, 'disenos', x.id), mini: this.archivoUrl(token, 'disenos', x.id, 'mini'),
      })),
      fotos: fotos.map((f) => ({ id: f.id, ancho: f.ancho, alto: f.alto, url: this.archivoUrl(token, 'fotos', f.id), mini: this.archivoUrl(token, 'fotos', f.id, 'mini') })),
      comprobantes: comprobantes.map((x) => ({ id: x.id, estado: x.estado, monto: x.monto, creadoEn: x.creadoEn })),
    };
  }

  async archivo(token: string, tipo: string, id: number, t?: string) {
    const { tipo: td, d } = await this.porToken(token);
    if (td !== 'venta') throw new NotFoundException('No encontramos ese archivo');
    const where = { id, tallerId: d.tallerId, ventaId: d.id };
    const em = this.ds.manager;
    let nom: string | null | undefined;
    if (tipo === 'disenos') {
      const x = await em.findOneBy(Diseno, where);
      nom = x && (t === 'mini' ? x.miniatura : t === 'vista' ? x.vista : x.archivo);
    } else if (tipo === 'fotos') {
      const x = await em.findOneBy(Foto, where);
      nom = x && (t === 'mini' ? x.miniatura : x.archivo);
    } else if (tipo === 'comprobantes') {
      const x = await em.findOneBy(Comprobante, where);
      nom = x && (t === 'mini' ? x.miniatura : x.archivo);
    }
    if (!nom) throw new NotFoundException('No encontramos ese archivo');
    const p = ruta(d.tallerId, nom);
    await stat(p).catch(() => { throw new NotFoundException('El archivo ya no existe'); });
    return { p, tipo: nom.endsWith('.webp') ? 'image/webp' : 'image/jpeg' };
  }

  async responder(token: string, id: number, dto: RespuestaDto) {
    const em = this.ds.manager;
    const { tipo, d } = await this.porToken(token);
    if (tipo !== 'venta') throw new NotFoundException('No encontramos ese diseño');
    const x = await em.findOneBy(Diseno, { id, tallerId: d.tallerId, ventaId: d.id });
    if (!x) throw new NotFoundException('No encontramos ese diseño');
    if (x.estado !== EstadoDiseno.Pendiente) throw new BadRequestException(x.estado === EstadoDiseno.Reemplazado ? 'Ya hay una versión más nueva de este diseño' : 'Este diseño ya tiene respuesta');
    const comentario = dto.comentario?.trim() || null;
    if (!dto.aprobado && (!comentario || comentario.length < 3)) throw new BadRequestException('Escribe qué cambios quieres');
    const nom = dto.nombre.trim();
    Object.assign(x, { estado: dto.aprobado ? EstadoDiseno.Aprobado : EstadoDiseno.Cambios, via: 'enlace', respuesta: comentario, respondidoPor: nom, respondidoEn: new Date() });
    await em.save(x);
    const v = d as Venta;
    if (dto.aprobado) await this.moverEtapa(v, [EtapaTaller.Diseno, EtapaTaller.Aprobacion], EtapaTaller.Cola);
    else await this.moverEtapa(v, [EtapaTaller.Aprobacion, EtapaTaller.Cola], EtapaTaller.Diseno);
    await this.bitacora.registrar(comoCliente(d.tallerId, nom), dto.aprobado ? 'aprobar_diseno' : 'cambios_diseno', 'venta', v.id, { folio: v.folio, version: x.version, via: 'enlace' });
    return { ok: true, estado: x.estado };
  }

  async aceptar(token: string, dto: AceptarDto) {
    const { tipo, d } = await this.porToken(token);
    if (tipo !== 'cotizacion') throw new BadRequestException('Este enlace no es de una cotización');
    const c = d as Cotizacion;
    if (c.estado === EstadoCotizacion.Aceptada) return { ok: true, estado: c.estado };
    if (c.estado === EstadoCotizacion.Rechazada) throw new BadRequestException('Esta cotización ya no está disponible. Escríbenos para actualizarla.');
    await this.ds.manager.update(Cotizacion, { id: c.id }, { estado: EstadoCotizacion.Aceptada });
    await this.bitacora.registrar(comoCliente(c.tallerId, dto.nombre.trim()), 'aceptar', 'cotizacion', c.id, { folio: c.folio, via: 'enlace' });
    return { ok: true, estado: EstadoCotizacion.Aceptada };
  }

  async subirComprobante(token: string, dto: ComprobanteDto) {
    const em = this.ds.manager;
    const { tipo, d } = await this.porToken(token);
    const v = d as Venta;
    if (tipo !== 'venta' || v.estado === EstadoVenta.Cancelada || v.estado === EstadoVenta.Entregada || v.total - v.pagado <= 0)
      throw new BadRequestException('Este pedido no tiene pagos pendientes');
    const [total, pendientes] = await Promise.all([
      em.count(Comprobante, { where: { tallerId: v.tallerId, ventaId: v.id } }),
      em.count(Comprobante, { where: { tallerId: v.tallerId, ventaId: v.id, estado: EstadoComprobante.Pendiente } }),
    ]);
    if (total >= MAX_COMPROBANTES || pendientes >= MAX_PENDIENTES) throw new BadRequestException('Ya recibimos varios comprobantes. Escríbenos por WhatsApp si necesitas mandar otro.');
    const [g, m] = await Promise.all([guardar(v.tallerId, dto.imagen), guardar(v.tallerId, dto.miniatura)]);
    const c = await em.save(em.create(Comprobante, {
      tallerId: v.tallerId, ventaId: v.id, archivo: g.archivo, miniatura: m.archivo, ancho: dto.ancho, alto: dto.alto,
      monto: r2(dto.monto ?? 0), nota: dto.nota?.trim() || null,
    }));
    await this.bitacora.registrar(comoCliente(v.tallerId, 'Cliente'), 'comprobante', 'venta', v.id, { folio: v.folio, monto: c.monto });
    return { id: c.id, estado: c.estado, monto: c.monto, creadoEn: c.creadoEn };
  }

  /** Página mínima con etiquetas Open Graph: WhatsApp muestra el diseño en la vista previa del enlace. */
  async vistaPrevia(token: string, version?: number) {
    const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
    const destino = `/pedido/${token}`;
    let titulo = 'Grabix';
    let desc = '';
    let imagen: { url: string; ancho: number; alto: number } | null = null;
    try {
      const { tipo, d, taller } = await this.porToken(token);
      const tn = sinEjemplo(taller.nombre);
      if (tipo === 'cotizacion') {
        titulo = `Cotización ${d.folio} · ${tn}`;
        desc = 'Revisa los conceptos, el total y acéptala desde aquí.';
      } else {
        const em = this.ds.manager;
        const ds = await em.find(Diseno, { where: { tallerId: d.tallerId, ventaId: d.id, estado: Not(EstadoDiseno.Reemplazado) }, order: { version: 'DESC' } });
        const x = (version && ds.find((y) => y.version === version)) || ds[0];
        if (x) {
          const k = Math.min(1, 1200 / Math.max(x.ancho, x.alto));
          imagen = { url: `${base()}${this.archivoUrl(token, 'disenos', x.id, 'vista')}`, ancho: Math.round(x.ancho * k), alto: Math.round(x.alto * k) };
        }
        titulo = `Pedido ${d.folio} · ${tn}`;
        desc = x?.estado === EstadoDiseno.Pendiente ? 'Tu diseño está listo para revisar. Apruébalo o pide cambios aquí.' : 'Consulta tu nota, el avance de tu pedido y las fotos del trabajo.';
      }
    } catch { /* enlace inválido: la página del cliente muestra el aviso */ }
    const og = [
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${esc(titulo)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:url" content="${esc(base() + destino)}">`,
      ...(imagen ? [
        `<meta property="og:image" content="${esc(imagen.url)}">`,
        `<meta property="og:image:type" content="image/jpeg">`,
        `<meta property="og:image:width" content="${imagen.ancho}">`,
        `<meta property="og:image:height" content="${imagen.alto}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
      ] : []),
    ].join('\n');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(desc)}">
${og}
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${esc(destino)}">
<script>location.replace(${JSON.stringify(destino)})</script>
</head><body><p><a href="${esc(destino)}">Ver pedido</a></p></body></html>`;
  }
}

const TALLER = [...VEN_COSTOS, Rol.Vendedor, Rol.Produccion];
const VENTA = [...VEN_COSTOS, Rol.Vendedor];

@Controller()
export class EnlaceController {
  constructor(private e: EnlaceService) {}

  @Get('ventas/:id/disenos') @Roles(...TALLER)
  disenos(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.e.disenos(s, id); }

  @Post('ventas/:id/disenos') @Roles(...TALLER)
  subir(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: DisenoDto) { return this.e.subirDiseno(s, id, dto); }

  @Post('ventas/:id/disenos/whatsapp') @Roles(...TALLER) @HttpCode(200)
  whatsapp(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.e.whatsappDiseno(s, id); }

  @Post('disenos/:id/aprobar') @Roles(...TALLER) @HttpCode(200)
  aprobar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: AprobarDto) { return this.e.aprobar(s, id, dto); }

  @Delete('disenos/:id') @Roles(...TALLER) @HttpCode(200)
  eliminar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.e.eliminarDiseno(s, id); }

  @Get('ventas/:id/comprobantes') @Roles(...VENTA)
  comprobantes(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.e.comprobantes(s, id); }

  @Post('comprobantes/:id/aplicar') @Roles(...VENTA) @HttpCode(200)
  aplicar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: AplicarDto) { return this.e.aplicar(s, id, dto); }

  @Post('comprobantes/:id/descartar') @Roles(...VENTA) @HttpCode(200)
  descartar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.e.descartar(s, id); }
}

@Publico()
@Controller('publico')
export class EnlacePublicoController {
  constructor(private e: EnlaceService) {}

  @Get('p/:token')
  async vista(@Param('token') token: string, @Query('d') d: string | undefined, @Res() res: Response) {
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    res.send(await this.e.vistaPrevia(token, parseInt(d ?? '', 10) || undefined));
  }

  @Get('pedido/:token')
  pedido(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    return this.e.pedido(token);
  }

  @Get('pedido/:token/:tipo/:id')
  async archivo(@Param('token') token: string, @Param('tipo') tipo: string, @Param('id', ParseIntPipe) id: number, @Query('t') t: string | undefined, @Res({ passthrough: true }) res: Response) {
    const a = await this.e.archivo(token, tipo, id, t);
    res.set({ 'Content-Type': a.tipo, 'Cache-Control': 'public, max-age=86400', 'X-Robots-Tag': 'noindex' });
    return new StreamableFile(createReadStream(a.p));
  }

  @Post('pedido/:token/disenos/:id/respuesta') @HttpCode(200)
  responder(@Param('token') token: string, @Param('id', ParseIntPipe) id: number, @Body() dto: RespuestaDto) { return this.e.responder(token, id, dto); }

  @Post('pedido/:token/aceptar') @HttpCode(200)
  aceptar(@Param('token') token: string, @Body() dto: AceptarDto) { return this.e.aceptar(token, dto); }

  @Post('pedido/:token/comprobantes') @HttpCode(200)
  comprobante(@Param('token') token: string, @Body() dto: ComprobanteDto) { return this.e.subirComprobante(token, dto); }
}

@Module({ imports: [DocumentosModule], controllers: [EnlaceController, EnlacePublicoController], providers: [EnlaceService], exports: [EnlaceService] })
export class EnlaceModule {}
