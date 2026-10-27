import { Global, Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { CostosService } from './costos.service';

@Global()
@Module({
  controllers: [CatalogoController],
  providers: [CatalogoService, CostosService],
  exports: [CostosService, CatalogoService],
})
export class CatalogoModule {}
