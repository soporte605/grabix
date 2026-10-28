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

## Super administrador

Panel de Elikar, aparte del login de los talleres. En producción no trae correo ni contraseña de fábrica.

- En local, con `ng serve`: http://localhost:4200/admin
- En local, con Docker: http://localhost:8081/admin
- En producción: https://admin.grabix.elikarsystems.com

Cuenta local (solo la base de Docker de esta máquina; no existe en producción):

- Correo: `local-panel@grabix.test`
- Contraseña: `Mesa4821k`
- Nombre: Elikar

El primero se crea al arrancar la API, solo si la tabla `super_admins` está vacía y hay `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`. La contraseña sigue las mismas reglas que el resto de cuentas: mínimo 8 caracteres, con letras y números, que no sea muy común y que no incluya el correo ni la palabra Elikar. Si no las cumple, no se crea y la API sigue. Si ya hay un super administrador, el arranque no cambia su contraseña.

Desde el panel se ven los talleres, se editan datos y planes, se bloquean cuentas, se reenvían correos y se puede entrar como dueño. **Bitácora** muestra lo que se cambió en el panel y en los talleres. **Accesos** guarda cada intento de entrar (panel y talleres): correo, si entró, el motivo, la IP y la hora. No guarda la contraseña. Los intentos anteriores a esta función no aparecen.

## Asistente con IA

Botón **Asistente** en la barra superior del sistema. Usa Claude (Anthropic) y responde con los datos del taller:

- Consulta ventas, pedidos, cotizaciones, inventario y clientes con herramientas **de solo lectura** (`backend/src/asistente/`). No crea, cambia ni borra nada.
- Respeta la **sucursal** elegida y el **rol**: vendedores y producción nunca reciben costos ni ganancias, y cada rol solo tiene las consultas que le tocan.
- Explica cómo usar Grabix con la guía de `backend/src/asistente/guia.ts` y da enlaces a las pantallas.
- Cupo diario por taller según el plan (40 / 150 / 500 preguntas), guardado en la tabla `asistente_uso` junto con los tokens usados.

Para activarlo pon `ANTHROPIC_API_KEY` en `.env` (llave de console.anthropic.com) y reconstruye la API. `ASISTENTE_MODELO` cambia el modelo (por defecto `claude-opus-5-5`; `claude-haiku-5-5` es mucho más barato). Sin llave, el panel avisa que no está activado.

## Identidad visual
Logo, colores, tipografías y reglas de uso en [`docs/MARCA.md`](docs/MARCA.md).

Colores de Elikar Systems (azul marino `#002150` y verde `#67BE28`, los mismos de SiloPro; provisionales hasta tener la paleta oficial) y fuentes de Google (Plus Jakarta Sans para todo el sistema y JetBrains Mono para cifras).

El diseño usa **Tailwind CSS v4**, igual que SiloPro y FincaPro. Todo vive en `frontend/src/styles.css`:
- `:root` con los colores y fuentes; `@theme` los expone como utilidades (`bg-marca`, `text-tenue`, `border-linea`, `font-titulo`, `shadow-caja`…). Para cambiar la marca basta con cambiar `:root`.
- `@layer components` con las piezas que se repiten: `btn` (`pri`, `sec`, `wa`, `peligro`, `sm`), `tarjeta`, `caja`, `campo`/`campos`, `renglon`, `pill`, `chip`, `kpi`, `encabezado`.
- Lo demás va con utilidades directamente en las plantillas de cada componente (no hay hojas de estilo por componente).
- **Modo oscuro**: el mismo `:root` se redefine con `data-tema="oscuro"` o con la preferencia del sistema.
- Piezas de interfaz en `frontend/src/app/ui/`: `capas` (barra de carga global, avisos y ventana de confirmación), `esqueleto` (skeletons de carga), `campo-clave` (contraseña con medidor de seguridad), `hoja` (ventanas modales) y `logo`.

### Seguridad de contraseñas
Mínimo 8 caracteres, con letras y números, que no sea una muy común ni contenga el correo o el nombre. Se valida igual en la API (`backend/src/common/clave.ts`) y en la app (`frontend/src/app/core/clave.ts`), que además muestra el medidor de seguridad.

Los colores del PDF se ajustan con `PDF_COLOR_ACENTO` y `PDF_COLOR_SECUNDARIO`.

## Antes de producción
- `DB_SYNC=false` y migraciones de TypeORM.
- `JWT_SECRET` largo y aleatorio; `PUBLIC_URL` con tu dominio y HTTPS (por ejemplo, Nginx/Caddy con Let's Encrypt delante del contenedor `web`).
- Respaldos automáticos del volumen `datos` de MySQL.
