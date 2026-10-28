import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AdminSesion {
  id: number;
  nombre: string;
  email: string;
}

/** Super administrador autenticado con el token del panel (`req.admin`). */
export const Admin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminSesion => {
  return ctx.switchToHttp().getRequest().admin;
});
