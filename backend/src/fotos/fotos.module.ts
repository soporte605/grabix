import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { BitacoraService } from '../common/bitacora.service';
import { Roles, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { Foto, Rol, Venta } from '../entities';

const DIR = process.env.FOTOS_DIR ?? join(process.cwd(), 'fotos');
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
function imagenDe(dataUrl: string): { buf: Buffer; ext: 'webp' | 'jpg' } {
  const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new BadRequestException('La foto debe ser una imagen WebP o JPEG');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) throw new BadRequestException('La foto pesa demasiado');
  const webp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!(m[1] === 'webp' ? webp : jpg)) throw new BadRequestException('El archivo no es una imagen válida');
  return { buf, ext: m[1] === 'webp' ? 'webp' : 'jpg' };
}

const nombre = (ext: string) => `${randomBytes(16).toString('hex')}.${ext}`;
const ruta = (tallerId: number, archivo: string) => join(DIR, String(tallerId), archivo.replace(/[^a-z0-9.]/g, ''));

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

@Module({ controllers: [FotosController], providers: [FotosService] })
export class FotosModule {}
