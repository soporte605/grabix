import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ipDe } from '../admin/accesos.service';
import { Publico, Ses, SinSuscripcion, type Sesion } from '../common/sesion';
import { CambiarContrasenaDto, LoginDto, OlvideDto, RegistroDto, RestablecerDto, TokenDto } from './auth.dto';
import { AuthService } from './auth.service';
import { RecordarService } from './recordar.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private recordar: RecordarService,
  ) {}

  @Publico() @Post('registro')
  registro(@Body() dto: RegistroDto) {
    return this.auth.registro(dto);
  }

  @Publico() @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let email = dto.email;
    if (!email) {
      // Pantalla "Hola, Jose": el correo sale de la cookie, nunca del navegador.
      const r = await this.recordar.buscar(req);
      if (!r) {
        await this.recordar.olvidar(req, res);
        throw new UnauthorizedException('Escribe tu correo para entrar.');
      }
      email = r.usuario.email;
    }
    const sesion = await this.auth.login({ email, password: dto.password }, ipDe(req));
    if (dto.recordar) await this.recordar.recordar(sesion.usuario.id, req, res);
    else await this.recordar.olvidar(req, res);
    return sesion;
  }

  /** Usuario recordado en este navegador: solo primer nombre y correo con asteriscos. */
  @Publico() @Get('recordado')
  recordado(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.recordar.saludo(req, res);
  }

  /** "No soy yo / usar otra cuenta". */
  @Publico() @Post('recordado/olvidar') @HttpCode(204)
  async olvidarRecordado(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.recordar.olvidar(req, res);
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
