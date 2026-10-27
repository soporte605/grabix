import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Rol } from '../entities';
import { GERENCIA, Roles, Ses, type Sesion, SinSuscripcion } from '../common/sesion';
import { ActivarPlanDto, SucursalDto, TallerDto, UsuarioDto } from './organizacion.dto';
import { OrganizacionService } from './organizacion.service';

@Controller()
export class OrganizacionController {
  constructor(private org: OrganizacionService) {}

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
    return this.org.activarPlan(s, dto);
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

  @Get('bitacora') @Roles(...GERENCIA)
  bitacora(@Ses() s: Sesion, @Query('pagina') pagina?: string) {
    return this.org.listarBitacora(s, parseInt(pagina ?? '1', 10) || 1);
  }
}
