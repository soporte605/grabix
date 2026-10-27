// Prueba rápida de punta a punta contra la API: node scripts/smoke.mjs [http://localhost:3000/api]
const API = process.argv[2] ?? 'http://localhost:3000/api';
let token = '';
let sucursal = '';
async function api(method, path, body, t = token) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(sucursal ? { 'X-Sucursal': sucursal } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = r.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await r.json() : await r.arrayBuffer();
  return { status: r.status, data };
}
const ok = (c, m) => { if (!c) { console.error('✗', m); process.exitCode = 1; } else console.log('✓', m); };

const email = `dueno${Date.now()}@ejemplo.com`;
let r = await api('POST', '/auth/registro', { taller: 'Taller de prueba', nombre: 'Dueño', email, password: 'secreto123', conEjemplos: true });
ok(r.status === 201 && r.data.token, 'registro con datos de ejemplo');
token = r.data.token;
sucursal = String(r.data.sucursales[0].id);
ok(r.data.suscripcion.vigente && r.data.suscripcion.estado === 'prueba', 'prueba gratuita vigente');

r = await api('GET', '/productos');
const prods = r.data;
const taza = prods.find((p) => p.nombre.startsWith('Taza sublimada'));
const tazaBlanca = prods.find((p) => p.nombre.startsWith('Taza blanca'));
ok(taza && taza.costoUnitario === 54.5, `costo de taza sublimada con receta = ${taza?.costoUnitario}`);
const stock0 = tazaBlanca.existencia;

r = await api('GET', '/estadisticas');
ok(r.status === 200 && r.data.serie.length === 12, `estadísticas: ventas del mes ${r.data.ventas}, por cobrar ${r.data.porCobrar}`);

r = await api('POST', '/cotizaciones', { clienteNombre: 'Cliente mostrador', clienteTelefono: '5511112222', items: [{ productoId: taza.id, descripcion: '', cantidad: 10, precio: 115 }], descuentoTipo: 'pct', descuentoValor: 10 });
ok(r.status === 201 && r.data.total === 1035, `cotización ${r.data.folio} total ${r.data.total}`);
const cot = r.data;

r = await api('POST', `/cotizaciones/${cot.id}/whatsapp`);
ok(r.data.url?.startsWith('https://wa.me/525511112222'), 'liga de WhatsApp con lada');
const pdfUrl = r.data.texto.match(/PDF: (\S+)/)[1];
const pub = await fetch(pdfUrl.replace(/^https?:\/\/[^/]+\/api/, API));
ok(pub.status === 200 && pub.headers.get('content-type') === 'application/pdf', 'PDF público por token');

r = await api('POST', `/cotizaciones/${cot.id}/convertir`);
ok(r.status === 201 && r.data.folio.startsWith('VTA-'), `convertida en venta ${r.data.folio}`);
const venta = r.data;
r = await api('GET', '/productos');
ok(r.data.find((p) => p.id === tazaBlanca.id).existencia === stock0 - 10, 'la venta descontó 10 tazas blancas de la receta');

r = await api('POST', `/ventas/${venta.id}/pagos`, { monto: 500, metodo: 'Transferencia' });
ok(r.data.saldo === 535, `pago registrado, saldo ${r.data.saldo}`);
r = await api('PATCH', `/ventas/${venta.id}/estado`, { estado: 'cancelada' });
r = await api('GET', '/productos');
ok(r.data.find((p) => p.id === tazaBlanca.id).existencia === stock0, 'cancelar devolvió el inventario');

r = await api('POST', '/compras', { proveedor: 'Proveedor', items: [{ productoId: tazaBlanca.id, descripcion: '', cantidad: 36, costo: 34 }] });
ok(r.status === 201, `compra ${r.data.folio}`);
r = await api('GET', '/productos');
const tb = r.data.find((p) => p.id === tazaBlanca.id);
ok(tb.existencia === stock0 + 36 && tb.costo === 31, `existencia ${tb.existencia} y costo promedio ${tb.costo}`);

r = await api('POST', '/sucursales', { nombre: 'Sucursal Centro' });
ok(r.status === 201, 'segunda sucursal');
const suc2 = r.data.id;
r = await api('POST', '/inventario/traspasos', { destinoId: suc2, items: [{ productoId: tazaBlanca.id, cantidad: 6 }] });
ok(r.status === 201, 'traspaso de 6 tazas a Sucursal Centro');

r = await api('POST', '/usuarios', { nombre: 'Vendedor', email: 'v' + email, password: 'secreto123', rol: 'vendedor', sucursalId: suc2 });
ok(r.status === 201, 'usuario vendedor en Sucursal Centro');
const lv = await api('POST', '/auth/login', { email: 'v' + email, password: 'secreto123' }, '');
const tv = lv.data.token;
const sucGuardada = sucursal;
sucursal = '';
r = await api('GET', '/productos', null, tv);
const tbV = r.data.find((p) => p.id === tazaBlanca.id);
ok(tbV.costo === undefined && tbV.costoUnitario === undefined && tbV.existencia === 6, 'el vendedor no ve costos y solo ve su sucursal');
r = await api('GET', '/compras', null, tv);
ok(r.status === 403, 'el vendedor no puede ver compras');
r = await api('GET', '/estadisticas', null, tv);
ok(r.status === 403, 'el vendedor no ve estadísticas');
sucursal = sucGuardada;

r = await api('GET', '/bitacora');
ok(r.data.length > 5, `bitácora con ${r.data.length} registros`);
