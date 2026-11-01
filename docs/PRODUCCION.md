# Publicar Grabix en producción

Resultado:

- **https://DOMINIO**: landing con el cotizador.
- **https://app.DOMINIO**: el sistema. Ahí van entrar, registro y `/app`.

El super administrador se publica en el host fijo **https://admin.grabix.elikarsystems.com** (no sale de `DOMINIO`). En la opción B, certbot también lleva `-d admin.grabix.elikarsystems.com`. `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` solo crean el primero si la tabla está vacía.

Landing, sistema y el host de super administrador usan HTTPS automático con Let's Encrypt, gracias a Caddy.

## 1. Servidor

Grabix necesita un VPS con Docker. El hosting compartido (cPanel) no sirve.

- Ubuntu 24.04 LTS, mínimo 2 GB de RAM, 1 vCPU y 25 GB de disco.
- Opciones: DigitalOcean, Hostinger VPS, Vultr o un VPS de GoDaddy.
- Anota la **IP pública**.

Entra por SSH (`ssh root@IP`) e instala Docker:

```bash
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2. DNS en GoDaddy

Entra a *Mis productos → Dominio → DNS → Administrar registros* y deja estos registros:

| Tipo  | Nombre | Valor          | TTL    |
|-------|--------|----------------|--------|
| A     | @      | IP del VPS     | 1 hora |
| A     | app    | IP del VPS     | 1 hora |
| CNAME | www    | @              | 1 hora |

Si GoDaddy creó antes un registro **A @** con "Parked" o un **CNAME www** que apunta a otra parte, bórralo o cámbialo.

Comprueba con `nslookup app.DOMINIO`. La IP tarda de minutos a un par de horas en propagarse.

El panel de super administrador no usa este dominio. En el DNS de **elikarsystems.com** crea un registro **A** con nombre `admin.grabix` y la misma IP del VPS.

## 3. Código y configuración

```bash
git clone https://github.com/soporte605/grabix.git /opt/grabix
cd /opt/grabix
cp .env.produccion.example .env.produccion
nano .env.produccion
```

Llena estos valores:

- `DOMINIO`: el dominio sin `www` ni `app`.
- `DB_PASSWORD` y `DB_ROOT_PASSWORD`: generar cada una con `openssl rand -base64 24`.
- `JWT_SECRET`: generar con `openssl rand -base64 48`.
- `RESEND_API_KEY` y `MAIL_FROM`: para que lleguen los correos de activación y recuperación (ver paso 5).
- `ANTHROPIC_API_KEY`: para el asistente con IA.
- `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`: el primer acceso al panel https://admin.grabix.elikarsystems.com. No hay contraseña por defecto. Solo se crea si la tabla `super_admins` está vacía. Mínimo 8 caracteres, con letras y números, que no sea muy común y que no incluya el correo ni la palabra Elikar. El nombre de esa cuenta queda como Elikar. Si ya existe un super administrador, estas variables no cambian su contraseña.

## 4. Levantar

**A. Servidor solo para Grabix** (Caddy se encarga de HTTPS):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.produccion --profile caddy up -d --build
```

**B. Servidor que ya tiene nginx en 80/443** (por ejemplo, el de SiloPro). Grabix queda en `127.0.0.1:8081` y el nginx del servidor lo publica:

```bash
# Si el 8081 ya está ocupado, pon WEB_PUERTO=8082 en .env.produccion y en deploy/nginx-grabix.conf.
docker compose -f docker-compose.prod.yml --env-file .env.produccion up -d --build
sed 's/grabix.com.mx/TU-DOMINIO/g' deploy/nginx-grabix.conf > /etc/nginx/sites-available/grabix
ln -s /etc/nginx/sites-available/grabix /etc/nginx/sites-enabled/grabix
nginx -t && systemctl reload nginx
certbot --nginx -d TU-DOMINIO -d www.TU-DOMINIO -d app.TU-DOMINIO -d admin.grabix.elikarsystems.com
```

Cuando el DNS ya apunta al servidor, ya hay HTTPS. Revisa:

- `https://DOMINIO`: la landing.
- `https://app.DOMINIO`: debe mandarte a entrar.
- `https://app.DOMINIO/api/publico/salud`: debe responder `{"ok":true}`.
- `https://admin.grabix.elikarsystems.com`: el acceso del super administrador.

## 5. Correo (Resend)

1. Crea una cuenta en resend.com y agrega el dominio.
2. Resend te da registros **TXT/MX/CNAME** (SPF y DKIM). Agrégalos tal cual en el DNS de GoDaddy.
3. Cuando aparezca como *Verified*, pon la llave en `RESEND_API_KEY`.
4. Pon un remitente del dominio en `MAIL_FROM`, por ejemplo `Grabix <no-responder@DOMINIO>`.
5. Vuelve a correr el comando del paso 4.

