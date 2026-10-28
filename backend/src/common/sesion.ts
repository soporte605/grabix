import { createParamDecorator, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Rol } from '../entities';

export interface Sesion {
  usuarioId: number;
  tallerId: number;
  nombre: string;
  rol: Rol;
  /** Sucursal asignada al usuario (null = todas). */
  sucursalAsignada: number | null;
  /** Sucursal con la que se está trabajando (null = todas). */
  sucursal: number | null;
  emailVerificado: boolean;
  /** Super administrador que entró como dueño de este taller. */
  soporteId?: number;
}

export const ES_PUBLICO = 'publico';
/** Ruta sin sesión (landing, simulador, PDF compartido). */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

export const ROLES = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

export const SIN_SUSCRIPCION = 'sinSuscripcion';
/** Permite escribir aunque la suscripción esté vencida (p. ej. pagar). */
export const SinSuscripcion = () => SetMetadata(SIN_SUSCRIPCION, true);

export const Ses = createParamDecorator((_: unknown, ctx: ExecutionContext): Sesion => {
  return ctx.switchToHttp().getRequest().sesion;
});

/** Roles que administran todo el taller. */
export const GERENCIA = [Rol.Dueno, Rol.Admin];
/** Roles que pueden ver costos y ganancias. */
export const VEN_COSTOS = [Rol.Dueno, Rol.Admin, Rol.Encargado];

/** Acciones que piden correo confirmado (elegir plan, invitar). El acceso normal no se bloquea. */
export function exigirCorreo(s: Sesion) {
  if (!s.emailVerificado)
    throw new ForbiddenException({ code: 'EMAIL_NO_VERIFICADO', message: 'Confirma tu correo para hacer esto. Revisa tu bandeja o pide otro enlace.' });
}
