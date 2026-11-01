import { EstadoSuscripcion } from '../entities';
import { sumarDias } from '../common/suscripcion';

export interface EstadoFechas {
  plan: string;
  estadoSuscripcion: EstadoSuscripcion;
  pruebaHasta: string | null;
  pagadoHasta: string | null;
  eliminarEn: string | null;
}

export interface AjusteSuscripcion {
  dias?: number;
  renovar?: 'mensual' | 'anual';
  plan?: 'basico' | 'pro' | 'empresa';
  estado?: EstadoSuscripcion;
  cancelarEliminacion?: boolean;
}

/** Aplica un ajuste del panel. `hoyFecha` la pone el servicio con `hoy()` para poder probar fechas fijas. */
export function aplicarSuscripcion(actual: EstadoFechas, ajuste: AjusteSuscripcion, hoyFecha: string): EstadoFechas {
  const r: EstadoFechas = { ...actual };
  if (ajuste.dias != null) {
    if (actual.estadoSuscripcion === EstadoSuscripcion.Prueba) r.pruebaHasta = sumarDias(actual.pruebaHasta ?? hoyFecha, ajuste.dias);
    else r.pagadoHasta = sumarDias(actual.pagadoHasta ?? hoyFecha, ajuste.dias);
  }
  if (ajuste.renovar) {
    const base = r.pagadoHasta && r.pagadoHasta > hoyFecha ? r.pagadoHasta : hoyFecha;
    r.plan = ajuste.plan ?? r.plan;
    r.estadoSuscripcion = EstadoSuscripcion.Activa;
    r.pagadoHasta = sumarDias(base, ajuste.renovar === 'anual' ? 365 : 30);
  } else if (ajuste.plan) {
    r.plan = ajuste.plan;
  }
  if (!ajuste.renovar && ajuste.estado) r.estadoSuscripcion = ajuste.estado;
  if (ajuste.cancelarEliminacion) r.eliminarEn = null;
  return r;
}

/** Mensaje si esta desactivación no se puede hacer, o null si sí. */
export function motivoNoDesactivar(p: { actorId: number; objetivoId: number; quedarianActivos: number }): string | null {
  if (p.actorId === p.objetivoId) return 'No puedes desactivarte';
  if (p.quedarianActivos <= 0) return 'Tiene que quedar al menos un super administrador activo';
  return null;
}
