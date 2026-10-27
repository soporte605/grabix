import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Publico } from '../common/sesion';
import { DIAS_PRUEBA_PUBLICO, PLANES } from '../common/suscripcion';
import { DocumentosService } from './documentos.service';
import { PdfService } from './pdf.service';

@Publico()
@Controller('publico')
export class PublicoController {
  constructor(
    private docs: DocumentosService,
    private pdf: PdfService,
  ) {}

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
