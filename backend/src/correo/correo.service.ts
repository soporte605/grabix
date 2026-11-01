import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { CorreoLog, TokenCuenta } from '../entities';
import { DIAS_PRUEBA_PUBLICO, PLANES } from '../common/suscripcion';
import { TokensService } from './tokens.service';

/** Colores de marca de los correos (Elikar Systems). */
export const MARCA = {
  primario: '#002150',
  acento: '#67BE28',
  acentoTexto: '#3F7A16',
  tinta: '#132230',
  texto: '#3B4A5C',
  tenue: '#6B7A8C',
  borde: '#E2E7EE',
  lienzo: '#F3F5F8',
};

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Proveedor = 'resend' | 'smtp' | 'log';
interface Correo { para: string; asunto: string; html: string; texto: string; tipo: string }

/**
 * Envío de correos, igual que FincaPro y SiloPro:
 *   1. Resend por HTTP si hay RESEND_API_KEY (recomendado en producción).
 *   2. SMTP si hay SMTP_HOST (Gmail, Brevo, Amazon SES, o Mailpit en desarrollo).
 *   3. Sin ninguno, el correo se escribe en el log para no bloquear el desarrollo.
 * Cada intento queda en la tabla correos_log.
 */
@Injectable()
export class CorreoService {
  private log = new Logger('Correo');
  private remitente = process.env.MAIL_FROM ?? process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? 'Grabix <no-responder@grabix.local>';
  private smtp = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  constructor(@InjectRepository(CorreoLog) private logs: Repository<CorreoLog>) {}

  get proveedor(): Proveedor {
    return process.env.RESEND_API_KEY ? 'resend' : this.smtp ? 'smtp' : 'log';
  }

  url(ruta: string) {
    return `${(process.env.PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, '')}${ruta}`;
  }

  /** Envía sin lanzar excepciones: un correo caído no debe tumbar el registro ni el flujo del usuario. */
  async enviar(c: Correo) {
    const proveedor = this.proveedor;
    let estado = 'enviado';
    let error: string | null = null;
    try {
      if (proveedor === 'resend') await this.porResend(c);
      else if (proveedor === 'smtp') await this.smtp!.sendMail({ from: this.remitente, to: c.para, subject: c.asunto, html: c.html, text: c.texto });
      else {
        estado = 'simulado';
        this.log.log(`(sin proveedor) Para: ${c.para} | ${c.asunto}\n${c.texto}`);
      }
    } catch (e) {
      estado = 'fallido';
      error = (e as Error).message.slice(0, 1000);
      this.log.error(`No se pudo enviar "${c.asunto}" a ${c.para}: ${error}`);
    }
    await this.logs.save(this.logs.create({ para: c.para, asunto: c.asunto.slice(0, 200), tipo: c.tipo, estado, proveedor, error })).catch(() => undefined);
    return estado !== 'fallido';
  }

