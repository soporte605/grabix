import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EstadoSuscripcion, Rol } from '../entities';

export class AdminLoginDto {
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsString() password: string;
}

export class AdminTallerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(255) direccion?: string;
}

export class BloqueoDto {
  @IsBoolean() bloqueado: boolean;
}

export class SuscripcionAdminDto {
  @IsOptional() @IsInt() @Min(1, { message: 'Los días deben ser al menos 1' }) @Max(3650, { message: 'Los días no pueden ser más de 3650' }) dias?: number;
  @IsOptional() @IsIn(['mensual', 'anual']) renovar?: 'mensual' | 'anual';
  @IsOptional() @IsIn(['basico', 'pro', 'empresa']) plan?: 'basico' | 'pro' | 'empresa';
  @IsOptional() @IsEnum(EstadoSuscripcion) estado?: EstadoSuscripcion;
  @IsOptional() @IsBoolean() cancelarEliminacion?: boolean;
}

export class AdminUsuarioDto {
  @IsString() @MinLength(2) @MaxLength(120) nombre: string;
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsEnum(Rol) rol: Rol;
  @IsOptional() @IsInt() sucursalId?: number | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CorreoAdminDto {
  @IsIn(['activacion', 'invitacion', 'recuperacion']) tipo: 'activacion' | 'invitacion' | 'recuperacion';
}

export class CrearAdminDto {
  @IsString() @MinLength(2) @MaxLength(120) nombre: string;
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsString() password: string;
}

export class ActivoAdminDto {
  @IsBoolean() activo: boolean;
}
