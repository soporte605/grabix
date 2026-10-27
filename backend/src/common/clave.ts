import { BadRequestException } from '@nestjs/common';
import { ValidateBy, ValidationArguments } from 'class-validator';

/**
 * Reglas de seguridad de la contraseña. Las mismas viven en frontend/src/app/core/clave.ts
 * (allí además se calcula el medidor de fuerza): si cambias una, cambia la otra.
 */
const COMUNES = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344', '123123123',
  'password', 'password1', 'password123', 'contraseña', 'contrasena', 'contraseña1', 'contrasena1', 'qwerty123', 'qwertyui',
  'abc12345', 'abcd1234', 'a1b2c3d4', 'admin123', 'administrador', 'iloveyou', 'teamo123', 'mexico123', 'grabix123', 'bienvenido1',
]);

/** Devuelve el motivo por el que la contraseña no sirve, o null si cumple. */
export function problemaClave(clave: string, personales: (string | null | undefined)[] = []): string | null {
  const c = String(clave ?? '');
  const minus = c.toLowerCase();
  if (c.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (c.length > 100) return 'La contraseña es demasiado larga';
  if (!/[a-zñ]/i.test(c) || !/\d/.test(c)) return 'La contraseña debe tener letras y números';
  if (COMUNES.has(minus) || /^(.)\1+$/.test(c)) return 'Esa contraseña es muy común, elige otra';
  const trozos = personales.flatMap((p) => (p ?? '').toLowerCase().split(/[@\s._-]+/)).filter((p) => p.length >= 4);
  if (trozos.some((p) => minus.includes(p))) return 'La contraseña no debe incluir tu correo ni tu nombre';
  return null;
}

export function exigirClave(clave: string, personales: (string | null | undefined)[] = []) {
  const p = problemaClave(clave, personales);
  if (p) throw new BadRequestException(p);
}

/** Valida la contraseña del DTO; `campos` son otros campos del mismo DTO que no debe contener (correo, nombre). */
export const ClaveSegura = (...campos: string[]) =>
  ValidateBy({
    name: 'claveSegura',
    validator: {
      validate: (v: unknown, a: ValidationArguments) =>
        typeof v === 'string' && !problemaClave(v, campos.map((k) => (a.object as Record<string, string>)[k])),
      defaultMessage: (a?: ValidationArguments) =>
        problemaClave(String(a?.value ?? ''), campos.map((k) => (a?.object as Record<string, string>)?.[k])) ?? 'Contraseña no válida',
    },
  });