  private async porResend(c: Correo) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.remitente, to: [c.para], subject: c.asunto, html: c.html, text: c.texto }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }

  // ---------------------------------------------------------------------------
  // Plantilla con marca (tablas e estilos en línea para que se vea bien en Gmail y Outlook)
  // ---------------------------------------------------------------------------

  plantilla(o: { previa: string; etiqueta?: string; titulo: string; parrafos: string[]; boton?: { texto: string; url: string }; nota?: string }) {
    const f = "'Plus Jakarta Sans',Segoe UI,Arial,Helvetica,sans-serif";
    const ps = o.parrafos.map((p) => `<p style="margin:0 0 16px;font-family:${f};font-size:16px;line-height:1.6;color:${MARCA.texto}">${esc(p)}</p>`).join('');
    const btn = o.boton
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 22px"><tr><td style="border-radius:10px;background:${MARCA.acento}">
           <a href="${esc(o.boton.url)}" style="display:inline-block;padding:15px 28px;font-family:${f};font-size:16px;font-weight:800;color:${MARCA.primario};text-decoration:none;border-radius:10px">${esc(o.boton.texto)} &rarr;</a>
         </td></tr></table>
         <p style="margin:0 0 4px;font-family:${f};font-size:12px;line-height:1.55;color:${MARCA.tenue}">Si el botón no abre, copia esta liga en tu navegador:<br>
           <a href="${esc(o.boton.url)}" style="color:${MARCA.acentoTexto};word-break:break-all">${esc(o.boton.url)}</a></p>`
      : '';
    const nota = o.nota
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr>
           <td style="width:4px;background:${MARCA.acento};border-radius:4px 0 0 4px;font-size:0">&nbsp;</td>
           <td style="padding:13px 16px;background:${MARCA.lienzo};border-radius:0 8px 8px 0;font-family:${f};font-size:13px;line-height:1.55;color:${MARCA.texto}">${esc(o.nota)}</td>
         </tr></table>`
      : '';
    const landing = (process.env.LANDING_URL ?? this.url('').replace('://app.', '://')).replace(/\/$/, '');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet"><title>${esc(o.titulo)}</title></head>
<body style="margin:0;padding:0;background:${MARCA.lienzo};font-family:${f}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MARCA.lienzo}"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${MARCA.borde}">
    <tr><td style="background:${MARCA.primario};padding:22px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${f};font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-.02em">
          <!-- Logo real en PNG (Gmail no muestra SVG). Si el correo oculta imágenes, el texto alternativo sale con la marca. -->
          <img src="${this.url('/logo-correo.png')}" width="166" height="44" alt="Grabix" style="display:block;width:166px;height:44px;border:0;font-family:${f};font-size:26px;font-weight:800;color:#ffffff"></td>
        <td align="right" style="font-family:${f};font-size:11px;font-weight:800;letter-spacing:.22em;color:#ffffff">ELIKAR <span style="color:${MARCA.acento}">SYSTEMS</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;background:${MARCA.acento};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:34px 32px 34px">
      <h1 style="margin:0 0 18px;font-family:${f};font-size:24px;line-height:1.3;font-weight:800;letter-spacing:-.01em;color:${MARCA.tinta}">${esc(o.titulo)}</h1>
      ${ps}${btn}${nota}
    </td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid ${MARCA.borde};font-family:${f};font-size:12px;line-height:1.6;color:${MARCA.tenue}">
      <b style="color:${MARCA.primario}">Grabix</b> · cotizaciones, producción, caja e inventario para tu taller.<br>
      ¿Dudas? Escríbenos a <a href="mailto:soporte@elikarsystems.com" style="color:${MARCA.acentoTexto}">soporte@elikarsystems.com</a> · <a href="${esc(landing)}" style="color:${MARCA.acentoTexto}">${esc(landing.replace(/^https?:\/\//, ''))}</a>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-family:${f};font-size:11px;color:${MARCA.tenue}">Un producto de Elikar Systems · Hecho en México</p>
</td></tr></table></body></html>`;
  }

  // ---------------------------------------------------------------------------
  // Correos de la cuenta
  // ---------------------------------------------------------------------------

  /** Bienvenida + confirmación de correo (al registrarse o al pedir reenvío). */
  activacion(para: string, nombre: string, taller: string, url: string) {
    return this.enviar({
      para,
      tipo: 'activacion',
      asunto: 'Confirma tu correo para activar Grabix',
      html: this.plantilla({
        previa: `Confirma tu correo para empezar con ${taller} en Grabix.`,
        etiqueta: 'Bienvenido a Grabix',
        titulo: `Hola ${nombre}, confirma tu correo`,
        parrafos: [
          `Gracias por registrar ${taller}. Ya puedes usar tu prueba gratuita de ${DIAS_PRUEBA_PUBLICO} días con todas las funciones.`,
          'Confirma tu correo para poder invitar a tu equipo, elegir un plan y recuperar tu contraseña si la olvidas.',
        ],
        boton: { texto: 'Confirmar mi correo', url },
        nota: 'Este enlace vence en 48 horas. Si no creaste esta cuenta, ignora este correo.',
      }),
      texto: `Hola ${nombre}, gracias por registrar ${taller} en Grabix. Confirma tu correo aquí: ${url} (vence en 48 horas).`,
    });
  }

  recuperacion(para: string, nombre: string, url: string) {
    return this.enviar({
      para,
      tipo: 'recuperacion',
      asunto: 'Restablece tu contraseña de Grabix',
      html: this.plantilla({
        previa: 'Crea una contraseña nueva para tu cuenta de Grabix.',
        etiqueta: 'Seguridad de tu cuenta',
        titulo: 'Restablece tu contraseña',
        parrafos: [`Hola ${nombre}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`],
        boton: { texto: 'Crear contraseña nueva', url },
        nota: 'El enlace vence en 1 hora y solo funciona una vez. Si no lo pediste, ignora este correo: tu contraseña no cambia.',
      }),
      texto: `Hola ${nombre}, para crear una contraseña nueva abre: ${url} (vence en 1 hora y funciona una sola vez).`,
    });
  }

  invitacion(para: string, nombre: string, taller: string, quien: string, url: string) {
    return this.enviar({
      para,
      tipo: 'invitacion',
      asunto: `${quien} te invitó a ${taller} en Grabix`,
      html: this.plantilla({
        previa: `Crea tu contraseña para entrar al sistema de ${taller}.`,
        etiqueta: 'Invitación',
        titulo: `Hola ${nombre}, te dieron acceso`,
        parrafos: [`${quien} te invitó al sistema de ${taller} en Grabix.`, 'Crea tu contraseña para entrar.'],
        boton: { texto: 'Crear mi contraseña', url },
        nota: 'El enlace vence en 7 días. Si no esperabas esta invitación, ignora este correo.',
      }),
      texto: `Hola ${nombre}, ${quien} te invitó a ${taller} en Grabix. Crea tu contraseña aquí: ${url} (vence en 7 días).`,
    });
  }

  /** Recordatorio cuando faltan pocos días de prueba. */
  pruebaPorVencer(para: string, nombre: string, taller: string, dias: number) {
    const url = this.url('/app/suscripcion');
    const cuando = dias === 1 ? 'mañana' : `en ${dias} días`;
    return this.enviar({
      para,
      tipo: 'prueba_por_vencer',
      asunto: `Tu prueba de Grabix termina ${cuando}`,
      html: this.plantilla({
        previa: `Elige tu plan para que ${taller} siga trabajando sin pausas.`,
        titulo: `Hola ${nombre}, tu prueba termina ${cuando}`,
        parrafos: [
          `Esperamos que Grabix ya le esté ahorrando tiempo a ${taller}: cotizaciones con tus costos reales, pedidos por etapas y la caja al día.`,
          'Para seguir sin interrupciones, elige tu plan. Todo lo que capturaste se queda igual: clientes, productos, cotizaciones y ventas.',
          `Los planes empiezan en $${PLANES[0].precioMensual} al mes, y el anual te regala dos meses.`,
        ],
        boton: { texto: 'Elegir mi plan', url },
        nota: '¿Necesitas más tiempo para probarlo o tienes dudas? Escríbenos a soporte@elikarsystems.com y te ayudamos.',
      }),
      texto: `Hola ${nombre}, tu prueba de Grabix para ${taller} termina ${cuando}. Elige tu plan para seguir sin interrupciones: ${url}`,
    });
  }

  /** Aviso cuando la prueba ya terminó. */
  pruebaTerminada(para: string, nombre: string, taller: string) {
    const url = this.url('/app/suscripcion');
    return this.enviar({
      para,
      tipo: 'prueba_terminada',
      asunto: 'Tu prueba de Grabix terminó: tus datos siguen guardados',
      html: this.plantilla({
        previa: `Elige un plan y ${taller} vuelve a trabajar en el mismo punto.`,
        titulo: `Hola ${nombre}, tu prueba terminó`,
        parrafos: [
          `Gracias por probar Grabix con ${taller}. Tus clientes, productos, cotizaciones y ventas siguen guardados.`,
          'Elige tu plan y sigues exactamente donde te quedaste, con todo tu equipo.',
        ],
        boton: { texto: 'Elegir mi plan', url },
        nota: '¿Algo no te convenció o te faltó una función? Cuéntanos en soporte@elikarsystems.com; leemos cada mensaje.',
      }),
      texto: `Hola ${nombre}, tu prueba de Grabix para ${taller} terminó. Tus datos siguen guardados. Elige tu plan aquí: ${url}`,
    });
  }

  contrasenaCambiada(para: string, nombre: string) {
    const url = this.url('/olvide-contrasena');
    return this.enviar({
      para,
      tipo: 'contrasena_cambiada',
      asunto: 'Tu contraseña de Grabix cambió',
      html: this.plantilla({
        previa: 'La contraseña de tu cuenta se cambió.',
        etiqueta: 'Seguridad de tu cuenta',
        titulo: 'Tu contraseña cambió',
        parrafos: [`Hola ${nombre}, la contraseña de tu cuenta de Grabix se cambió correctamente.`],
        nota: `Si no fuiste tú, restablécela de inmediato en ${url} y avísale al dueño del taller.`,
      }),
      texto: `Hola ${nombre}, la contraseña de tu cuenta de Grabix cambió. Si no fuiste tú, restablécela en ${url}.`,
    });
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TokenCuenta, CorreoLog])],
  providers: [CorreoService, TokensService],
  exports: [CorreoService, TokensService],
})
export class CorreoModule {}
