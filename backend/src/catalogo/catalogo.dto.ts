import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { TipoProducto } from '../entities';

export class ComponenteDto {
  @IsInt() insumoId: number;
  @IsNumber() @Min(0) cantidad: number;
}

export class ProductoDto {
  @IsString() @MinLength(1) @MaxLength(160) nombre: string;
  @IsEnum(TipoProducto) tipo: TipoProducto;
  @IsOptional() @IsString() @MaxLength(60) categoria?: string;
  @IsOptional() @IsString() @MaxLength(20) unidad?: string;
  @IsOptional() @IsNumber() @Min(0) costo?: number;
  @IsOptional() @IsNumber() @Min(0) precio?: number;
  @IsOptional() @IsNumber() @Min(0) minutos?: number;
  @IsOptional() @IsNumber() @Min(0) extra?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ComponenteDto)
  componentes?: ComponenteDto[];
  /** Solo al crear: existencia inicial en la sucursal activa. */
  @IsOptional() @IsNumber() stockInicial?: number;
  @IsOptional() @IsNumber() @Min(0) minimo?: number;
}

export class AjusteDto {
  /** Nueva existencia contada físicamente. */
  @IsOptional() @IsNumber() cantidad?: number;
  @IsOptional() @IsNumber() @Min(0) minimo?: number;
  @IsOptional() @IsString() @MaxLength(40) motivo?: string;
}

export class TraspasoItemDto {
  @IsInt() productoId: number;
  @IsNumber() @Min(0.0001) cantidad: number;
}

export class TraspasoDto {
  @IsInt() destinoId: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TraspasoItemDto) items: TraspasoItemDto[];
}

export class ClienteDto {
  @IsString() @MinLength(1) @MaxLength(160) nombre: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(160) empresa?: string;
  @IsOptional() @IsString() notas?: string;
}

export class PromocionDto {
  @IsString() @MinLength(1) @MaxLength(160) nombre: string;
  @IsIn(['pct', 'monto']) tipo: string;
  @IsNumber() @Min(0) valor: number;
  @IsOptional() @IsDateString() inicio?: string | null;
  @IsOptional() @IsDateString() fin?: string | null;
  @IsOptional() @IsBoolean() activa?: boolean;
  @IsOptional() @IsString() mensaje?: string;
}
