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

/**
 * En producción la landing vive en DOMINIO y el sistema en app.DOMINIO.
 * En localhost o con una IP todo queda en el mismo sitio.
 */
const separado = () => {
  const h = location.hostname;
  return h.includes('.') && h !== 'localhost' && !/^[\d.]+$/.test(h);
};

/** Pantallas de cuenta y sistema: si se abren desde la landing, pasan a app.DOMINIO. */
export const enSistema: CanActivateFn = (_r, estado) => {
  const h = location.hostname;
  if (!separado() || h.startsWith('app.')) return true;
  location.href = `${location.protocol}//app.${h.replace(/^www\./, '')}${estado.url}`;
  return false;
};

/** La landing: si se abre desde app.DOMINIO, pasa al dominio principal. */
export const enLanding: CanActivateFn = () => {
  const h = location.hostname;
  if (!separado() || !h.startsWith('app.')) return true;
  location.href = `${location.protocol}//${h.slice(4)}/`;
  return false;
};
