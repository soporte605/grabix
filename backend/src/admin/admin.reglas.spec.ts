import { EstadoSuscripcion } from '../entities';
import { sumarDias } from '../common/suscripcion';
import { aplicarSuscripcion, motivoNoDesactivar, type EstadoFechas } from './admin.reglas';

const base = (parcial: Partial<EstadoFechas> = {}): EstadoFechas => ({
  plan: 'basico',
  estadoSuscripcion: EstadoSuscripcion.Activa,
  pruebaHasta: '2026-10-01',
  pagadoHasta: '2026-12-01',
  eliminarEn: null,
  ...parcial,
});

describe('aplicarSuscripcion', () => {
  it('alargar en prueba toca pruebaHasta', () => {
    const r = aplicarSuscripcion(
      base({ estadoSuscripcion: EstadoSuscripcion.Prueba, plan: 'prueba', pruebaHasta: '2026-11-01', pagadoHasta: '2026-01-01' }),
      { dias: 10 },
      '2026-10-28',
    );
    expect(r.pruebaHasta).toBe(sumarDias('2026-11-01', 10));
    expect(r.pagadoHasta).toBe('2026-01-01');
  });

  it('alargar en activa toca pagadoHasta', () => {
    const r = aplicarSuscripcion(base(), { dias: 5 }, '2026-10-28');
    expect(r.pagadoHasta).toBe(sumarDias('2026-12-01', 5));
    expect(r.pruebaHasta).toBe('2026-10-01');
  });

  it('renovar anual desde una fecha futura no la recorta', () => {
    const hoy = '2026-10-28';
    const futura = '2027-06-01';
    const r = aplicarSuscripcion(base({ pagadoHasta: futura }), { renovar: 'anual' }, hoy);
    expect(r.pagadoHasta).toBe(sumarDias(futura, 365));
    expect(r.pagadoHasta! > sumarDias(hoy, 365)).toBe(true);
    expect(r.estadoSuscripcion).toBe(EstadoSuscripcion.Activa);
  });
});

describe('motivoNoDesactivar', () => {
  it('no desactivar al propio', () => {
    expect(motivoNoDesactivar({ actorId: 1, objetivoId: 1, quedarianActivos: 2 })).toBe('No puedes desactivarte');
  });

  it('no desactivar si quedarían cero activos', () => {
    expect(motivoNoDesactivar({ actorId: 1, objetivoId: 2, quedarianActivos: 0 })).toBe(
      'Tiene que quedar al menos un super administrador activo',
    );
  });
});
