# Grabix

Sistema por suscripción para talleres de **corte/grabado láser y sublimación**: cotizaciones con PDF y WhatsApp, ventas con anticipos y saldos, inventario por sucursal con recetas de insumos, compras con costo promedio, promociones, producción, estadísticas de ventas y ganancia, roles, varias sucursales y bitácora.

| Parte | Tecnología |
|---|---|
| `frontend/` | Angular 20 (componentes standalone + signals) + Tailwind CSS v4 |
| `backend/` | NestJS 11 + TypeORM |
| Base de datos | MySQL 8 |
| Correo | Resend (producción) o SMTP; Mailpit en desarrollo |
| Despliegue | Docker Compose (MySQL + API + Nginx + Mailpit) |

## Levantarlo con Docker

```bash
cp .env.example .env        # ajusta contraseñas y JWT_SECRET
docker compose up -d --build
```

- App: http://localhost:8080
- API: http://localhost:8080/api
- Correos de prueba (Mailpit): http://localhost:8025
- MySQL desde tu máquina: `localhost:3307` (usuario y contraseña del `.env`)

Al registrarte puedes marcar "Cargar datos de ejemplo" para ver la app con información.

## Desarrollo sin Docker

```bash
docker compose up -d db                       # solo MySQL
docker compose up -d mailpit                  # bandeja de correos en :8025 (SMTP en :1025, ver nota)
cd backend && npm install && DB_PORT=3307 DB_SYNC=true PAGOS_MODO=demo npm run start:dev
cd frontend && npm install && npm start       # http://localhost:4200 (proxy a la API en :3000)
```

Sin `SMTP_HOST` ni `RESEND_API_KEY`, la API escribe los correos en la consola. Para verlos en Mailpit sin Docker en la API, publica el puerto 1025 del contenedor y usa `SMTP_HOST=localhost SMTP_PORT=1025`.

Prueba de punta a punta de la API (registro, correos, cotización, venta, inventario, roles):

```bash
node scripts/smoke.mjs http://localhost:8080/api http://localhost:8025
```

## Cómo está organizado

### Multitaller, sucursales y roles
- Cada **taller** (cliente que paga) tiene sus sucursales, usuarios y datos; toda consulta filtra por `tallerId`.
- Inventario, folios de documentos y ventas se registran por **sucursal**. El encabezado `X-Sucursal` indica con cuál se trabaja; dueño y administrador pueden ver "todas".
- Roles:
  - **Dueño**: todo, incluida la suscripción.
  - **Administrador**: todo menos pagos de suscripción.
  - **Encargado**: su sucursal, inventario, compras y reportes.
  - **Vendedor**: cotiza, vende y cobra. **No ve costos ni ganancias**; la API los quita de las respuestas (`CostosInterceptor`).
  - **Producción**: tablero de pedidos y cambio de estado.

### Costos e inventario
- Un **producto** puede tener **receta** de insumos (taza sublimada = 1 taza blanca + 1 hoja de papel).
- Costo por pieza = insumos (o costo de compra) + minutos de máquina × costo por minuto del taller + otros costos.
- Al vender se descuentan los insumos de la receta; al cancelar o eliminar se devuelven. Cada cambio queda en `movimientos_inventario`.
- Las compras suman existencias y recalculan el **costo promedio ponderado**.

### Documentos
- Folios consecutivos por taller (`COT-0001`, `VTA-0001`, `CMP-0001`) con bloqueo para ventas simultáneas.
- El PDF se genera en el servidor (pdfkit). WhatsApp abre `wa.me` con el resumen y una **liga pública al PDF** (`/api/publico/documentos/<token>.pdf`), así el cliente lo abre sin cuenta.

### Cuenta y correos
Igual que FincaPro y SiloPro:
- Al **registrarse** se entra de inmediato y llega un correo de bienvenida con el botón **Confirmar mi correo** (vence en 48 h). Mientras no se confirma, la app muestra un aviso con "Reenviar" (máximo uno por minuto). Elegir plan e invitar usuarios piden el correo confirmado (`403` con `code: EMAIL_NO_VERIFICADO`).
- **Olvidé mi contraseña**: el enlace vence en 1 hora y funciona una sola vez; la respuesta es igual exista o no el correo. Al restablecer o cambiar la contraseña se cierran las demás sesiones y llega un aviso.
- **Invitaciones**: al crear un usuario sin contraseña, recibe un correo para crearla (vence en 7 días). Se puede reenviar desde Usuarios.
- Los enlaces se guardan como hash SHA-256 en `tokens_cuenta`; cada correo enviado, simulado o fallido queda en `correos_log`.
- Proveedor: **Resend** si hay `RESEND_API_KEY`; si no, **SMTP** (Gmail, Brevo, SES o Mailpit); si no hay ninguno, solo se escribe en el log. Plantillas en `backend/src/correo/correo.service.ts`.

### Suscripción
- Registro = **14 días de prueba**. Planes en `backend/src/common/suscripcion.ts`.
- Con la suscripción vencida se puede consultar, pero no registrar (HTTP 402).
- `PAGOS_MODO=demo` activa planes sin cobrar. **Pendiente:** conectar Stripe o Mercado Pago (webhook que llame a la activación).

## Identidad visual
Colores de Elikar Systems (azul marino `#002150` y verde `#67BE28`, los mismos de SiloPro; provisionales hasta tener la paleta oficial) y fuentes de Google (Montserrat, Inter, JetBrains Mono).

El diseño usa **Tailwind CSS v4**, igual que SiloPro y FincaPro. Todo vive en `frontend/src/styles.css`:
- `:root` con los colores y fuentes; `@theme` los expone como utilidades (`bg-marca`, `text-tenue`, `border-linea`, `font-titulo`, `shadow-caja`…). Para cambiar la marca basta con cambiar `:root`.
- `@layer components` con las piezas que se repiten: `btn` (`pri`, `sec`, `wa`, `peligro`, `sm`), `tarjeta`, `caja`, `campo`/`campos`, `renglon`, `pill`, `chip`, `kpi`, `encabezado`.
- Lo demás va con utilidades directamente en las plantillas de cada componente (no hay hojas de estilo por componente).

Los colores del PDF se ajustan con `PDF_COLOR_ACENTO` y `PDF_COLOR_SECUNDARIO`.

## Antes de producción
- `DB_SYNC=false` y migraciones de TypeORM.
- `JWT_SECRET` largo y aleatorio; `PUBLIC_URL` con tu dominio y HTTPS (por ejemplo, Nginx/Caddy con Let's Encrypt delante del contenedor `web`).
- Respaldos automáticos del volumen `datos` de MySQL.
