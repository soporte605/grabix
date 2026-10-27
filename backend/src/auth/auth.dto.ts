import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString() @MinLength(2) @MaxLength(120) taller: string;
  @IsString() @MinLength(2) @MaxLength(120) nombre: string;
  @IsEmail({}, { message: 'Correo no válido' }) email: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) password: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
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
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) @MaxLength(100) password: string;
}

export class CambiarContrasenaDto {
  @IsString() actual: string;
  @IsString() @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres' }) @MaxLength(100) nueva: string;
}
