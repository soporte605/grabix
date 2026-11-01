import { Global, Injectable, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Bitacora } from '../entities';
import { Sesion } from './sesion';

@Injectable()
export class BitacoraService {
  constructor(@InjectRepository(Bitacora) private repo: Repository<Bitacora>) {}

  registrar(s: Sesion, accion: string, entidad: string, entidadId: number | null, detalle?: unknown, em?: EntityManager) {
    const soporteId = s.soporteId;
    const base = detalle !== null && typeof detalle === 'object' && !Array.isArray(detalle) ? (detalle as Record<string, unknown>) : {};
    const repo = em ? em.getRepository(Bitacora) : this.repo;
    const r = repo.create({
      tallerId: s.tallerId,
      usuarioId: soporteId != null ? null : s.usuarioId,
      usuarioNombre: soporteId != null ? 'Soporte Grabix' : s.nombre,
      accion,
      entidad,
      entidadId,
      detalle: soporteId != null ? { ...base, soporteId } : (detalle ?? null),
    });
    return repo.save(r);
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Bitacora])],
  providers: [BitacoraService],
  exports: [BitacoraService],
})
export class BitacoraModule {}
