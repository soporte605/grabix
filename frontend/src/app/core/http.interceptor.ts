import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AvisoService } from './aviso.service';
import { SesionService } from './sesion.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const aviso = inject(AvisoService);
  const headers: Record<string, string> = {};
  const t = sesion.token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const s = sesion.sucursal();
  if (s) headers['X-Sucursal'] = String(s);
  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && t && !req.url.endsWith('/auth/yo')) sesion.salir();
      if (e.status === 402) aviso.error(e.error?.message ?? 'Tu suscripción venció');
      return throwError(() => e);
    }),
  );
};
