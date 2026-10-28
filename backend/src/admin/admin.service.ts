import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { AdminBitacora, CorreoLog, EstadoSuscripcion, Rol, Sucursal, SuperAdmin, Taller, Usuario } from '../entities';
import { exigirClave } from '../common/clave';
import { existe } from '../common/util';
import { CorreoService } from '../correo/correo.service';
import { TokensService } from '../correo/tokens.service';
import { hoy } from '../common/suscripcion';
import { AdminSesion } from './admin.decorator';
import { AdminLoginDto, AdminTallerDto, AdminUsuarioDto, BloqueoDto, CrearAdminDto, SuscripcionAdminDto } from './admin.dto';
import { aplicarSuscripcion, motivoNoDesactivar } from './admin.reglas';

const ESPERA: Record<'activacion' | 'invitacion' | 'recuperacion', { clave: (u: Usuario) => string; texto: string }> = {
  activacion: {
    clave: (u) => `activacion:${u.id}`,
    texto: 'Ya te enviamos un enlace hace menos de un minuto. Revisa tu bandeja (y la carpeta de spam).',
  },
  invitacion: {
    clave: (u) => `invitacion:${u.id}`,
    texto: 'Ya se envió una invitación hace menos de un minuto',
  },
  recuperacion: {
    clave: (u) => `recuperacion:${u.email}`,
    texto: 'Ya te enviamos un enlace hace menos de un minuto. Revisa tu bandeja (y la carpeta de spam).',
  },
};

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  private log = new Logger('Admin');

  constructor(
    private jwt: JwtService,
    @InjectRepository(SuperAdmin) private admins: Repository<SuperAdmin>,
    @InjectRepository(AdminBitacora) private bitacora: Repository<AdminBitacora>,
    @InjectRepository(Taller) private talleres: Repository<Taller>,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Sucursal) private sucursales: Repository<Sucursal>,
    @InjectRepository(CorreoLog) private correos: Repository<CorreoLog>,
    private correo: CorreoService,
    private tokens: TokensService,
  ) {}

  async onApplicationBootstrap() {
    if (await this.admins.count()) return;
    const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD;
    if (!email || !password) return;
    try {
      exigirClave(password, [email, 'Elikar']);
    } catch (e) {
      const cuerpo = e instanceof HttpException ? e.getResponse() : e;
      const msg = typeof cuerpo === 'string' ? cuerpo : (cuerpo as { message?: string })?.message;
      this.log.error(typeof msg === 'string' ? msg : 'La contraseña del super administrador no cumple las reglas');
      return;
    }
    await this.admins.save(this.admins.create({ nombre: 'Elikar', email, passwordHash: await bcrypt.hash(password, 10) }));
  }

  async entrar(dto: AdminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const a = await this.admins.createQueryBuilder('a').addSelect('a.passwordHash').where('a.email = :e', { e: email }).getOne();
    if (!a || !a.activo || !(await bcrypt.compare(dto.password, a.passwordHash)))
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    const token = await this.jwt.signAsync({ sub: a.id, tipo: 'superadmin' });
    return { token, admin: { id: a.id, nombre: a.nombre, email: a.email } };
  }

  yo(a: AdminSesion) {
    return { id: a.id, nombre: a.nombre, email: a.email };
  }

  async listarTalleres(q?: string) {
    const qb = this.talleres.createQueryBuilder('t').orderBy('t.id', 'DESC');
    const texto = q?.trim();
    if (texto) {
      qb.where(
        `(t.nombre LIKE :q OR t.email LIKE :q OR EXISTS (
          SELECT 1 FROM usuarios u WHERE u.tallerId = t.id AND u.rol = :rol AND u.email LIKE :q
        ))`,
        { q: `%${texto}%`, rol: Rol.Dueno },
      );
    }
    const talleres = await qb.getMany();
    if (!talleres.length) return [];
    const duenos = await this.usuarios.find({
      where: { rol: Rol.Dueno, tallerId: In(talleres.map((t) => t.id)) },
      order: { id: 'ASC' },
    });
    const porTaller = new Map<number, Usuario>();
    for (const u of duenos) {
      const prev = porTaller.get(u.tallerId);
      if (!prev || (u.activo && !prev.activo)) porTaller.set(u.tallerId, u);
    }
    return talleres.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      emailDueno: porTaller.get(t.id)?.email ?? null,
      plan: t.plan,
      estadoSuscripcion: t.estadoSuscripcion,
      vence: t.estadoSuscripcion === EstadoSuscripcion.Prueba ? t.pruebaHasta : t.pagadoHasta,
      bloqueado: t.bloqueado,
      creadoEn: t.creadoEn,
    }));
  }

  async ficha(id: number) {
    const taller = existe(await this.talleres.findOneBy({ id }), 'Taller');
    const usuarios = await this.usuarios.find({ where: { tallerId: id }, order: { nombre: 'ASC' } });
    const emails = usuarios.map((u) => u.email);
    const filas = emails.length
      ? await this.correos.find({ where: { para: In(emails) }, order: { id: 'DESC' }, take: 50 })
      : [];
    return {
      taller,
      usuarios: usuarios.map(({ id: uid, nombre, email, rol, sucursalId, activo, emailVerificado }) => ({
        id: uid,
        nombre,
        email,
        rol,
        sucursalId,
        activo,
        emailVerificado,
      })),
      correos: filas.map(({ id: cid, para, asunto, tipo, estado, error, creadoEn }) => ({ id: cid, para, asunto, tipo, estado, error, creadoEn })),
    };
  }

  async actualizarTaller(admin: AdminSesion, id: number, dto: AdminTallerDto) {
    const t = existe(await this.talleres.findOneBy({ id }), 'Taller');
    if (dto.nombre !== undefined) t.nombre = dto.nombre;
    if (dto.telefono !== undefined) t.telefono = dto.telefono;
    if (dto.email !== undefined) t.email = dto.email;
    if (dto.direccion !== undefined) t.direccion = dto.direccion;
    await this.talleres.save(t);
    await this.anotar(admin, 'actualizar', 'taller', t.id, t.id, dto);
    return t;
  }

  async bloqueo(admin: AdminSesion, id: number, dto: BloqueoDto) {
    const t = existe(await this.talleres.findOneBy({ id }), 'Taller');
    t.bloqueado = dto.bloqueado;
    await this.talleres.save(t);
    await this.anotar(admin, dto.bloqueado ? 'bloquear' : 'reactivar', 'taller', t.id, t.id, { bloqueado: dto.bloqueado });
    return t;
  }

  async suscripcion(admin: AdminSesion, id: number, dto: SuscripcionAdminDto) {
    const t = existe(await this.talleres.findOneBy({ id }), 'Taller');
    const next = aplicarSuscripcion(
      {
        plan: t.plan,
        estadoSuscripcion: t.estadoSuscripcion,
        pruebaHasta: t.pruebaHasta,
        pagadoHasta: t.pagadoHasta,
        eliminarEn: t.eliminarEn,
      },
      dto,
      hoy(),
    );
    Object.assign(t, next);
    await this.talleres.save(t);
    await this.anotar(admin, 'suscripcion', 'taller', t.id, t.id, dto);
    return t;
  }

  async actualizarUsuario(admin: AdminSesion, id: number, dto: AdminUsuarioDto) {
    const email = dto.email.trim().toLowerCase();
    const u = existe(await this.usuarios.findOneBy({ id }), 'Usuario');
    if (dto.sucursalId && !(await this.sucursales.existsBy({ id: dto.sucursalId, tallerId: u.tallerId })))
      throw new BadRequestException('Sucursal no válida');
    const otro = await this.usuarios.findOneBy({ email });
    if (otro && otro.id !== id) throw new BadRequestException('Ese correo ya está en uso');
    u.nombre = dto.nombre.trim();
    u.email = email;
    u.rol = dto.rol;
    u.sucursalId = [Rol.Dueno, Rol.Admin].includes(dto.rol) ? null : (dto.sucursalId ?? null);
    if (dto.activo !== undefined) u.activo = dto.activo;
    const r = await this.usuarios.save(u);
    await this.anotar(admin, 'actualizar', 'usuario', r.id, r.tallerId, {
      nombre: r.nombre,
      email: r.email,
      rol: r.rol,
      sucursalId: r.sucursalId,
      activo: r.activo,
    });
    const { passwordHash: _omit, ...publico } = r;
    return publico;
  }

  async reenviarCorreo(admin: AdminSesion, id: number, tipo: 'activacion' | 'invitacion' | 'recuperacion') {
    const u = existe(await this.usuarios.findOneBy({ id }), 'Usuario');
    const t = existe(await this.talleres.findOneBy({ id: u.tallerId }), 'Taller');
    const espera = ESPERA[tipo];
    if (!this.tokens.puedeEnviar(espera.clave(u))) throw new HttpException(espera.texto, HttpStatus.TOO_MANY_REQUESTS);
    const token = await this.tokens.crear(u.id, tipo);
    if (tipo === 'activacion') await this.correo.activacion(u.email, u.nombre, t.nombre, this.correo.url(`/verificar-correo?token=${token}`));
    else if (tipo === 'invitacion')
      await this.correo.invitacion(u.email, u.nombre, t.nombre, 'Soporte Grabix', this.correo.url(`/invitacion?token=${token}`));
    else await this.correo.recuperacion(u.email, u.nombre, this.correo.url(`/restablecer-contrasena?token=${token}`));
    await this.anotar(admin, 'reenviar', 'usuario', u.id, u.tallerId, { tipo, email: u.email });
    return { enviado: true };
  }

  async entrarTaller(admin: AdminSesion, id: number) {
    const t = existe(await this.talleres.findOneBy({ id }), 'Taller');
    const dueno = await this.usuarios.findOne({ where: { tallerId: t.id, rol: Rol.Dueno, activo: true }, order: { id: 'ASC' } });
    if (!dueno) throw new BadRequestException('Este taller no tiene un dueño activo');
    const token = await this.jwt.signAsync({ sub: dueno.id, t: t.id, soporte: admin.id });
    await this.anotar(admin, 'entrar', 'taller', t.id, t.id, { usuarioId: dueno.id });
    return { token };
  }

  async salirTaller(admin: AdminSesion, id: number) {
    const t = existe(await this.talleres.findOneBy({ id }), 'Taller');
    await this.anotar(admin, 'salir', 'taller', t.id, t.id);
    return { ok: true };
  }

  listarAdministradores() {
    return this.admins.find({ order: { id: 'ASC' } }).then((rows) =>
      rows.map((a) => ({ id: a.id, nombre: a.nombre, email: a.email, activo: a.activo, creadoEn: a.creadoEn })),
    );
  }

  async crearAdministrador(dto: CrearAdminDto) {
    const email = dto.email.trim().toLowerCase();
    const nombre = dto.nombre.trim();
    exigirClave(dto.password, [email, nombre]);
    if (await this.admins.existsBy({ email })) throw new BadRequestException('Ese correo ya está en uso');
    const a = await this.admins.save(this.admins.create({ nombre, email, passwordHash: await bcrypt.hash(dto.password, 10) }));
    return { id: a.id, nombre: a.nombre, email: a.email, activo: a.activo };
  }

  async actualizarAdministrador(actor: AdminSesion, id: number, activo: boolean) {
    const a = existe(await this.admins.findOneBy({ id }), 'Administrador');
    if (!activo) {
      const activos = await this.admins.countBy({ activo: true });
      const quedarian = activos - (a.activo ? 1 : 0);
      const motivo = motivoNoDesactivar({ actorId: actor.id, objetivoId: a.id, quedarianActivos: quedarian });
      if (motivo) throw new BadRequestException(motivo);
    }
    a.activo = activo;
    await this.admins.save(a);
    return { id: a.id, nombre: a.nombre, email: a.email, activo: a.activo };
  }

  private anotar(admin: AdminSesion, accion: string, entidad: string, entidadId: number | null, tallerId: number | null, detalle?: unknown) {
    return this.bitacora.save(
      this.bitacora.create({
        superAdminId: admin.id,
        superAdminNombre: admin.nombre,
        tallerId,
        accion,
        entidad,
        entidadId,
        detalle: detalle ?? null,
      }),
    );
  }
}
