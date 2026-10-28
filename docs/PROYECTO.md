# Grabix: guía del proyecto

Documento de contexto para quien trabaje en el código, ya sea una persona o un asistente como Cursor. Explica qué es Grabix, cómo está armado, las reglas del negocio y las convenciones que hay que respetar. El historial de cambios está en [`CHANGELOG.md`](../CHANGELOG.md). Para levantarlo en local, ver el [`README.md`](../README.md). Para el servidor, ver [`PRODUCCION.md`](PRODUCCION.md). Logo y colores en [`MARCA.md`](MARCA.md).

## Qué es

Grabix es un sistema por suscripción (SaaS) para talleres de **corte y grabado láser y sublimación**. Lo desarrolla Elikar Systems. Nació del taller del dueño (Prin3mex) y se vende a otros talleres.

- **Landing:** https://grabix.elikarsystems.com. Tiene un cotizador gratuito como gancho: 3 cotizaciones por IP cada 30 días y luego invita a registrarse.
- **Sistema:** https://app.grabix.elikarsystems.com. Al registrarse empieza una prueba de 14 días y después se elige un plan.
- **Usuarios:** el dueño del taller, su administrador, encargados de sucursal, vendedores de mostrador y personal de producción. Se usa mucho desde el **teléfono**.
- **Idioma:** todo en español de México. Moneda `$` (MXN) y lada de WhatsApp 52, ambas configurables por taller.

## Stack

| Parte | Tecnología |
|---|---|
| `frontend/` | Angular 20: componentes standalone, signals, `@if`/`@for`/`@let` y `input()`/`output()`/`model()`. Tailwind CSS v4 con tokens en `src/styles.css`. Sin SCSS ni estilos por componente. |
| `backend/` | NestJS 11 + TypeORM 0.3 + MySQL 8. ValidationPipe global con mensajes en español (`common/validacion.ts`). |
| PDF | `pdfkit` (`backend/src/documentos/pdf.service.ts`) |
| Correo | Resend en producción, o SMTP (Mailpit en desarrollo) |
| IA | Asistente con la API de Anthropic (`@anthropic-ai/sdk`), solo lectura, con límite diario por plan |
| Despliegue | Docker Compose (`docker-compose.prod.yml`) detrás del nginx del servidor |

## Estructura

```
backend/src/
  entities/index.ts      Todas las entidades TypeORM (ENTIDADES)
  common/                sesión y roles, bitácora, validación en español, interceptor que oculta costos
  auth/ cuenta/          registro, entrar, perfil (/auth/yo), activación, recuperación, recorrido, eliminar cuenta
  organizacion/          taller, sucursales (incluye datos de pago), usuarios, datos de ejemplo
  catalogo/              productos con receta, existencias, clientes, promociones, compras
  documentos/            cotizaciones, ventas, pagos, PDF y texto de WhatsApp
  caja/                  turnos de caja, entradas y salidas, corte, eliminar cortes
  produccion/            tablero del taller (etapas), máquinas, avance por pieza
  fotos/                 fotos de trabajos terminados (archivos en FOTOS_DIR)
  estadisticas/          reportes
  asistente/             asistente con IA
  publico/               salud, cotizador de la landing, PDF por enlace público
frontend/src/app/
  core/                  servicios (api, sesión, avisos, validación, fotos, ticket...) y modelos.ts
  pages/                 una pantalla por módulo (caja, doc-lista/doc-editor, produccion, inventario...)
  ui/                    piezas reutilizables (hoja = modal, buscador, vista-documento, alta-rapida...)
  shell.ts               menú, barra superior y bienvenida
docs/                    esta guía, producción y marca
deploy/                  nginx y Caddy de ejemplo
scripts/smoke.mjs        prueba de punta a punta de la API
```

## Reglas del negocio

### Multitaller, sucursales y roles
- Cada **taller** es un cliente que paga. Toda consulta filtra por `tallerId`.
- Folios, inventario, ventas y caja son **por sucursal**. El frontend manda el encabezado `X-Sucursal`. Dueño y administrador pueden ver "todas", pero para registrar se pide una sucursal.
- Roles (`common/sesion.ts`):
  - `GERENCIA` = dueño y administrador.
  - `VEN_COSTOS` = gerencia + encargado.
  - `VENTA` = VEN_COSTOS + vendedor.
  - `produccion` solo ve el tablero del taller y no ve importes.
- Vendedor y producción **no ven costos ni ganancias**: `CostosInterceptor` los quita de las respuestas.
- Las acciones importantes (eliminar, cambiar etapa, borrar cortes, fotos) se anotan en la **bitácora**.

### Costos e inventario
- Un producto puede tener **receta** de insumos. Costo por pieza = insumos + minutos de máquina × costo por minuto del taller + otros costos.
- Al vender se descuentan los insumos y al cancelar o eliminar se devuelven (`movimientos_inventario`). Las compras recalculan el costo promedio ponderado.

