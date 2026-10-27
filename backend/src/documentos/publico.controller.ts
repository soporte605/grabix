import { Controller, Get, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import { Publico } from '../common/sesion';
import { DIAS_PRUEBA_PUBLICO, hoy, PLANES, sumarDias } from '../common/suscripcion';
import { DocumentosService } from './documentos.service';
import { PdfService } from './pdf.service';

@Publico()
@Controller('publico')
export class PublicoController {
  constructor(
    private docs: DocumentosService,
    private pdf: PdfService,
    @InjectDataSource() private ds: DataSource,
  ) {}

  /* Cotizador de la landing: cuántas cotizaciones gratis le quedan a este visitante. */

  private get limite() {
    return Math.max(1, Number(process.env.COTIZADOR_LIMITE) || 3);
  }

  /** Visitante = hash de la IP (con el secreto del servidor), para no guardar la IP. */
  private visitante(req: Request) {
    const sal = process.env.JWT_SECRET ?? 'grabix';
    return createHash('sha256').update(`${sal}:${req.ip ?? ''}`).digest('hex');
  }

  /** Usos de los últimos 30 días. */
  private async usos(v: string) {
    const [r] = await this.ds.query('SELECT COALESCE(SUM(usos), 0) AS n FROM cotizador_uso WHERE visitante = ? AND fecha >= ?', [v, sumarDias(hoy(), -29)]);
    return Number(r?.n ?? 0);
  }

  @Get('cotizador')
  async cotizador(@Req() req: Request) {
    const usos = await this.usos(this.visitante(req));
    return { usos, limite: this.limite, restantes: Math.max(0, this.limite - usos) };
  }

  /** Cuenta una cotización. Si ya no le quedan, no suma y responde permitido: false. */
  @Post('cotizador')
  @HttpCode(200)
  async usarCotizador(@Req() req: Request) {
    const v = this.visitante(req);
    let usos = await this.usos(v);
    if (usos >= this.limite) return { permitido: false, usos, limite: this.limite, restantes: 0 };
    await this.ds.query('INSERT INTO cotizador_uso (visitante, fecha, usos) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE usos = usos + 1', [v, hoy()]);
    usos += 1;
    return { permitido: true, usos, limite: this.limite, restantes: Math.max(0, this.limite - usos) };
  }

  @Get('planes')
  planes() {
    return { diasPrueba: DIAS_PRUEBA_PUBLICO, planes: PLANES };
  }

  /** PDF compartido por WhatsApp; el token es largo y aleatorio. */
  @Get('documentos/:token.pdf')
  async documento(@Param('token') token: string, @Res() res: Response) {
    const d = await this.docs.porToken(token);
    if (!d) throw new NotFoundException('Documento no encontrado');
    const b = await this.pdf.generar(d);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${d.d.folio}.pdf"`, 'Cache-Control': 'no-store' });
    res.send(b);
  }

  @Get('salud')
  salud() {
    return { ok: true };
  }
}
