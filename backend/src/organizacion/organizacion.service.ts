import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Bitacora, EstadoSuscripcion, Rol, Sucursal, Taller, Usuario } from '../entities';
import { BitacoraService } from '../common/bitacora.service';
import { CorreoService } from '../correo/correo.service';
import { TokensService } from '../correo/tokens.service';
import { exigirCorreo, Sesion } from '../common/sesion';
import { hoy, limites, PLANES, sumarDias } from '../common/suscripcion';
import { existe } from '../common/util';
import { ActivarPlanDto, SucursalDto, TallerDto, UsuarioDto } from './organizacion.dto';

@Injectable()
export class OrganizacionService {
  constructor(
    @InjectRepository(Taller) private talleres: Repository<Taller>,
    @InjectRepository(Sucursal) private sucursales: Repository<Sucursal>,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Bitacora) private bitacoraRepo: Repository<Bitacora>,
    private bitacora: BitacoraService,
    private correo: CorreoService,
    private tokens: TokensService,
  ) {}

  taller(s: Sesion) {
    return this.talleres.findOneByOrFail({ id: s.tallerId });
  }

  async actualizarTaller(s: Sesion, dto: TallerDto) {
    await this.talleres.update({ id: s.tallerId }, dto);
    await this.bitacora.registrar(s, 'actualizar', 'taller', s.tallerId, dto);
    return this.taller(s);
  }

  /**
   * Activa un plan. En producción esto lo hace el webhook de la pasarela de pago
   * (Stripe o Mercado Pago); mientras no esté integrada, solo funciona con PAGOS_MODO=demo.
   */
  async activarPlan(s: Sesion, dto: ActivarPlanDto) {
    if (process.env.PAGOS_MODO !== 'demo')
      throw new BadRequestException('Los pagos en línea aún no están habilitados');
    exigirCorreo(s);
    const t = await this.taller(s);
    const base = t.pagadoHasta && t.pagadoHasta > hoy() ? t.pagadoHasta : hoy();
    t.plan = dto.plan;
    t.estadoSuscripcion = EstadoSuscripcion.Activa;
    t.pagadoHasta = sumarDias(base, dto.periodo === 'anual' ? 365 : 30);
    await this.talleres.save(t);
    await this.bitacora.registrar(s, 'activar-plan', 'taller', t.id, dto);
    return { plan: PLANES.find((p) => p.id === dto.plan), pagadoHasta: t.pagadoHasta };
  }

  listarSucursales(s: Sesion) {
    return this.sucursales.find({ where: { tallerId: s.tallerId }, order: { id: 'ASC' } });
  }

  async guardarSucursal(s: Sesion, dto: SucursalDto, id?: number) {
    if (!id) {
      const t = await this.taller(s);
      const n = await this.sucursales.countBy({ tallerId: s.tallerId, activa: true });
      if (n >= limites(t).sucursales)
        throw new ForbiddenException(`Tu plan permite ${limites(t).sucursales} sucursal(es). Mejora tu plan para agregar más.`);
    }
    const suc = id
      ? existe(await this.sucursales.findOneBy({ id, tallerId: s.tallerId }), 'Sucursal')
      : this.sucursales.create({ tallerId: s.tallerId });
    Object.assign(suc, dto);
    const r = await this.sucursales.save(suc);
    await this.bitacora.registrar(s, id ? 'actualizar' : 'crear', 'sucursal', r.id, dto);
    return r;
  }

  listarUsuarios(s: Sesion) {
    return this.usuarios.find({ where: { tallerId: s.tallerId }, order: { nombre: 'ASC' } });
  }

  async guardarUsuario(s: Sesion, dto: UsuarioDto, id?: number) {
    const email = dto.email.trim().toLowerCase();
    if (dto.rol === Rol.Dueno && s.rol !== Rol.Dueno) throw new ForbiddenException('Solo el dueño puede asignar el rol de dueño');
    if (dto.sucursalId && !(await this.sucursales.existsBy({ id: dto.sucursalId, tallerId: s.tallerId })))
      throw new BadRequestException('Sucursal no válida');
    const otro = await this.usuarios.findOneBy({ email });
    if (otro && otro.id !== id) throw new BadRequestException('Ese correo ya está en uso');

    let u: Usuario;
    if (id) {
      u = existe(await this.usuarios.findOneBy({ id, tallerId: s.tallerId }), 'Usuario');
      if (u.rol === Rol.Dueno && s.rol !== Rol.Dueno) throw new ForbiddenException('No puedes modificar al dueño');
      if (u.id === s.usuarioId && (dto.rol !== u.rol || dto.activo === false))
        throw new BadRequestException('No puedes cambiar tu propio rol ni desactivarte');
    } else {
      const t = await this.taller(s);
      const n = await this.usuarios.countBy({ tallerId: s.tallerId, activo: true });
      if (n >= limites(t).usuarios)
        throw new ForbiddenException(`Tu plan permite ${limites(t).usuarios} usuarios. Mejora tu plan para agregar más.`);
      exigirCorreo(s);
      // Sin contraseña inicial, la persona la crea desde el correo de invitación.
      u = this.usuarios.create({ tallerId: s.tallerId, passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10) });
    }
    u.nombre = dto.nombre.trim();
    u.email = email;
    u.rol = dto.rol;
    // Dueño y administrador siempre ven todas las sucursales.
    u.sucursalId = [Rol.Dueno, Rol.Admin].includes(dto.rol) ? null : (dto.sucursalId ?? null);
    if (dto.activo !== undefined) u.activo = dto.activo;
    if (dto.password) u.passwordHash = await bcrypt.hash(dto.password, 10);
    const r = await this.usuarios.save(u);
    await this.bitacora.registrar(s, id ? 'actualizar' : 'crear', 'usuario', r.id, { nombre: u.nombre, email, rol: u.rol, sucursalId: u.sucursalId });
    if (!id && !dto.password) await this.enviarInvitacion(s, r);
    const { passwordHash: _omit, ...publico } = r;
    return { ...publico, invitado: !id && !dto.password };
  }

  /** Reenvía la invitación a un usuario que aún no confirma su correo. */
  async invitar(s: Sesion, id: number) {
    exigirCorreo(s);
    const u = existe(await this.usuarios.findOneBy({ id, tallerId: s.tallerId, activo: true }), 'Usuario');
    if (u.emailVerificado) throw new BadRequestException('Este usuario ya activó su cuenta');
    if (!this.tokens.puedeEnviar(`invitacion:${u.id}`))
      throw new HttpException('Ya se envió una invitación hace menos de un minuto', HttpStatus.TOO_MANY_REQUESTS);
    await this.enviarInvitacion(s, u);
    await this.bitacora.registrar(s, 'invitar', 'usuario', u.id, { email: u.email });
    return { enviado: true };
  }

  private async enviarInvitacion(s: Sesion, u: Usuario) {
    const t = await this.taller(s);
    const token = await this.tokens.crear(u.id, 'invitacion');
    await this.correo.invitacion(u.email, u.nombre, t.nombre, s.nombre, this.correo.url(`/invitacion?token=${token}`));
  }

  listarBitacora(s: Sesion, pagina = 1) {
    return this.bitacoraRepo.find({
      where: { tallerId: s.tallerId },
      order: { id: 'DESC' },
      take: 50,
      skip: (Math.max(1, pagina) - 1) * 50,
    });
  }
}
