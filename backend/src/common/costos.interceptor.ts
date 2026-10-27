import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { Sesion, VEN_COSTOS } from './sesion';

const OCULTOS = new Set(['costo', 'costoUnitario', 'costoTotal', 'utilidad', 'margen', 'ganancia', 'costoVendido']);

function limpiar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(limpiar);
  if (v && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (!OCULTOS.has(k)) o[k] = limpiar(x);
    return o;
  }
  return v;
}

/** Quita costos y ganancias de las respuestas para vendedores y producción. */
@Injectable()
export class CostosInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const s: Sesion | undefined = ctx.switchToHttp().getRequest().sesion;
    if (!s || VEN_COSTOS.includes(s.rol)) return next.handle();
    return next.handle().pipe(map((r) => (Buffer.isBuffer(r) ? r : limpiar(r))));
  }
}
