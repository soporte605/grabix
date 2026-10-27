import { Body, Controller, Get, HttpCode, Module, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { SinSuscripcion, Ses, type Sesion } from '../common/sesion';
import { DocumentosModule } from '../documentos/documentos.module';
import { AsistenteService } from './asistente.service';

class MensajeDto {
  @IsIn(['usuario', 'asistente']) rol: 'usuario' | 'asistente';
  @IsString() @MinLength(1) @MaxLength(4000) texto: string;
}

class PreguntaDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => MensajeDto)
  mensajes: MensajeDto[];
}

@Controller('asistente')
export class AsistenteController {
  constructor(private asistente: AsistenteService) {}

  @Get()
  estado(@Ses() s: Sesion) {
    return this.asistente.estado(s);
  }

  /** Solo consulta datos, así que funciona aunque la suscripción esté vencida. */
  @Post() @HttpCode(200) @SinSuscripcion()
  preguntar(@Ses() s: Sesion, @Body() dto: PreguntaDto) {
    return this.asistente.preguntar(s, dto.mensajes);
  }
}

@Module({
  imports: [DocumentosModule],
  controllers: [AsistenteController],
  providers: [AsistenteService],
})
export class AsistenteModule {}
