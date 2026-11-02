# Lanzamiento: Meta, Mercado Pago y piezas de campaña

Bitácora de lo que se configuró fuera del código para lanzar Grabix, en qué orden y qué problemas salieron. Complementa [`PRODUCCION.md`](PRODUCCION.md), que explica el servidor.

> Las llaves y tokens nunca van en el repositorio ni en el chat. Se guardan en `deploy/contabo.local.env` de la PC de Gonzalo y de ahí se copian a `/opt/grabix/.env.produccion` en el servidor, con permisos 600.

## Estado al 2 de noviembre de 2026

| Pieza | Estado | Dónde se configura |
|---|---|---|
| Producción | Corre desde la rama `main` en `/opt/grabix` | `PRODUCCION.md` |
| Aviso de privacidad y términos | Publicados en `/privacidad` y `/terminos` | `frontend/src/app/pages/legal.ts`, `LEGAL_*` |
| Vista previa al compartir la liga | Activa (`og-grabix.png`) | `frontend/src/index.html` |
| Pixel de Meta | Activo, ID `1698818815133149` | `META_PIXEL_ID` |
| Botón de WhatsApp | Programado, falta el número | `WHATSAPP_CONTACTO` |
| Domicilio en el aviso de privacidad | Falta (muestra "México") | `LEGAL_DOMICILIO` |
| Mercado Pago | Probado con token de prueba; falta token de producción | `MERCADOPAGO_ACCESS_TOKEN`, `PAGOS_MODO` |
| Aviso de caídas | Activo cada 10 min | `.github/workflows/vigilancia.yml` |
| Respaldo fuera del servidor | Programado, falta elegir destino | servicio `respaldo-remoto` |
| Migraciones de base de datos | Pendiente (sigue `DB_SYNC=true`) | — |

## 1. Pixel de Meta

### Para qué sirve

Le avisa a Meta lo que hace en la landing la gente que llega de un anuncio. Con eso se mide cuántas cuentas trajo cada anuncio, Meta optimiza a quién se lo muestra y se puede volver a mostrar anuncios a quien visitó y no se registró.

Grabix lo carga solo en páginas públicas (landing, registro, entrar, avisos legales), nunca dentro de `/app`. Eventos que manda (`frontend/src/app/core/publico.service.ts`):

| Evento | Cuándo |
|---|---|
| `PageView` | Cada página pública |
| `Lead` | Primera cotización en el simulador de la landing |
| `Contact` | Clic en el botón de WhatsApp |
| `CompleteRegistration` | Cuenta creada |

### Qué pasó y cómo se resolvió

1. **Primer intento:** en Meta Business Suite → Más herramientas → **Administrador de eventos** → Conectar datos → Web. Al crear el conjunto de datos salía "Algo salió mal", con cualquier nombre.
2. **Pista falsa:** el número que aparece arriba a la derecha del Administrador de eventos (212296180394221) no es un Pixel, es el ID de la cuenta. En "Conjuntos de datos" no había ninguno.
3. **Causa real:** la página de Facebook "Elikar Systems - Desarrollo de Software" no pertenecía a ningún **portafolio comercial**, y Meta solo permite crear un Pixel dentro de uno. Los portafolios existentes eran Dev Dinosoft, DinoSoft, Dinofood, Dinofood26 y "Gonzalo Castillo Gurria".
4. **Límite de portafolios:** no se podía crear uno nuevo ("Crear negocio" en gris). Se eliminó DinoSoft, pero Meta deja los portafolios "programados para eliminación" varios días y siguen contando para el límite.
5. **Solución:**
   - Se renombró el portafolio **"Gonzalo Castillo Gurria" (ID 620403189461710) a "Elikar Systems"**, en business.facebook.com/settings → Información del negocio. Ahí sigue también la página de Dinofood.
   - Se agregó la página "Elikar Systems - Desarrollo de Software" al portafolio: Configuración → Cuentas → Páginas → Agregar → Reclamar página. Hay que aceptar las Condiciones comerciales de Meta; ese clic lo tiene que dar el dueño.
   - Se creó el conjunto de datos **"Grabix"** en Configuración → Orígenes de datos → Conjuntos de datos → Agregar: business.facebook.com/latest/settings/datasets?business_id=620403189461710.
   - Se dejó **desmarcada** la casilla "Conecta todos los conjuntos de datos… a la API de conversiones", porque cambia todos los conjuntos del portafolio y Grabix solo usa el Pixel en el navegador.
   - No se instaló ningún código desde Meta: Grabix ya lo trae.
