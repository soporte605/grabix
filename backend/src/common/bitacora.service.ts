import { Global, Injectable, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Bitacora } from '../entities';
import { Sesion } from './sesion';

@Injectable()
export class BitacoraService {
  constructor(@InjectRepository(Bitacora) private repo: Repository<Bitacora>) {}

  registrar(s: Sesion, accion: string, entidad: string, entidadId: number | null, detalle?: unknown, em?: EntityManager) {
    const r = (em ? em.getRepository(Bitacora) : this.repo).create({
      tallerId: s.tallerId,
      usuarioId: s.usuarioId,
      usuarioNombre: s.nombre,
      accion,
      entidad,
      entidadId,
      detalle: detalle ?? null,
    });
    return (em ? em.getRepository(Bitacora) : this.repo).save(r);
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Bitacora])],
  providers: [BitacoraService],
  exports: [BitacoraService],
})
export class BitacoraModule {}
