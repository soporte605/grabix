import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** MySQL devuelve DECIMAL como string; lo convertimos a number. */
const dec = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v == null ? 0 : parseFloat(v)),
};
const money = { type: 'decimal' as const, precision: 14, scale: 2, default: 0, transformer: dec };
const qty = { type: 'decimal' as const, precision: 14, scale: 4, default: 0, transformer: dec };

export enum Rol {
  Dueno = 'dueno',
  Admin = 'admin',
  Encargado = 'encargado',
  Vendedor = 'vendedor',
  Produccion = 'produccion',
}

export enum EstadoSuscripcion {
  Prueba = 'prueba',
  Activa = 'activa',
  Vencida = 'vencida',
  Cancelada = 'cancelada',
}

export enum TipoProducto {
  Producto = 'producto',
  Insumo = 'insumo',
  Servicio = 'servicio',
}

export enum EstadoCotizacion {
  Borrador = 'borrador',
  Enviada = 'enviada',
  Aceptada = 'aceptada',
  Rechazada = 'rechazada',
}

export enum EstadoVenta {
  Pendiente = 'pendiente',
  Produccion = 'produccion',
  Lista = 'lista',
  Entregada = 'entregada',
  Cancelada = 'cancelada',
}

@Entity('talleres')
export class Taller {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 120 }) nombre: string;
  @Column({ length: 40, default: '' }) telefono: string;
  @Column({ length: 120, default: '' }) email: string;
  @Column({ length: 255, default: '' }) direccion: string;
  @Column({ length: 8, default: '$' }) moneda: string;
  @Column({ length: 4, default: '52' }) lada: string;
  /** Costo de máquina por minuto (luz, desgaste de tubo y lentes, mano de obra). */
  @Column(money) tarifaMinuto: number;
  @Column({ type: 'int', default: 60 }) margenObjetivo: number;
  @Column({ type: 'int', default: 15 }) vigenciaDias: number;
  @Column({ type: 'text', nullable: true }) notasCotizacion: string | null;
  @Column({ length: 20, default: 'prueba' }) plan: string;
  @Column({ type: 'enum', enum: EstadoSuscripcion, default: EstadoSuscripcion.Prueba })
  estadoSuscripcion: EstadoSuscripcion;
  @Column({ type: 'date', nullable: true }) pruebaHasta: string | null;
  @Column({ type: 'date', nullable: true }) pagadoHasta: string | null;
  /** Eliminación solicitada por el dueño: ese día se borran todos los datos del taller. Mientras, la cuenta queda bloqueada. */
  @Column({ type: 'date', nullable: true }) eliminarEn: string | null;
  /** Suspensión manual desde el panel. El equipo no puede entrar ni seguir con una sesión abierta; el acceso de soporte sí. */
  @Column({ default: false }) bloqueado: boolean;
  @CreateDateColumn() creadoEn: Date;
}

@Entity('sucursales')
export class Sucursal {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column({ length: 120 }) nombre: string;
  @Column({ length: 255, default: '' }) direccion: string;
  @Column({ length: 40, default: '' }) telefono: string;
  @Column({ default: true }) activa: boolean;
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column({ length: 120 }) nombre: string;
  @Index({ unique: true }) @Column({ length: 160 }) email: string;
  @Column({ length: 100, select: false }) passwordHash: string;
  @Column({ type: 'enum', enum: Rol, default: Rol.Vendedor }) rol: Rol;
  /** null = acceso a todas las sucursales. */
  @Column({ type: 'int', nullable: true }) sucursalId: number | null;
  @Column({ default: true }) activo: boolean;
  /** Se confirma con el enlace de activación o al aceptar una invitación. */
  @Column({ default: false }) emailVerificado: boolean;
  /** Las sesiones emitidas antes de esta fecha dejan de valer (cambio o restablecimiento de contraseña). */
  @Column({ type: 'datetime', precision: 3, nullable: true }) claveCambiadaEn: Date | null;
  /** Ya vio (o se saltó) la bienvenida con el recorrido guiado. */
  @Column({ default: false }) recorridoVisto: boolean;
  @CreateDateColumn() creadoEn: Date;
}

/** Enlaces de un solo uso enviados por correo. Se guarda solo el hash del token. */
@Entity('tokens_cuenta')
export class TokenCuenta {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() usuarioId: number;
  /** activacion | recuperacion | invitacion */
  @Column({ length: 20 }) tipo: string;
  @Index({ unique: true }) @Column({ length: 64 }) hash: string;
  @Column({ type: 'datetime' }) expira: Date;
  @Column({ type: 'datetime', nullable: true }) usado: Date | null;
  @CreateDateColumn() creadoEn: Date;
}

