import { Component, computed, inject, input, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicoService } from '../core/publico.service';
import { Logo } from '../ui/logo';
import { SelectorTema } from '../ui/selector-tema';

/** Fecha de la versión vigente de ambos documentos. Cámbiala cuando se modifique el texto. */
const ACTUALIZADO = '1 de noviembre de 2026';

/** Marco común de las páginas legales: encabezado con logo, texto legible y pie con enlaces cruzados. */
@Component({
  selector: 'app-legal',
  imports: [RouterLink, Logo, SelectorTema],
  template: `
    <header class="sticky top-0 z-30 border-b border-linea bg-superficie/90 py-2.5 backdrop-blur">
      <div class="mx-auto flex max-w-[860px] items-center justify-between gap-3 margen-x">
        <a class="no-underline" routerLink="/" aria-label="Grabix, inicio"><app-logo [tamano]="28" /></a>
        <div class="flex items-center gap-2">
          <app-selector-tema />
          <a routerLink="/registro" class="btn sm pri">Prueba gratis</a>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-[860px] margen-x py-10 sm:py-14">
      <h1 class="font-titulo text-[clamp(1.7rem,4.5vw,2.4rem)] font-extrabold tracking-[-.02em] text-tinta">{{ titulo() }}</h1>
      <p class="mt-2 text-sm text-tenue">Última actualización: {{ actualizado }}</p>
      <article class="legal mt-8"><ng-content /></article>
    </main>
    <footer class="border-t border-linea">
      <div class="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 margen-x py-7 text-[.88rem] text-tenue">
        <span>Grabix es un producto de {{ pub.config().legal.responsable }}</span>
        <nav class="flex flex-wrap gap-4">
          <a routerLink="/privacidad" class="text-tenue">Aviso de privacidad</a>
          <a routerLink="/terminos" class="text-tenue">Términos de uso</a>
          <a [href]="'mailto:' + pub.config().legal.correo" class="text-tenue">{{ pub.config().legal.correo }}</a>
        </nav>
      </div>
    </footer>
  `,
  styles: `
    .legal { font-size: 1rem; line-height: 1.7; color: var(--color-texto, inherit); }
    .legal ::ng-deep h2 { margin: 2.2rem 0 .6rem; font-family: var(--font-titulo, inherit); font-size: 1.22rem; font-weight: 800; letter-spacing: -.01em; color: var(--color-tinta, inherit); }
    .legal ::ng-deep h3 { margin: 1.4rem 0 .4rem; font-size: 1.02rem; font-weight: 700; color: var(--color-tinta, inherit); }
    .legal ::ng-deep p { margin: .6rem 0; }
    .legal ::ng-deep ul { margin: .6rem 0; padding-left: 1.3rem; list-style: disc; }
    .legal ::ng-deep li { margin: .3rem 0; }
    .legal ::ng-deep .caja { margin: 1rem 0; padding: 1rem 1.2rem; border: 1px solid var(--color-linea, #ddd); border-radius: 14px; background: var(--color-superficie-2, transparent); }
  `,
  host: { class: 'block min-h-dvh bg-fondo' },
})
export class MarcoLegal implements OnInit {
  pub = inject(PublicoService);
  titulo = input.required<string>();
  actualizado = ACTUALIZADO;
  ngOnInit() { void this.pub.cargar(); }
}

abstract class Legal {
  pub = inject(PublicoService);
  l = computed(() => this.pub.config().legal);
  domicilio = computed(() => this.l().domicilio || 'México');
}

