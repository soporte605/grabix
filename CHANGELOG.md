# Changelog

Cambios de Grabix, del más reciente al más antiguo. Entre paréntesis va el commit, en la rama `mejoras-interfaz-seguridad` (PR #1). El contexto del proyecto está en [`docs/PROYECTO.md`](docs/PROYECTO.md).

## 2026-10-30

### Sugerir con IA al dar de alta un artículo
- En Inventario → Nuevo artículo, el botón **Sugerir con IA** propone tipo, línea, unidad, minutos de máquina, otros costos, la receta con insumos que ya existen y el precio de venta, con una nota de cómo lo calculó y el rango que se cobra en el mercado. Se pueden agregar detalles (medidas, material). Los campos quedan llenos para revisarlos; nunca se guarda solo.
- Usa los datos del taller: insumos con su costo, tarifa por minuto, margen objetivo y precios de artículos parecidos. Las recetas solo aceptan ids de insumos reales.
- **En cotizaciones y ventas:** al crear un producto o servicio desde el buscador ("Nuevo producto o servicio") también está el botón; guarda precio, costo, receta y minutos sugeridos. En un concepto libre, el botón con la chispa junto al precio propone el precio por pieza y deja debajo del renglón la explicación, el rango de mercado y el costo estimado (no sale en el PDF).
- `POST /api/asistente/sugerir-producto`, solo para roles que ven costos. Cuenta como una consulta del límite diario del asistente.

### Logo por sucursal e imágenes en cotizaciones
- **Logo:** en Ajustes → "Logo, cobro y condiciones por sucursal" se sube el logo (PNG, JPG o SVG; se guarda como PNG). Sale en el encabezado del PDF de notas y cotizaciones, en el enlace del cliente y como vista previa de WhatsApp cuando no hay otra imagen. Se puede usar el mismo en todas las sucursales.
- **Imágenes en la cotización:** hasta 8 por cotización, cada una con nota (el diseño sobre la taza, un boceto, un trabajo parecido). Se suben desde el editor o la vista previa. El cliente las ve en su enlace ("Así quedaría tu pedido"), la primera sale en la vista previa de WhatsApp y todas van al final del PDF en "Imágenes de referencia". Al convertirla en venta se ven en la venta y en la orden de Producción.
- En ventas o cotizaciones sin diseño ni imagen, la vista previa de WhatsApp usa el logo de la sucursal.

### Enlace del pedido para el cliente
- Cada venta y cotización tiene un enlace `/p/:token` que se manda por WhatsApp. El cliente ve su nota o cotización, el avance del pedido (Recibido, Diseño, En producción, Listo, Entregado), las fotos del trabajo terminado, los datos para transferir y el PDF, sin crear cuenta.
- **Aprobación de diseño:** el taller sube la prueba (JPG, PNG o SVG) desde Producción o la vista previa de la venta y la manda por WhatsApp. La imagen sale en la vista previa del enlace dentro del chat (etiquetas Open Graph con un JPEG ligero). El cliente aprueba o pide cambios en el enlace, o contesta "sí" y el taller lo registra con "Ya lo aprobó". Queda quién, cuándo y por qué medio. Subir un diseño pasa el pedido a "Esperando aprobación"; aprobarlo, a "En cola"; pedir cambios, a "Por diseñar".
- **Comprobantes:** el cliente sube la foto de su transferencia en el enlace. El taller la revisa en la vista previa de la venta y con "Ya llegó, registrar" se anota el pago como transferencia.
- **Cotizaciones:** el cliente puede aceptarlas desde el enlace (queda en la bitácora).
- El tablero de Producción marca "Diseño enviado", "Diseño aprobado", "Pidió cambios" y "Comprobante por revisar". El WhatsApp de "pedido listo" incluye el enlace.

## 2026-10-28 (panel)

### Super administrador
- Bitácora del panel y de los talleres, y accesos (intentos de entrar al panel y a los talleres, con IP y motivo, sin guardar la contraseña).
- Cuenta local del panel documentada en el README: `local-panel@grabix.test`. No es la de producción.
- Si ya habías entrado, abrir de nuevo el sistema se quedaba en blanco (NG0203). Ya entra directo al taller.

## 2026-10-28 (tarde)

### WhatsApp y cobro
- El mensaje de WhatsApp va compacto, sin renglones vacíos (14dc90c).
- El mensaje ya no repite las condiciones, porque van en la nota. El enlace dice "Ver nota" o "Ver cotización" en lugar de "PDF". Si la venta está liquidada dice "Pagado en su totalidad" y no muestra "Saldo: $0.00" (88bb881).
- Datos de cobro **por sucursal**: banco, titular, CLABE, cuenta, tarjeta, indicaciones de pago, % de anticipo para iniciar y condiciones de venta. Se capturan en Ajustes con vista previa. Aparecen en el PDF (recuadro "Datos para transferencia o depósito" y fila "Anticipo para iniciar" o "Falta para iniciar"), en WhatsApp y en la vista previa, con botones para copiar (254ef1e).

### Captura más rápida
- "+ Nuevo" dentro de los buscadores para dar de alta un cliente o un producto o servicio sin salir de la cotización o la venta. "+ Nueva" para crear una promoción y aplicarla. En Caja, cliente nuevo (bc0fb42).
- Los modales ya no se cierran al tocar afuera (bc0fb42).

### Fotos de trabajos
- Fotos del trabajo terminado por pedido, desde la orden en Producción o desde la vista previa de la venta. Se pueden tomar con la cámara o elegir de la galería. Se reducen en el teléfono antes de subirse y se ven en un visor con flechas o deslizando (3178751, bc0fb42).
- En Inventario, cada producto o servicio tiene la galería "Trabajos hechos" con las fotos de todos los pedidos que lo incluyeron.
- Se guardan en `FOTOS_DIR` (`./fotos` en el servidor) y solo se descargan con sesión.

### Caja
- Gerencia puede eliminar un corte de caja cerrado si escribe el motivo, que queda en la bitácora. Los cobros se conservan y solo se desligan del corte. Con la caja abierta se puede borrar una entrada o salida capturada por error (77ba8ab).

## 2026-10-28 (mañana)

### Producción
- Fase 1 del tablero: etapas (Por diseñar, Esperando aprobación, En cola, En máquina, Acabado y empaque, Listo para entregar), máquinas, responsable, urgentes, avance por pieza, minutos de máquina pendientes, indicadores, filtros, arrastrar y soltar en escritorio, pestañas en el teléfono y aviso de "pedido listo" por WhatsApp (c6c6a72).
- La orden se ve en una ventana (PDF, imprimir, WhatsApp) y se puede cancelar el pedido (abba5c7).

### Interfaz
- Vista previa de ventas y cotizaciones en una ventana (015875b).
- Encabezado igual en todos los módulos: icono, título y contexto (9123ec4).
- Indicador de carga: la G del logo cortándose con el láser, arriba al centro y en la pantalla de arranque (e0e3f5f, 459d64d).
- Validación de formularios: obligatorios marcados y errores en español bajo cada campo, tanto del navegador como del servidor (e20cba7).
- Tipografía unificada: una sola fuente y escala de tamaños (63a5e26).
- Promociones: el listado dice si está vigente, pausada, cuándo empieza o si terminó (2160b54).

### Caja y reportes
- Turnos de caja con apertura, entradas y salidas, corte con conteo por denominación y reportes de ventas (2861c7e, ff821bf).
- Pago combinado (efectivo, tarjeta y transferencia en una misma venta) (1e6d708).

### Otros
- WhatsApp a clientes con mensajes listos según lo que tienen pendiente (4086bfb).
- Bienvenida con recorrido guiado. Eliminación de cuenta con 30 días para arrepentirse (1f9d2ae).
- Listados con acciones rápidas y paginación (d6942bc).
- Inicio con saludo, animación del láser e indicadores (d863e11).
- PDF rediseñado con estilo sobrio de factura (5d7072d, 75a81c8).
- Producción en el VPS Contabo: landing y sistema en dominios separados, nginx del servidor y respaldos diarios de la base (8ec8024, 21f0261, abe9b6f).

## 2026-10-27

- Caja: punto de venta de mostrador con pantalla completa y atajos (0a7675c, 9728a12).
- Punto de venta, selectores con buscador, filtros por fecha y límite del cotizador de la landing (4fafa7a).
- Ventas y cotizaciones se abren en un modal sobre la lista (c4189a8).
- Asistente con IA por sucursal y rol, de solo lectura y con límite diario por plan (b6a1f3e).
- Landing nueva: cotizador, envío por WhatsApp, vista del sistema, cómo funciona y preguntas frecuentes (b1cc38e, 86aba48, ecb4c38).
- Selector de tema claro, oscuro o del sistema. Pantallas de entrar y crear cuenta rediseñadas, menú lateral colapsable y fuente Plus Jakarta Sans (f8a14a9).
- Seguridad de contraseñas, logo, modo oscuro, avisos, skeletons y confirmaciones (cac6b87).
- Diseño migrado a Tailwind CSS v4 (4e1caec, 08ef0eb).
- Correos de cuenta: activación, recuperación de contraseña e invitaciones (2f325f7).
- Base: API NestJS con talleres, sucursales, roles, inventario con recetas, cotizaciones, ventas, compras, PDF y estadísticas. Frontend Angular y Docker Compose (6f23960, 40b32bd).