/** Registro de cada correo que sale (o falla) para poder revisar entregas. */
@Entity('correos_log')
export class CorreoLog {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ length: 160 }) para: string;
  @Column({ length: 200 }) asunto: string;
  /** activacion | recuperacion | invitacion | contrasena_cambiada */
  @Column({ length: 30 }) tipo: string;
  /** enviado | fallido | simulado (sin proveedor configurado) */
  @Column({ length: 12 }) estado: string;
  @Column({ length: 12 }) proveedor: string;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn() creadoEn: Date;
}

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column({ length: 160 }) nombre: string;
  @Column({ type: 'enum', enum: TipoProducto, default: TipoProducto.Producto }) tipo: TipoProducto;
  @Column({ length: 60, default: 'Sublimación' }) categoria: string;
  @Column({ length: 20, default: 'pza' }) unidad: string;
  /** Costo de compra (promedio ponderado) para insumos y productos sin receta. */
  @Column(qty) costo: number;
  @Column(money) precio: number;
  /** Minutos de láser o plancha por pieza. */
  @Column(qty) minutos: number;
  /** Otros costos por pieza (empaque, base, etc.). */
  @Column(money) extra: number;
  @Column({ default: true }) activo: boolean;
  @OneToMany(() => ProductoComponente, (c) => c.producto, { cascade: true, eager: true })
  componentes: Relation<ProductoComponente[]>;
}

/** Receta: de qué insumos se arma un producto. */
@Entity('producto_componentes')
export class ProductoComponente {
  @PrimaryGeneratedColumn() id: number;
  @Column() productoId: number;
  @ManyToOne(() => Producto, (p) => p.componentes, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'productoId' })
  producto: Relation<Producto>;
  @Column() insumoId: number;
  @Column(qty) cantidad: number;
}

@Entity('existencias')
@Unique(['productoId', 'sucursalId'])
export class Existencia {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column() productoId: number;
  @Column() sucursalId: number;
  @Column(qty) cantidad: number;
  @Column(qty) minimo: number;
}

@Entity('movimientos_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column() productoId: number;
  @Column() sucursalId: number;
  @Column(qty) cantidad: number;
  /** venta, cancelacion, compra, ajuste, traspaso */
  @Column({ length: 20 }) motivo: string;
  @Column({ length: 40, default: '' }) referencia: string;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;
  @CreateDateColumn() creadoEn: Date;
}

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column({ length: 160 }) nombre: string;
  @Column({ length: 40, default: '' }) telefono: string;
  @Column({ length: 160, default: '' }) email: string;
  @Column({ length: 160, default: '' }) empresa: string;
  @Column({ type: 'text', nullable: true }) notas: string | null;
  @CreateDateColumn() creadoEn: Date;
}

@Entity('promociones')
export class Promocion {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column({ length: 160 }) nombre: string;
  /** pct | monto */
  @Column({ length: 10, default: 'pct' }) tipo: string;
  @Column(money) valor: number;
  @Column({ type: 'date', nullable: true }) inicio: string | null;
  @Column({ type: 'date', nullable: true }) fin: string | null;
  @Column({ default: true }) activa: boolean;
  @Column({ type: 'text', nullable: true }) mensaje: string | null;
}

/** Campos comunes de cotizaciones y ventas. */
abstract class DocumentoVenta {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column() sucursalId: number;
  @Column({ length: 20 }) folio: string;
  @Column({ type: 'date' }) fecha: string;
  @Column({ type: 'int', nullable: true }) clienteId: number | null;
  @ManyToOne(() => Cliente, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clienteId' })
  cliente: Relation<Cliente> | null;
  /** Para clientes de mostrador sin registro. */
  @Column({ length: 160, default: '' }) clienteNombre: string;
  @Column({ length: 40, default: '' }) clienteTelefono: string;
  @Column({ length: 10, default: 'pct' }) descuentoTipo: string;
  @Column(money) descuentoValor: number;
  @Column({ type: 'int', nullable: true }) promocionId: number | null;
  @Column({ type: 'text', nullable: true }) notas: string | null;
  @Column(money) subtotal: number;
  @Column(money) descuento: number;
  @Column(money) total: number;
  /** Costo estimado de lo vendido (no visible para vendedores). */
  @Column(money) costo: number;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;
  @CreateDateColumn() creadoEn: Date;
  @UpdateDateColumn() actualizadoEn: Date;
}

abstract class Renglon {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int', nullable: true }) productoId: number | null;
  @Column({ length: 255 }) descripcion: string;
  @Column(qty) cantidad: number;
  @Column(money) precio: number;
  @Column(qty) costo: number;
}

@Entity('cotizaciones')
@Unique(['tallerId', 'folio'])
export class Cotizacion extends DocumentoVenta {
  @Column({ type: 'enum', enum: EstadoCotizacion, default: EstadoCotizacion.Borrador })
  estado: EstadoCotizacion;
  @Column({ type: 'int', default: 15 }) vigenciaDias: number;
  /** Token para compartir el PDF por WhatsApp sin iniciar sesión. */
  @Index({ unique: true }) @Column({ length: 40 }) tokenPublico: string;
  @OneToMany(() => CotizacionItem, (i) => i.cotizacion, { cascade: true, eager: true })
  items: Relation<CotizacionItem[]>;
}

@Entity('cotizacion_items')
export class CotizacionItem extends Renglon {
  @Column() cotizacionId: number;
  @ManyToOne(() => Cotizacion, (c) => c.items, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'cotizacionId' })
  cotizacion: Relation<Cotizacion>;
}