@Component({
  selector: 'app-privacidad',
  imports: [MarcoLegal, RouterLink],
  template: `
    <app-legal titulo="Aviso de privacidad">
      <p>
        Este aviso explica qué datos personales recabamos en Grabix, para qué los usamos y cómo puedes ejercer tus derechos,
        conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su normativa aplicable.
      </p>

      <h2>1. Quién es el responsable</h2>
      <p>
        <b>{{ l().responsable }}</b>, con domicilio en {{ domicilio() }}, es responsable del tratamiento de los datos
        personales que nos proporcionas al usar Grabix en grabix.elikarsystems.com y app.grabix.elikarsystems.com.
        Para cualquier asunto de privacidad escríbenos a <a [href]="'mailto:' + l().correo">{{ l().correo }}</a>.
      </p>

      <h2>2. Datos que recabamos</h2>
      <h3>Si creas una cuenta (dueño del taller y su equipo)</h3>
      <ul>
        <li>Identificación y contacto: nombre, correo electrónico, teléfono y nombre del taller.</li>
        <li>Datos de acceso: contraseña (se guarda cifrada; nadie en Elikar Systems puede leerla) y registros de inicio de sesión.</li>
        <li>Datos fiscales, solo si los capturas para facturar: RFC, razón social, régimen fiscal, código postal y correo para facturas.</li>
        <li>Datos de pago de la suscripción: plan, monto, fecha y folio de Mercado Pago. <b>No recibimos ni guardamos los datos de tu tarjeta</b>; los captura y protege Mercado Pago.</li>
        <li>Datos de uso: acciones dentro del sistema (bitácora), preguntas al asistente con IA y datos técnicos como dirección IP, navegador y dispositivo.</li>
      </ul>
      <h3>Si solo visitas la landing</h3>
      <ul>
        <li>Para limitar el cotizador gratuito guardamos una huella cifrada de tu dirección IP (no la IP en sí) y cuántas cotizaciones hiciste.</li>
        <li>Si nos escribes por WhatsApp o correo, los datos que tú nos compartas en esa conversación.</li>
        <li>Datos de navegación mediante cookies y tecnologías similares, descritos en la sección 7.</li>
      </ul>
      <p>No solicitamos datos personales sensibles.</p>

      <h2>3. Para qué usamos tus datos</h2>
      <h3>Finalidades necesarias para darte el servicio</h3>
      <ul>
        <li>Crear y administrar tu cuenta, verificar tu correo y recuperar tu contraseña.</li>
        <li>Prestar el servicio de Grabix: cotizaciones, ventas, caja, producción, inventario, sucursales y usuarios.</li>
        <li>Cobrar la suscripción, confirmar pagos y, si lo pides, emitir tu factura.</li>
        <li>Enviarte correos sobre tu cuenta: activación, avisos de tu periodo de prueba, pagos y cambios importantes del servicio.</li>
        <li>Darte soporte, cuidar la seguridad de la plataforma y prevenir abusos o fraudes.</li>
        <li>Cumplir obligaciones legales y fiscales.</li>
      </ul>
      <h3>Finalidades adicionales</h3>
      <ul>
        <li>Medir el desempeño de nuestros anuncios y de la landing.</li>
        <li>Enviarte novedades, consejos y promociones de Grabix.</li>
        <li>Hacer estadísticas internas para mejorar el producto.</li>
      </ul>
      <p>
        Si no quieres que usemos tus datos para las finalidades adicionales, escríbenos a <a [href]="'mailto:' + l().correo">{{ l().correo }}</a>
        en cualquier momento. Negarte no afecta tu servicio.
      </p>

      <h2>4. Información de los clientes de tu taller</h2>
      <p>
        Los datos de tus clientes que capturas en Grabix (nombres, teléfonos, correos, direcciones, pedidos, pagos) son tuyos.
        Respecto de ellos, tu taller es el responsable y Elikar Systems actúa como encargado: los tratamos solo para darte el servicio,
        siguiendo tus instrucciones, no los vendemos ni los usamos para anunciarnos con ellos. Tú te comprometes a informar a tus clientes
        y a contar con su consentimiento cuando la ley lo pida.
      </p>

      <h2>5. Con quién compartimos datos</h2>
      <p>Para operar Grabix nos apoyamos en proveedores que tratan datos por nuestra cuenta y bajo obligaciones de confidencialidad:</p>
      <ul>
        <li><b>Servidores y respaldos:</b> proveedor de infraestructura en la nube donde se aloja la base de datos.</li>
        <li><b>Correo transaccional:</b> Resend, para enviar los correos de tu cuenta.</li>
        <li><b>Pagos:</b> Mercado Pago, que procesa el cobro de la suscripción con sus propias políticas de privacidad.</li>
        <li><b>Asistente con IA:</b> Anthropic, que recibe tus preguntas y la información del taller necesaria para responderlas. No se usa para entrenar modelos.</li>
        <li><b>Medición publicitaria:</b> Meta Platforms, a través de su Pixel, solo en la landing y el registro.</li>
      </ul>
      <p>
        Algunos de estos proveedores están fuera de México. Fuera de ellos, solo compartimos datos con autoridades cuando una ley o una orden
        lo exija. No vendemos tus datos personales.
      </p>

      <h2>6. Tus derechos ARCO y cómo ejercerlos</h2>
      <p>
        Puedes <b>acceder</b> a tus datos, <b>rectificarlos</b>, pedir su <b>cancelación</b> u <b>oponerte</b> a su uso, así como
        <b>revocar tu consentimiento</b> o limitar su uso y divulgación. Muchos datos los puedes corregir tú mismo en Ajustes y en tu perfil.
      </p>
      <div class="caja">
        <p><b>Envía tu solicitud a <a [href]="'mailto:' + l().correo">{{ l().correo }}</a></b> con:</p>
        <ul>
          <li>Tu nombre y el correo con el que usas Grabix.</li>
          <li>Una identificación oficial (o la de tu representante y el documento que lo acredite).</li>
          <li>Qué derecho quieres ejercer y sobre qué datos.</li>
        </ul>
        <p>Te respondemos en un máximo de 20 días hábiles y, si procede, lo hacemos efectivo dentro de los 15 días hábiles siguientes.</p>
      </div>
      <p>
        Algunos datos debemos conservarlos aunque canceles tu cuenta, por ejemplo los de pagos y facturas, durante los plazos que fijan las
        leyes fiscales. Si consideras que no atendimos tu solicitud, puedes acudir a la autoridad en materia de protección de datos personales.
      </p>

      <h2>7. Cookies y tecnologías similares</h2>
      <ul>
        <li><b>Necesarias:</b> guardamos en tu navegador tu sesión, el tema claro u oscuro y preferencias de pantalla. Sin ellas el sistema no funciona.</li>
        <li><b>De medición publicitaria:</b> en la landing, el registro y estas páginas podemos usar el Pixel de Meta, que registra visitas y si creaste una cuenta. No se carga dentro del sistema.</li>
        <li><b>Fuentes tipográficas:</b> la tipografía se descarga de Google Fonts, que recibe tu dirección IP.</li>
      </ul>
      <p>Puedes borrar o bloquear las cookies desde la configuración de tu navegador; algunas funciones podrían dejar de servir.</p>

      <h2>8. Cómo cuidamos tus datos</h2>
      <p>
        Usamos conexiones cifradas (HTTPS), contraseñas cifradas, accesos por rol y por sucursal, registro de acciones y respaldos periódicos.
        Ningún sistema es infalible; si ocurriera una vulneración que afecte tus derechos, te avisaremos sin demora.
      </p>

      <h2>9. Menores de edad</h2>
      <p>Grabix es una herramienta para negocios y no está dirigida a menores de 18 años.</p>

      <h2>10. Cambios a este aviso</h2>
      <p>
        Si cambiamos este aviso publicaremos la nueva versión en esta página con su fecha, y si el cambio es importante te avisaremos por
        correo o dentro del sistema.
      </p>
      <p>Consulta también nuestros <a routerLink="/terminos">Términos de uso</a>.</p>
    </app-legal>
  `,
})
export class Privacidad extends Legal {}

