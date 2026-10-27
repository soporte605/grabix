/** Cálculo del simulador público de cotización (corte/grabado láser y sublimación). */
export interface EntradaSimulador {
  tipo: 'laser' | 'sublimacion';
  cantidad: number;
  // Láser: lámina y pieza en cm
  costoHoja: number; anchoHoja: number; altoHoja: number; anchoPieza: number; altoPieza: number;
  // Sublimación: pieza base (taza, playera…) + papel
  costoBase: number; costoPapel: number;
  minutos: number;
  tarifaMinuto: number;
  extra: number;
  diseno: number;
  margen: number;
}

export interface ResultadoSimulador {
  piezasPorHoja: number; hojas: number;
  material: number; maquina: number; extras: number; costoTotal: number; costoPieza: number;
  precioPieza: number; precioTotal: number; ganancia: number;
}

const SEPARACION = 0.3; // cm entre piezas para el corte

export function piezasPorHoja(aH: number, hH: number, aP: number, hP: number) {
  if (aP <= 0 || hP <= 0) return 0;
  const cabe = (a: number, h: number) => Math.floor((aH + SEPARACION) / (a + SEPARACION)) * Math.floor((hH + SEPARACION) / (h + SEPARACION));
  return Math.max(cabe(aP, hP), cabe(hP, aP));
}

export function simular(e: EntradaSimulador): ResultadoSimulador {
  const q = Math.max(1, Math.floor(e.cantidad || 1));
  let pph = 0, hojas = 0, material: number;
  if (e.tipo === 'laser') {
    pph = piezasPorHoja(e.anchoHoja, e.altoHoja, e.anchoPieza, e.altoPieza);
    hojas = pph ? Math.ceil(q / pph) : 0;
    material = hojas * e.costoHoja;
  } else {
    material = q * (e.costoBase + e.costoPapel);
  }
  const maquina = q * e.minutos * e.tarifaMinuto;
  const extras = q * e.extra;
  const costoTotal = material + maquina + extras + e.diseno;
  const m = Math.min(0.95, Math.max(0, e.margen / 100));
  const costoPieza = (material + maquina + extras) / q;
  const precioPieza = Math.ceil(costoPieza / (1 - m));
  const precioTotal = precioPieza * q + Math.ceil(e.diseno / (1 - m));
  return { piezasPorHoja: pph, hojas, material, maquina, extras, costoTotal, costoPieza, precioPieza, precioTotal, ganancia: precioTotal - costoTotal };
}
