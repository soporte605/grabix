import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol, Sucursal, Taller, Usuario } from '../entities';
import { ES_PUBLICO, ROLES, SIN_SUSCRIPCION, Sesion } from './sesion';
import { suscripcionVigente } from './suscripcion';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Taller) private talleres: Repository<Taller>,
    @InjectRepository(Sucursal) private sucursales: Repository<Sucursal>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    if (meta<boolean>(ES_PUBLICO)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar');
    let payload: { sub: number; iat?: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Tu sesión expiró, vuelve a iniciar sesión');
    }
    const u = await this.usuarios.findOneBy({ id: payload.sub });
    if (!u || !u.activo) throw new UnauthorizedException('Usuario inactivo');
    if (u.claveCambiadaEn && (payload.iat ?? 0) < Math.floor(u.claveCambiadaEn.getTime() / 1000))
      throw new UnauthorizedException('Tu contraseña cambió, vuelve a iniciar sesión');

    const roles = meta<Rol[]>(ROLES);
    if (roles && !roles.includes(u.rol)) throw new ForbiddenException('Tu rol no tiene permiso para esta acción');

    if (req.method !== 'GET' && !meta<boolean>(SIN_SUSCRIPCION)) {
      const t = await this.talleres.findOneBy({ id: u.tallerId });
      if (!t || !suscripcionVigente(t))
        throw new HttpException('Tu suscripción venció. Renueva tu plan para seguir registrando.', HttpStatus.PAYMENT_REQUIRED);
    }

    let sucursal: number | null = u.sucursalId;
    if (sucursal == null) {
      const h = parseInt(String(req.headers['x-sucursal'] ?? ''), 10);
      if (h) {
        const ok = await this.sucursales.existsBy({ id: h, tallerId: u.tallerId });
        if (!ok) throw new ForbiddenException('Sucursal no válida');
        sucursal = h;
      }
    }
    const sesion: Sesion = {
      usuarioId: u.id,
      tallerId: u.tallerId,
      nombre: u.nombre,
      rol: u.rol,
      sucursalAsignada: u.sucursalId,
      sucursal,
      emailVerificado: u.emailVerificado,
    };
    req.sesion = sesion;
    return true;
  }
}
