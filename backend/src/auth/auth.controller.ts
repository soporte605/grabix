import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Publico, Ses, SinSuscripcion, type Sesion } from '../common/sesion';
import { CambiarContrasenaDto, LoginDto, OlvideDto, RegistroDto, RestablecerDto, TokenDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Publico() @Post('registro')
  registro(@Body() dto: RegistroDto) {
    return this.auth.registro(dto);
  }

  @Publico() @Post('login') @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('yo')
  yo(@Ses() s: Sesion) {
    return this.auth.yo(s);
  }

  @Publico() @Post('correo/verificar') @HttpCode(200)
  verificarCorreo(@Body() dto: TokenDto) {
    return this.auth.verificarCorreo(dto.token);
  }

  @SinSuscripcion() @Post('correo/reenviar') @HttpCode(200)
  reenviarActivacion(@Ses() s: Sesion) {
    return this.auth.reenviarActivacion(s);
  }

  @Publico() @Post('contrasena/olvide') @HttpCode(204)
  async olvide(@Body() dto: OlvideDto) {
    await this.auth.olvide(dto.email);
  }

  @Publico() @Post('contrasena/enlace') @HttpCode(200)
  enlace(@Body() dto: TokenDto) {
    return this.auth.enlace(dto.token);
  }

  @Publico() @Post('contrasena/restablecer') @HttpCode(200)
  restablecer(@Body() dto: RestablecerDto) {
    return this.auth.restablecer(dto);
  }

  @SinSuscripcion() @Post('contrasena') @HttpCode(200)
  cambiarContrasena(@Ses() s: Sesion, @Body() dto: CambiarContrasenaDto) {
    return this.auth.cambiarContrasena(s, dto);
  }
}
