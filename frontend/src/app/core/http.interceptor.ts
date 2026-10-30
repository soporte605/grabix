import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { leerAdminToken } from './admin-host';
import { AdminService } from './admin.service';
import { AvisoService } from './aviso.service';
import { CargaService } from './carga.service';
import { SesionService } from './sesion.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const admin = inject(AdminService);
  const aviso = inject(AvisoService);
  const carga = inject(CargaService);
  const esAdmin = req.url.includes('/api/admin');
  const headers: Record<string, string> = {};
  const tokenTaller = sesion.token();
  if (esAdmin) {
    const t = leerAdminToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  } else {
    if (tokenTaller) headers['Authorization'] = `Bearer ${tokenTaller}`;
    const s = sesion.sucursal();
    if (s) headers['X-Sucursal'] = String(s);
  }
  carga.inicio();
  return next(req.clone({ setHeaders: headers })).pipe(
    finalize(() => carga.fin()),
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && esAdmin) {
        admin.cerrarSesion(!req.url.includes('/api/admin/entrar'));
      } else if (e.status === 401 && sesion.enSoporte()) {
        sesion.restaurarTrasSoporte();
      } else if (e.status === 401 && tokenTaller && !req.url.endsWith('/auth/yo')) {
        sesion.salir();
      }
      if (e.status === 402) aviso.error(e.error?.message ?? 'Tu suscripción venció');
      return throwError(() => e);
    }),
  );
};
