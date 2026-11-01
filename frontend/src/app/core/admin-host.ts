/** Host del panel. En local el mismo sitio usa el prefijo /admin. */
export const ADMIN_HOST = 'admin.grabix.elikarsystems.com';

export const CLAVE_ADMIN = 'grabix.admin.token';

export function esHostAdmin() {
  return location.hostname.startsWith('admin.');
}

/** Dominio real: no es localhost ni una IP. */
export function hostSeparado() {
  const h = location.hostname;
  return h.includes('.') && h !== 'localhost' && !/^[\d.]+$/.test(h);
}

/** Listado, entrar o ficha, en la raíz (host admin) o bajo /admin (local). */
export function rutaPanel(camino = ''): string {
  const base = esHostAdmin() ? '' : '/admin';
  if (!camino) return base || '/';
  return `${base}/${camino}`.replace(/\/{2,}/g, '/');
}

export function leerAdminToken() {
  try { return localStorage.getItem(CLAVE_ADMIN); } catch { return null; }
}

export const PLANES: { id: 'basico' | 'pro' | 'empresa'; nombre: string }[] = [
  { id: 'basico', nombre: 'Taller' },
  { id: 'pro', nombre: 'Pro' },
  { id: 'empresa', nombre: 'Empresa' },
];

export const ESTADOS_SUSCRIPCION: { id: 'prueba' | 'activa' | 'vencida' | 'cancelada'; nombre: string }[] = [
  { id: 'prueba', nombre: 'Prueba' },
  { id: 'activa', nombre: 'Activa' },
  { id: 'vencida', nombre: 'Vencida' },
  { id: 'cancelada', nombre: 'Cancelada' },
];

export function nombrePlan(id: string) {
  return PLANES.find((p) => p.id === id)?.nombre ?? id;
}

export function nombreEstado(id: string) {
  return ESTADOS_SUSCRIPCION.find((e) => e.id === id)?.nombre ?? id;
}

export function claseEstado(id: string) {
  if (id === 'activa') return 'ok';
  if (id === 'prueba') return 'warn';
  if (id === 'vencida') return 'bad';
  return 'mut';
}
