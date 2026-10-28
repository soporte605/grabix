import { Component, computed, inject, Injectable, input, output } from '@angular/core';
import { driver, DriveStep } from 'driver.js';
import { Api } from '../core/api.service';
import { SesionService } from '../core/sesion.service';
import { Hoja } from './hoja';
import { Icono } from './icono';
import { Logo } from './logo';

export interface Modulo { ruta: string; texto: string; icono: string }

/** Qué hace cada módulo, para la bienvenida y el recorrido. */
export const QUE_HACE: Record<string, string> = {
  inicio: 'Tus números del día y del mes: ventas, ganancia, lo que te deben y pedidos atrasados.',
  caja: 'Punto de venta para mostrador: agrega productos, cobra en efectivo, tarjeta o combinado e imprime el ticket.',
  cotizaciones: 'Arma precios con tus costos reales, descarga el PDF y mándalo por WhatsApp.',
  ventas: 'Órdenes de venta con anticipos, saldos y fecha de entrega.',
  produccion: 'Tablero con lo que falta hacer, lo que está en proceso y lo que ya está listo.',
  inventario: 'Insumos, productos con receta y servicios, con su costo y existencia.',
  clientes: 'Tu cartera de clientes y lo que cada uno te ha comprado.',
  compras: 'Lo que compras a proveedores: suma inventario y actualiza tu costo.',
  promociones: 'Descuentos listos para aplicar y anunciar por WhatsApp.',
  sucursales: 'Tus talleres o puntos de venta, cada uno con su inventario.',
  usuarios: 'Invita a tu equipo y define qué puede ver y hacer cada quien.',
  ajustes: 'Datos del taller, tarifa de máquina por minuto, margen y tu plan.',
};

/** Recorrido guiado con driver.js sobre el menú real (lateral en escritorio, barra inferior en el celular). */
@Injectable({ providedIn: 'root' })
export class RecorridoService {
  private api = inject(Api);
  private s = inject(SesionService);

  /** Marca la bienvenida como vista para no volver a mostrarla. */
  async marcarVisto() {
    const p = this.s.perfil();
    if (!p || p.usuario.recorridoVisto) return;
    this.s.perfil.set({ ...p, usuario: { ...p.usuario, recorridoVisto: true } });
    await this.api.post('/cuenta/recorrido', {}).catch(() => undefined);
  }

  iniciar(modulos: Modulo[]) {
    // El primer elemento visible con ese data-tour (el menú lateral se oculta en el celular).
    const el = (k: string) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${k}"]`)].find((e) => e.offsetParent !== null);
    const pasos: DriveStep[] = [
      { popover: { title: 'Recorrido rápido', description: 'Te enseño dónde está cada cosa. Son unos segundos y puedes salir cuando quieras.' } },
    ];
    // Solo los módulos clave; el resto ya se explicó en la bienvenida.
    const clave = ['inicio', 'caja', 'cotizaciones', 'ventas', 'produccion', 'inventario', 'ajustes'];
    for (const m of modulos.filter((x) => clave.includes(x.ruta))) {
      const e = el('m-' + m.ruta);
      pasos.push({ element: e, popover: { title: m.texto, description: QUE_HACE[m.ruta] ?? '', side: 'right', align: 'center' } });
    }
    const suc = el('sucursal');
    if (suc) pasos.push({ element: suc, popover: { title: 'Sucursal', description: 'Todo lo que ves y registras es de esta sucursal. Si tienes varias, cámbiala aquí.' } });
    const asis = el('asistente');
    if (asis) pasos.push({ element: asis, popover: { title: 'Asistente', description: 'Pregúntale cosas como "¿cuánto vendí esta semana?" o "¿qué pedidos se entregan mañana?".' } });
    const ayuda = el('ayuda');
    if (ayuda) pasos.push({ element: ayuda, popover: { title: '¿Lo quieres repetir?', description: 'Desde aquí vuelves a ver este recorrido cuando quieras.' } });
    pasos.push({ popover: { title: '¡Listo!', description: 'Un buen primer paso: revisa tu inventario y haz tu primera cotización.' } });

    driver({
      steps: pasos,
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Terminar',
      popoverClass: 'grabix-tour',
      overlayOpacity: 0.55,
      stagePadding: 4,
      stageRadius: 10,
    }).drive();
  }
}

/** Ventana de bienvenida la primera vez que alguien entra: resumen de módulos y opción de recorrido guiado. */
@Component({
  selector: 'app-bienvenida',
  imports: [Hoja, Icono, Logo],
  template: `
    <app-hoja [titulo]="''" ancho="720px" (cerrar)="omitir()">
      <div class="flex flex-col items-center gap-2 pt-1 text-center">
        <app-logo [tamano]="52" [texto]="false" />
        <h2 class="text-[1.45rem]">Bienvenido a Grabix, {{ nombre() }}</h2>
        <p class="max-w-[52ch] text-tenue">{{ esDueno() ? 'Tu taller ya está listo.' : 'Ya tienes acceso al taller.' }} Esto es lo que puedes hacer desde aquí:</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        @for (m of modulos(); track m.ruta) {
          <div class="flex items-start gap-3 rounded-xl border border-linea bg-superficie p-3">
            <span class="grid size-9 flex-none place-items-center rounded-[10px] bg-marca-suave text-marca"><app-icono class="text-[1.1rem]" [nombre]="m.icono" /></span>
            <span class="min-w-0"><b class="block text-[.95rem]">{{ m.texto }}</b><span class="block text-[.84rem] leading-snug text-tenue">{{ que[m.ruta] }}</span></span>
          </div>
        }
      </div>
      <ng-container pie>
        <button class="btn" (click)="omitir()">Omitir por ahora</button>
        <span class="flex-1"></span>
        <button class="btn pri" (click)="recorrido()">Hacer el recorrido guiado</button>
      </ng-container>
    </app-hoja>
  `,
})
export class Bienvenida {
  private s = inject(SesionService);
  private tour = inject(RecorridoService);
  modulos = input.required<Modulo[]>();
  cerrar = output();
  que = QUE_HACE;
  nombre = computed(() => (this.s.perfil()?.usuario.nombre ?? '').split(' ')[0]);
  esDueno = computed(() => this.s.rol() === 'dueno');

  omitir() {
    this.tour.marcarVisto();
    this.cerrar.emit();
  }
  recorrido() {
    this.omitir();
    // Espera a que se cierre la ventana para que el recorrido resalte el menú.
    setTimeout(() => this.tour.iniciar(this.modulos()), 250);
  }
}
