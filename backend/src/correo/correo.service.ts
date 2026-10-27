import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { CorreoLog, TokenCuenta } from '../entities';
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

  plantilla(o: { previa: string; etiqueta: string; titulo: string; parrafos: string[]; boton?: { texto: string; url: string }; nota?: string }) {
    const ps = o.parrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${MARCA.texto}">${esc(p)}</p>`).join('');
    const btn = o.boton
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${MARCA.primario}">
           <a href="${esc(o.boton.url)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${esc(o.boton.texto)}</a>
         </td></tr></table>
         <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:${MARCA.tenue}">Si el botón no funciona, copia esta liga en tu navegador:<br>
           <a href="${esc(o.boton.url)}" style="color:${MARCA.acentoTexto};word-break:break-all">${esc(o.boton.url)}</a></p>`
      : '';
    const nota = o.nota
      ? `<p style="margin:18px 0 0;padding:12px 14px;background:${MARCA.lienzo};border-radius:8px;font-size:13px;line-height:1.5;color:${MARCA.tenue}">${esc(o.nota)}</p>`
      : '';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.titulo)}</title></head>
<body style="margin:0;padding:0;background:${MARCA.lienzo};font-family:Inter,Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MARCA.lienzo}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 14px;font-family:Montserrat,Arial,sans-serif;font-size:22px;font-weight:800;color:${MARCA.primario}">
      <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${MARCA.acento};margin-right:8px;vertical-align:-1px"></span>Grabix</td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${MARCA.borde};border-radius:12px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:5px;background:${MARCA.acento};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:28px 30px 30px">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MARCA.acentoTexto}">${esc(o.etiqueta)}</p>
          <h1 style="margin:0 0 16px;font-family:Montserrat,Arial,sans-serif;font-size:22px;line-height:1.3;color:${MARCA.tinta}">${esc(o.titulo)}</h1>
          ${ps}${btn}${nota}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.6;color:${MARCA.tenue};text-align:center">
      Grabix · un producto de Elikar Systems<br>¿Dudas? Escríbenos a <a href="mailto:soporte@elikarsystems.com" style="color:${MARCA.acentoTexto}">soporte@elikarsystems.com</a>
    </td></tr>
  </table>
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
          `Gracias por registrar ${taller}. Ya puedes usar tu prueba gratuita de 14 días con todas las funciones.`,
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
