# Super administrador de Grabix

Fecha: 2026-10-28

Panel de Elikar para ver y operar todos los talleres. Vive en `admin.grabix.elikarsystems.com`, con inicio de sesión propio. Desde la ficha de un taller se puede entrar como su dueño, con el mismo control que él, sin salir de ese sitio.

## Decisión

Una sola aplicación (Angular) y una sola API (Nest). El super administrador no es un usuario de ningún taller. Un tercer host distingue el panel del sitio de los clientes.

Otras formas se descartaron: una segunda aplicación obligaría a copiar el sistema para tener el control total, y un rol dentro de un taller rompería el aislamiento por `tallerId`.

## Fuera de alcance

- Cobrar con Stripe o Mercado Pago.
- Borrar un taller desde el panel. Solo se cancela una eliminación que el dueño ya programó. El borrado a los 30 días sigue igual.
- Reportes o exportaciones que mezclen datos de varios talleres.
- Ver o escribir la contraseña de un cliente. Solo se envía el enlace de recuperación que ya existe.

## Sitios

| Host | Qué muestra |
|---|---|
| Dominio de la landing | Landing. Sin cambios. |
| `app.` | Sistema del taller. Sin cambios. |
| `admin.grabix.elikarsystems.com` | Panel. La raíz es el listado. `/entrar` es el acceso. |

En local no hay subdominio: el panel se abre en `http://localhost:4200/admin`. En un host real, si alguien abre rutas de clientes en `admin.` se le manda al listado. Si alguien abre `/admin` en la landing o en `app.`, se le manda a `https://admin.grabix.elikarsystems.com`.

Hoy `enSistema` redirige cualquier host que no empiece por `app.` hacia `app.`. Hay que excluir `admin.` para que no termine en `app.admin…`.

Nginx (`deploy/nginx-grabix.conf`) y Caddy (`deploy/Caddyfile`) publican ese host hacia el mismo contenedor `web`. `CORS_ORIGIN` incluye `https://admin.grabix.elikarsystems.com`. Los enlaces de correo y el PDF siguen usando `PUBLIC_URL` del sitio `app.`.

Publicar el host en el servidor de Contabo es un paso aparte: primero se revisa cómo está el nginx y el DNS, y solo entonces se despliega.

## Datos

`super_admins`: `id`, `nombre`, `email` único, `passwordHash`, `activo`, `claveCambiadaEn`, `creadoEn`. Sin `tallerId`.

`admin_bitacora`: `id`, `superAdminId`, `superAdminNombre`, `tallerId` (nullable), `accion`, `entidad`, `entidadId`, `detalle` (json), `creadoEn`.

`talleres.bloqueado`: booleano, por defecto `false`. Es distinto de la suscripción vencida y de `eliminarEn`.

El primer super administrador se crea al arrancar la API solo si la tabla está vacía y existen `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`. La contraseña cumple las mismas reglas que el resto de cuentas. Si no las cumple, no se crea y queda escrito en el log; la API sigue arrancando. Si ya hay filas, el arranque no toca contraseñas. Desde el panel, un administrador activo puede crear otros. No puede desactivarse a sí mismo ni dejar cero administradores activos.

## Dos tokens

El token de taller sigue siendo `{ sub, t }` y se guarda en `grabix.token`.

**Token de panel.** Claim `tipo: 'superadmin'`. Se guarda en `grabix.admin.token`, solo en el origen de admin. Abre el listado, la ficha y las acciones de suscripción, usuarios y correos. No sirve para cotizar, vender ni llamar rutas de un taller. Un token de taller que llame a `/api/admin` recibe 403.

**Token de soporte.** Se emite al pulsar **Entrar como dueño**. La API arma la sesión del dueño activo de ese taller (`rol: dueno`, su `usuarioId` y su `tallerId`) y le añade `soporteId`. Se guarda en `grabix.token` del origen de admin. Antes de pisarlo, si había otro valor, se aparta en `grabix.token.antes` y al salir se restaura. Así en local no se pierde la sesión de quien estaba probando el sistema.

