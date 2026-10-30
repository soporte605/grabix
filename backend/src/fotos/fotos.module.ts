import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { BitacoraService } from '../common/bitacora.service';
import { GERENCIA, Roles, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { Foto, Rol, Sucursal, Venta } from '../entities';

export const DIR = process.env.FOTOS_DIR ?? join(process.cwd(), 'fotos');
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_POR_PEDIDO = 30;
const POR_PAGINA = 24;

export class FotoDto {
  /** data:image/webp;base64,… (o jpeg). El navegador ya la reduce a ~1600 px. */
  @IsString() @MaxLength(6_000_000) imagen: string;
  @IsString() @MaxLength(1_000_000) miniatura: string;
  @IsInt() @Min(1) @Max(10000) ancho: number;
  @IsInt() @Min(1) @Max(10000) alto: number;
  @IsOptional() @IsString() @MaxLength(200) nota?: string;
}

/** Decodifica un data URL y confirma por sus primeros bytes que de verdad es WebP o JPEG. */
export function imagenDe(dataUrl: string): { buf: Buffer; ext: 'webp' | 'jpg' } {
  const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new BadRequestException('La foto debe ser una imagen WebP o JPEG');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) throw new BadRequestException('La foto pesa demasiado');
  const webp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!(m[1] === 'webp' ? webp : jpg)) throw new BadRequestException('El archivo no es una imagen válida');
  return { buf, ext: m[1] === 'webp' ? 'webp' : 'jpg' };
}

export const nombre = (ext: string) => `${randomBytes(16).toString('hex')}.${ext}`;
export const ruta = (tallerId: number, archivo: string) => join(DIR, String(tallerId), archivo.replace(/[^a-z0-9.]/g, ''));