@Component({
  selector: 'app-terminos',
  imports: [MarcoLegal, RouterLink],
  template: `
    <app-legal titulo="Términos de uso">
      <p>
        Estos términos regulan el uso de Grabix, el sistema en línea para talleres de corte láser, grabado y sublimación que ofrece
        <b>{{ l().responsable }}</b>, con domicilio en {{ domicilio() }}. Al crear una cuenta o usar Grabix aceptas
        estos términos y nuestro <a routerLink="/privacidad">Aviso de privacidad</a>.
      </p>

      <h2>1. El servicio</h2>
      <p>
        Grabix permite cotizar, vender, cobrar en caja, dar seguimiento a la producción, llevar inventario, clientes y compras, y trabajar con
        varias sucursales y usuarios. Incluye un simulador de precios en la landing y un asistente con inteligencia artificial.
        Las funciones disponibles dependen de tu plan y pueden mejorar o cambiar con el tiempo.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debes ser mayor de edad y dar datos verdaderos. Quien crea la cuenta es el dueño del taller y responde por ella.</li>
        <li>Cuida tus contraseñas y las de tu equipo. Lo que se haga con tus usuarios se considera hecho por tu taller.</li>
        <li>El dueño decide quién entra al sistema y con qué rol; puede desactivar usuarios en cualquier momento.</li>
        <li>Avísanos de inmediato a <a [href]="'mailto:' + l().correo">{{ l().correo }}</a> si notas un acceso que no reconoces.</li>
      </ul>

      <h2>3. Prueba gratis, planes y pagos</h2>
      <ul>
        <li>Las cuentas nuevas tienen un periodo de prueba gratis, sin tarjeta, con los límites que se indican al registrarte.</li>
        <li>Al terminar la prueba puedes contratar un plan mensual o anual. Los precios están en pesos mexicanos, se muestran en la landing y en "Mi suscripción", e incluyen los impuestos que correspondan.</li>
        <li>El pago se hace por adelantado a través de Mercado Pago. <b>No hay cargos automáticos</b>: cada periodo se paga cuando tú decides renovarlo.</li>
        <li>Si pagas antes de que termine tu periodo vigente o tu prueba, los días que te quedaban se suman al nuevo periodo.</li>
        <li>Podemos cambiar los precios; el cambio no afecta periodos ya pagados y lo anunciaremos con anticipación.</li>
        <li>Si necesitas factura, captura tus datos fiscales en "Mi suscripción" o escríbenos dentro del mes del pago.</li>
      </ul>

      <h2>4. Cancelación y reembolsos</h2>
      <p>
        Puedes dejar de usar Grabix cuando quieras; basta con no renovar. Tu plan sigue activo hasta el final del periodo pagado.
        Por ser un servicio que se presta desde el primer día, los periodos pagados no son reembolsables, salvo cuando la ley lo
        exija o cuando un fallo atribuible a nosotros te haya impedido usar el servicio; en ese caso escríbenos y lo resolvemos.
      </p>
      <p>
        Si no renuevas, tu cuenta queda en modo consulta y conservamos tu información por al menos 90 días para que puedas volver o pedirnos
        una copia. Después podemos eliminarla, salvo lo que la ley nos obligue a guardar.
      </p>

      <h2>5. Tu información</h2>
      <ul>
        <li>Los datos que capturas (catálogos, precios, clientes, ventas, fotos) son de tu taller. Nos das permiso de guardarlos y procesarlos solo para prestarte el servicio.</li>
        <li>Tú eres responsable de tener derecho a usar la información y las imágenes que subes, y de tratar los datos de tus clientes conforme a la ley.</li>
        <li>Hacemos respaldos periódicos, pero te recomendamos conservar tus propios registros importantes (por ejemplo, los PDF de cotizaciones y cortes).</li>
      </ul>

      <h2>6. Uso aceptable</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Usar Grabix para actividades ilegales, fraudes o para enviar mensajes no solicitados.</li>
        <li>Intentar entrar a cuentas o datos de otros talleres, probar vulnerabilidades sin permiso o saturar el servicio.</li>
        <li>Copiar, revender o sublicenciar el sistema, o extraer su contenido de forma automatizada.</li>
      </ul>
      <p>Si detectamos un uso así podemos suspender la cuenta, avisándote cuando sea posible.</p>

      <h2>7. Cotizador, sugerencias de precio y asistente con IA</h2>
      <p>
        El simulador, los precios sugeridos y las respuestas del asistente son <b>orientativos</b>: se calculan con los datos que capturas
        y pueden contener errores. Revisa siempre precios, costos y cantidades antes de cotizar o vender. Las decisiones comerciales de
        tu taller son tuyas. El asistente solo consulta información; no modifica tus datos.
      </p>

      <h2>8. Disponibilidad y soporte</h2>
      <p>
        Trabajamos para que Grabix esté disponible todo el tiempo, pero puede haber interrupciones por mantenimiento, fallas de proveedores
        o causas fuera de nuestro control. Procuraremos avisar de los mantenimientos programados. El soporte se da por correo en
        <a [href]="'mailto:' + l().correo">{{ l().correo }}</a>{{ pub.config().whatsapp ? ' y por WhatsApp' : '' }} en horario hábil.
      </p>

      <h2>9. Propiedad intelectual</h2>
      <p>
        Grabix, su código, diseño, logotipos y marca son de Elikar Systems. Tu suscripción te da un derecho de uso personal e
        intransferible para tu taller mientras esté vigente.
      </p>

      <h2>10. Responsabilidad</h2>
      <p>
        Grabix se ofrece tal como está. En la medida en que la ley lo permita, Elikar Systems no responde por pérdidas indirectas,
        ganancias no obtenidas o decisiones tomadas con base en los cálculos del sistema. Nuestra responsabilidad total frente a ti
        no excederá lo que pagaste por el servicio en los últimos 12 meses. Nada de esto limita los derechos que te da la
        Ley Federal de Protección al Consumidor.
      </p>

      <h2>11. Cambios a estos términos</h2>
      <p>
        Podemos actualizar estos términos. Publicaremos la versión nueva en esta página con su fecha y, si el cambio es importante,
        te avisaremos por correo o dentro del sistema. Si sigues usando Grabix después del cambio, aceptas la versión nueva.
      </p>

      <h2>12. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier duda o aclaración, escríbenos a
        <a [href]="'mailto:' + l().correo">{{ l().correo }}</a>; preferimos resolver todo platicando. Si no llegamos a un acuerdo,
        puedes acudir a la Procuraduría Federal del Consumidor o a los tribunales competentes.
      </p>
    </app-legal>
  `,
})
export class Terminos extends Legal {}
