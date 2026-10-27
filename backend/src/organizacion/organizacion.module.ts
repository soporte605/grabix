import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bitacora, Sucursal, Taller, Usuario } from '../entities';
import { EjemplosService } from './ejemplos.service';
import { OrganizacionController } from './organizacion.controller';
import { OrganizacionService } from './organizacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Taller, Sucursal, Usuario, Bitacora])],
  controllers: [OrganizacionController],
  providers: [OrganizacionService, EjemplosService],
  exports: [EjemplosService],
})
export class OrganizacionModule {}
