import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Publico } from '../common/sesion';
import { Admin, type AdminSesion } from './admin.decorator';
import { ActivoAdminDto, AdminLoginDto, AdminTallerDto, AdminUsuarioDto, BloqueoDto, CorreoAdminDto, CrearAdminDto, SuscripcionAdminDto } from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Publico() @Post('entrar') @HttpCode(200)
  entrar(@Body() dto: AdminLoginDto) {
    return this.admin.entrar(dto);
  }

  @Get('yo')
  yo(@Admin() a: AdminSesion) {
    return this.admin.yo(a);
  }

  @Get('talleres')
  talleres(@Query('q') q?: string) {
    return this.admin.listarTalleres(q);
  }

  @Get('talleres/:id')
  ficha(@Param('id', ParseIntPipe) id: number) {
    return this.admin.ficha(id);
  }

  @Patch('talleres/:id')
  actualizarTaller(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number, @Body() dto: AdminTallerDto) {
    return this.admin.actualizarTaller(a, id, dto);
  }

  @Post('talleres/:id/bloqueo') @HttpCode(200)
  bloqueo(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number, @Body() dto: BloqueoDto) {
    return this.admin.bloqueo(a, id, dto);
  }

  @Post('talleres/:id/suscripcion') @HttpCode(200)
  suscripcion(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number, @Body() dto: SuscripcionAdminDto) {
    return this.admin.suscripcion(a, id, dto);
  }

  @Post('talleres/:id/entrar') @HttpCode(200)
  entrarTaller(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number) {
    return this.admin.entrarTaller(a, id);
  }

  @Post('talleres/:id/salir') @HttpCode(200)
  salir(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number) {
    return this.admin.salirTaller(a, id);
  }

  @Patch('usuarios/:id')
  actualizarUsuario(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number, @Body() dto: AdminUsuarioDto) {
    return this.admin.actualizarUsuario(a, id, dto);
  }

  @Post('usuarios/:id/correo') @HttpCode(200)
  correo(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number, @Body() dto: CorreoAdminDto) {
    return this.admin.reenviarCorreo(a, id, dto.tipo);
  }

  @Get('administradores')
  administradores() {
    return this.admin.listarAdministradores();
  }

  @Post('administradores')
  crearAdministrador(@Body() dto: CrearAdminDto) {
    return this.admin.crearAdministrador(dto);
  }

  @Patch('administradores/:id')
  actualizarAdministrador(@Admin() a: AdminSesion, @Param('id', ParseIntPipe) id: number, @Body() dto: ActivoAdminDto) {
    return this.admin.actualizarAdministrador(a, id, dto.activo);
  }
}
