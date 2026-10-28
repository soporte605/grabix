export type Rol = 'dueno' | 'admin' | 'encargado' | 'vendedor' | 'produccion';
export type TipoProducto = 'producto' | 'insumo' | 'servicio';
export type EstadoCotizacion = 'borrador' | 'enviada' | 'aceptada' | 'rechazada';
export type EstadoVenta = 'pendiente' | 'produccion' | 'lista' | 'entregada' | 'cancelada';

export interface Taller {
  id: number; nombre: string; telefono: string; email: string; direccion: string; moneda: string; lada: string;
  tarifaMinuto: number; margenObjetivo: number; vigenciaDias: number; notasCotizacion: string | null;
  plan: string; estadoSuscripcion: string; pruebaHasta: string | null; pagadoHasta: string | null; eliminarEn?: string | null;
}
export interface Sucursal { id: number; nombre: string; direccion: string; telefono: string; activa: boolean }
export interface Usuario { id: number; nombre: string; email: string; rol: Rol; sucursalId: number | null; activo?: boolean; emailVerificado?: boolean; recorridoVisto?: boolean }
export interface Plan { id: string; nombre: string; precioMensual: number; precioAnual: number; sucursales: number; usuarios: number; incluye: string[] }
export interface Suscripcion {
  plan: string; estado: string; vigente: boolean; vence: string | null; diasRestantes: number | null;
  limites: { sucursales: number; usuarios: number }; planes: Plan[];
}
export interface Perfil { usuario: Usuario; taller: Taller; sucursales: Sucursal[]; suscripcion: Suscripcion }

export interface Componente { insumoId: number; cantidad: number }
export interface Producto {
  id: number; nombre: string; tipo: TipoProducto; categoria: string; unidad: string; costo?: number; precio: number;
  minutos: number; extra: number; activo: boolean; componentes: Componente[]; costoUnitario?: number; margen?: number | null;
  existencia: number; minimo: number; controlaStock: boolean;
}
export interface Cliente { id: number; nombre: string; telefono: string; email: string; empresa: string; notas: string | null; pedidos?: number; comprado?: number }
export interface Promocion { id: number; nombre: string; tipo: 'pct' | 'monto'; valor: number; inicio: string | null; fin: string | null; activa: boolean; mensaje: string | null }
export interface Renglon { id?: number; productoId: number | null; descripcion: string; cantidad: number; precio: number; costo?: number }
export interface Pago { id: number; fecha: string; monto: number; metodo: string }
export interface Documento {
  id: number; sucursalId: number; folio: string; fecha: string; clienteId: number | null; cliente?: Cliente | null;
  clienteNombre: string; clienteTelefono: string; descuentoTipo: 'pct' | 'monto'; descuentoValor: number; promocionId: number | null;
  notas: string | null; subtotal: number; descuento: number; total: number; costo?: number; items: Renglon[]; tokenPublico?: string;
}
export interface Cotizacion extends Documento { estado: EstadoCotizacion; vigenciaDias: number }
export interface Venta extends Documento { estado: EstadoVenta; entrega: string | null; pagado: number; saldo: number; pagos: Pago[]; cotizacionId: number | null }
export interface CompraItem { productoId: number | null; descripcion: string; cantidad: number; costo: number }
export interface Compra { id: number; folio: string; fecha: string; proveedor: string; notas: string | null; total: number; items: CompraItem[] }
export interface Estadisticas {
  desde: string; hasta: string; ventas: number; pedidos: number; ticketPromedio: number; costo: number; ganancia: number; margen: number | null;
  cobrado: number; porCobrar: number; compras: number; cotizaciones: { total: number; aceptadas: number; abiertas: number };
  ventasAnterior: number; hoy: { ventas: number; pedidos: number }; atrasados: number; clientesNuevos: number;
  serie: { mes: string; ventas: number; ganancia: number; pedidos: number }[];
  top: { descripcion: string; cantidad: number; ventas: number; ganancia: number }[];
  pendientes: { id: number; folio: string; cliente: string; entrega: string | null; estado: EstadoVenta; total: number; saldo: number }[];
  stockBajo: { id: number; nombre: string; unidad: string; existencia: number; minimo: number }[];
}
export interface Bitacora { id: number; usuarioNombre: string; accion: string; entidad: string; entidadId: number | null; detalle: unknown; creadoEn: string }

export const ROLES: Record<Rol, { nombre: string; desc: string }> = {
  dueno: { nombre: 'Dueño', desc: 'Todo, incluida la suscripción' },
  admin: { nombre: 'Administrador', desc: 'Todas las sucursales, sin pagos de suscripción' },
  encargado: { nombre: 'Encargado de sucursal', desc: 'Su sucursal: inventario, compras y reportes' },
  vendedor: { nombre: 'Vendedor', desc: 'Cotiza, vende y cobra; no ve costos ni ganancias' },
  produccion: { nombre: 'Producción', desc: 'Ve pedidos por hacer y cambia su estado' },
};
export const EST_COT: Record<EstadoCotizacion, [string, string]> = {
  borrador: ['Borrador', 'mut'], enviada: ['Enviada', 'acc'], aceptada: ['Aceptada', 'ok'], rechazada: ['Rechazada', 'bad'],
};
export const EST_VTA: Record<EstadoVenta, [string, string]> = {
  pendiente: ['Pendiente', 'warn'], produccion: ['En producción', 'sec'], lista: ['Lista para entregar', 'acc'], entregada: ['Entregada', 'ok'], cancelada: ['Cancelada', 'bad'],
};
export const TIPOS: Record<TipoProducto, string> = { producto: 'Producto', insumo: 'Insumo', servicio: 'Servicio' };
