import Anthropic from '@anthropic-ai/sdk';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CatalogoService } from '../catalogo/catalogo.service';
import { sinCostos } from '../common/costos.interceptor';
import { GERENCIA, Sesion, VEN_COSTOS } from '../common/sesion';
import { hoy, LIMITES_PRUEBA, limites, sumarDias } from '../common/suscripcion';
import { r2 } from '../common/util';
import { DocumentosService } from '../documentos/documentos.service';
import { AsistenteUso, Cotizacion, EstadoSuscripcion, Rol, Sucursal, Taller, Venta } from '../entities';
import { GUIA } from './guia';

type Herramienta = Anthropic.Beta.BetaTool & { roles: Rol[] };
interface Mensaje { rol: 'usuario' | 'asistente'; texto: string }

const VENTA = [...VEN_COSTOS, Rol.Vendedor];
const TODOS = [...VENTA, Rol.Produccion];
const NOMBRE_ROL: Record<Rol, string> = {
  [Rol.Dueno]: 'Dueño',
  [Rol.Admin]: 'Administrador',
  [Rol.Encargado]: 'Encargado de sucursal',
  [Rol.Vendedor]: 'Vendedor (no ve costos ni ganancias)',
  [Rol.Produccion]: 'Producción (no ve costos ni ganancias)',
};
const MAX_VUELTAS = 6;

/** Herramientas de solo lectura. Cada una respeta el rol y la sucursal de quien pregunta. */
const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'resumen_ventas',
    description:
      'Ventas, pedidos, ticket promedio, ganancia, margen, cobrado, por cobrar, compras, cotizaciones aceptadas, productos que más dejan, pedidos pendientes de entrega, stock bajo y la serie de los últimos 12 meses, para la sucursal actual. Úsala para preguntas sobre cómo va el negocio.',
    input_schema: {
      type: 'object',
      properties: { periodo: { type: 'string', enum: ['hoy', 'semana', 'mes', 'mes_pasado', 'anio'], description: 'semana = últimos 7 días; anio = año en curso' } },
      required: ['periodo'],
      additionalProperties: false,
    },
    strict: true,
    roles: VEN_COSTOS,
  },
  {
    name: 'buscar_productos',
    description: 'Productos, insumos y servicios del catálogo con precio y existencias en la sucursal actual. Con solo_stock_bajo=true devuelve lo que está en el mínimo o debajo.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Parte del nombre o categoría; vacío para todos' },
        solo_stock_bajo: { type: 'boolean' },
      },
      required: ['texto', 'solo_stock_bajo'],
      additionalProperties: false,
    },
    strict: true,
    roles: TODOS,
  },
  {
    name: 'buscar_pedidos',
    description: 'Ventas (pedidos) de la sucursal actual con estado, fecha de entrega, total, pagado y saldo. "abiertos" = pendiente, en producción o listo para entregar.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Folio o nombre del cliente; vacío para todos' },
        estado: { type: 'string', enum: ['todos', 'abiertos', 'pendiente', 'produccion', 'lista', 'entregada', 'cancelada'] },
        solo_con_saldo: { type: 'boolean', description: 'true = solo los que deben dinero' },
      },
      required: ['texto', 'estado', 'solo_con_saldo'],
      additionalProperties: false,
    },
    strict: true,
    roles: TODOS,
  },
  {
    name: 'buscar_cotizaciones',
    description: 'Cotizaciones de la sucursal actual con estado, cliente, total y vigencia.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Folio o nombre del cliente; vacío para todas' },
        estado: { type: 'string', enum: ['todas', 'borrador', 'enviada', 'aceptada', 'rechazada'] },
      },
      required: ['texto', 'estado'],
      additionalProperties: false,
    },
    strict: true,
    roles: VENTA,
  },
  {
    name: 'buscar_clientes',
    description: 'Clientes del taller con teléfono, correo, número de pedidos y total comprado.',
    input_schema: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'Parte del nombre, empresa o teléfono; vacío para los que más compran' } },
      required: ['texto'],
      additionalProperties: false,
    },
    strict: true,
    roles: VENTA,
  },
];

/**
 * Asistente con IA dentro del sistema (Claude). Responde dudas de uso con la guía de Grabix
 * y consulta datos del taller con herramientas de solo lectura, limitadas a la sucursal y al rol del usuario.
 */
@Injectable()
export class AsistenteService {
  private log = new Logger('Asistente');
  private modelo = process.env.ASISTENTE_MODELO || 'claude-opus-5-5';
  private cliente = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

  constructor(
    @InjectDataSource() private ds: DataSource,
    private catalogo: CatalogoService,
    private docs: DocumentosService,
  ) {}

  get disponible() {
    return !!this.cliente;
  }

  async estado(s: Sesion) {
    const { limite, usadas } = await this.cupo(s);
    return { disponible: this.disponible, limite, usadas };
  }

