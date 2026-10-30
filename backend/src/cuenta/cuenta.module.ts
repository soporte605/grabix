import { Body, Controller, ForbiddenException, HttpCode, Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Post, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { BitacoraService } from '../common/bitacora.service';
import { Roles, Ses, SinSuscripcion, type Sesion } from '../common/sesion';
import { hoy, sumarDias } from '../common/suscripcion';
import { CorreoService } from '../correo/correo.service';
import { Rol, Taller, Usuario } from '../entities';

/** Días para arrepentirse antes del borrado definitivo. */
export const DIAS_GRACIA = 30;

export class EliminarCuentaDto {
  @IsString() password: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

/**
 * Cuenta del taller: bienvenida vista y eliminación (derecho de cancelación, LFPDPPP).
 * Eliminar deja la cuenta bloqueada DIAS_GRACIA días; el dueño puede restaurarla. Después se borra todo.
 */
@Injectable()
export class CuentaService implements OnApplicationBootstrap, OnApplicationShutdown {
  private log = new Logger('Cuenta');
  private reloj?: ReturnType<typeof setInterval>;

  constructor(
    @InjectDataSource() private ds: DataSource,
    private correo: CorreoService,
    private bitacora: BitacoraService,
  ) {}

  async recorridoVisto(s: Sesion) {
    await this.ds.manager.update(Usuario, { id: s.usuarioId }, { recorridoVisto: true });
    return { ok: true };
  }

  async eliminar(s: Sesion, dto: EliminarCuentaDto) {
    const u = await this.ds.manager.createQueryBuilder(Usuario, 'u').addSelect('u.passwordHash').where('u.id = :id', { id: s.usuarioId }).getOneOrFail();
    if (!(await bcrypt.compare(dto.password, u.passwordHash))) throw new UnauthorizedException('La contraseña no es correcta');
    const t = await this.ds.manager.findOneByOrFail(Taller, { id: s.tallerId });
    const fecha = sumarDias(hoy(), DIAS_GRACIA);
    await this.ds.manager.update(Taller, { id: t.id }, { eliminarEn: fecha });
    await this.bitacora.registrar(s, 'eliminar', 'cuenta', t.id, { eliminarEn: fecha, motivo: dto.motivo ?? '' });
    await this.correo.enviar({
      para: u.email,
      tipo: 'cuenta_eliminacion',
      asunto: `Programaste la eliminación de ${t.nombre} en Grabix`,
      html: this.correo.plantilla({
        previa: `Tus datos se borrarán el ${fecha}. Puedes restaurar la cuenta antes de esa fecha.`,
        etiqueta: 'Eliminación de cuenta',
        titulo: 'Recibimos tu solicitud',
        parrafos: [
          `Hola ${u.nombre}, la cuenta de ${t.nombre} quedó desactivada y nadie de tu equipo podrá entrar.`,
          `El ${fecha} borraremos de forma definitiva todos sus datos: clientes, cotizaciones, ventas, pagos, inventario, compras, usuarios y bitácora.`,
          'Si cambias de opinión, entra con tu correo y contraseña antes de esa fecha y elige "Restaurar cuenta".',
        ],
        boton: { texto: 'Entrar a Grabix', url: this.correo.url('/entrar') },
        nota: 'Si no fuiste tú, entra de inmediato, restaura la cuenta y cambia tu contraseña.',
      }),
      texto: `Hola ${u.nombre}, la cuenta de ${t.nombre} quedó desactivada. El ${fecha} se borrarán todos sus datos. Para restaurarla entra antes de esa fecha: ${this.correo.url('/entrar')}`,
    });
    return { eliminarEn: fecha };
  }

  async restaurar(s: Sesion) {
    await this.ds.manager.update(Taller, { id: s.tallerId }, { eliminarEn: null });
    await this.bitacora.registrar(s, 'restaurar', 'cuenta', s.tallerId);
    return { ok: true };
  }

  /** Borra todo lo del taller: primero los renglones hijos, luego cada tabla con tallerId y al final el taller. */
  async purgar(tallerId: number) {
    await this.ds.transaction(async (em) => {
      const q = (sql: string) => em.query(sql, [tallerId]);
      await q('DELETE FROM cotizacion_items WHERE cotizacionId IN (SELECT id FROM cotizaciones WHERE tallerId = ?)');
      await q('DELETE FROM venta_items WHERE ventaId IN (SELECT id FROM ventas WHERE tallerId = ?)');
      await q('DELETE FROM pagos WHERE ventaId IN (SELECT id FROM ventas WHERE tallerId = ?)');
      await q('DELETE FROM compra_items WHERE compraId IN (SELECT id FROM compras WHERE tallerId = ?)');
      await q('DELETE FROM producto_componentes WHERE productoId IN (SELECT id FROM productos WHERE tallerId = ?)');
      await q('DELETE FROM tokens_cuenta WHERE usuarioId IN (SELECT id FROM usuarios WHERE tallerId = ?)');
      await q('DELETE FROM correos_log WHERE para IN (SELECT email FROM usuarios WHERE tallerId = ?)');
      // Ventas antes que cotizaciones por la referencia cotizacionId; usuarios al final.
      const tablas = this.ds.entityMetadatas
        .filter((m) => m.findColumnWithPropertyName('tallerId') && m.tableName !== 'usuarios')
        .map((m) => m.tableName)
        .sort((a, b) => (a === 'ventas' ? -1 : b === 'ventas' ? 1 : 0));
      for (const t of tablas) await q(`DELETE FROM \`${t}\` WHERE tallerId = ?`);
      await q('DELETE FROM usuarios WHERE tallerId = ?');
      await q('DELETE FROM talleres WHERE id = ?');
    });
    this.log.log(`Taller ${tallerId} eliminado por completo`);
  }

  async purgarVencidas() {
    const ts = await this.ds.manager.find(Taller, { where: { eliminarEn: LessThanOrEqual(hoy()) } });
    for (const t of ts) await this.purgar(t.id).catch((e) => this.log.error(`No se pudo eliminar el taller ${t.id}: ${(e as Error).message}`));
  }

  onApplicationBootstrap() {
    // Revisa al arrancar y cada 6 horas; no hace falta más precisión que el día.
    setTimeout(() => this.purgarVencidas().catch(() => undefined), 30_000);
    this.reloj = setInterval(() => this.purgarVencidas().catch(() => undefined), 6 * 3600_000);
  }

  onApplicationShutdown() {
    clearInterval(this.reloj);
  }
}

@Controller('cuenta')
export class CuentaController {
  constructor(private cuenta: CuentaService) {}

  @SinSuscripcion() @Post('recorrido') @HttpCode(200)
  recorrido(@Ses() s: Sesion) {
    return this.cuenta.recorridoVisto(s);
  }

  @SinSuscripcion() @Roles(Rol.Dueno) @Post('eliminar') @HttpCode(200)
  eliminar(@Ses() s: Sesion, @Body() dto: EliminarCuentaDto) {
    if (s.rol !== Rol.Dueno) throw new ForbiddenException('Solo el dueño puede eliminar la cuenta');
    return this.cuenta.eliminar(s, dto);
  }

  @SinSuscripcion() @Roles(Rol.Dueno) @Post('restaurar') @HttpCode(200)
  restaurar(@Ses() s: Sesion) {
    return this.cuenta.restaurar(s);
  }
}

@Module({ controllers: [CuentaController], providers: [CuentaService] })
export class CuentaModule {}
