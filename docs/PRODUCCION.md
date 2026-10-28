# Publicar Grabix en producción

Resultado:

- **https://DOMINIO**: landing con el cotizador.
- **https://app.DOMINIO**: el sistema. Ahí van entrar, registro y `/app`.

Los dos usan HTTPS automático con Let's Encrypt, gracias a Caddy.

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
certbot --nginx -d TU-DOMINIO -d www.TU-DOMINIO -d app.TU-DOMINIO
```

Cuando el DNS ya apunta al servidor, ya hay HTTPS. Revisa:

- `https://DOMINIO`: la landing.
- `https://app.DOMINIO`: debe mandarte a entrar.
- `https://app.DOMINIO/api/publico/salud`: debe responder `{"ok":true}`.

## 5. Correo (Resend)

1. Crea una cuenta en resend.com y agrega el dominio.
2. Resend te da registros **TXT/MX/CNAME** (SPF y DKIM). Agrégalos tal cual en el DNS de GoDaddy.
3. Cuando aparezca como *Verified*, pon la llave en `RESEND_API_KEY`.
4. Pon un remitente del dominio en `MAIL_FROM`, por ejemplo `Grabix <no-responder@DOMINIO>`.
5. Vuelve a correr el comando del paso 4.

## 6. Actualizar a una versión nueva

```bash
cd /opt/grabix
git pull
docker compose -f docker-compose.prod.yml --env-file .env.produccion up -d --build   # agrega --profile caddy en la opción A
```

## 7. Respaldos

El servicio `respaldos` guarda cada día `respaldos/grabix-AAAA-MM-DD.sql.gz` y conserva 14 días. Copia esa carpeta fuera del servidor de vez en cuando, o activa los *snapshots* del proveedor.

Las fotos de trabajos terminados se guardan como archivos en `fotos/` (una carpeta por taller), no en la base de datos. Respáldala junto con `respaldos/`, por ejemplo con `tar czf fotos-$(date +%F).tgz fotos`.

Para restaurar:

```bash
gunzip -c respaldos/grabix-2026-10-28.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env.produccion exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" grabix'
```

## Notas

- `DB_SYNC=true` crea y actualiza las tablas solo. Está bien para el arranque. Antes de tener muchos clientes conviene pasar a migraciones.
- `PAGOS_MODO=demo` activa los planes sin cobrar, hasta que conectemos Stripe o Mercado Pago.
- La base de datos no queda expuesta a internet. Solo Caddy publica los puertos 80 y 443.
