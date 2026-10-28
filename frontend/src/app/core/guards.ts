import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { ADMIN_HOST, esHostAdmin, hostSeparado, rutaPanel } from './admin-host';
import { AdminService } from './admin.service';
import { Rol } from './modelos';
import { SesionService } from './sesion.service';

export const conSesion: CanActivateFn = async () => {
  const s = inject(SesionService);
  const r = inject(Router);
  if (s.perfil()) return true;
  if (await s.cargar()) return true;
  if (s.acaboDeCerrarSoporte()) return r.parseUrl(rutaPanel());
  return r.parseUrl('/entrar');
};

export const sinSesion: CanActivateFn = async () => {
  const s = inject(SesionService);
  return s.token() && (await s.cargar()) ? inject(Router).parseUrl('/app') : true;
};

export const roles = (...permitidos: Rol[]): CanActivateFn => () => {
  const s = inject(SesionService);
  return permitidos.includes(s.rol()!) ? true : inject(Router).parseUrl('/app');
};

/** Panel en la raíz solo cuando el host es admin. */
export const hostEsAdmin: CanMatchFn = () => esHostAdmin();

/** Landing, registro y demás pantallas de clientes. */
export const noEsAdmin: CanMatchFn = () => !esHostAdmin();

/** /admin en localhost o en una IP. */
export const panelLocal: CanMatchFn = () => !esHostAdmin() && !hostSeparado();

/** /admin abierto en la landing o en app. de producción. */
export const adminEnOtroSitio: CanMatchFn = () => !esHostAdmin() && hostSeparado();

export const saltoHostAdmin: CanActivateFn = () => {
  location.href = `https://${ADMIN_HOST}/`;
  return false;
};

export const conAdmin: CanActivateFn = async () => {
  const admin = inject(AdminService);
  const r = inject(Router);
  if (admin.token() && (await admin.yo())) return true;
  return r.parseUrl(rutaPanel('entrar'));
};

export const sinAdmin: CanActivateFn = async () => {
  const admin = inject(AdminService);
  const r = inject(Router);
  if (!admin.token()) return true;
  return (await admin.yo()) ? r.parseUrl(rutaPanel()) : true;
};

/**
 * En producción la landing vive en DOMINIO y el sistema en app.DOMINIO.
 * En localhost o con una IP todo queda en el mismo sitio.
 * admin. no se manda a app.admin…
 */
export const enSistema: CanActivateFn = (_r, estado) => {
  const h = location.hostname;
  if (!hostSeparado() || h.startsWith('app.') || h.startsWith('admin.')) return true;
  location.href = `${location.protocol}//app.${h.replace(/^www\./, '')}${estado.url}`;
  return false;
};

/** La landing: si se abre desde app.DOMINIO, pasa al dominio principal. */
export const enLanding: CanActivateFn = () => {
  const h = location.hostname;
  if (!hostSeparado() || !h.startsWith('app.')) return true;
  location.href = `${location.protocol}//${h.slice(4)}/`;
  return false;
};
