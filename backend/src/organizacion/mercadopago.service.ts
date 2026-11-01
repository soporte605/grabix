import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThan } from 'typeorm';
import { Sesion } from '../common/sesion';
import { hoy, PLANES, sumarDias } from '../common/suscripcion';
import { EstadoSuscripcion, PagoSuscripcion, Taller } from '../entities';

const API = 'https://api.mercadopago.com';
const REF = 'grabix-';

interface PagoMP { id: number; status: string; external_reference?: string; transaction_amount: number; currency_id: string }

/**
 * Cobro de la suscripción con Mercado Pago Checkout Pro (tarjeta, OXXO, SPEI).
 * 1. `crear` registra un pago pendiente y una preferencia; el dueño paga en Mercado Pago.
 * 2. Mercado Pago avisa al webhook (o el dueño regresa a Ajustes y se llama `confirmar`).
 * 3. En ambos casos se consulta el pago en la API de Mercado Pago (no se confía en lo que llega) y,
 *    si está aprobado y el monto coincide, se extiende el plan una sola vez.
 */
@Injectable()
export class MercadoPagoService {
  private log = new Logger('MercadoPago');

  constructor(@InjectDataSource() private ds: DataSource) {}

  get activo() {
    return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
  }

  private async api<T>(ruta: string, init?: RequestInit): Promise<T> {
    const r = await fetch(API + ruta, {
      ...init,
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!r.ok) {
      this.log.error(`${init?.method ?? 'GET'} ${ruta} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
      throw new ServiceUnavailableException('Mercado Pago no respondió. Intenta de nuevo en unos minutos.');
    }
    return r.json() as Promise<T>;
  }

  private base() {
    return (process.env.PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, '');
  }

  async crear(s: Sesion, plan: string, periodo: string) {
    if (!this.activo) throw new BadRequestException('Los pagos en línea aún no están habilitados');
    const p = PLANES.find((x) => x.id === plan);
    if (!p) throw new BadRequestException('Plan no válido');
    const monto = periodo === 'anual' ? p.precioAnual : p.precioMensual;
    // Doble clic o reintento: reutiliza la misma liga si se pidió hace menos de 30 minutos.
    const previo = await this.ds.manager.findOne(PagoSuscripcion, {
      where: { tallerId: s.tallerId, plan, periodo, estado: 'pendiente', creadoEn: MoreThan(new Date(Date.now() - 30 * 60_000)) },
      order: { id: 'DESC' },
    });
    if (previo?.url) return { url: previo.url, pagoId: previo.id };
    const pago = await this.ds.manager.save(
      this.ds.manager.create(PagoSuscripcion, { tallerId: s.tallerId, plan, periodo, monto, usuarioId: s.usuarioId }),
    );
    const vuelta = `${this.base()}/app/ajustes?pago=${pago.id}`;
    const pref = await this.api<{ id: string; init_point: string }>('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `${REF}${pago.id}` },
      body: JSON.stringify({
        items: [{ id: `${plan}-${periodo}`, title: `Grabix plan ${p.nombre} (${periodo})`, quantity: 1, unit_price: monto, currency_id: 'MXN' }],
        external_reference: `${REF}${pago.id}`,
        back_urls: { success: vuelta, pending: vuelta, failure: vuelta },
        auto_return: 'approved',
        notification_url: `${this.base()}/api/pagos/mercadopago`,
        statement_descriptor: 'GRABIX',
      }),
    });
    await this.ds.manager.update(PagoSuscripcion, { id: pago.id }, { preferenciaId: pref.id, url: pref.init_point });
    return { url: pref.init_point, pagoId: pago.id };
  }

  /** Aviso de Mercado Pago. Solo trae el id; el pago se consulta en la API. */
  async webhook(tipo: string | undefined, id: string | undefined) {
    if (!this.activo || !id || !/^\d{1,30}$/.test(id) || (tipo && tipo !== 'payment')) return { ok: true };
    await this.aplicar(id).catch((e) => this.log.error(`Webhook ${id}: ${(e as Error).message}`));
    return { ok: true };
  }

  /** El dueño regresó de Mercado Pago: confirma su pago sin esperar al webhook. */
  async confirmar(s: Sesion, pagoId: number, mpPagoId?: string) {
    const pago = await this.ds.manager.findOneBy(PagoSuscripcion, { id: pagoId, tallerId: s.tallerId });
    if (!pago) throw new BadRequestException('Pago no encontrado');
    if (pago.estado === 'pendiente' && mpPagoId && /^\d{1,30}$/.test(mpPagoId)) await this.aplicar(mpPagoId, s.tallerId);
    const p = await this.ds.manager.findOneByOrFail(PagoSuscripcion, { id: pagoId });
    return { estado: p.estado, pagadoHasta: p.pagadoHasta };
  }

  private async aplicar(mpPagoId: string, tallerId?: number) {
    const mp = await this.api<PagoMP>(`/v1/payments/${mpPagoId}`);
    const ref = mp.external_reference ?? '';
    if (!ref.startsWith(REF)) return;
    const id = Number(ref.slice(REF.length));
    await this.ds.transaction(async (em) => {
      const pago = await em.findOne(PagoSuscripcion, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!pago || (tallerId && pago.tallerId !== tallerId) || pago.estado === 'aprobado') return;
      if (mp.status === 'rejected' || mp.status === 'cancelled') {
        await em.update(PagoSuscripcion, { id }, { estado: 'rechazado', mpPagoId: String(mp.id) });
        return;
      }
      if (mp.status !== 'approved') return;
      if (mp.currency_id !== 'MXN' || Math.abs(mp.transaction_amount - Number(pago.monto)) > 0.01) {
        this.log.error(`Pago ${mp.id}: monto ${mp.transaction_amount} ${mp.currency_id} no coincide con ${pago.monto} MXN`);
        return;
      }
      const t = await em.findOneOrFail(Taller, { where: { id: pago.tallerId }, lock: { mode: 'pessimistic_write' } });
      const h = hoy();
      // No pierde lo que ya tenía: días pagados o días de prueba que le quedaban.
      const vigente = t.estadoSuscripcion === EstadoSuscripcion.Activa ? t.pagadoHasta : t.estadoSuscripcion === EstadoSuscripcion.Prueba ? t.pruebaHasta : null;
      const base = vigente && vigente > h ? vigente : h;
      const hasta = sumarDias(base, pago.periodo === 'anual' ? 365 : 30);
      await em.update(Taller, { id: t.id }, { plan: pago.plan, estadoSuscripcion: EstadoSuscripcion.Activa, pagadoHasta: hasta });
      await em.update(PagoSuscripcion, { id }, { estado: 'aprobado', mpPagoId: String(mp.id), pagadoHasta: hasta });
      this.log.log(`Taller ${t.id}: plan ${pago.plan} ${pago.periodo} pagado hasta ${hasta} (pago ${mp.id})`);
    });
  }
}