  async preguntar(s: Sesion, mensajes: Mensaje[]) {
    if (!this.cliente) throw new HttpException('El asistente aún no está configurado en este servidor.', HttpStatus.SERVICE_UNAVAILABLE);
    const { limite, usadas, taller } = await this.cupo(s);
    if (usadas >= limite)
      throw new HttpException(`Tu taller ya usó las ${limite} preguntas de hoy. Mañana se renueva el cupo, o puedes subir de plan en Ajustes.`, HttpStatus.TOO_MANY_REQUESTS);

    const herramientas = HERRAMIENTAS.filter((h) => h.roles.includes(s.rol)).map(({ roles: _, ...h }) => h);
    const historial: Anthropic.Beta.BetaMessageParam[] = mensajes
      .slice(-20)
      .map((m) => ({ role: m.rol === 'usuario' ? ('user' as const) : ('assistant' as const), content: m.texto }));
    while (historial.length && historial[0].role !== 'user') historial.shift();

    const contexto = await this.contexto(s, taller);
    let entrada = 0, salida = 0, texto = '';
    try {
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const r = await this.cliente.beta.messages.create({
          model: this.modelo,
          max_tokens: 8000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low' },
          system: [
            { type: 'text', text: GUIA, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: contexto },
          ],
          tools: herramientas,
          messages: historial,
        });
        entrada += r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0);
        salida += r.usage.output_tokens;

        if (r.stop_reason === 'refusal') {
          texto = 'No puedo ayudarte con eso. Pregúntame sobre tu taller o sobre cómo usar Grabix.';
          break;
        }
        historial.push({ role: 'assistant', content: r.content });
        texto = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (r.stop_reason === 'pause_turn') continue;
        if (r.stop_reason !== 'tool_use') break;

        const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const b of r.content) {
          if (b.type !== 'tool_use') continue;
          try {
            const datos = await this.ejecutar(s, b.name, b.input as Record<string, unknown>);
            resultados.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(datos) });
          } catch (e) {
            resultados.push({ type: 'tool_result', tool_use_id: b.id, content: (e as Error).message, is_error: true });
          }
        }
        historial.push({ role: 'user', content: resultados });
      }
    } catch (e) {
      throw this.error(e);
    } finally {
      if (entrada || salida) await this.registrar(s.tallerId, entrada, salida);
    }
    return { texto: texto || 'No encontré una respuesta. ¿Puedes decirlo de otra forma?', restantes: Math.max(0, limite - usadas - 1) };
  }

  /* ----------------------------------------------------------------------- */

  private async ejecutar(s: Sesion, nombre: string, x: Record<string, unknown>) {
    const h = HERRAMIENTAS.find((t) => t.name === nombre);
    if (!h || !h.roles.includes(s.rol)) throw new Error('No tienes permiso para consultar esto.');
    const texto = String(x.texto ?? '').trim().toLowerCase();
    const coincide = (...vals: (string | null | undefined)[]) => !texto || vals.some((v) => (v ?? '').toLowerCase().includes(texto));
    let datos: unknown;

    switch (nombre) {
      case 'resumen_ventas': {
        const [desde, hasta] = rango(String(x.periodo));
        const e = await this.docs.estadisticas(s, desde, hasta);
        datos = { ...e, top: e.top.slice(0, 5), serie: e.serie.filter((m) => m.pedidos) };
        break;
      }
      case 'buscar_productos': {
        const ps = await this.catalogo.productos(s);
        datos = ps
          .filter((p) => p.activo && coincide(p.nombre, p.categoria))
          .filter((p) => !x.solo_stock_bajo || (p.controlaStock && p.minimo > 0 && p.existencia <= p.minimo))
          .slice(0, 30)
          .map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, categoria: p.categoria, unidad: p.unidad, precio: p.precio, costoUnitario: p.costoUnitario, margen: p.margen, existencia: p.controlaStock ? p.existencia : 'no aplica (servicio o producto con receta)', minimo: p.minimo }));
        break;
      }
      case 'buscar_pedidos': {
        const est = String(x.estado);
        const estado = est === 'todos' ? undefined : est === 'abiertos' ? 'pendiente,produccion,lista' : est;
        const vs = (await this.docs.ventas(s, { estado })) as (Venta & { saldo: number })[];
        datos = vs
          .filter((v) => coincide(v.folio, v.cliente?.nombre, v.clienteNombre))
          .filter((v) => !x.solo_con_saldo || v.saldo > 0)
          .slice(0, 20)
          .map((v) => ({
            folio: v.folio, enlace: `/app/ventas/${v.id}`, fecha: v.fecha, entrega: v.entrega, estado: v.estado,
            cliente: v.cliente?.nombre || v.clienteNombre || 'Mostrador', total: v.total, pagado: v.pagado, saldo: v.saldo,
            piezas: v.items.map((i) => `${r2(i.cantidad)} × ${i.descripcion}`),
          }));
        break;
      }
      case 'buscar_cotizaciones': {
        const est = String(x.estado);
        const cs = (await this.docs.cotizaciones(s, { estado: est === 'todas' ? undefined : est })) as Cotizacion[];
        datos = cs
          .filter((c) => coincide(c.folio, c.cliente?.nombre, c.clienteNombre))
          .slice(0, 20)
          .map((c) => ({
            folio: c.folio, enlace: `/app/cotizaciones/${c.id}`, fecha: c.fecha, vence: sumarDias(c.fecha, c.vigenciaDias), estado: c.estado,
            cliente: c.cliente?.nombre || c.clienteNombre || 'Sin cliente', total: c.total,
          }));
        break;
      }
      case 'buscar_clientes': {
        const cs = await this.catalogo.clientes(s);
        datos = cs
          .filter((c) => coincide(c.nombre, c.empresa, c.telefono, c.email))
          .sort((a, b) => b.comprado - a.comprado)
          .slice(0, 20)
          .map((c) => ({ nombre: c.nombre, empresa: c.empresa, telefono: c.telefono, email: c.email, pedidos: c.pedidos, comprado: c.comprado }));
        break;
      }
    }
    // Vendedores y producción nunca reciben costos ni ganancias, igual que en las pantallas.
    return VEN_COSTOS.includes(s.rol) ? datos : sinCostos(datos);
  }

  private async contexto(s: Sesion, t: Taller) {
    const suc = s.sucursal ? await this.ds.manager.findOneBy(Sucursal, { id: s.sucursal, tallerId: s.tallerId }) : null;
    return [
      '# Quién pregunta',
      `- Taller: ${t.nombre}`,
      `- Usuario: ${s.nombre}`,
      `- Rol: ${NOMBRE_ROL[s.rol]}`,
      `- Sucursal actual: ${suc ? suc.nombre : 'todas las sucursales (vista consolidada)'}`,
      `- Moneda: ${t.moneda}`,
      `- Fecha de hoy: ${hoy()}`,
      `- Puede ver costos y ganancias: ${VEN_COSTOS.includes(s.rol) ? 'sí' : 'no'}`,
      `- Administra sucursales, usuarios y plan: ${GERENCIA.includes(s.rol) ? 'sí' : 'no'}`,
    ].join('\n');
  }

  private async cupo(s: Sesion) {
    const taller = await this.ds.manager.findOneByOrFail(Taller, { id: s.tallerId });
    const limite = Number(process.env.ASISTENTE_LIMITE_DIARIO) || (taller.estadoSuscripcion === EstadoSuscripcion.Activa ? limites(taller).asistente : LIMITES_PRUEBA.asistente);
    const uso = await this.ds.manager.findOneBy(AsistenteUso, { tallerId: s.tallerId, fecha: hoy() });
    return { taller, limite, usadas: uso?.preguntas ?? 0 };
  }

  private async registrar(tallerId: number, entrada: number, salida: number) {
    await this.ds.manager
      .query(
        `INSERT INTO asistente_uso (tallerId, fecha, preguntas, tokensEntrada, tokensSalida) VALUES (?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE preguntas = preguntas + 1, tokensEntrada = tokensEntrada + VALUES(tokensEntrada), tokensSalida = tokensSalida + VALUES(tokensSalida)`,
        [tallerId, hoy(), entrada, salida],
      )
      .catch((e) => this.log.error(`No se pudo registrar el uso: ${(e as Error).message}`));
  }

  private error(e: unknown) {
    if (e instanceof HttpException) return e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      this.log.error(`Credenciales del asistente inválidas: ${e.message}`);
      return new HttpException('El asistente no está disponible por ahora.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError)
      return new HttpException('El asistente está muy ocupado. Intenta de nuevo en un momento.', HttpStatus.SERVICE_UNAVAILABLE);
    if (e instanceof Anthropic.APIError) {
      this.log.error(`Error ${e.status} del asistente: ${e.message}`);
      return new HttpException('El asistente tuvo un problema. Intenta de nuevo.', HttpStatus.BAD_GATEWAY);
    }
    if (e instanceof Anthropic.APIConnectionError) return new HttpException('No pudimos conectar con el asistente. Intenta de nuevo.', HttpStatus.SERVICE_UNAVAILABLE);
    this.log.error(e);
    return new HttpException('El asistente tuvo un problema. Intenta de nuevo.', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/** Fechas [desde, hasta] para cada periodo. */
function rango(p: string): [string, string] {
  const h = hoy();
  const [a, m] = h.split('-');
  switch (p) {
    case 'hoy': return [h, h];
    case 'semana': return [sumarDias(h, -6), h];
    case 'mes_pasado': {
      const ini = new Date(Date.UTC(+a, +m - 2, 1)).toISOString().slice(0, 10);
      const fin = new Date(Date.UTC(+a, +m - 1, 0)).toISOString().slice(0, 10);
      return [ini, fin];
    }
    case 'anio': return [`${a}-01-01`, h];
    default: return [`${a}-${m}-01`, h];
  }
}
