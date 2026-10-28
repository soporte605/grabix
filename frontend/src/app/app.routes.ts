import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { adminEnOtroSitio, conAdmin, conSesion, enLanding, enSistema, hostEsAdmin, noEsAdmin, panelLocal, roles, saltoHostAdmin, sinAdmin, sinSesion } from './core/guards';
import { SesionService } from './core/sesion.service';

const COSTOS = roles('dueno', 'admin', 'encargado');
const VENTA = roles('dueno', 'admin', 'encargado', 'vendedor');
const GER = roles('dueno', 'admin');

const panel = (): Routes => [
  { path: '', canActivate: [conAdmin], loadComponent: () => import('./pages/admin-talleres').then((m) => m.AdminTalleres), title: 'Talleres · Grabix' },
  { path: 'entrar', canActivate: [sinAdmin], loadComponent: () => import('./pages/admin-entrar').then((m) => m.AdminEntrar), title: 'Entrar · Panel · Grabix' },
  { path: 'talleres/:id', canActivate: [conAdmin], loadComponent: () => import('./pages/admin-ficha').then((m) => m.AdminFicha), title: 'Taller · Grabix' },
];

export const routes: Routes = [
  { path: '', canMatch: [hostEsAdmin], children: panel() },
  {
    path: 'admin',
    canMatch: [adminEnOtroSitio],
    canActivate: [saltoHostAdmin],
    children: [
      { path: '', pathMatch: 'full', canActivate: [saltoHostAdmin], loadComponent: () => import('./pages/admin-ir').then((m) => m.AdminIr) },
      { path: '**', canActivate: [saltoHostAdmin], loadComponent: () => import('./pages/admin-ir').then((m) => m.AdminIr) },
    ],
  },
  { path: 'admin', canMatch: [panelLocal], children: panel() },
  { path: '', canMatch: [noEsAdmin], canActivate: [enLanding], loadComponent: () => import('./pages/landing').then((m) => m.Landing), title: 'Grabix · Cotizaciones, producción e inventario para tu taller' },
  { path: 'entrar', canMatch: [noEsAdmin], canActivate: [enSistema, sinSesion], loadComponent: () => import('./pages/acceso').then((m) => m.Acceso), data: { modo: 'entrar' }, title: 'Entrar · Grabix' },
  { path: 'registro', canMatch: [noEsAdmin], canActivate: [enSistema, sinSesion], loadComponent: () => import('./pages/acceso').then((m) => m.Acceso), data: { modo: 'registro' }, title: 'Crear cuenta · Grabix' },
  { path: 'verificar-correo', canMatch: [noEsAdmin], canActivate: [enSistema], loadComponent: () => import('./pages/cuenta').then((m) => m.VerificarCorreo), title: 'Confirmar correo · Grabix' },
  { path: 'olvide-contrasena', canMatch: [noEsAdmin], canActivate: [enSistema], loadComponent: () => import('./pages/cuenta').then((m) => m.OlvideContrasena), title: 'Recuperar contraseña · Grabix' },
  { path: 'restablecer-contrasena', canMatch: [noEsAdmin], canActivate: [enSistema], loadComponent: () => import('./pages/cuenta').then((m) => m.Restablecer), data: { modo: 'recuperacion' }, title: 'Nueva contraseña · Grabix' },
  { path: 'invitacion', canMatch: [noEsAdmin], canActivate: [enSistema], loadComponent: () => import('./pages/cuenta').then((m) => m.Restablecer), data: { modo: 'invitacion' }, title: 'Invitación · Grabix' },
  {
    path: 'app',
    canActivate: [enSistema, conSesion],
    loadComponent: () => import('./shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => {
          const r = inject(SesionService).rol();
          return r === 'vendedor' ? 'cotizaciones' : r === 'produccion' ? 'produccion' : 'inicio';
        },
      },
      { path: 'inicio', canActivate: [COSTOS], loadComponent: () => import('./pages/inicio').then((m) => m.Inicio), title: 'Inicio · Grabix' },
      { path: 'cotizaciones', canActivate: [VENTA], data: { tipo: 'cotizaciones' }, loadComponent: () => import('./pages/doc-lista').then((m) => m.DocLista), title: 'Cotizaciones · Grabix',
        children: [
          { path: 'nueva', data: { tipo: 'cotizaciones' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Nueva cotización · Grabix' },
          { path: ':id', data: { tipo: 'cotizaciones' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Cotización · Grabix' },
        ],
      },
      { path: 'ventas', canActivate: [VENTA], data: { tipo: 'ventas' }, loadComponent: () => import('./pages/doc-lista').then((m) => m.DocLista), title: 'Ventas · Grabix',
        children: [
          { path: 'nueva', data: { tipo: 'ventas' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Nueva venta · Grabix' },
          { path: ':id', data: { tipo: 'ventas' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Venta · Grabix' },
        ],
      },
      { path: 'caja', canActivate: [VENTA], loadComponent: () => import('./pages/caja').then((m) => m.Caja), title: 'Caja · Grabix' },
      { path: 'cortes', canActivate: [VENTA], loadComponent: () => import('./pages/cortes').then((m) => m.Cortes), title: 'Cortes de caja · Grabix' },
      { path: 'reportes', canActivate: [COSTOS], loadComponent: () => import('./pages/reportes').then((m) => m.Reportes), title: 'Reportes · Grabix' },
      { path: 'produccion', loadComponent: () => import('./pages/produccion').then((m) => m.Produccion), title: 'Producción · Grabix' },
      { path: 'inventario', canActivate: [VENTA], loadComponent: () => import('./pages/inventario').then((m) => m.Inventario), title: 'Inventario · Grabix' },
      { path: 'clientes', canActivate: [VENTA], loadComponent: () => import('./pages/clientes').then((m) => m.Clientes), title: 'Clientes · Grabix' },
      { path: 'compras', canActivate: [COSTOS], loadComponent: () => import('./pages/compras').then((m) => m.Compras), title: 'Compras · Grabix' },
      { path: 'promociones', canActivate: [VENTA], loadComponent: () => import('./pages/promociones').then((m) => m.Promociones), title: 'Promociones · Grabix' },
      { path: 'sucursales', canActivate: [GER], loadComponent: () => import('./pages/equipo').then((m) => m.Sucursales), title: 'Sucursales · Grabix' },
      { path: 'usuarios', canActivate: [GER], loadComponent: () => import('./pages/equipo').then((m) => m.Usuarios), title: 'Usuarios · Grabix' },
      { path: 'ajustes', canActivate: [GER], loadComponent: () => import('./pages/ajustes').then((m) => m.Ajustes), title: 'Ajustes · Grabix' },
    ],
  },
  { path: '**', redirectTo: '' },
];
