import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { AvisoService } from './aviso.service';
import { CargaService } from './carga.service';
import { SesionService } from './sesion.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const aviso = inject(AvisoService);
  const carga = inject(CargaService);
  const headers: Record<string, string> = {};
  const t = sesion.token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const s = sesion.sucursal();
  if (s) headers['X-Sucursal'] = String(s);
  carga.inicio();
  return next(req.clone({ setHeaders: headers })).pipe(
    finalize(() => carga.fin()),
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && t && !req.url.endsWith('/auth/yo')) sesion.salir();
      if (e.status === 402) aviso.error(e.error?.message ?? 'Tu suscripción venció');
      return throwError(() => e);
    }),
  );
};
