import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Rol } from '../entities';
import { GERENCIA, Roles, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { hoy } from '../common/suscripcion';
import { CompraDto, CotizacionDto, EstadoVentaDto, FiltroDto, PagoDto, VentaDto } from './documentos.dto';
import { DocumentosService } from './documentos.service';
import { PdfService } from './pdf.service';

const VENTA = [...VEN_COSTOS, Rol.Vendedor];
const urlPublica = (token: string) => `${process.env.PUBLIC_URL ?? 'http://localhost:8080'}/api/publico/documentos/${token}.pdf`;

@Controller()
export class DocumentosController {
  constructor(
    private docs: DocumentosService,
    private pdf: PdfService,
  ) {}

  private async enviarPdf(res: Response, datos: Awaited<ReturnType<DocumentosService['paraImprimir']>>) {
    const b = await this.pdf.generar(datos);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${datos.d.folio}.pdf"` });
    res.send(b);
  }

  /* cotizaciones */
  @Get('cotizaciones') @Roles(...VENTA)
  cotizaciones(@Ses() s: Sesion, @Query() f: FiltroDto) {
    return this.docs.cotizaciones(s, f);
  }

  @Get('cotizaciones/:id') @Roles(...VENTA)
  cotizacion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.docs.cotizacion(s, id);
  }

  @Post('cotizaciones') @Roles(...VENTA)
  crearCotizacion(@Ses() s: Sesion, @Body() dto: CotizacionDto) {
    return this.docs.guardarCotizacion(s, dto);
  }

  @Put('cotizaciones/:id') @Roles(...VENTA)
  editarCotizacion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: CotizacionDto) {
    return this.docs.guardarCotizacion(s, dto, id);
  }

  @Delete('cotizaciones/:id') @Roles(...VEN_COSTOS)
  eliminarCotizacion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.docs.eliminarCotizacion(s, id);
  }

  @Post('cotizaciones/:id/convertir') @Roles(...VENTA)
  convertir(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.docs.convertir(s, id);
  }

  @Get('cotizaciones/:id/pdf') @Roles(...VENTA)
  async pdfCotizacion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    await this.enviarPdf(res, await this.docs.paraImprimir('cotizacion', await this.docs.cotizacion(s, id)));
  }

  @Post('cotizaciones/:id/whatsapp') @Roles(...VENTA)
  async waCotizacion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    const c = await this.docs.cotizacion(s, id);
    await this.docs.marcarEnviada(s, id);
    return this.pdf.whatsapp(await this.docs.paraImprimir('cotizacion', c), urlPublica(c.tokenPublico));
  }

  /* ventas */
  @Get('ventas') @Roles(...VENTA, Rol.Produccion)
  ventas(@Ses() s: Sesion, @Query() f: FiltroDto) {
    return this.docs.ventas(s, f);
  }

  @Get('ventas/:id') @Roles(...VENTA, Rol.Produccion)
  venta(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.docs.venta(s, id);
  }

  @Post('ventas') @Roles(...VENTA)
  crearVenta(@Ses() s: Sesion, @Body() dto: VentaDto) {
    return this.docs.crearVenta(s, dto);
  }

  @Put('ventas/:id') @Roles(...VENTA)
  editarVenta(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: VentaDto) {
    return this.docs.editarVenta(s, id, dto);
  }

  @Patch('ventas/:id/estado') @Roles(...VENTA, Rol.Produccion)
  estado(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: EstadoVentaDto) {
    return this.docs.cambiarEstado(s, id, dto.estado);
  }

  @Post('ventas/:id/pagos') @Roles(...VENTA)
  pago(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: PagoDto) {
    return this.docs.registrarPago(s, id, dto);
  }

  @Delete('ventas/:id') @Roles(...GERENCIA)
  eliminarVenta(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.docs.eliminarVenta(s, id);
  }

  @Get('ventas/:id/pdf') @Roles(...VENTA, Rol.Produccion)
  async pdfVenta(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    await this.enviarPdf(res, await this.docs.paraImprimir('venta', await this.docs.venta(s, id)));
  }

  @Post('ventas/:id/whatsapp') @Roles(...VENTA)
  async waVenta(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    const v = await this.docs.venta(s, id);
    return this.pdf.whatsapp(await this.docs.paraImprimir('venta', v), urlPublica(v.tokenPublico));
  }

  /* compras */
  @Get('compras') @Roles(...VEN_COSTOS)
  compras(@Ses() s: Sesion, @Query() f: FiltroDto) {
    return this.docs.compras(s, f);
  }

  @Post('compras') @Roles(...VEN_COSTOS)
  crearCompra(@Ses() s: Sesion, @Body() dto: CompraDto) {
    return this.docs.crearCompra(s, dto);
  }

  @Delete('compras/:id') @Roles(...GERENCIA)
  eliminarCompra(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.docs.eliminarCompra(s, id);
  }

  /* estadísticas */
  @Get('estadisticas') @Roles(...VEN_COSTOS)
  estadisticas(@Ses() s: Sesion, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const h = hasta || hoy();
    return this.docs.estadisticas(s, desde || h.slice(0, 8) + '01', h);
  }
}
