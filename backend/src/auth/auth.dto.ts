import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ClaveSegura } from '../common/clave';

export class RegistroDto {
  @IsString() @MinLength(2) @MaxLength(120) taller: string;
  @IsString() @MinLength(2) @MaxLength(120) nombre: string;
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsString() @ClaveSegura('email', 'nombre', 'taller') password: string;
  /** WhatsApp o teléfono del taller: obligatorio, de 10 a 15 dígitos (se aceptan espacios, guiones, paréntesis y +). */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El WhatsApp o teléfono es obligatorio' })
  @IsNotEmpty({ message: 'El WhatsApp o teléfono es obligatorio' })
  @MaxLength(25, { message: 'El WhatsApp o teléfono no puede pasar de 25 caracteres' })
  @Matches(/^\+?[\d\s().-]+$/, { message: 'El WhatsApp o teléfono solo puede llevar números, espacios, guiones, paréntesis y +' })
  @Matches(/^(?:\D*\d){10,15}\D*$/, { message: 'Escribe un WhatsApp o teléfono de 10 dígitos, por ejemplo 55 1234 5678' })
  telefono: string;
  @IsOptional() @IsBoolean() conEjemplos?: boolean;
}

export class LoginDto {
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsString() password: string;
}

export class TokenDto {
  @IsString() @MinLength(10) @MaxLength(200) token: string;
}

export class OlvideDto {
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
}

export class RestablecerDto extends TokenDto {
  @IsString() @ClaveSegura() password: string;
}

export class CambiarContrasenaDto {
  @IsString() actual: string;
  @IsString() @ClaveSegura() nueva: string;
}
