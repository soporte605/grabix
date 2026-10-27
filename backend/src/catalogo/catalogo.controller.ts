import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { Rol } from '../entities';
import { Roles, Ses, type Sesion, VEN_COSTOS } from '../common/sesion';
import { AjusteDto, ClienteDto, ProductoDto, PromocionDto, TraspasoDto } from './catalogo.dto';
import { CatalogoService } from './catalogo.service';

const VENTA = [...VEN_COSTOS, Rol.Vendedor];

@Controller()
export class CatalogoController {
  constructor(private cat: CatalogoService) {}

  @Get('productos')
  productos(@Ses() s: Sesion) {
    return this.cat.productos(s);
  }

  @Post('productos') @Roles(...VEN_COSTOS)
  crearProducto(@Ses() s: Sesion, @Body() dto: ProductoDto) {
    return this.cat.guardarProducto(s, dto);
  }

  @Put('productos/:id') @Roles(...VEN_COSTOS)
  editarProducto(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: ProductoDto) {
    return this.cat.guardarProducto(s, dto, id);
  }

  @Delete('productos/:id') @Roles(...VEN_COSTOS)
  eliminarProducto(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.cat.eliminarProducto(s, id);
  }

  @Patch('productos/:id/existencia') @Roles(...VEN_COSTOS)
  ajustar(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: AjusteDto) {
    return this.cat.ajustar(s, id, dto);
  }

  @Get('productos/:id/movimientos') @Roles(...VEN_COSTOS)
  movimientos(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.cat.movimientos(s, id);
  }

  @Post('inventario/traspasos') @Roles(...VEN_COSTOS)
  traspasar(@Ses() s: Sesion, @Body() dto: TraspasoDto) {
    return this.cat.traspasar(s, dto);
  }

  @Get('clientes') @Roles(...VENTA)
  clientes(@Ses() s: Sesion) {
    return this.cat.clientes(s);
  }

  @Post('clientes') @Roles(...VENTA)
  crearCliente(@Ses() s: Sesion, @Body() dto: ClienteDto) {
    return this.cat.guardarCliente(s, dto);
  }

  @Put('clientes/:id') @Roles(...VENTA)
  editarCliente(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: ClienteDto) {
    return this.cat.guardarCliente(s, dto, id);
  }

  @Delete('clientes/:id') @Roles(...VEN_COSTOS)
  eliminarCliente(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.cat.eliminarCliente(s, id);
  }

  @Get('promociones') @Roles(...VENTA)
  promociones(@Ses() s: Sesion) {
    return this.cat.promociones(s);
  }

  @Post('promociones') @Roles(...VEN_COSTOS)
  crearPromocion(@Ses() s: Sesion, @Body() dto: PromocionDto) {
    return this.cat.guardarPromocion(s, dto);
  }

  @Put('promociones/:id') @Roles(...VEN_COSTOS)
  editarPromocion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: PromocionDto) {
    return this.cat.guardarPromocion(s, dto, id);
  }

  @Delete('promociones/:id') @Roles(...VEN_COSTOS)
  eliminarPromocion(@Ses() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.cat.eliminarPromocion(s, id);
  }
}
