import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvisoService, mensajeError } from './core/aviso.service';
import { Rol } from './core/modelos';
import { SesionService } from './core/sesion.service';
import { Icono } from './ui/icono';

interface Item { ruta: string; texto: string; icono: string; roles: Rol[] }
const TODOS: Rol[] = ['dueno', 'admin', 'encargado', 'vendedor', 'produccion'];
const COSTOS: Rol[] = ['dueno', 'admin', 'encargado'];
const GER: Rol[] = ['dueno', 'admin'];
const MENU: Item[] = [
  { ruta: 'inicio', texto: 'Inicio', icono: 'inicio', roles: COSTOS },
  { ruta: 'cotizaciones', texto: 'Cotizaciones', icono: 'cotizaciones', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'ventas', texto: 'Ventas', icono: 'ventas', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'produccion', texto: 'Producción', icono: 'produccion', roles: TODOS },
  { ruta: 'inventario', texto: 'Inventario', icono: 'inventario', roles: TODOS.filter((r) => r !== 'produccion') },
  { ruta: 'clientes', texto: 'Clientes', icono: 'clientes', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'compras', texto: 'Compras', icono: 'compras', roles: COSTOS },
  { ruta: 'promociones', texto: 'Promociones', icono: 'promociones', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'sucursales', texto: 'Sucursales', icono: 'sucursales', roles: GER },
  { ruta: 'usuarios', texto: 'Usuarios', icono: 'usuarios', roles: GER },
  { ruta: 'bitacora', texto: 'Bitácora', icono: 'bitacora', roles: GER },
  { ruta: 'ajustes', texto: 'Ajustes y plan', icono: 'ajustes', roles: GER },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  template: `
    <div class="grid min-h-full lg:grid-cols-[240px_1fr]">
      <aside class="sticky top-0 hidden h-screen flex-col gap-1 overflow-auto border-r border-linea bg-superficie px-3 py-5 lg:flex">
        <a class="flex items-center gap-2.5 px-2 pb-[18px] text-tinta no-underline" routerLink="/app">
          <span class="marca-ico"></span>
          <span><b class="block font-titulo text-[1.25rem] font-extrabold">Grabix</b><small class="block max-w-40 truncate text-[.75rem] text-tenue">{{ s.taller()?.nombre }}</small></span>
        </a>
        <nav>
          @for (m of menu(); track m.ruta) {
            <a [routerLink]="m.ruta" routerLinkActive="!bg-marca-suave !text-marca" [class]="ITEM + ' hover:bg-superficie-2'"><app-icono [nombre]="m.icono" />{{ m.texto }}</a>
          }
        </nav>
        <button [class]="ITEM + ' mt-auto !text-tenue hover:bg-superficie-2'" (click)="s.salir()"><app-icono nombre="salir" />Salir</button>
      </aside>

      <div class="min-w-0">
        <div class="sticky top-0 z-20 flex items-center justify-between gap-2.5 border-b border-linea bg-superficie py-2.5 margen-x">
          <div class="fila">
            @if (s.multiSucursal()) {
              <label class="sr" for="suc">Sucursal</label>
              <select id="suc" class="entrada w-auto max-w-60 px-2.5 py-1.5 font-semibold" [value]="s.sucursal() ?? ''" (change)="cambiarSucursal($any($event.target).value)">
                @for (x of s.perfil()!.sucursales; track x.id) { <option [value]="x.id">{{ x.nombre }}</option> }
                @if (s.gerencia()) { <option value="">Todas las sucursales</option> }
              </select>
            } @else {
              <span class="pill mut">{{ s.nombreSucursal() }}</span>
            }
          </div>
          <span class="chico truncate text-tenue">{{ s.perfil()?.usuario?.nombre }}</span>
        </div>
        @if (s.perfil()?.usuario?.emailVerificado === false) {
          <div [class]="BANNER + ' items-center bg-marca-suave'">
            <span>Confirma tu correo <b>{{ s.perfil()!.usuario.email }}</b> con el enlace que te enviamos.</span>
            <button class="font-bold text-marca underline" (click)="reenviar()" [disabled]="reenviando()">{{ reenviando() ? 'Enviando…' : 'Reenviar enlace' }}</button>
          </div>
        }
        @if (aviso(); as a) {
          <div [class]="BANNER + (a.vigente ? ' bg-acento-suave' : ' bg-bad-suave text-bad')">
            {{ a.texto }}
            @if (s.rol() === 'dueno') { <a routerLink="ajustes">Ver planes</a> }
          </div>
        }
        <main class="mx-auto max-w-[1180px] pt-[18px] pb-[100px] margen-x lg:px-8 lg:pt-6 lg:pb-12"><router-outlet /></main>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-linea bg-superficie pt-1.5 pr-[max(6px,env(safe-area-inset-right,0px))] pb-[calc(6px+env(safe-area-inset-bottom,0px))] pl-[max(6px,env(safe-area-inset-left,0px))] lg:hidden">
        @for (m of principales(); track m.ruta) {
          <a [routerLink]="m.ruta" routerLinkActive="!text-marca" [class]="PESTANA"><app-icono class="text-[1.25rem]" [nombre]="m.icono" />{{ m.texto }}</a>
        }
        <button [class]="PESTANA" [class.!text-marca]="mas()" (click)="mas.set(!mas())"><app-icono class="text-[1.25rem]" nombre="mas" />Más</button>
      </nav>
      @if (mas()) {
        <div class="fixed inset-0 z-25 flex items-end bg-[rgba(8,20,30,.3)] px-3 pb-[calc(72px+env(safe-area-inset-bottom,0px))]" (click)="mas.set(false)">
          <div class="tarjeta grid w-full grid-cols-2 gap-0.5 p-2 shadow-caja">
            @for (m of resto(); track m.ruta) { <a [routerLink]="m.ruta" [class]="ITEM"><app-icono [nombre]="m.icono" />{{ m.texto }}</a> }
            <button [class]="ITEM" (click)="s.salir()"><app-icono nombre="salir" />Salir</button>
          </div>
        </div>
      }
    </div>
    @if (avisos.mensaje(); as m) {
      <div class="fixed bottom-[calc(86px+env(safe-area-inset-bottom,0px))] left-1/2 z-60 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[10px] px-4 py-2.5 text-[.9rem] shadow-caja lg:bottom-6"
        [class]="m.tipo === 'error' ? 'bg-bad text-white' : 'bg-tinta text-superficie'" role="status">{{ m.texto }}</div>
    }
  `,
})
export class Shell {
  readonly ITEM = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left font-medium text-tinta no-underline';
  readonly PESTANA = 'flex flex-col items-center gap-0.5 py-1 text-[.68rem] text-tenue no-underline';
  readonly BANNER = 'mx-[max(16px,env(safe-area-inset-left,0px))] mt-3 flex flex-wrap gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[.88rem]';
  s = inject(SesionService);
  avisos = inject(AvisoService);
  private router = inject(Router);
  mas = signal(false);
  menu = computed(() => MENU.filter((m) => m.roles.includes(this.s.rol()!)));
  principales = computed(() => this.menu().slice(0, 4));
  resto = computed(() => this.menu().slice(4));
  aviso = computed(() => {
    const x = this.s.perfil()?.suscripcion;
    if (!x) return null;
    if (!x.vigente) return { vigente: false, texto: 'Tu suscripción venció. Puedes consultar tu información, pero no registrar nada nuevo.' };
    if (x.estado === 'prueba') return { vigente: true, texto: `Prueba gratuita: te quedan ${x.diasRestantes} días.` };
    return null;
  });

  reenviando = signal(false);
  async reenviar() {
    this.reenviando.set(true);
    try {
      const r = await this.s.reenviarActivacion();
      if (r.yaVerificado) await this.s.cargar();
      else this.avisos.ok('Listo, revisa tu correo (y la carpeta de spam)');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.reenviando.set(false);
    }
  }

  cambiarSucursal(v: string) {
    this.s.elegirSucursal(v ? Number(v) : null);
    // Recarga la vista actual con la nueva sucursal.
    const url = this.router.url;
    this.router.navigateByUrl('/app', { skipLocationChange: true }).then(() => this.router.navigateByUrl(url));
  }
}
