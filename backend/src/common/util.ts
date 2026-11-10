import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Sesion } from './sesion';

export const r2 = (n: number) => Math.round(n * 100) / 100;
/** Lo que el cliente se ahorra por precios especiales en los renglones (precio normal − precio dado). */
export const ahorroPrecio = (items: { cantidad: number; precio: number; precioLista?: number | null }[]) =>
  r2(items.reduce((a, i) => a + (Number(i.precioLista) > Number(i.precio) ? Number(i.cantidad) * (Number(i.precioLista) - Number(i.precio)) : 0), 0));
export const token = () => randomBytes(18).toString('base64url');

export function existe<T>(x: T | null | undefined, que = 'Registro'): T {
  if (!x) throw new NotFoundException(`${que} no encontrado`);
  return x;
}

/** Las ventas, compras y movimientos siempre ocurren en una sucursal concreta. */
export function sucursalDe(s: Sesion): number {
  if (!s.sucursal) throw new BadRequestException('Elige una sucursal para registrar esta operación');
  return s.sucursal;
}
