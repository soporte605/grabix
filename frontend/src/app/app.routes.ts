import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { conSesion, roles, sinSesion } from './core/guards';
import { SesionService } from './core/sesion.service';

const COSTOS = roles('dueno', 'admin', 'encargado');
const VENTA = roles('dueno', 'admin', 'encargado', 'vendedor');
const GER = roles('dueno', 'admin');

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing').then((m) => m.Landing), title: 'Grabix · Cotizaciones, producción e inventario para tu taller' },
  { path: 'entrar', canActivate: [sinSesion], loadComponent: () => import('./pages/acceso').then((m) => m.Acceso), data: { modo: 'entrar' }, title: 'Entrar · Grabix' },
  { path: 'registro', canActivate: [sinSesion], loadComponent: () => import('./pages/acceso').then((m) => m.Acceso), data: { modo: 'registro' }, title: 'Crear cuenta · Grabix' },
  { path: 'verificar-correo', loadComponent: () => import('./pages/cuenta').then((m) => m.VerificarCorreo), title: 'Confirmar correo · Grabix' },
  { path: 'olvide-contrasena', loadComponent: () => import('./pages/cuenta').then((m) => m.OlvideContrasena), title: 'Recuperar contraseña · Grabix' },
  { path: 'restablecer-contrasena', loadComponent: () => import('./pages/cuenta').then((m) => m.Restablecer), data: { modo: 'recuperacion' }, title: 'Nueva contraseña · Grabix' },
  { path: 'invitacion', loadComponent: () => import('./pages/cuenta').then((m) => m.Restablecer), data: { modo: 'invitacion' }, title: 'Invitación · Grabix' },
  {
    path: 'app',
    canActivate: [conSesion],
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
      { path: 'cotizaciones', canActivate: [VENTA], data: { tipo: 'cotizaciones' }, loadComponent: () => import('./pages/doc-lista').then((m) => m.DocLista), title: 'Cotizaciones · Grabix' },
      { path: 'cotizaciones/nueva', canActivate: [VENTA], data: { tipo: 'cotizaciones' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Nueva cotización · Grabix' },
      { path: 'cotizaciones/:id', canActivate: [VENTA], data: { tipo: 'cotizaciones' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Cotización · Grabix' },
      { path: 'ventas', canActivate: [VENTA], data: { tipo: 'ventas' }, loadComponent: () => import('./pages/doc-lista').then((m) => m.DocLista), title: 'Ventas · Grabix' },
      { path: 'ventas/nueva', canActivate: [VENTA], data: { tipo: 'ventas' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Nueva venta · Grabix' },
      { path: 'ventas/:id', canActivate: [VENTA], data: { tipo: 'ventas' }, loadComponent: () => import('./pages/doc-editor').then((m) => m.DocEditor), title: 'Venta · Grabix' },
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