@Entity('ventas')
@Unique(['tallerId', 'folio'])
export class Venta extends DocumentoVenta {
  @Column({ type: 'enum', enum: EstadoVenta, default: EstadoVenta.Pendiente }) estado: EstadoVenta;
  @Column({ type: 'date', nullable: true }) entrega: string | null;
  @Column(money) pagado: number;
  @Column({ type: 'int', nullable: true }) cotizacionId: number | null;
  @Column({ default: false }) stockAplicado: boolean;
  @Index({ unique: true }) @Column({ length: 40 }) tokenPublico: string;
  @OneToMany(() => VentaItem, (i) => i.venta, { cascade: true, eager: true })
  items: Relation<VentaItem[]>;
  @OneToMany(() => Pago, (p) => p.venta, { cascade: true, eager: true })
  pagos: Relation<Pago[]>;
}

@Entity('venta_items')
export class VentaItem extends Renglon {
  @Column() ventaId: number;
  @ManyToOne(() => Venta, (v) => v.items, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'ventaId' })
  venta: Relation<Venta>;
}

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn() id: number;
  @Column() ventaId: number;
  @ManyToOne(() => Venta, (v) => v.pagos, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'ventaId' })
  venta: Relation<Venta>;
  @Column({ type: 'date' }) fecha: string;
  @Column(money) monto: number;
  @Column({ length: 30, default: 'Efectivo' }) metodo: string;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;
  /** Turno de caja abierto cuando se cobró (para el corte). */
  @Index() @Column({ type: 'int', nullable: true }) turnoId: number | null;
  @CreateDateColumn() creadoEn: Date;
}

@Entity('compras')
@Unique(['tallerId', 'folio'])
export class Compra {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column() sucursalId: number;
  @Column({ length: 20 }) folio: string;
  @Column({ type: 'date' }) fecha: string;
  @Column({ length: 160, default: '' }) proveedor: string;
  @Column({ type: 'text', nullable: true }) notas: string | null;
  @Column(money) total: number;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;
  @OneToMany(() => CompraItem, (i) => i.compra, { cascade: true, eager: true })
  items: Relation<CompraItem[]>;
  @CreateDateColumn() creadoEn: Date;
}

@Entity('compra_items')
export class CompraItem {
  @PrimaryGeneratedColumn() id: number;
  @Column() compraId: number;
  @ManyToOne(() => Compra, (c) => c.items, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'compraId' })
  compra: Relation<Compra>;
  @Column({ type: 'int', nullable: true }) productoId: number | null;
  @Column({ length: 255 }) descripcion: string;
  @Column(qty) cantidad: number;
  @Column(qty) costo: number;
}

/** Consecutivo de folios por taller y tipo de documento. */
@Entity('folios')
@Unique(['tallerId', 'tipo'])
export class Folio {
  @PrimaryGeneratedColumn() id: number;
  @Column() tallerId: number;
  @Column({ length: 10 }) tipo: string;
  @Column({ type: 'int', default: 0 }) ultimo: number;
}

@Entity('bitacora')
export class Bitacora {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;
  @Column({ length: 120, default: '' }) usuarioNombre: string;
  @Column({ length: 40 }) accion: string;
  @Column({ length: 40 }) entidad: string;
  @Column({ type: 'int', nullable: true }) entidadId: number | null;
  @Column({ type: 'json', nullable: true }) detalle: unknown;
  @Index() @CreateDateColumn() creadoEn: Date;
}

/** Uso diario del asistente con IA por taller (para respetar el límite del plan y ver el gasto). */
@Entity('asistente_uso')
@Unique(['tallerId', 'fecha'])
export class AsistenteUso {
  @PrimaryGeneratedColumn() id: number;
  @Column() tallerId: number;
  @Column({ type: 'date' }) fecha: string;
  @Column({ type: 'int', default: 0 }) preguntas: number;
  @Column({ type: 'int', default: 0 }) tokensEntrada: number;
  @Column({ type: 'int', default: 0 }) tokensSalida: number;
}

