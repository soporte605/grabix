import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Folio } from '../entities';

@Injectable()
export class FoliosService {
  /** Siguiente folio consecutivo (COT-0001, VTA-0001…), seguro ante ventas simultáneas. */
  async siguiente(em: EntityManager, tallerId: number, prefijo: 'COT' | 'VTA' | 'CMP') {
    await em.createQueryBuilder().insert().into(Folio).values({ tallerId, tipo: prefijo, ultimo: 0 }).orIgnore().updateEntity(false).execute();
    const f = await em.findOneOrFail(Folio, { where: { tallerId, tipo: prefijo }, lock: { mode: 'pessimistic_write' } });
    f.ultimo += 1;
    await em.save(f);
    return `${prefijo}-${String(f.ultimo).padStart(4, '0')}`;
  }
}
