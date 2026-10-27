import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal, Taller, Usuario } from '../entities';
import { OrganizacionModule } from '../organizacion/organizacion.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Taller, Sucursal]), OrganizacionModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
