import { BadRequestException, ValidationError } from '@nestjs/common';

/** Nombre legible de cada campo de los DTO, con su artículo para armar la frase. */
const NOMBRES: Record<string, [string, 'o' | 'a']> = {
  nombre: ['El nombre', 'o'], taller: ['El nombre del taller', 'o'], email: ['El correo', 'o'], telefono: ['El teléfono', 'o'],
  password: ['La contraseña', 'a'], nueva: ['La contraseña nueva', 'a'], actual: ['La contraseña actual', 'a'], token: ['El enlace', 'o'],
  empresa: ['La empresa', 'a'], notas: ['Las notas', 'a'], direccion: ['La dirección', 'a'], moneda: ['La moneda', 'a'], lada: ['La lada', 'a'],
  tarifaMinuto: ['La tarifa por minuto', 'a'], margenObjetivo: ['El margen objetivo', 'o'], vigenciaDias: ['La vigencia', 'a'],
  notasCotizacion: ['Las notas de cotización', 'a'], rol: ['El rol', 'o'], sucursalId: ['La sucursal', 'a'], activo: ['El estado', 'o'],
  activa: ['El estado', 'o'], plan: ['El plan', 'o'], periodo: ['El periodo', 'o'], tipo: ['El tipo', 'o'], categoria: ['La categoría', 'a'],
  unidad: ['La unidad', 'a'], costo: ['El costo', 'o'], precio: ['El precio', 'o'], minutos: ['Los minutos', 'o'], extra: ['El extra', 'o'],
  stockInicial: ['La existencia inicial', 'a'], minimo: ['El mínimo', 'o'], cantidad: ['La cantidad', 'a'], motivo: ['El motivo', 'o'],
  insumoId: ['El insumo', 'o'], productoId: ['El producto', 'o'], destinoId: ['La sucursal destino', 'a'], items: ['Los conceptos', 'o'],
  descripcion: ['La descripción', 'a'], clienteId: ['El cliente', 'o'], clienteNombre: ['El nombre del cliente', 'o'],
  clienteTelefono: ['El teléfono del cliente', 'o'], fecha: ['La fecha', 'a'], entrega: ['La fecha de entrega', 'a'], estado: ['El estado', 'o'],
  descuentoTipo: ['El tipo de descuento', 'o'], descuentoValor: ['El descuento', 'o'], promocionId: ['La promoción', 'a'], monto: ['El monto', 'o'],
  metodo: ['La forma de pago', 'a'], anticipo: ['El anticipo', 'o'], pagos: ['Los pagos', 'o'], valor: ['El valor', 'o'], inicio: ['La fecha de inicio', 'a'],
  fin: ['La fecha de fin', 'a'], mensaje: ['El mensaje', 'o'], fondo: ['El fondo inicial', 'o'], concepto: ['El concepto', 'o'],
  contado: ['El efectivo contado', 'o'], dejado: ['Lo que se deja en caja', 'o'], desde: ['La fecha inicial', 'a'], hasta: ['La fecha final', 'a'],
  texto: ['El mensaje', 'o'], mensajes: ['La conversación', 'a'], componentes: ['Los componentes', 'o'], conteo: ['El conteo', 'o'],
};

const vacio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim());
const numero = (m: string) => Number(m.match(/-?\d+(\.\d+)?/)?.[0] ?? 0);
const dinero = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

/** Traduce una restricción de class-validator; deja igual los mensajes que ya escribimos en español. */
function traducir(campo: string, regla: string, original: string, valor: unknown): string {
  if (!original.startsWith(campo + ' ') && !original.startsWith('each value in ')) return original;
  const [nombre, g] = NOMBRES[campo] ?? ['Este campo', 'o'];
  const plural = /^(Los|Las) /.test(nombre);
  const es = plural ? 'son' : 'es';
  const obligatorio = `${nombre} ${es} obligatori${g}${plural ? 's' : ''}`;
  const n = numero(original.slice(campo.length));
  switch (regla) {
    case 'minLength': return vacio(valor) ? obligatorio : `${nombre} debe tener al menos ${n} ${n === 1 ? 'carácter' : 'caracteres'}`;
    case 'maxLength': return `${nombre} no puede pasar de ${n} caracteres`;
    case 'isString': case 'isNotEmpty': case 'isDefined': return vacio(valor) ? obligatorio : `${nombre} no ${es} válid${g}${plural ? 's' : ''}`;
    case 'isEmail': return vacio(valor) ? obligatorio : 'Escribe un correo válido, por ejemplo nombre@correo.com';
    case 'isNumber': case 'isInt': return vacio(valor) ? obligatorio : `${nombre} debe ser un número${regla === 'isInt' ? ' entero' : ''}`;
    case 'min': return n > 0 && n < 1 ? `${nombre} debe ser mayor a 0` : n === 0 ? `${nombre} no puede ser negativ${g}` : `${nombre} debe ser al menos ${dinero(n)}`;
    case 'max': return `${nombre} no puede ser mayor a ${dinero(n)}`;
    case 'isDateString': return vacio(valor) ? obligatorio : `${nombre} no es una fecha válida`;
    case 'isIn': case 'isEnum': return vacio(valor) ? `Elige ${nombre.toLowerCase()}` : `${nombre} no es una opción válida`;
    case 'arrayMinSize': return `Agrega al menos ${n} en ${nombre.toLowerCase()}`;
    case 'arrayMaxSize': return `${nombre} admite máximo ${n}`;
    default: return vacio(valor) ? obligatorio : `${nombre} no ${es} válid${g}${plural ? 's' : ''}`;
  }
}

const RENGLON: Record<string, string> = { items: 'Concepto', pagos: 'Pago', componentes: 'Componente', mensajes: 'Mensaje' };

/** Orden en que se reporta la primera regla rota de un campo: lo que falta antes que el formato. */
const PRIORIDAD = ['isDefined', 'isNotEmpty', 'isString', 'isNumber', 'isInt', 'isEmail', 'minLength', 'min'];

function aplanar(errores: ValidationError[], ruta: string[], campos: Record<string, string>) {
  for (const e of errores) {
    const r = [...ruta, e.property];
    if (e.constraints) {
      const orden = (k: string) => PRIORIDAD.indexOf(k) + 1 || 99;
      const regla = Object.keys(e.constraints).sort((a, b) => orden(a) - orden(b))[0];
      let m = traducir(e.property, regla, e.constraints[regla], e.value);
      // Renglones de una lista (items.2.cantidad): se dice en qué renglón.
      const i = r.findIndex((p) => /^\d+$/.test(p));
      if (i > 0) m = `${RENGLON[r[i - 1]] ?? 'Renglón'} ${Number(r[i]) + 1}: ${m.charAt(0).toLowerCase()}${m.slice(1)}`;
      campos[r.join('.')] = m;
    }
    if (e.children?.length) aplanar(e.children, r, campos);
  }
}

/** Errores de validación en español, con un mapa campo → mensaje para marcar cada campo en el formulario. */
export function errorValidacion(errores: ValidationError[]) {
  const campos: Record<string, string> = {};
  aplanar(errores, [], campos);
  const mensajes = Object.values(campos);
  return new BadRequestException({ statusCode: 400, error: 'Bad Request', message: mensajes[0] ?? 'Revisa los datos del formulario', mensajes, campos });
}
