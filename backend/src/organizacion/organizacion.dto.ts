import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { ClaveSegura } from '../common/clave';
import { Rol } from '../entities';

export class TallerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(255) direccion?: string;
  @IsOptional() @IsString() @MaxLength(8) moneda?: string;
  @IsOptional() @IsString() @MaxLength(4) lada?: string;
  @IsOptional() @IsNumber() @Min(0) tarifaMinuto?: number;
  @IsOptional() @IsInt() @Min(0) @Max(95) margenObjetivo?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) vigenciaDias?: number;
  @IsOptional() @IsString() notasCotizacion?: string;
}

export class SucursalDto {
  @IsString() @MinLength(2) @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(255) direccion?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsBoolean() activa?: boolean;
  @IsOptional() @IsString() @MaxLength(80) banco?: string;
  @IsOptional() @IsString() @MaxLength(120) titular?: string;
  @IsOptional() @Matches(/^(\d{18})?$/, { message: 'La CLABE debe tener 18 dígitos' }) clabe?: string;
  @IsOptional() @Matches(/^[\d-]{0,30}$/, { message: 'El número de cuenta solo lleva dígitos' }) cuenta?: string;
  @IsOptional() @Matches(/^(\d{15,19})?$/, { message: 'La tarjeta debe tener 16 dígitos' }) tarjeta?: string;
  @IsOptional() @IsString() @MaxLength(500) indicacionesPago?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) anticipoPct?: number;
  @IsOptional() @IsString() @MaxLength(1000) condiciones?: string;
}

export class UsuarioDto {
  @IsString() @MinLength(2) @MaxLength(120) nombre: string;
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsOptional() @IsString() @ClaveSegura('email', 'nombre') password?: string;
  @IsEnum(Rol) rol: Rol;
  @IsOptional() @IsInt() sucursalId?: number | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class ActivarPlanDto {
  @IsIn(['basico', 'pro', 'empresa']) plan: string;
  @IsIn(['mensual', 'anual']) periodo: string;
}
