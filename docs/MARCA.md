# Marca de Grabix

Grabix es un producto de **Elikar Systems**. Hereda los colores de Elikar (los mismos que SiloPro) y usa tipografías de Google Fonts.

## Logo

| Archivo | Uso |
|---|---|
| `frontend/public/logo.svg` | Logo maestro (vector). |
| `frontend/public/favicon.svg` | Ícono de la pestaña. |
| `frontend/public/icono-180.png`, `icono-192.png`, `icono-512.png` | iPhone/Android y la cabecera de los correos. |
| `frontend/src/app/ui/logo.ts` | Componente `<app-logo>` para usarlo dentro de la app. |

**Isotipo:** cuadro azul marino redondeado con una **"G" blanca** que un **rayo láser verde** está cortando. El rayo baja hasta la punta de la G, donde está el punto de corte. Así se cuenta en un solo dibujo qué hace el sistema: corte y grabado láser.

**Logotipo:** "Grabix" en Montserrat ExtraBold (800), con un interletrado ligeramente cerrado (-1 %).

Reglas:
- Deja alrededor del isotipo un espacio libre de al menos ¼ de su ancho.
- Tamaño mínimo: 16 px de pantalla (favicon) o 8 mm impreso.
- No cambies los colores del isotipo ni lo pongas sobre fondos azules parecidos. En modo oscuro lleva un borde blanco al 22 % para que se separe del fondo.

## Colores

Son provisionales hasta que Elikar entregue su paleta oficial. Se cambian solo en el bloque `:root` de `frontend/src/styles.css`.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `marca` | `#002150` | `#7AA7FF` | Botón principal, enlaces, selección |
| `acento` | `#67BE28` | `#67BE28` | Rayo del logo, barra de carga, destacados |
| `acento-2` | `#3F7A16` | `#8FD85A` | Verde para texto sobre fondo claro u oscuro |
| `fondo` | `#F2F5F8` | `#0B1220` | Fondo de pantalla |
| `superficie` | `#FFFFFF` | `#121B2C` | Tarjetas, ventanas |
| `tinta` / `tenue` | `#132230` / `#5B6B79` | `#E6EDF5` / `#97A6B8` | Texto principal / secundario |
| `ok` · `warn` · `bad` | `#1F8A4C` · `#9A6A00` · `#B8350F` | `#4CC27F` · `#E3B546` · `#FF8466` | Estados |

## Tipografías

- **Montserrat** (600–800): títulos y logotipo.
- **Inter** (400–600): textos e interfaz.
- **JetBrains Mono** (500): importes, folios y cantidades (cifras tabulares).

## Voz

Se habla de tú, en frases cortas y concretas, en el idioma del taller: "cotización", "pedido", "insumo", "lámina". Los errores dicen qué pasó y qué hacer ("Esa contraseña es muy común, elige otra"), sin códigos técnicos.

## Modo claro y oscuro

La app sigue al dispositivo. El usuario puede fijar el modo claro u oscuro con el botón de la barra superior. Se guarda en el navegador con `grabix.tema` y se aplica con `data-tema` en `<html>`.
