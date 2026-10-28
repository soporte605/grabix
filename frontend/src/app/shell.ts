import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvisoService, mensajeError } from './core/aviso.service';
import { Rol } from './core/modelos';
import { SesionService } from './core/sesion.service';
import { Icono } from './ui/icono';
import { Logo } from './ui/logo';
import { SelectorTema } from './ui/selector-tema';
import { Asistente } from './ui/asistente';
import { AsistenteService } from './core/asistente.service';
import { Bienvenida, RecorridoService } from './ui/bienvenida';
import { FechaPipe } from './core/formato';
import { Api } from './core/api.service';

interface Item { ruta: string; texto: string; icono: string; roles: Rol[] }
const TODOS: Rol[] = ['dueno', 'admin', 'encargado', 'vendedor', 'produccion'];
const COSTOS: Rol[] = ['dueno', 'admin', 'encargado'];
const GER: Rol[] = ['dueno', 'admin'];
const MENU: Item[] = [
  { ruta: 'inicio', texto: 'Inicio', icono: 'inicio', roles: COSTOS },
  { ruta: 'caja', texto: 'Caja', icono: 'caja', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'cotizaciones', texto: 'Cotizaciones', icono: 'cotizaciones', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'ventas', texto: 'Ventas', icono: 'ventas', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'produccion', texto: 'Producción', icono: 'produccion', roles: TODOS },
  { ruta: 'inventario', texto: 'Inventario', icono: 'inventario', roles: TODOS.filter((r) => r !== 'produccion') },
  { ruta: 'clientes', texto: 'Clientes', icono: 'clientes', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'compras', texto: 'Compras', icono: 'compras', roles: COSTOS },
  { ruta: 'cortes', texto: 'Cortes de caja', icono: 'cortes', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'reportes', texto: 'Reportes', icono: 'reportes', roles: COSTOS },
  { ruta: 'promociones', texto: 'Promociones', icono: 'promociones', roles: [...COSTOS, 'vendedor'] },
  { ruta: 'sucursales', texto: 'Sucursales', icono: 'sucursales', roles: GER },
  { ruta: 'usuarios', texto: 'Usuarios', icono: 'usuarios', roles: GER },
  { ruta: 'ajustes', texto: 'Ajustes y plan', icono: 'ajustes', roles: GER },
];