/** Usos del cotizador público por visitante y día. La IP se guarda cifrada (hash), nunca en claro. */
@Entity('cotizador_uso')
@Unique(['visitante', 'fecha'])
export class CotizadorUso {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 64 }) visitante: string;
  @Column({ type: 'date' }) fecha: string;
  @Column({ type: 'int', default: 0 }) usos: number;
}

export enum EstadoTurno {
  Abierto = 'abierto',
  Cerrado = 'cerrado',
}

/** Resumen guardado al cerrar: no cambia aunque después se editen ventas. */
export interface ResumenTurno {
  porMetodo: Record<string, number>;
  cobrado: number;
  ventas: number;
  entradas: number;
  salidas: number;
  esperado: number;
}

/** Turno de caja: de la apertura (fondo) al corte (efectivo contado y lo que se deja). Uno abierto por sucursal. */
@Entity('caja_turnos')
export class CajaTurno {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Index() @Column() sucursalId: number;
  @Column({ length: 20 }) folio: string;
  @Column({ type: 'enum', enum: EstadoTurno, default: EstadoTurno.Abierto }) estado: EstadoTurno;
  @Column() abrioId: number;
  @Column({ length: 120 }) abrioNombre: string;
  @CreateDateColumn() abiertoEn: Date;
  @Column(money) fondo: number;
  @Column({ type: 'text', nullable: true }) notasApertura: string | null;
  @Column({ type: 'int', nullable: true }) cerroId: number | null;
  @Column({ length: 120, default: '' }) cerroNombre: string;
  @Column({ type: 'datetime', nullable: true }) cerradoEn: Date | null;
  /** Efectivo esperado, contado y diferencia (contado − esperado: + sobra, − falta). */
  @Column(money) esperado: number;
  @Column(money) contado: number;
  @Column(money) diferencia: number;
  /** Lo que se queda en el cajón para el siguiente turno; el resto es retiro. */
  @Column(money) dejado: number;
  @Column(money) retiro: number;
  @Column({ type: 'json', nullable: true }) conteo: Record<string, number> | null;
  @Column({ type: 'json', nullable: true }) resumen: ResumenTurno | null;
  @Column({ type: 'text', nullable: true }) notasCierre: string | null;
}

@Entity('caja_movimientos')
export class CajaMovimiento {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() tallerId: number;
  @Index() @Column() turnoId: number;
  /** entrada | salida */
  @Column({ length: 10 }) tipo: string;
  @Column(money) monto: number;
  @Column({ length: 200 }) concepto: string;
  @Column() usuarioId: number;
  @Column({ length: 120 }) usuarioNombre: string;
  @CreateDateColumn() creadoEn: Date;
}

/** Cuenta del panel de Elikar. No pertenece a ningún taller. */
@Entity('super_admins')
export class SuperAdmin {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 120 }) nombre: string;
  @Index({ unique: true }) @Column({ length: 160 }) email: string;
  @Column({ length: 100, select: false }) passwordHash: string;
  @Column({ default: true }) activo: boolean;
  /** Las sesiones emitidas antes de esta fecha dejan de valer. */
  @Column({ type: 'datetime', precision: 3, nullable: true }) claveCambiadaEn: Date | null;
  @CreateDateColumn() creadoEn: Date;
}

/** Acciones del panel. El nombre real del super administrador solo vive aquí. */
@Entity('admin_bitacora')
export class AdminBitacora {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() superAdminId: number;
  @Column({ length: 120 }) superAdminNombre: string;
  @Column({ type: 'int', nullable: true }) tallerId: number | null;
  @Column({ length: 40 }) accion: string;
  @Column({ length: 40 }) entidad: string;
  @Column({ type: 'int', nullable: true }) entidadId: number | null;
  @Column({ type: 'json', nullable: true }) detalle: unknown;
  @Index() @CreateDateColumn() creadoEn: Date;
}

export const ENTIDADES = [
  CajaTurno,
  CajaMovimiento,
  CotizadorUso,
  Taller,
  Sucursal,
  Usuario,
  SuperAdmin,
  TokenCuenta,
  CorreoLog,
  Producto,
  ProductoComponente,
  Existencia,
  MovimientoInventario,
  Cliente,
  Promocion,
  Cotizacion,
  CotizacionItem,
  Venta,
  VentaItem,
  Pago,
  Compra,
  CompraItem,
  Folio,
  Bitacora,
  AdminBitacora,
  AsistenteUso,
];
