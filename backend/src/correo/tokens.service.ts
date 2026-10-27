import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, In, IsNull, MoreThan } from 'typeorm';
import { TokenCuenta, Usuario } from '../entities';

export type TipoToken = 'activacion' | 'recuperacion' | 'invitacion';
const VIGENCIA_HORAS: Record<TipoToken, number> = { activacion: 48, recuperacion: 1, invitacion: 24 * 7 };
const ESPERA_MS = 60_000;

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/** Enlaces de un solo uso para activar cuenta, recuperar contraseña e invitar usuarios. */
@Injectable()
export class TokensService {
  private ultimoEnvio = new Map<string, number>();

  constructor(@InjectDataSource() private ds: DataSource) {}

  /** Evita que alguien use el formulario para mandar correos en ráfaga a la misma dirección. */
  puedeEnviar(clave: string) {
    const ahora = Date.now();
    if ((this.ultimoEnvio.get(clave) ?? 0) > ahora - ESPERA_MS) return false;
    this.ultimoEnvio.set(clave, ahora);
    return true;
  }

  /** Crea un token nuevo e invalida los anteriores del mismo tipo para ese usuario. */
  async crear(usuarioId: number, tipo: TipoToken, em: EntityManager = this.ds.manager) {
    const crudo = randomBytes(32).toString('base64url');
    await em.update(TokenCuenta, { usuarioId, tipo, usado: IsNull() }, { usado: new Date() });
    await em.save(em.create(TokenCuenta, { usuarioId, tipo, hash: hash(crudo), expira: new Date(Date.now() + VIGENCIA_HORAS[tipo] * 3600_000) }));
    return crudo;
  }

  /** Busca un token vigente y no usado. */
  async buscar(crudo: string, tipos: TipoToken[]) {
    const t = await this.ds.manager.findOneBy(TokenCuenta, { hash: hash(crudo ?? ''), tipo: In(tipos), usado: IsNull(), expira: MoreThan(new Date()) });
    if (!t) throw new BadRequestException('El enlace no es válido o ya venció. Pide uno nuevo.');
    const u = await this.ds.manager.findOneBy(Usuario, { id: t.usuarioId });
    if (!u || !u.activo) throw new BadRequestException('La cuenta no está disponible');
    return { token: t, usuario: u };
  }

  marcarUsado(t: TokenCuenta, em: EntityManager = this.ds.manager) {
    return em.update(TokenCuenta, { id: t.id }, { usado: new Date() });
  }
}
