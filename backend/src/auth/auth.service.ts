import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { EstadoSuscripcion, Rol, Sucursal, Taller, Usuario } from '../entities';
import { Sesion } from '../common/sesion';
import { DIAS_PRUEBA_PUBLICO, hoy, limites, PLANES, sumarDias, suscripcionVigente } from '../common/suscripcion';
import { EjemplosService } from '../organizacion/ejemplos.service';
import { LoginDto, RegistroDto } from './auth.dto';

export const DIAS_PRUEBA = DIAS_PRUEBA_PUBLICO;
const NOTAS = 'Precios sujetos a cambio sin previo aviso. Se requiere 50% de anticipo para iniciar producción.';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    @InjectDataSource() private ds: DataSource,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Taller) private talleres: Repository<Taller>,
    @InjectRepository(Sucursal) private sucursales: Repository<Sucursal>,
    private ejemplos: EjemplosService,
  ) {}

  async registro(dto: RegistroDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.usuarios.existsBy({ email })) throw new ConflictException('Ya existe una cuenta con ese correo');
    const hash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.ds.transaction(async (em) => {
      const t = await em.save(
        em.create(Taller, {
          nombre: dto.taller.trim(),
          telefono: dto.telefono ?? '',
          email,
          tarifaMinuto: 6,
          notasCotizacion: NOTAS,
          plan: 'prueba',
          estadoSuscripcion: EstadoSuscripcion.Prueba,
          pruebaHasta: sumarDias(hoy(), DIAS_PRUEBA),
        }),
      );
      const s = await em.save(em.create(Sucursal, { tallerId: t.id, nombre: 'Matriz', telefono: dto.telefono ?? '' }));
      const u = await em.save(
        em.create(Usuario, { tallerId: t.id, nombre: dto.nombre.trim(), email, passwordHash: hash, rol: Rol.Dueno, sucursalId: null }),
      );
      if (dto.conEjemplos) await this.ejemplos.crear(em, t, s);
      return u;
    });
    return this.respuesta(usuario);
  }

  async login(dto: LoginDto) {
    const u = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :e', { e: dto.email.trim().toLowerCase() })
      .getOne();
    if (!u || !u.activo || !(await bcrypt.compare(dto.password, u.passwordHash)))
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    return this.respuesta(u);
  }

  async respuesta(u: Usuario) {
    const token = await this.jwt.signAsync({ sub: u.id, t: u.tallerId });
    return { token, ...(await this.perfil(u.id)) };
  }

  async yo(s: Sesion) {
    return this.perfil(s.usuarioId);
  }

  private async perfil(usuarioId: number) {
    const u = await this.usuarios.findOneByOrFail({ id: usuarioId });
    const t = await this.talleres.findOneByOrFail({ id: u.tallerId });
    const sucursales = await this.sucursales.find({
      where: u.sucursalId ? { id: u.sucursalId, tallerId: u.tallerId } : { tallerId: u.tallerId, activa: true },
      order: { id: 'ASC' },
    });
    const vence = t.estadoSuscripcion === EstadoSuscripcion.Prueba ? t.pruebaHasta : t.pagadoHasta;
    const dias = vence ? Math.round((Date.parse(vence) - Date.parse(hoy())) / 86400000) : null;
    return {
      usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, sucursalId: u.sucursalId },
      taller: t,
      sucursales,
      suscripcion: {
        plan: t.plan,
        estado: t.estadoSuscripcion,
        vigente: suscripcionVigente(t),
        vence,
        diasRestantes: dias,
        limites: limites(t),
        planes: PLANES,
      },
    };
  }
}