@Injectable()
export class FotosService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    private bitacora: BitacoraService,
  ) {}

  private async venta(s: Sesion, id: number) {
    const v = await this.ds.manager.findOne(Venta, { where: { id, tallerId: s.tallerId }, relations: { items: false, pagos: false } });
    if (!v || (s.sucursal && v.sucursalId !== s.sucursal)) throw new NotFoundException('No encontramos ese pedido');
    return v;
  }

  async delPedido(s: Sesion, ventaId: number) {
    await this.venta(s, ventaId);
    return this.ds.manager.find(Foto, { where: { tallerId: s.tallerId, ventaId }, order: { id: 'ASC' } });
  }

  async subir(s: Sesion, ventaId: number, dto: FotoDto) {
    const v = await this.venta(s, ventaId);
    const n = await this.ds.manager.count(Foto, { where: { tallerId: s.tallerId, ventaId } });
    if (n >= MAX_POR_PEDIDO) throw new BadRequestException(`Un pedido puede tener hasta ${MAX_POR_PEDIDO} fotos`);
    const img = imagenDe(dto.imagen);
    const min = imagenDe(dto.miniatura);
    const archivo = nombre(img.ext);
    const miniatura = nombre(min.ext);
    await mkdir(join(DIR, String(s.tallerId)), { recursive: true });
    await writeFile(ruta(s.tallerId, archivo), img.buf);
    await writeFile(ruta(s.tallerId, miniatura), min.buf);
    const f = await this.ds.manager.save(this.ds.manager.create(Foto, {
      tallerId: s.tallerId, ventaId, archivo, miniatura, ancho: dto.ancho, alto: dto.alto, bytes: img.buf.length + min.buf.length,
      nota: dto.nota?.trim() || null, usuarioId: s.usuarioId, usuarioNombre: s.nombre,
    }));
    await this.bitacora.registrar(s, 'foto', 'venta', ventaId, { folio: v.folio, foto: f.id });
    return f;
  }

  async eliminar(s: Sesion, id: number) {
    const f = await this.ds.manager.findOneBy(Foto, { id, tallerId: s.tallerId });
    if (!f) throw new NotFoundException('No encontramos esa foto');
    const v = await this.venta(s, f.ventaId);
    if (!VEN_COSTOS.includes(s.rol) && f.usuarioId !== s.usuarioId) throw new ForbiddenException('Solo puedes borrar las fotos que tú subiste');
    await this.ds.manager.delete(Foto, { id });
    await Promise.all([unlink(ruta(s.tallerId, f.archivo)), unlink(ruta(s.tallerId, f.miniatura))].map((p) => p.catch(() => undefined)));
    await this.bitacora.registrar(s, 'eliminar_foto', 'venta', f.ventaId, { folio: v.folio, foto: id });
    return { ok: true };
  }

  async archivo(s: Sesion, id: number, mini: boolean) {
    const f = await this.ds.manager.findOneBy(Foto, { id, tallerId: s.tallerId });
    if (!f) throw new NotFoundException('No encontramos esa foto');
    await this.venta(s, f.ventaId);
    const nom = mini ? f.miniatura : f.archivo;
    const p = ruta(s.tallerId, nom);
    await stat(p).catch(() => { throw new NotFoundException('El archivo de la foto ya no existe'); });
    return { p, tipo: nom.endsWith('.webp') ? 'image/webp' : 'image/jpeg' };
  }

  /** Galería de un producto o servicio: fotos de todos los pedidos que lo incluyeron. */
  async delProducto(s: Sesion, productoId: number, pagina: number) {
    const q = this.ds.manager.createQueryBuilder(Foto, 'f')
      .innerJoin(Venta, 'v', 'v.id = f.ventaId')
      .leftJoin('v.cliente', 'c')
      .where('f.tallerId = :t', { t: s.tallerId })
      .andWhere('EXISTS (SELECT 1 FROM venta_items i WHERE i.ventaId = f.ventaId AND i.productoId = :p)', { p: productoId });
    if (s.sucursal) q.andWhere('v.sucursalId = :suc', { suc: s.sucursal });
    const total = await q.getCount();
    const filas = await q
      .select(['f.id AS id', 'f.ventaId AS ventaId', 'f.ancho AS ancho', 'f.alto AS alto', 'f.nota AS nota', 'f.usuarioNombre AS usuarioNombre', 'f.creadoEn AS creadoEn',
        'v.folio AS folio', 'v.fecha AS fecha', "COALESCE(c.nombre, NULLIF(v.clienteNombre, ''), 'Mostrador') AS cliente"])
      .orderBy('f.id', 'DESC')
      .offset((pagina - 1) * POR_PAGINA).limit(POR_PAGINA)
      .getRawMany();
    return { items: filas, total, porPagina: POR_PAGINA };
  }
}

const TALLER = [...VEN_COSTOS, Rol.Vendedor, Rol.Produccion];

@Controller()
export class FotosController {
  constructor(private f: FotosService) {}

  @Get('ventas/:id/fotos') @Roles(...TALLER)
  delPedido(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.f.delPedido(s, id); }

  @Post('ventas/:id/fotos') @Roles(...TALLER)
  subir(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: FotoDto) { return this.f.subir(s, id, dto); }

  @Delete('fotos/:id') @Roles(...TALLER) @HttpCode(200)
  eliminar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) { return this.f.eliminar(s, id); }

  @Get('fotos/:id/archivo') @Roles(...TALLER)
  async archivo(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Query('mini') mini: string | undefined, @Res({ passthrough: true }) res: Response) {
    const a = await this.f.archivo(s, id, mini === '1');
    res.set({ 'Content-Type': a.tipo, 'Cache-Control': 'private, max-age=86400' });
    return new StreamableFile(createReadStream(a.p));
  }

  @Get('productos/:id/trabajos') @Roles(...TALLER)
  delProducto(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Query('pagina') pagina?: string) {
    return this.f.delProducto(s, id, Math.max(1, parseInt(pagina ?? '1', 10) || 1));
  }
}

