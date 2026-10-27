import { EstadoSuscripcion, Taller } from '../entities';

export const hoy = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export function suscripcionVigente(t: Taller): boolean {
  const h = hoy();
  if (t.estadoSuscripcion === EstadoSuscripcion.Activa) return !t.pagadoHasta || t.pagadoHasta >= h;
  if (t.estadoSuscripcion === EstadoSuscripcion.Prueba) return !!t.pruebaHasta && t.pruebaHasta >= h;
  return false;
}

export const PLANES = [
  {
    id: 'basico',
    nombre: 'Taller',
    precioMensual: 199,
    precioAnual: 1990,
    sucursales: 1,
    usuarios: 3,
    incluye: ['Cotizaciones con PDF y WhatsApp', 'Inventario con recetas de insumos', 'Ventas, anticipos y saldos', 'Estadísticas de ventas y ganancia'],
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precioMensual: 399,
    precioAnual: 3990,
    sucursales: 3,
    usuarios: 10,
    incluye: ['Todo lo del plan Taller', 'Hasta 3 sucursales', 'Roles y permisos por usuario', 'Traspasos de inventario y bitácora'],
  },
  {
    id: 'empresa',
    nombre: 'Empresa',
    precioMensual: 799,
    precioAnual: 7990,
    sucursales: 20,
    usuarios: 50,
    incluye: ['Todo lo del plan Pro', 'Sucursales y usuarios ampliados', 'Soporte prioritario'],
  },
];

/** Límites mientras dura la prueba gratuita. */
export const LIMITES_PRUEBA = { sucursales: 2, usuarios: 5 };

export function limites(t: Taller) {
  const p = PLANES.find((x) => x.id === t.plan);
  return p ? { sucursales: p.sucursales, usuarios: p.usuarios } : LIMITES_PRUEBA;
}
export const DIAS_PRUEBA_PUBLICO = 14;
