import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { EstadoSuscripcion, Rol, Sucursal, Taller, Usuario } from '../entities';
import { exigirClave } from '../common/clave';
import { Sesion } from '../common/sesion';
import { DIAS_PRUEBA_PUBLICO, hoy, limites, PLANES, sumarDias, suscripcionVigente } from '../common/suscripcion';
import { EjemplosService } from '../organizacion/ejemplos.service';
import { CorreoService } from '../correo/correo.service';
import { TokensService } from '../correo/tokens.service';
import { CambiarContrasenaDto, LoginDto, RegistroDto, RestablecerDto } from './auth.dto';

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
    private correo: CorreoService,
    private tokens: TokensService,
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
    // Como en FincaPro y SiloPro: entra de inmediato y confirma el correo cuando pueda.
    this.tokens.puedeEnviar(`activacion:${usuario.id}`);
    await this.enviarActivacion(usuario.id, dto.taller.trim());
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

  // ---------------------------------------------------------------------------
  // Confirmación de correo
  // ---------------------------------------------------------------------------

  private async enviarActivacion(usuarioId: number, taller?: string) {
    const u = await this.usuarios.findOneByOrFail({ id: usuarioId });
    taller ??= (await this.talleres.findOneByOrFail({ id: u.tallerId })).nombre;
    const token = await this.tokens.crear(u.id, 'activacion');
    await this.correo.activacion(u.email, u.nombre, taller, this.correo.url(`/verificar-correo?token=${token}`));
  }

  async reenviarActivacion(s: Sesion) {
    if (s.emailVerificado) return { yaVerificado: true };
    if (!this.tokens.puedeEnviar(`activacion:${s.usuarioId}`))
      throw new HttpException('Ya te enviamos un enlace hace menos de un minuto. Revisa tu bandeja (y la carpeta de spam).', HttpStatus.TOO_MANY_REQUESTS);
    await this.enviarActivacion(s.usuarioId);
    return { enviado: true };
  }

  async verificarCorreo(crudo: string) {
    const { token, usuario } = await this.tokens.buscar(crudo, ['activacion']);
    await this.ds.transaction(async (em) => {
      await em.update(Usuario, { id: usuario.id }, { emailVerificado: true });
      await this.tokens.marcarUsado(token, em);
    });
    return { ok: true, email: usuario.email };
  }

  // ---------------------------------------------------------------------------
  // Contraseñas: olvidé, restablecer, invitación y cambio con sesión
  // ---------------------------------------------------------------------------

  /** Siempre responde igual, exista o no la cuenta, para no revelar qué correos están registrados. */
  async olvide(emailCrudo: string) {
    const email = emailCrudo.trim().toLowerCase();
    if (!this.tokens.puedeEnviar(`recuperacion:${email}`)) return;
    const u = await this.usuarios.findOneBy({ email, activo: true });
    if (!u) return;
    const token = await this.tokens.crear(u.id, 'recuperacion');
    await this.correo.recuperacion(u.email, u.nombre, this.correo.url(`/restablecer-contrasena?token=${token}`));
  }

  /** Datos para mostrar en la pantalla del enlace (a quién pertenece y de qué taller). */
  async enlace(crudo: string) {
    const { token, usuario } = await this.tokens.buscar(crudo, ['recuperacion', 'invitacion']);
    const t = await this.talleres.findOneByOrFail({ id: usuario.tallerId });
    return { tipo: token.tipo, nombre: usuario.nombre, email: usuario.email, taller: t.nombre };
  }

  /** Sirve para el enlace de recuperación y para aceptar una invitación. Deja la sesión iniciada. */
  async restablecer(dto: RestablecerDto) {
    const { token, usuario } = await this.tokens.buscar(dto.token, ['recuperacion', 'invitacion']);
    exigirClave(dto.password, [usuario.email, usuario.nombre]);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.ds.transaction(async (em) => {
      // Abrir el enlace prueba que el correo es suyo.
      await em.update(Usuario, { id: usuario.id }, { passwordHash, emailVerificado: true, claveCambiadaEn: new Date() });
      await this.tokens.marcarUsado(token, em);
    });
    if (token.tipo === 'recuperacion') await this.correo.contrasenaCambiada(usuario.email, usuario.nombre);
    return this.respuesta(usuario);
  }

  async cambiarContrasena(s: Sesion, dto: CambiarContrasenaDto) {
    const u = await this.usuarios.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: s.usuarioId }).getOneOrFail();
    if (!(await bcrypt.compare(dto.actual, u.passwordHash))) throw new BadRequestException('Tu contraseña actual no es correcta');
    exigirClave(dto.nueva, [u.email, u.nombre]);
    if (dto.nueva === dto.actual) throw new BadRequestException('La contraseña nueva debe ser distinta de la actual');
    await this.usuarios.update({ id: u.id }, { passwordHash: await bcrypt.hash(dto.nueva, 10), claveCambiadaEn: new Date() });
    await this.correo.contrasenaCambiada(u.email, u.nombre);
    // Las demás sesiones se cierran; esta recibe un token nuevo.
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
      usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, sucursalId: u.sucursalId, emailVerificado: u.emailVerificado },
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