### Ventas, cotizaciones y cobro
- Una cotización se convierte en venta. La venta tiene anticipo, pagos (se permite pago combinado) y saldo.
- Por **sucursal** se configuran banco, titular, CLABE, cuenta, tarjeta, indicaciones de pago, **% de anticipo para iniciar** y **condiciones de venta**. Se capturan en Ajustes. Mientras haya saldo aparecen en el PDF, en la vista previa y en WhatsApp.
- WhatsApp se abre con enlaces `wa.me`, sin API. El texto va **compacto**, sin renglones vacíos y sin emoji (llegaban como �). Si la venta está liquidada dice "Pagado en su totalidad", sin "Saldo: $0.00". El enlace dice "Ver nota" o "Ver cotización". Las condiciones no se repiten en el mensaje porque ya van en la nota.

### Caja
- Turnos con fondo inicial, entradas y salidas y corte con conteo por denominación.
- Gerencia puede **eliminar un corte cerrado** si da un motivo. Los cobros no se borran: solo se desligan del turno. Con la caja abierta se puede borrar una entrada o salida capturada por error.

### Producción
- Etapas del taller: `diseno → aprobacion → cola → maquina → acabado → lista`. Cada etapa corresponde a un `EstadoVenta` (pendiente, produccion, lista).
- Cada pedido puede tener máquina (Láser, Sublimación y Plancha se crean solas), responsable, marca de urgente y avance por pieza (`VentaItem.hechos`).
- **Fotos del trabajo** por pedido. Se toman desde la orden o desde la vista previa de la venta. Cada producto o servicio muestra la galería "Trabajos hechos" en Inventario. Los archivos se guardan en `FOTOS_DIR` (`/opt/grabix/fotos` en el servidor; respaldarla) y solo se descargan con sesión.

## Convenciones de interfaz (preferencias del dueño)

- **Formularios en modales** (`ui/hoja.ts`). Los modales **no se cierran al tocar afuera**, solo con ×, Cancelar o Esc. Esc cierra solo el de más arriba.
- Al pulsar el botón principal (`.btn.pri`), el modal valida los campos. El atributo `sin-validar` evita esa validación. Los campos obligatorios llevan `required` y `name` para que se marquen con asterisco y muestren el error en español debajo.
- Encabezado igual en todos los módulos: `.titulo` + `.icono-modulo` (fondo azul marino, icono verde).
- Selectores con buscador (`ui/buscador.ts`). La opción `crear` permite **dar de alta ahí mismo** (cliente, producto o servicio, promoción) sin salir del documento.
- Indicador de carga: la G del logo cortándose con el láser (`ui/logo-carga.ts`). No usar barras de progreso.
- Tiene que verse bien en **teléfono** y en escritorio, en tema claro u oscuro.
- Textos positivos y sencillos. Evitar frases que suenen a IA o a marketing agresivo, y evitar etiquetas tipo "eyebrow" en la landing.
- Colores Elikar: azul marino `#002150` y verde `#67BE28`. Fuente Plus Jakarta Sans.

## Desarrollo

- Ver el README. `DB_SYNC=true` crea las tablas y columnas nuevas, también en producción por ahora. Pendiente: migrar a migraciones.
- Para registrar algo hace falta `X-Sucursal` en las peticiones.
- No subir secretos. `.env`, `.env.produccion` y `*.local.env` están en `.gitignore`. En `.gitignore` las carpetas de datos se anclan a la raíz (`/fotos/`, no `fotos/`): una regla sin `/` una vez ocultó `backend/src/fotos` y rompió un despliegue.

## Producción

Corre en el VPS Contabo del dueño, que es compartido con otros proyectos de Elikar (SiloPro, FincaPro, etc.; **no tocarlos**). Está en `/opt/grabix`, con el proyecto compose `grabix` y la web en `127.0.0.1:8081` detrás del nginx del servidor con Let's Encrypt. Para desplegar:

```bash
cd /opt/grabix && git pull && docker compose -p grabix -f docker-compose.prod.yml --env-file .env.produccion up -d --build
```

Luego verificar `https://app.grabix.elikarsystems.com/api/publico/salud`. Más detalles en [`PRODUCCION.md`](PRODUCCION.md).

## Pendientes conocidos

- Proveedor de pagos para la suscripción (Stripe o Mercado Pago). Hoy funciona en modo demostración.
- Unir la rama `mejoras-interfaz-seguridad` (PR #1) a `main` y desplegar desde `main`.
- Migraciones de TypeORM en lugar de `DB_SYNC`.
- Producción fase 2: aprobación de diseño por enlace público, tiempos reales y pantalla del taller con QR.
- `RESEND_API_KEY` en producción para los correos.
