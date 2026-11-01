import { Global, Injectable, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InicioSesion } from '../entities';

export function ipDe(req: { ip?: string; socket?: { remoteAddress?: string } }) {
  return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64);
}

/** Anota un intento de entrar. Un fallo al guardar no debe impedir el login. */
@Injectable()
export class AccesosService {
  constructor(@InjectRepository(InicioSesion) private repo: Repository<InicioSesion>) {}

  anotar(d: Partial<InicioSesion>) {
    return this.repo.save(this.repo.create(d)).catch(() => undefined);
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([InicioSesion])],
  providers: [AccesosService],
  exports: [AccesosService],
})
export class AccesosModule {}
