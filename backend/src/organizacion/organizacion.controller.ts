import { Body, HttpCode, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Rol } from '../entities';
import { exigirCorreo, GERENCIA, Publico, Roles, Ses, type Sesion, SinSuscripcion } from '../common/sesion';
import { MercadoPagoService } from './mercadopago.service';
import { ActivarPlanDto, ConfirmarPagoDto, SucursalDto, TallerDto, UsuarioDto } from './organizacion.dto';
import { OrganizacionService } from './organizacion.service';

@Controller()
export class OrganizacionController {
  constructor(
    private org: OrganizacionService,
    private mp: MercadoPagoService,
  ) {}

  @Get('taller')
  taller(@Ses() s: Sesion) {
    return this.org.taller(s);
  }

  @Patch('taller') @Roles(...GERENCIA)
  actualizar(@Ses() s: Sesion, @Body() dto: TallerDto) {
    return this.org.actualizarTaller(s, dto);
  }

  @Post('taller/suscripcion') @Roles(Rol.Dueno) @SinSuscripcion()
  activar(@Ses() s: Sesion, @Body() dto: ActivarPlanDto) {
    if (process.env.PAGOS_MODO === 'demo') return this.org.activarPlan(s, dto);
    exigirCorreo(s);
    return this.mp.crear(s, dto.plan, dto.periodo);
  }

  @Get('taller/suscripcion') @Roles(Rol.Dueno)
  resumenSuscripcion(@Ses() s: Sesion) {
    return this.mp.resumen(s);
  }

  @Post('taller/suscripcion/confirmar') @Roles(Rol.Dueno) @SinSuscripcion() @HttpCode(200)
  confirmar(@Ses() s: Sesion, @Body() dto: ConfirmarPagoDto) {
    return this.mp.confirmar(s, dto.pagoId, dto.mpPagoId);
  }

  /** Aviso de Mercado Pago (webhook o IPN). Siempre responde 200; el pago se verifica en su API. */
  @Publico() @Post('pagos/mercadopago') @HttpCode(200)
  webhookMP(@Query() q: Record<string, string>, @Body() b: { type?: string; topic?: string; data?: { id?: string | number } }) {
    const tipo = b?.type ?? q.type ?? b?.topic ?? q.topic;
    const id = b?.data?.id ?? q['data.id'] ?? q.id;
    return this.mp.webhook(tipo, id != null ? String(id) : undefined);
  }

  @Get('sucursales')
  sucursales(@Ses() s: Sesion) {
    return this.org.listarSucursales(s);
  }

  @Post('sucursales') @Roles(...GERENCIA)
  crearSucursal(@Ses() s: Sesion, @Body() dto: SucursalDto) {
    return this.org.guardarSucursal(s, dto);
  }

  @Put('sucursales/:id') @Roles(...GERENCIA)
  editarSucursal(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: SucursalDto) {
    return this.org.guardarSucursal(s, dto, id);
  }

  @Get('usuarios') @Roles(...GERENCIA)
  usuarios(@Ses() s: Sesion) {
    return this.org.listarUsuarios(s);
  }

  @Post('usuarios') @Roles(...GERENCIA)
  crearUsuario(@Ses() s: Sesion, @Body() dto: UsuarioDto) {
    return this.org.guardarUsuario(s, dto);
  }

  @Put('usuarios/:id') @Roles(...GERENCIA)
  editarUsuario(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: UsuarioDto) {
    return this.org.guardarUsuario(s, dto, id);
  }

  @Post('usuarios/:id/invitar') @Roles(...GERENCIA) @HttpCode(200)
  invitar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.org.invitar(s, id);
  }

  @Get('bitacora') @Roles(...GERENCIA)
  bitacora(@Ses() s: Sesion, @Query('pagina') pagina?: string) {
    return this.org.listarBitacora(s, parseInt(pagina ?? '1', 10) || 1);
  }
}
