import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol } from './modelos';
import { SesionService } from './sesion.service';

export const conSesion: CanActivateFn = async () => {
  const s = inject(SesionService);
  const r = inject(Router);
  if (s.perfil()) return true;
  return (await s.cargar()) ? true : r.parseUrl('/entrar');
};

export const sinSesion: CanActivateFn = async () => {
  const s = inject(SesionService);
  return s.token() && (await s.cargar()) ? inject(Router).parseUrl('/app') : true;
};

export const roles = (...permitidos: Rol[]): CanActivateFn => () => {
  const s = inject(SesionService);
  return permitidos.includes(s.rol()!) ? true : inject(Router).parseUrl('/app');
};
