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
import { Rol, Sucursal, SuperAdmin, Taller, Usuario } from '../entities';
import { ES_PUBLICO, ROLES, SIN_SUSCRIPCION, Sesion } from './sesion';
import { suscripcionVigente } from './suscripcion';

const SIN_PERMISO = 'Tu rol no tiene permiso para esta acción';
const SESION_INVALIDA = 'Tu sesión ya no es válida';

function pathDe(req: { path?: string; url?: string }) {
  return String(req.path ?? req.url ?? '').split('?')[0];
}

/** El prefijo global /api forma parte del path (igual que el chequeo de eliminarEn). */
function esRutaAdmin(path: string) {
  return path === '/api/admin' || path.startsWith('/api/admin/');
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Taller) private talleres: Repository<Taller>,
    @InjectRepository(Sucursal) private sucursales: Repository<Sucursal>,
    @InjectRepository(SuperAdmin) private superAdmins: Repository<SuperAdmin>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    if (meta<boolean>(ES_PUBLICO)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar');
    let payload: { sub: number; iat?: number; tipo?: string; soporte?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Tu sesión expiró, vuelve a iniciar sesión');
    }

    const path = pathDe(req);
    if (payload.tipo === 'superadmin') return this.comoSuperAdmin(req, payload, path);

    const soporteId = typeof payload.soporte === 'number' ? payload.soporte : undefined;
    if (soporteId != null) {
      const a = await this.superAdmins.findOneBy({ id: soporteId });
      if (!a || !a.activo) throw new UnauthorizedException(SESION_INVALIDA);
      if (esRutaAdmin(path)) throw new ForbiddenException(SIN_PERMISO);
    } else if (esRutaAdmin(path)) {
      throw new ForbiddenException(SIN_PERMISO);
    }

    const u = await this.usuarios.findOneBy({ id: payload.sub });
    if (!u || !u.activo) throw new UnauthorizedException('Usuario inactivo');
    if (u.claveCambiadaEn && (payload.iat ?? 0) < Math.floor(u.claveCambiadaEn.getTime() / 1000))
      throw new UnauthorizedException('Tu contraseña cambió, vuelve a iniciar sesión');

    const roles = meta<Rol[]>(ROLES);
    if (roles && !roles.includes(u.rol)) throw new ForbiddenException(SIN_PERMISO);

    const t = await this.talleres.findOneBy({ id: u.tallerId });
    if (!t) throw new UnauthorizedException('Cuenta no encontrada');
    // El token de soporte entra aunque el taller esté bloqueado, vencido o con eliminación programada.
    if (soporteId == null) {
      if (t.bloqueado) throw new UnauthorizedException('Esta cuenta está suspendida. Escríbenos para reactivarla.');
      if (t.eliminarEn) {
        if (u.rol !== Rol.Dueno) throw new UnauthorizedException('Esta cuenta está en proceso de eliminación');
        if (!/^\/api\/(auth|cuenta)\//.test(path))
          throw new ForbiddenException('La cuenta está programada para eliminarse. Restáurala para seguir usando Grabix.');
      }
      if (req.method !== 'GET' && !meta<boolean>(SIN_SUSCRIPCION)) {
        if (!suscripcionVigente(t))
          throw new HttpException('Tu suscripción venció. Renueva tu plan para seguir registrando.', HttpStatus.PAYMENT_REQUIRED);
      }
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
      emailVerificado: soporteId != null ? true : u.emailVerificado,
    };
    if (soporteId != null) sesion.soporteId = soporteId;
    req.sesion = sesion;
    return true;
  }

  private async comoSuperAdmin(req: { admin?: { id: number; nombre: string; email: string } }, payload: { sub: number; iat?: number }, path: string) {
    const a = await this.superAdmins.findOneBy({ id: payload.sub });
    if (!a || !a.activo) throw new UnauthorizedException(SESION_INVALIDA);
    if (a.claveCambiadaEn && (payload.iat ?? 0) < Math.floor(a.claveCambiadaEn.getTime() / 1000))
      throw new UnauthorizedException(SESION_INVALIDA);
    if (!esRutaAdmin(path)) throw new ForbiddenException(SIN_PERMISO);
    req.admin = { id: a.id, nombre: a.nombre, email: a.email };
    return true;
  }
}
