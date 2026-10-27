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
    <div class="app">
      <aside class="lateral">
        <a class="logo" routerLink="/app"><span class="marca-ico"></span><span><b>Grabix</b><small>{{ s.taller()?.nombre }}</small></span></a>
        <nav>
          @for (m of menu(); track m.ruta) {
            <a [routerLink]="m.ruta" routerLinkActive="on"><app-icono [nombre]="m.icono" />{{ m.texto }}</a>
          }
        </nav>
        <button class="salir" (click)="s.salir()"><app-icono nombre="salir" />Salir</button>
      </aside>

      <div class="contenido">
        <div class="superior">
          <div class="fila">
            @if (s.multiSucursal()) {
              <label class="sr" for="suc">Sucursal</label>
              <select id="suc" class="entrada sucursal" [value]="s.sucursal() ?? ''" (change)="cambiarSucursal($any($event.target).value)">
                @for (x of s.perfil()!.sucursales; track x.id) { <option [value]="x.id">{{ x.nombre }}</option> }
                @if (s.gerencia()) { <option value="">Todas las sucursales</option> }
              </select>
            } @else {
              <span class="pill mut">{{ s.nombreSucursal() }}</span>
            }
          </div>
          <span class="tenue chico usuario">{{ s.perfil()?.usuario?.nombre }}</span>
        </div>
        @if (s.perfil()?.usuario?.emailVerificado === false) {
          <div class="banner correo">
            <span>Confirma tu correo <b>{{ s.perfil()!.usuario.email }}</b> con el enlace que te enviamos.</span>
            <button class="enlace" (click)="reenviar()" [disabled]="reenviando()">{{ reenviando() ? 'Enviando…' : 'Reenviar enlace' }}</button>
          </div>
        }
        @if (aviso(); as a) {
          <div class="banner" [class.vencido]="!a.vigente">
            {{ a.texto }}
            @if (s.rol() === 'dueno') { <a routerLink="ajustes">Ver planes</a> }
          </div>
        }
        <main><router-outlet /></main>
      </div>

      <nav class="pestanas">
        @for (m of principales(); track m.ruta) {
          <a [routerLink]="m.ruta" routerLinkActive="on"><app-icono [nombre]="m.icono" />{{ m.texto }}</a>
        }
        <button (click)="mas.set(!mas())" [class.on]="mas()"><app-icono nombre="mas" />Más</button>
      </nav>
      @if (mas()) {
        <div class="menu-mas" (click)="mas.set(false)">
          <div class="panel tarjeta">
            @for (m of resto(); track m.ruta) { <a [routerLink]="m.ruta"><app-icono [nombre]="m.icono" />{{ m.texto }}</a> }
            <button (click)="s.salir()"><app-icono nombre="salir" />Salir</button>
          </div>
        </div>
      }
    </div>
    @if (avisos.mensaje(); as m) { <div class="toast" [class.err]="m.tipo === 'error'" role="status">{{ m.texto }}</div> }
  `,
  styles: `
    :host { display: block; min-height: 100%; }
    .app { display: grid; min-height: 100%; }
    .lateral { display: none; }
    .contenido { min-width: 0; }
    main { padding: 18px max(16px, env(safe-area-inset-right, 0px)) 100px max(16px, env(safe-area-inset-left, 0px)); max-width: 1180px; margin: 0 auto; }
    @media (min-width: 960px) {
      .app { grid-template-columns: 240px 1fr; }
      .lateral { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; padding: 20px 12px; background: var(--superficie); border-right: 1px solid var(--linea); overflow: auto; }
      .pestanas { display: none !important; }
      main { padding: 24px 32px 48px; }
    }
    .logo { display: flex; align-items: center; gap: 10px; padding: 0 8px 18px; text-decoration: none; color: var(--tinta); }
    .logo b { font: 800 1.25rem var(--f-titulo); display: block; }
    .logo small { display: block; color: var(--tenue); font-size: .75rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .marca-ico { width: 30px; height: 30px; border-radius: 8px; flex: none; background: linear-gradient(180deg, var(--marca) 0 72%, var(--acento) 72%); }
    nav a, .salir, .panel a, .panel button { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; text-decoration: none; color: var(--tinta); font-weight: 500; background: none; border: 0; cursor: pointer; width: 100%; text-align: left; }
    .lateral nav a:hover, .salir:hover { background: var(--superficie-2); }
    .lateral nav a.on { background: var(--marca-suave); color: var(--marca); }
    .salir { margin-top: auto; color: var(--tenue); }
    .superior { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px));
      background: var(--superficie); border-bottom: 1px solid var(--linea); position: sticky; top: 0; z-index: 20; }
    .sucursal { width: auto; max-width: 240px; padding: 6px 10px; font-weight: 600; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .usuario { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .banner { margin: 12px max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px)); padding: 10px 14px; border-radius: 10px; background: var(--acento-suave); font-size: .88rem; display: flex; gap: 10px; flex-wrap: wrap; }
    .banner.correo { background: var(--marca-suave); align-items: center; }
    .enlace { background: none; border: 0; padding: 0; color: var(--marca); font-weight: 700; text-decoration: underline; cursor: pointer; }
    .banner.vencido { background: var(--bad-suave); color: var(--bad); }
    .pestanas { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: grid; grid-template-columns: repeat(5, 1fr); background: var(--superficie); border-top: 1px solid var(--linea);
      padding: 6px max(6px, env(safe-area-inset-right, 0px)) calc(6px + env(safe-area-inset-bottom, 0px)) max(6px, env(safe-area-inset-left, 0px)); }
    .pestanas a, .pestanas button { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: .68rem; color: var(--tenue); text-decoration: none; background: none; border: 0; padding: 4px 0; cursor: pointer; }
    .pestanas app-icono { font-size: 1.25rem; }
    .pestanas .on { color: var(--marca); }
    .menu-mas { position: fixed; inset: 0; z-index: 25; background: rgba(8, 20, 30, .3); display: flex; align-items: flex-end; padding: 0 12px calc(72px + env(safe-area-inset-bottom, 0px)); }
    .panel { width: 100%; padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; box-shadow: var(--sombra); }
    .toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(86px + env(safe-area-inset-bottom, 0px)); z-index: 60; background: var(--tinta); color: var(--superficie);
      padding: 10px 16px; border-radius: 10px; font-size: .9rem; max-width: calc(100% - 32px); box-shadow: var(--sombra); }
    .toast.err { background: var(--bad); color: #fff; }
    @media (min-width: 960px) { .toast { bottom: 24px; } }
  `,
})
export class Shell {
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