Con ese token valen las pantallas y las acciones del dueño. El guard no aplica el 402 de suscripción vencida, no exige correo confirmado y no limita las rutas por `eliminarEn`. Si el taller está bloqueado, el equipo no entra; esta sesión sí.

Los dos tokens duran 7 días, igual que el de un taller. Al salir se borra solo el token de soporte y se vuelve al listado. El token de panel sigue válido. Si el de soporte expira, se vuelve al panel; si el de panel también expiró, a `/entrar`.

**Entrar como dueño** exige un usuario con rol dueño y `activo`. Si no hay, la ficha lo dice y no abre el sistema.

## Panel

Listado con búsqueda por nombre del taller, correo del taller o correo del dueño. Cada renglón muestra nombre, correo del dueño, plan, estado de suscripción, vencimiento, si está bloqueado y la fecha de alta.

La ficha de un taller tiene cuatro bloques:

- **Datos.** Nombre, teléfono, correo y dirección.
- **Suscripción.** Plan (Taller, Pro, Empresa), estado (`prueba`, `activa`, `vencida`, `cancelada`) y cancelar una eliminación programada (`eliminarEn` vuelve a null). Alargar suma los días indicados a `pruebaHasta` si el estado es `prueba`, y a `pagadoHasta` en cualquier otro estado. Renovar 30 o 365 días deja el plan elegido, el estado `activa` y `pagadoHasta` contado desde hoy o desde la fecha ya pagada si esa es posterior. Estas acciones no dependen de `PAGOS_MODO`.
- **Usuarios.** Nombre, correo, rol, sucursal, activo y correo confirmado. Se editan nombre, correo, rol, sucursal y activo. Se reenvía la invitación o la confirmación, y se envía el enlace de recuperación. El reenvío respeta la espera de un minuto que ya tienen los tokens.
- **Correos.** Filas de `correos_log` de los correos de esos usuarios: tipo, estado (`enviado`, `fallido`, `simulado`), fecha y error.

Bloquear el taller pone `bloqueado`. El login del equipo responde que la cuenta está suspendida. Reactivar lo quita. El dueño, con la cuenta bloqueada, tampoco entra por `app.`.

## Rastro

Cada acción del panel (editar datos, cambiar plan o plazo, bloquear, cancelar eliminación, editar usuario, reenviar correo, entrar y salir del modo soporte) se guarda en `admin_bitacora` con el super administrador real.

Lo que se hace ya dentro del taller pasa por la bitácora del negocio. `usuarioNombre` queda como `Soporte Grabix` y `usuarioId` en null, para que el dueño vea que no fue alguien de su equipo. El `soporteId` va en el detalle. El nombre real solo está en `admin_bitacora`.

## Errores

- Correo o contraseña de admin incorrectos: el mismo mensaje genérico que el login del taller.
- Correo de usuario ya usado al editar: se rechaza.
- Reenvío antes de un minuto: 429, con el texto que ya usa el sistema.
- Taller sin dueño activo: no se emite token de soporte.
- Super administrador inactivo: no entra, y un token ya emitido deja de valer.

## Pruebas

En la API:

- Un token de taller no abre `/api/admin`.
- El token de panel no crea una venta.
- Bloquear un taller impide el login del dueño y del equipo.
- El token de soporte entra a un taller bloqueado, vencido o con eliminación programada, y puede registrar.
- Entrar sin dueño activo no emite token.
- La bitácora del taller anota `Soporte Grabix` y `admin_bitacora` anota a la persona.
- No se puede desactivar al último super administrador ni a uno mismo.

En la app, con el host de admin (o `/admin` en local): login, listado, ficha, entrar como dueño, barra de soporte y volver al listado sin perder la sesión de admin.
