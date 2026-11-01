/**
 * Reglas de seguridad de la contraseña. Las mismas viven en backend/src/common/clave.ts:
 * si cambias una, cambia la otra.
 */
const COMUNES = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344', '123123123',
  'password', 'password1', 'password123', 'contraseña', 'contrasena', 'contraseña1', 'contrasena1', 'qwerty123', 'qwertyui',
  'abc12345', 'abcd1234', 'a1b2c3d4', 'admin123', 'administrador', 'iloveyou', 'teamo123', 'mexico123', 'grabix123', 'bienvenido1',
]);

export interface Requisito { texto: string; ok: boolean; obligatorio: boolean }
export interface Fuerza { nivel: 0 | 1 | 2 | 3 | 4; etiqueta: string; valida: boolean; requisitos: Requisito[] }

const ETIQUETAS = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];

/** `personales`: correo, nombre o taller; la contraseña no debe contenerlos. */
export function evaluarClave(clave: string, personales: (string | null | undefined)[] = []): Fuerza {
  const c = clave ?? '';
  const minus = c.toLowerCase();
  const trozos = personales
    .flatMap((p) => (p ?? '').toLowerCase().split(/[@\s._-]+/))
    .filter((p) => p.length >= 4);
  const personal = trozos.some((p) => minus.includes(p));
  const comun = COMUNES.has(minus) || /^(.)\1+$/.test(c);
  const requisitos: Requisito[] = [
    { texto: 'Al menos 8 caracteres', ok: c.length >= 8, obligatorio: true },
    { texto: 'Letras y números', ok: /[a-zñ]/i.test(c) && /\d/.test(c), obligatorio: true },
    { texto: 'Que no sea tu correo, tu nombre ni una muy común', ok: c.length > 0 && !personal && !comun, obligatorio: true },
    { texto: 'Mayúsculas y minúsculas', ok: /[a-zñ]/.test(c) && /[A-ZÑ]/.test(c), obligatorio: false },
    { texto: 'Un símbolo (!, #, $, …) o 12 caracteres', ok: /[^A-Za-z0-9ñÑ]/.test(c) || c.length >= 12, obligatorio: false },
  ];
  const valida = requisitos.every((r) => !r.obligatorio || r.ok);
  let puntos = requisitos.filter((r) => r.ok).length - 1;
  if (c.length >= 14) puntos++;
  const nivel = (!c ? 0 : !valida ? Math.min(1, Math.max(0, puntos)) : Math.max(2, Math.min(4, puntos))) as Fuerza['nivel'];
  return { nivel, etiqueta: ETIQUETAS[nivel], valida, requisitos };
}
