# Grabix

Sistema por suscripción para talleres de **corte/grabado láser y sublimación**: cotizaciones con PDF y WhatsApp, ventas con anticipos y saldos, inventario por sucursal con recetas de insumos, compras con costo promedio, promociones, producción, estadísticas de ventas y ganancia, roles, varias sucursales y bitácora.

| Parte | Tecnología |
|---|---|
| `frontend/` | Angular 20 (componentes standalone + signals) |
| `backend/` | NestJS 11 + TypeORM |
| Base de datos | MySQL 8 |
| Despliegue | Docker Compose (MySQL + API + Nginx) |

## Levantarlo con Docker

```bash
cp .env.example .env        # ajusta contraseñas y JWT_SECRET
docker compose up -d --build
```

- App: http://localhost:8080
- API: http://localhost:8080/api
- MySQL desde tu máquina: `localhost:3307` (usuario y contraseña del `.env`)

Al registrarte puedes marcar "Cargar datos de ejemplo" para ver la app con información.

## Desarrollo sin Docker

```bash
docker compose up -d db                       # solo MySQL
cd backend && npm install && DB_PORT=3307 DB_SYNC=true PAGOS_MODO=demo npm run start:dev
cd frontend && npm install && npm start       # http://localhost:4200 (proxy a la API en :3000)
```

Prueba de punta a punta de la API (registro, cotización, venta, inventario, roles):

```bash
node scripts/smoke.mjs http://localhost:3000/api
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

### Suscripción
- Registro = **14 días de prueba**. Planes en `backend/src/common/suscripcion.ts`.
- Con la suscripción vencida se puede consultar, pero no registrar (HTTP 402).
- `PAGOS_MODO=demo` activa planes sin cobrar. **Pendiente:** conectar Stripe o Mercado Pago (webhook que llame a la activación).

## Identidad visual
Colores y fuentes están en un solo lugar: el bloque `:root` de `frontend/src/styles.scss` (fuentes de Google: Montserrat, Inter, JetBrains Mono). Los colores del PDF se ajustan con `PDF_COLOR_ACENTO` y `PDF_COLOR_SECUNDARIO`.

## Antes de producción
- `DB_SYNC=false` y migraciones de TypeORM.
- `JWT_SECRET` largo y aleatorio; `PUBLIC_URL` con tu dominio y HTTPS (por ejemplo, Nginx/Caddy con Let's Encrypt delante del contenedor `web`).
- Respaldos automáticos del volumen `datos` de MySQL.
