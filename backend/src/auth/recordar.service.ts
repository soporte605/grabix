import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { DispositivoRecordado, Usuario } from '../entities';

/**
 * "Recordar mi usuario" como en las apps de banco.
 *
 * El navegador solo guarda un token al azar (256 bits) en una cookie HttpOnly, Secure y SameSite=Strict:
 * JavaScript no la puede leer, no viaja a otros sitios y no contiene el nombre, el correo ni la contraseña.
 * En la base se guarda solo su hash SHA-256, así que ni con una copia de la base se puede rehacer la cookie.
 * El token no abre sesión: solo sirve para saludar ("Hola, Jose") y saber qué correo usar; la contraseña
 * se pide siempre.
 */
export const COOKIE_RECORDAR = 'grabix_recordar';
const DIAS = 90;
/** La cookie solo viaja a las rutas de acceso, no a cada petición de la app. */
const RUTA = '/api/auth';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/** jose.perez@gmail.com → jo•••••••@gmail.com */
export function ocultarCorreo(email: string) {
  const [usuario, dominio = ''] = email.split('@');
  const ver = usuario.length <= 2 ? usuario.slice(0, 1) : usuario.slice(0, 2);
  return `${ver}${'•'.repeat(Math.max(3, Math.min(8, usuario.length - ver.length)))}@${dominio}`;
}

export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? '';

function leerCookie(req: Request): string | null {
  const crudo = req.headers.cookie ?? '';
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === COOKIE_RECORDAR) {
      const v = parte.slice(i + 1).trim();
      return /^[A-Za-z0-9_-]{20,100}$/.test(v) ? v : null;
    }
  }
  return null;
}

/** En producción siempre Secure; en localhost por http no se podría guardar, así que ahí no. */
function segura(req: Request) {
  if (process.env.COOKIE_SEGURA === 'false') return false;
  return !['localhost', '127.0.0.1', '::1'].includes(req.hostname);
}

@Injectable()
export class RecordarService {
  constructor(
    @InjectRepository(DispositivoRecordado) private dispositivos: Repository<DispositivoRecordado>,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
  ) {}

  /** Usuario recordado en este navegador, si la cookie es válida y la cuenta sigue activa. */
  async buscar(req: Request) {
    const crudo = leerCookie(req);
    if (!crudo) return null;
    const d = await this.dispositivos.findOneBy({ hash: hash(crudo), expira: MoreThan(new Date()) });
    if (!d) return null;
    const u = await this.usuarios.findOneBy({ id: d.usuarioId, activo: true });
    return u ? { dispositivo: d, usuario: u } : null;
  }

  /** Lo que ve la pantalla de entrada: primer nombre y correo con asteriscos. Nada más. */
  async saludo(req: Request, res: Response) {
    const r = await this.buscar(req);
    if (!r) {
      if (leerCookie(req)) this.borrarCookie(req, res);
      return { recordado: false as const };
    }
    return { recordado: true as const, nombre: primerNombre(r.usuario.nombre), email: ocultarCorreo(r.usuario.email) };
  }

  /** Tras entrar con "Recordar": cambia el token por uno nuevo (el anterior deja de servir). */
  async recordar(usuarioId: number, req: Request, res: Response) {
    await this.quitarActual(req);
    await this.dispositivos.delete({ usuarioId, expira: LessThan(new Date()) });
    const crudo = randomBytes(32).toString('base64url');
    await this.dispositivos.save(
      this.dispositivos.create({
        usuarioId,
        hash: hash(crudo),
        agente: String(req.headers['user-agent'] ?? '').slice(0, 200),
        expira: new Date(Date.now() + DIAS * 86400_000),
        usadoEn: new Date(),
      }),
    );
    res.cookie(COOKIE_RECORDAR, crudo, {
      httpOnly: true,
      secure: segura(req),
      sameSite: 'strict',
      path: RUTA,
      maxAge: DIAS * 86400_000,
    });
  }

  /** "No soy yo" o entrar sin marcar "Recordar": se borra del navegador y de la base. */
  async olvidar(req: Request, res: Response) {
    await this.quitarActual(req);
    this.borrarCookie(req, res);
  }

  /** Al cambiar o restablecer la contraseña se olvidan todos los equipos de esa persona. */
  olvidarTodos(usuarioId: number) {
    return this.dispositivos.delete({ usuarioId });
  }

  private async quitarActual(req: Request) {
    const crudo = leerCookie(req);
    if (crudo) await this.dispositivos.delete({ hash: hash(crudo) });
  }

  private borrarCookie(req: Request, res: Response) {
    res.clearCookie(COOKIE_RECORDAR, { httpOnly: true, secure: segura(req), sameSite: 'strict', path: RUTA });
  }
}
