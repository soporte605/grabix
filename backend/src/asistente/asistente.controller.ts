import { Body, Controller, Get, HttpCode, Module, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Roles, SinSuscripcion, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { TipoProducto } from '../entities';
import { DocumentosModule } from '../documentos/documentos.module';
import { AsistenteService, LINEAS } from './asistente.service';

class MensajeDto {
  @IsIn(['usuario', 'asistente']) rol: 'usuario' | 'asistente';
  @IsString() @MinLength(1) @MaxLength(4000) texto: string;
}

class PreguntaDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => MensajeDto)
  mensajes: MensajeDto[];
}

class SugerenciaDto {
  @IsString() @MinLength(3) @MaxLength(160) nombre: string;
  @IsOptional() @IsEnum(TipoProducto) tipo?: TipoProducto;
  @IsOptional() @IsIn(LINEAS) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) detalles?: string;
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

  /** Rellena un artículo nuevo con costos y precio. Solo para quien ve costos. */
  @Post('sugerir-producto') @HttpCode(200) @Roles(...VEN_COSTOS)
  sugerirProducto(@Ses() s: Sesion, @Body() dto: SugerenciaDto) {
    return this.asistente.sugerirProducto(s, dto);
  }
}

@Module({
  imports: [DocumentosModule],
  controllers: [AsistenteController],
  providers: [AsistenteService],
})
export class AsistenteModule {}