## 5b. Cobro de la suscripción (Mercado Pago)

1. En mercadopago.com.mx/developers → *Tus integraciones* crea la aplicación "Grabix" (Checkout Pro).
2. Pon el *Access Token* en `MERCADOPAGO_ACCESS_TOKEN` y cambia `PAGOS_MODO=mercadopago` (con `demo` el plan se activa sin cobrar).
3. Vuelve a correr el comando del paso 4. No hace falta configurar el webhook en el panel: cada preferencia manda su `notification_url` (`https://app.DOMINIO/api/pagos/mercadopago`).
4. Prueba primero con el token de prueba y un comprador de prueba; luego cambia al token de producción.

## 5c. Landing para campañas (WhatsApp, Pixel de Meta, avisos legales)

Variables opcionales en `.env.produccion`; vacías, la landing funciona igual sin esa pieza:

- `WHATSAPP_CONTACTO`: número con lada, sin espacios (`5215512345678`). Muestra el botón flotante "Escríbenos" en la landing.
- `META_PIXEL_ID`: ID del Pixel (Administrador de eventos de Meta). Se carga solo en la landing, registro, entrar y avisos legales, nunca dentro de `/app`. Eventos: `PageView`, `Lead` (primera cotización del simulador), `Contact` (botón de WhatsApp) y `CompleteRegistration` (cuenta creada).
- `LEGAL_RESPONSABLE`, `LEGAL_DOMICILIO`, `LEGAL_CORREO`: aparecen en `/privacidad` y `/terminos`. El domicilio es obligatorio por ley en el aviso de privacidad; mientras esté vacío se muestra "México".

La vista previa al compartir la liga usa `frontend/public/og-grabix.png` (1200×630) y las etiquetas `og:` de `index.html`. Tras cambiarla, pide a Facebook que la vuelva a leer en developers.facebook.com/tools/debug.

## 6. Actualizar a una versión nueva

```bash
cd /opt/grabix
git pull
docker compose -f docker-compose.prod.yml --env-file .env.produccion up -d --build   # agrega --profile caddy en la opción A
```

## 7. Respaldos

El servicio `respaldos` guarda cada día `respaldos/grabix-AAAA-MM-DD.sql.gz` y conserva 14 días. Copia esa carpeta fuera del servidor de vez en cuando, o activa los *snapshots* del proveedor.

Las fotos de trabajos terminados se guardan como archivos en `fotos/` (una carpeta por taller), no en la base de datos. Respáldala junto con `respaldos/`, por ejemplo con `tar czf fotos-$(date +%F).tgz fotos`.

### Copia fuera del servidor (recomendado)

Si el servidor se pierde, los respaldos locales se pierden con él. El servicio `respaldo-remoto` copia cada día `respaldos/` y `fotos/` a un almacenamiento externo con rclone y guarda 60 días de la base de datos.

1. Crea un *bucket* privado, por ejemplo en Cloudflare R2 (10 GB gratis) o Backblaze B2, y una llave de acceso solo para ese bucket.
2. En `/opt/grabix` crea `rclone.conf` (permisos 600), por ejemplo para R2:

   ```ini
   [externo]
   type = s3
   provider = Cloudflare
   access_key_id = …
   secret_access_key = …
   endpoint = https://<ID_DE_CUENTA>.r2.cloudflarestorage.com
   ```

3. En `.env.produccion` agrega `RESPALDO_DESTINO=externo:grabix-respaldos` (remoto:bucket).
4. Levanta con el perfil: `docker compose -f docker-compose.prod.yml --env-file .env.produccion --profile respaldo-remoto up -d`. Revisa con `docker compose … logs respaldo-remoto` que diga "Respaldos copiados".

### Aviso si el sistema se cae

`.github/workflows/vigilancia.yml` revisa cada 10 minutos la landing y `https://app.DOMINIO/api/publico/salud`. Si no responden tras 3 intentos abre un issue "Grabix no responde" con la etiqueta `caida` (GitHub manda correo) y lo cierra cuando vuelven. Solo corre desde `main`; se puede lanzar a mano en la pestaña *Actions*.

Para restaurar:

```bash
gunzip -c respaldos/grabix-2026-10-28.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env.produccion exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" grabix'
```

## Notas

- `DB_SYNC=true` crea y actualiza las tablas solo. Está bien para el arranque. Antes de tener muchos clientes conviene pasar a migraciones.
- `PAGOS_MODO=demo` activa los planes sin cobrar; con `mercadopago` se cobra de verdad (sección 5b).
- La base de datos no queda expuesta a internet. Solo Caddy publica los puertos 80 y 443.
