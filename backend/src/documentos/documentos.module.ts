import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { FoliosService } from './folios.service';
import { PdfService } from './pdf.service';
import { PublicoController } from './publico.controller';

@Module({
  controllers: [DocumentosController, PublicoController],
  providers: [DocumentosService, FoliosService, PdfService],
  exports: [FoliosService],
})
export class DocumentosModule {}
