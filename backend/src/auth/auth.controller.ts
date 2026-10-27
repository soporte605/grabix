import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Publico, Ses, type Sesion } from '../common/sesion';
import { LoginDto, RegistroDto } from './auth.dto';
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
}