const CLAVE_MENU = 'grabix.menu-corto';
function leer() {
  try { return localStorage.getItem(CLAVE_MENU); } catch { return null; }
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, Logo, SelectorTema, Asistente, Bienvenida, FechaPipe],
  template: `
    <div class="flex min-h-full flex-col">
    @if (modoSoporte()) {
      <div class="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-2 bg-[#002150] px-4 py-2.5 text-sm text-white">
        <span>Estás dentro como soporte. Los cambios quedan a nombre de Soporte Grabix.</span>
        <button class="btn sm" (click)="volver()" [disabled]="volviendo()">{{ volviendo() ? 'Volviendo…' : 'Volver al panel' }}</button>
      </div>
    }
    <div class="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200" [class]="corto() ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[248px_1fr]'">
      <aside class="sticky hidden flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-linea bg-superficie px-3 py-5 lg:flex"
        [style.top]="modoSoporte() ? '3rem' : '0'" [style.height]="modoSoporte() ? 'calc(100dvh - 3rem)' : '100dvh'">
        <div class="flex items-center gap-1 pb-[18px]" [class.flex-col]="corto()">
          <a class="flex min-w-0 flex-1 items-center gap-2.5 px-2 text-tinta no-underline" [class.!px-0]="corto()" routerLink="/app" [title]="corto() ? 'Grabix · ' + (s.taller()?.nombre ?? '') : ''">
            <app-logo [tamano]="32" [texto]="false" />
            @if (!corto()) { <span class="min-w-0"><b class="block font-titulo text-xl font-extrabold tracking-[-.02em]">Grabix</b><small class="block truncate text-xs text-tenue">{{ s.taller()?.nombre }}</small></span> }
          </a>
          <button class="flex size-9 flex-none items-center justify-center rounded-lg text-xl text-tenue hover:bg-superficie-2 hover:text-tinta" (click)="alternarMenu()"
            [attr.aria-label]="corto() ? 'Expandir menú' : 'Colapsar menú'" [title]="corto() ? 'Expandir menú' : 'Colapsar menú'" [attr.aria-expanded]="!corto()">
            <app-icono [nombre]="corto() ? 'panel-abrir' : 'panel'" />
          </button>
        </div>
        <nav class="flex flex-col gap-0.5">
          @for (m of menu(); track m.ruta) {
            <a [routerLink]="m.ruta" [attr.data-tour]="'m-' + m.ruta" routerLinkActive="!bg-marca-suave !text-marca" [class]="ITEM + ' hover:bg-superficie-2' + (corto() ? CORTO : '')"
              [title]="corto() ? m.texto : ''" [attr.aria-label]="corto() ? m.texto : null"><app-icono class="text-lg" [nombre]="m.icono" />@if (!corto()) { <span class="truncate">{{ m.texto }}</span> }</a>
          }
        </nav>
        @if (modoSoporte()) { <span class="mt-auto"></span> } @else {
          <button [class]="ITEM + ' mt-auto !text-tenue hover:bg-superficie-2' + (corto() ? CORTO : '')" (click)="s.salir()" [title]="corto() ? 'Salir' : ''" [attr.aria-label]="corto() ? 'Salir' : null"><app-icono class="text-lg" nombre="salir" />@if (!corto()) { Salir }</button>
        }
      </aside>

      <div class="min-w-0">
        <div class="sticky z-20 flex items-center justify-between gap-2.5 border-b border-linea bg-superficie py-2.5 margen-x" [style.top]="modoSoporte() ? '3rem' : '0'">
          <div class="fila">
            @if (s.multiSucursal()) {
              <label class="sr" for="suc">Sucursal</label>
              <select id="suc" data-tour="sucursal" class="entrada w-auto max-w-60 px-2.5 py-1.5 font-semibold" [value]="s.sucursal() ?? ''" (change)="cambiarSucursal($any($event.target).value)">
                @for (x of s.perfil()!.sucursales; track x.id) { <option [value]="x.id">{{ x.nombre }}</option> }
                @if (s.gerencia()) { <option value="">Todas las sucursales</option> }
              </select>
            } @else {
              <span class="pill mut" data-tour="sucursal">{{ s.nombreSucursal() }}</span>
            }
          </div>
          <div class="flex min-w-0 items-center gap-1">
            <button data-tour="asistente" class="mr-1 flex h-9 items-center gap-1.5 rounded-lg border border-linea px-2.5 text-base font-semibold hover:border-marca"
              [class.!border-marca]="asistente.abierto()" [class.!bg-marca-suave]="asistente.abierto()" (click)="asistente.abierto() ? asistente.abierto.set(false) : asistente.abrir()"
              [attr.aria-expanded]="asistente.abierto()" aria-label="Asistente con IA">
              <app-icono class="text-lg text-acento-2" nombre="chispa" /><span class="max-[380px]:hidden">Asistente</span>
            </button>
            <span class="chico truncate text-tenue max-sm:hidden">{{ s.perfil()?.usuario?.nombre }}</span>
            <button data-tour="ayuda" class="flex size-9 items-center justify-center rounded-lg text-tenue hover:bg-superficie-2 hover:text-tinta" (click)="tour.iniciar(menu())"
              title="Recorrido guiado" aria-label="Ver el recorrido guiado"><app-icono class="text-xl" nombre="info" /></button>
            <app-selector-tema />
          </div>
        </div>
        @if (!modoSoporte() && s.perfil()?.usuario?.emailVerificado === false) {
          <div [class]="BANNER + ' items-center bg-marca-suave'">
            <span>Confirma tu correo <b>{{ s.perfil()!.usuario.email }}</b> con el enlace que te enviamos.</span>
            <button class="font-bold text-marca underline" (click)="reenviar()" [disabled]="reenviando()">{{ reenviando() ? 'Enviando…' : 'Reenviar enlace' }}</button>
          </div>
        }
        @if (!modoSoporte() && aviso(); as a) {
          <div [class]="BANNER + (a.vigente ? ' bg-acento-suave' : ' bg-bad-suave text-bad')">
            {{ a.texto }}
            @if (s.rol() === 'dueno') { <a routerLink="ajustes">Ver planes</a> }
          </div>
        }
        <main class="w-full max-w-[1400px] pt-[18px] pb-[100px] margen-x lg:px-6 lg:pt-6 lg:pb-12">@if (!s.taller()?.eliminarEn || modoSoporte()) { <router-outlet /> }</main>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-linea bg-superficie pt-1.5 pr-[max(6px,env(safe-area-inset-right,0px))] pb-[calc(6px+env(safe-area-inset-bottom,0px))] pl-[max(6px,env(safe-area-inset-left,0px))] lg:hidden">
        @for (m of principales(); track m.ruta) {
          <a [routerLink]="m.ruta" [attr.data-tour]="'m-' + m.ruta" routerLinkActive="!text-marca" [class]="PESTANA"><app-icono class="text-xl" [nombre]="m.icono" />{{ m.texto }}</a>
        }
        <button [class]="PESTANA" [class.!text-marca]="mas()" (click)="mas.set(!mas())"><app-icono class="text-xl" nombre="mas" />Más</button>
      </nav>
      <app-asistente />
      @if (bienvenida()) { <app-bienvenida [modulos]="menu()" (cerrar)="vista.set(true)" /> }
      @if (!modoSoporte() && s.taller()?.eliminarEn; as fecha) {
        <div class="fixed inset-0 z-[70] grid place-items-center bg-fondo p-4">
          <div class="tarjeta flex w-full max-w-[520px] flex-col gap-3 p-6">
            <span class="grid size-11 place-items-center rounded-xl bg-bad-suave text-bad"><app-icono class="text-xl" nombre="alerta" /></span>
            <h1 class="text-xl">Tu cuenta se eliminará el {{ fecha | fecha }}</h1>
            <p class="text-tenue">Mientras tanto nadie de tu equipo puede entrar. Ese día se borran de forma definitiva todos los datos de {{ s.taller()!.nombre }}.</p>
            <p class="text-tenue">Si cambiaste de opinión, restáurala y todo seguirá como estaba.</p>
            <div class="fila mt-2">
              <button class="btn pri" (click)="restaurar()" [disabled]="restaurando()">{{ restaurando() ? 'Restaurando…' : 'Restaurar cuenta' }}</button>
              <button class="btn" (click)="s.salir()">Salir</button>
            </div>
          </div>
        </div>
      }
      @if (mas()) {
        <div class="fixed inset-0 z-25 flex items-end bg-[rgba(8,20,30,.3)] px-3 pb-[calc(72px+env(safe-area-inset-bottom,0px))]" (click)="mas.set(false)">
          <div class="tarjeta grid w-full grid-cols-2 gap-0.5 p-2 shadow-caja">
            @for (m of resto(); track m.ruta) { <a [routerLink]="m.ruta" [class]="ITEM"><app-icono [nombre]="m.icono" />{{ m.texto }}</a> }
            @if (!modoSoporte()) { <button [class]="ITEM" (click)="s.salir()"><app-icono nombre="salir" />Salir</button> }
          </div>
        </div>
      }
    </div>
    </div>
  `,
})
export class Shell {
  readonly ITEM = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left font-medium text-tinta no-underline';
  readonly CORTO = ' justify-center !px-0';
  readonly PESTANA = 'flex flex-col items-center gap-0.5 py-1 text-xs text-tenue no-underline';
  readonly BANNER = 'mx-[max(16px,env(safe-area-inset-left,0px))] lg:mx-6 mt-3 flex flex-wrap gap-2.5 rounded-[10px] px-3.5 py-2.5 text-base';
  s = inject(SesionService);
  avisos = inject(AvisoService);
  asistente = inject(AsistenteService);
  tour = inject(RecorridoService);
  private api = inject(Api);
  private router = inject(Router);
  mas = signal(false);
  volviendo = signal(false);
  modoSoporte = computed(() => !!this.s.perfil()?.soporte || !!this.s.idSoporte());
  async volver() {
    if (this.volviendo()) return;
    const id = this.s.idSoporte();
    this.volviendo.set(true);
    try {
      if (id) await this.api.post(`/admin/talleres/${id}/salir`);
      this.s.restaurarTrasSoporte();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.volviendo.set(false);
    }
  }
  /** Bienvenida la primera vez que entra cada usuario. */
  vista = signal(false);
  bienvenida = computed(() => !this.modoSoporte() && !this.vista() && this.s.perfil()?.usuario.recorridoVisto === false && !this.s.taller()?.eliminarEn);
  restaurando = signal(false);
  async restaurar() {
    this.restaurando.set(true);
    try {
      await this.api.post('/cuenta/restaurar', {});
      await this.s.cargar();
      this.avisos.ok('Cuenta restaurada. ¡Qué bueno que sigues con nosotros!');
    } catch (e) { this.avisos.error(mensajeError(e)); }
    finally { this.restaurando.set(false); }
  }
  /** Menú lateral colapsado (solo íconos). Se recuerda en este navegador. */
  corto = signal(leer() === '1');
  alternarMenu() {
    this.corto.update((v) => !v);
    try { localStorage.setItem(CLAVE_MENU, this.corto() ? '1' : '0'); } catch {}
  }
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
