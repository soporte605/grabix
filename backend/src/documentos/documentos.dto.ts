import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { EstadoCotizacion, EstadoVenta } from '../entities';

export class RenglonDto {
  @IsOptional() @IsInt() productoId?: number | null;
  @IsString() @MaxLength(255) descripcion: string;
  @IsNumber() @Min(0.0001) cantidad: number;
  @IsNumber() @Min(0) precio: number;
}

export class DocumentoDto {
  @IsOptional() @IsInt() clienteId?: number | null;
  @IsOptional() @IsString() @MaxLength(160) clienteNombre?: string;
  @IsOptional() @IsString() @MaxLength(40) clienteTelefono?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsIn(['pct', 'monto']) descuentoTipo?: string;
  @IsOptional() @IsNumber() @Min(0) descuentoValor?: number;
  @IsOptional() @IsInt() promocionId?: number | null;
  @IsOptional() @IsString() notas?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos un concepto' }) @ValidateNested({ each: true }) @Type(() => RenglonDto)
  items: RenglonDto[];
}

export class CotizacionDto extends DocumentoDto {
  @IsOptional() @IsEnum(EstadoCotizacion) estado?: EstadoCotizacion;
  @IsOptional() @IsInt() @Min(1) @Max(365) vigenciaDias?: number;
}

export class PagoDto {
  @IsNumber() @Min(0.01) monto: number;
  @IsOptional() @IsString() @MaxLength(30) metodo?: string;
  @IsOptional() @IsDateString() fecha?: string;
}

export class VentaDto extends DocumentoDto {
  @IsOptional() @IsEnum(EstadoVenta) estado?: EstadoVenta;
  @IsOptional() @IsDateString() entrega?: string | null;
  /** Solo al crear: anticipo recibido. */
  @IsOptional() @ValidateNested() @Type(() => PagoDto) anticipo?: PagoDto;
  /** Solo al crear: pago combinado (por ejemplo, parte en efectivo y parte con tarjeta). */
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => PagoDto) pagos?: PagoDto[];
}

export class EstadoVentaDto {
  @IsEnum(EstadoVenta) estado: EstadoVenta;
}

export class CompraItemDto {
  @IsOptional() @IsInt() productoId?: number | null;
  @IsString() @MaxLength(255) descripcion: string;
  @IsNumber() @Min(0.0001) cantidad: number;
  @IsNumber() @Min(0) costo: number;
}

export class CompraDto {
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsString() @MaxLength(160) proveedor?: string;
  @IsOptional() @IsString() notas?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos un concepto' }) @ValidateNested({ each: true }) @Type(() => CompraItemDto)
  items: CompraItemDto[];
}

export class FiltroDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}
