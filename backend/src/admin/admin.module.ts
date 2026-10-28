import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminBitacora, Bitacora, CorreoLog, InicioSesion, Sucursal, SuperAdmin, Taller, Usuario } from '../entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([SuperAdmin, AdminBitacora, Bitacora, InicioSesion, Taller, Usuario, Sucursal, CorreoLog])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
