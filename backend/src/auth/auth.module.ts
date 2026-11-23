import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispositivoRecordado, Sucursal, Taller, Usuario } from '../entities';
import { OrganizacionModule } from '../organizacion/organizacion.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RecordarService } from './recordar.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Taller, Sucursal, DispositivoRecordado]), OrganizacionModule],
  controllers: [AuthController],
  providers: [AuthService, RecordarService],
})
export class AuthModule {}