export class LogoDto {
  /** data:image/png;base64,… o jpeg; el navegador lo reduce a 800 px. */
  @IsString() @MaxLength(2_000_000) imagen: string;
  /** Usar el mismo logo en todas las sucursales del taller. */
  @IsOptional() @IsBoolean() todas?: boolean;
}

/** El PDF (pdfkit) solo dibuja PNG y JPEG, así que el logo no puede ser WebP. */
function logoDe(dataUrl: string): { buf: Buffer; ext: 'png' | 'jpg' } {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new BadRequestException('El logo debe ser PNG o JPG');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > 1.5 * 1024 * 1024) throw new BadRequestException('El logo pesa demasiado');
  const png = buf.subarray(1, 4).toString('ascii') === 'PNG';
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!(m[1] === 'png' ? png : jpg)) throw new BadRequestException('El archivo no es una imagen válida');
  return { buf, ext: m[1] === 'png' ? 'png' : 'jpg' };
}

/** Ruta del logo de una sucursal, o null si no tiene (o el archivo ya no está). */
export async function rutaLogo(suc?: Pick<Sucursal, 'tallerId' | 'logo'> | null) {
  if (!suc?.logo) return null;
  const p = ruta(suc.tallerId, suc.logo);
  return (await stat(p).then(() => true, () => false)) ? p : null;
}

@Controller()
export class LogoController {
  constructor(@InjectDataSource() private ds: DataSource, private bitacora: BitacoraService) {}

  private async sucursal(s: Sesion, id: number) {
    const x = await this.ds.manager.findOneBy(Sucursal, { id, tallerId: s.tallerId });
    if (!x) throw new NotFoundException('No encontramos esa sucursal');
    return x;
  }

  /** Borra los archivos de logo que ya no use ninguna sucursal. */
  private async limpiar(tallerId: number, archivos: (string | null)[]) {
    const usados = new Set((await this.ds.manager.find(Sucursal, { where: { tallerId }, select: { logo: true } })).map((x) => x.logo));
    await Promise.all([...new Set(archivos)].filter((a): a is string => !!a && !usados.has(a)).map((a) => unlink(ruta(tallerId, a)).catch(() => undefined)));
  }

  @Put('sucursales/:id/logo') @Roles(...GERENCIA)
  async subir(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: LogoDto) {
    const suc = await this.sucursal(s, id);
    const img = logoDe(dto.imagen);
    const archivo = nombre(img.ext);
    await mkdir(join(DIR, String(s.tallerId)), { recursive: true });
    await writeFile(ruta(s.tallerId, archivo), img.buf);
    const afectadas = dto.todas ? await this.ds.manager.find(Sucursal, { where: { tallerId: s.tallerId } }) : [suc];
    await this.ds.manager.update(Sucursal, afectadas.map((x) => x.id), { logo: archivo });
    await this.limpiar(s.tallerId, afectadas.map((x) => x.logo));
    await this.bitacora.registrar(s, 'logo', 'sucursal', id, { todas: !!dto.todas });
    return { logo: archivo, sucursales: afectadas.map((x) => x.id) };
  }

  @Delete('sucursales/:id/logo') @Roles(...GERENCIA) @HttpCode(200)
  async quitar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    const suc = await this.sucursal(s, id);
    await this.ds.manager.update(Sucursal, { id }, { logo: null });
    await this.limpiar(s.tallerId, [suc.logo]);
    return { ok: true };
  }

  @Get('sucursales/:id/logo')
  async ver(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    const p = await rutaLogo(await this.sucursal(s, id));
    if (!p) throw new NotFoundException('Esta sucursal no tiene logo');
    res.set({ 'Content-Type': p.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, no-cache' });
    return new StreamableFile(createReadStream(p));
  }
}

@Module({ controllers: [FotosController, LogoController], providers: [FotosService] })
export class FotosModule {}