6. **En el servidor:** `META_PIXEL_ID=1698818815133149` en `.env.produccion` (y en `contabo.local.env`), reinicio solo de la api:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.produccion up -d api
   ```

   Comprobación: `https://app.grabix.elikarsystems.com/api/publico/config` devuelve `"pixelId":"1698818815133149"`.

### Cómo revisar que llegan eventos

Entra a grabix.elikarsystems.com, espera unos minutos y abre el Administrador de eventos → Grabix. Debe dejar de decir "no recibe eventos". Para probar en vivo usa la pestaña **Probar eventos**.

### Si hay que cambiarlo

Crear otro conjunto de datos en el portafolio Elikar Systems, cambiar `META_PIXEL_ID` y reiniciar la api. No se toca código. Para quitarlo, dejar la variable vacía.

## 2. Mercado Pago

### Credenciales

En mercadopago.com.mx/developers → Tus integraciones → la aplicación de Grabix (Checkout Pro):

- **Credenciales de prueba:** el Access Token empieza con `TEST-`. Con este se hizo la prueba completa del 1 de noviembre.
- **Credenciales de producción:** el Access Token empieza con `APP_USR-`. Es el que cobra de verdad.
- **Public Key:** Grabix no la usa (el pago se hace en la página de Mercado Pago, no dentro del sistema).

### Activar cobros reales

1. En `deploy/contabo.local.env` poner `MERCADOPAGO_ACCESS_TOKEN=APP_USR-…`.
2. Copiarlo a `/opt/grabix/.env.produccion` y poner `PAGOS_MODO=mercadopago` (con `demo` los planes se activan sin cobrar).
3. Reiniciar la api.
4. Opcional: en la aplicación de Mercado Pago → Webhooks, poner `https://app.grabix.elikarsystems.com/api/pagos/mercadopago` con el evento "Pagos". No es obligatorio: cada cobro manda esa URL.

### Lo que aprendimos en las pruebas

- Con token de prueba, el comprador tiene que ser una **cuenta de prueba compradora** de Mercado Pago, con sesión iniciada. Si el comprador es una cuenta real sale "Una de las partes con la que intentas hacer el pago es de prueba".
- Por eso la preferencia **no manda el correo del comprador**.
- En modo incógnito o con bloqueador de anuncios el botón "Pagar" puede quedarse gris. Pagar con "Dinero disponible" de la cuenta de prueba funcionó.
- Al pagar, los días que quedaban (de prueba o pagados) se suman al nuevo periodo.
- Después de pasar a producción conviene borrar el pago de prueba del taller del dueño y regresar su plan.

## 3. WhatsApp, domicilio y avisos legales

Variables en `.env.produccion` (vacías = no se muestran):

| Variable | Ejemplo | Efecto |
|---|---|---|
| `WHATSAPP_CONTACTO` | `5215512345678` | Botón flotante "Escríbenos" en la landing |
| `LEGAL_RESPONSABLE` | `Elikar Systems` | Nombre en `/privacidad` y `/terminos` |
| `LEGAL_DOMICILIO` | `Ciudad, Estado, México` | Domicilio que pide la ley en el aviso de privacidad |
| `LEGAL_CORREO` | `soporte@elikarsystems.com` | Contacto para derechos ARCO |

Los textos legales están en `frontend/src/app/pages/legal.ts`. Si se cambian, actualizar la constante `ACTUALIZADO` con la fecha.

## 4. Vista previa al compartir

`frontend/public/og-grabix.png` (1200×630) y las etiquetas `og:`/`twitter:` de `frontend/src/index.html`. Si se cambia la imagen, pedir a Facebook que la vuelva a leer en developers.facebook.com/tools/debug con la liga de la landing.

## 5. Aviso de caídas y respaldo externo

- **Aviso de caídas:** GitHub Actions revisa cada 10 minutos la landing y `/api/publico/salud`. Si fallan 3 intentos abre el issue "Grabix no responde" (llega correo de GitHub) y lo cierra al volver. Solo corre desde `main`.
- **Respaldo externo:** servicio `respaldo-remoto` (rclone). Falta crear el bucket (recomendado Cloudflare R2, 10 GB gratis) y `rclone.conf` en el servidor. Pasos en `PRODUCCION.md`, sección 7.

## Pendientes

- Número de WhatsApp y domicilio (ciudad y estado).
- Token de producción de Mercado Pago y limpieza del pago de prueba.
- Destino del respaldo externo.
- Migraciones de base de datos en lugar de `DB_SYNC`.
- Primera campaña en Meta: presupuesto, ciudades y anuncios (con el conector Adspirer o desde el navegador).
