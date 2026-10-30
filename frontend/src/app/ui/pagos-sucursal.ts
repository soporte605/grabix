import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { AvisoService, mensajeError } from '../core/aviso.service';
import { ConfirmarService } from '../core/confirmar.service';
import { FotosService } from '../core/fotos.service';
import { Sucursal } from '../core/modelos';
import { SesionService } from '../core/sesion.service';
import { validarFormulario } from '../core/validar';
import { DatosPago } from './datos-pago';
import { Icono } from './icono';

type Pago = Required<Pick<Sucursal, 'banco' | 'titular' | 'clabe' | 'cuenta' | 'tarjeta' | 'anticipoPct'>> & { indicacionesPago: string; condiciones: string };

const sugerencia = (pct: number) =>
  (pct > 0 ? `El trabajo inicia al recibir el ${pct}% de anticipo; el saldo se liquida al entregar. ` : 'El pago se realiza al entregar el trabajo. ') +
  'Los diseños se aprueban antes de producir; cambios posteriores a la aprobación pueden tener costo adicional.';

/** Datos bancarios, anticipo y condiciones de cada sucursal (salen en PDF, WhatsApp y vista previa). */
@Component({
  selector: 'app-pagos-sucursal',
  imports: [FormsModule, DatosPago, Icono],
  template: `
    <section class="caja" #zona>
      <h3>Logo, cobro y condiciones por sucursal</h3>
      <p class="tenue chico">Aparecen en tus cotizaciones y notas de venta: PDF, vista previa, WhatsApp y el enlace del cliente.</p>
      @if (sucursales().length > 1) {
        <div class="chips" role="radiogroup" aria-label="Sucursal">
          @for (x of sucursales(); track x.id) { <button type="button" role="radio" class="chip" [class.on]="x.id === actual()?.id" [attr.aria-checked]="x.id === actual()?.id" (click)="elegir(x)">{{ x.nombre }}</button> }
        </div>
      }
      @if (actual()) {
        <h4 class="mt-1 text-base font-semibold">Logo</h4>
        <div class="flex flex-wrap items-center gap-3">
          <div class="grid h-20 w-44 place-items-center overflow-hidden rounded-xl border border-linea bg-white p-2">
            @if (logoUrl(); as u) { <img [src]="u" alt="Logo de la sucursal" class="max-h-16 max-w-40 object-contain"> }
            @else { <span class="chico text-center text-[#5a6a74]">Sin logo</span> }
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn sm" (click)="elegirLogo.click()" [disabled]="subiendoLogo()"><app-icono nombre="camara" />{{ subiendoLogo() ? 'Subiendo…' : logoUrl() ? 'Cambiar logo' : 'Subir logo' }}</button>
              @if (logoUrl()) { <button type="button" class="btn sm" (click)="quitarLogo()" [disabled]="subiendoLogo()"><app-icono nombre="basura" />Quitar</button> }
            </div>
            @if (sucursales().length > 1) { <label class="fila chico cursor-pointer"><input type="checkbox" [(ngModel)]="logoTodas"> Usar en todas las sucursales</label> }
            <p class="chico tenue">PNG, JPG o SVG. De preferencia horizontal y con fondo transparente.</p>
          </div>
          <input #elegirLogo type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="hidden" (change)="subirLogo($event)" aria-label="Elegir logo">
        </div>

        <h4 class="mt-2 text-base font-semibold">Anticipo y condiciones</h4>
        <div class="campos">
          <div class="campo"><label for="ps-a">Anticipo para iniciar (%)</label>
            <input id="ps-a" name="anticipoPct" type="number" inputmode="numeric" min="0" max="100" class="num" [(ngModel)]="f.anticipoPct">
            <div class="mt-1 flex flex-wrap gap-1.5">@for (n of [0, 30, 50, 100]; track n) { <button type="button" class="chip" [class.on]="+f.anticipoPct === n" (click)="f.anticipoPct = n">{{ n ? n + '%' : 'Sin anticipo' }}</button> }</div>
          </div>
          <p class="chico self-end pb-2 tenue">En la cotización aparece "Anticipo para iniciar" con el monto; en la venta, lo que falta para iniciar.</p>
          <div class="campo todo"><div class="flex items-baseline justify-between gap-2"><label for="ps-c">Condiciones de venta</label>
              <button type="button" class="chico font-semibold text-marca" (click)="f.condiciones = sugerir()">Usar texto sugerido</button></div>
            <textarea id="ps-c" rows="3" maxlength="1000" [(ngModel)]="f.condiciones" [placeholder]="sugerir()"></textarea></div>
        </div>

        <h4 class="mt-2 text-base font-semibold">Datos para transferencia o depósito</h4>
        <div class="campos">
          <div class="campo"><label for="ps-b">Banco</label><input id="ps-b" maxlength="80" [(ngModel)]="f.banco" placeholder="Ej. BBVA"></div>
          <div class="campo"><label for="ps-t">Titular de la cuenta</label><input id="ps-t" maxlength="120" [(ngModel)]="f.titular" placeholder="Nombre o razón social"></div>
          <div class="campo"><label for="ps-cl">CLABE interbancaria</label><input id="ps-cl" name="clabe" class="num" inputmode="numeric" minlength="18" maxlength="22" [(ngModel)]="f.clabe" placeholder="18 dígitos"></div>
          <div class="campo"><label for="ps-cu">Número de cuenta (opcional)</label><input id="ps-cu" name="cuenta" class="num" inputmode="numeric" maxlength="30" [(ngModel)]="f.cuenta"></div>
          <div class="campo"><label for="ps-ta">Tarjeta para depósito (opcional)</label><input id="ps-ta" name="tarjeta" class="num" inputmode="numeric" maxlength="23" [(ngModel)]="f.tarjeta" placeholder="16 dígitos, p. ej. para OXXO"></div>
          <div class="campo todo"><label for="ps-i">Indicaciones de pago</label>
            <textarea id="ps-i" rows="2" maxlength="500" [(ngModel)]="f.indicacionesPago" placeholder="Ej. Envía tu comprobante por WhatsApp indicando tu folio. El trabajo se agenda al confirmar el depósito."></textarea></div>
        </div>
        <p class="chico font-semibold tenue">Así se ve para tu cliente</p>
        <app-datos-pago [sucursal]="vista()" [copiable]="false" />
        @if (!vista().banco && !vista().clabe && !vista().tarjeta && !vista().cuenta) { <p class="chico tenue">Captura al menos el banco y la CLABE para mostrar el recuadro.</p> }
        <div><button class="btn pri" (click)="guardar()" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar datos de ' + actual()!.nombre }}</button></div>
      }
    </section>
  `,
})
export class PagosSucursal implements OnInit, OnDestroy {
  private api = inject(Api);
  private aviso = inject(AvisoService);
  private s = inject(SesionService);
  private http = inject(HttpClient);
  private fotos = inject(FotosService);
  private confirmar = inject(ConfirmarService);
  logoUrl = signal<string | null>(null);
  subiendoLogo = signal(false);
  logoTodas = false;
  private zona = viewChild.required<ElementRef<HTMLElement>>('zona');
  sucursales = signal<Sucursal[]>([]);
  actual = signal<Sucursal | null>(null);
  ocupado = signal(false);
  f: Pago = this.vacio();
  /** Copia nueva en cada revisión para que la vista previa siga lo que se escribe. */
  vista() { return { ...this.f }; }

  async ngOnInit() {
    try {
      const ss = (await this.api.get<Sucursal[]>('/sucursales')).filter((x) => x.activa);
      this.sucursales.set(ss);
      const suc = ss.find((x) => x.id === this.s.sucursal()) ?? ss[0];
      if (suc) this.elegir(suc);
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }

  private vacio(): Pago { return { banco: '', titular: '', clabe: '', cuenta: '', tarjeta: '', indicacionesPago: '', anticipoPct: 0, condiciones: '' }; }

  ngOnDestroy() { this.soltarLogo(); }

  private soltarLogo() {
    const u = this.logoUrl();
    if (u) URL.revokeObjectURL(u);
    this.logoUrl.set(null);
  }

  /** El logo se pide con la sesión; la etiqueta <img> no puede mandar el token. */
  private async cargarLogo(x: Sucursal) {
    this.soltarLogo();
    if (!x.logo) return;
    try {
      const b = await firstValueFrom(this.http.get(`/api/sucursales/${x.id}/logo`, { responseType: 'blob' }));
      if (this.actual()?.id === x.id) this.logoUrl.set(URL.createObjectURL(b));
    } catch { /* sin logo */ }
  }

  async subirLogo(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const a = el.files?.[0];
    el.value = '';
    const x = this.actual();
    if (!a || !x) return;
    this.subiendoLogo.set(true);
    try {
      const imagen = await this.fotos.prepararLogo(a);
      const r = await this.api.put<{ logo: string; sucursales: number[] }>(`/sucursales/${x.id}/logo`, { imagen, todas: this.logoTodas });
      this.sucursales.update((l) => l.map((y) => (r.sucursales.includes(y.id) ? { ...y, logo: r.logo } : y)));
      this.actual.set({ ...x, logo: r.logo });
      await this.cargarLogo({ ...x, logo: r.logo });
      await this.s.cargar();
      this.aviso.ok(r.sucursales.length > 1 ? 'Logo guardado en todas las sucursales' : `Logo de ${x.nombre} guardado`);
    } catch (e) { this.aviso.error(e instanceof Error && !('status' in e) ? e.message : mensajeError(e)); }
    this.subiendoLogo.set(false);
  }

  async quitarLogo() {
    const x = this.actual();
    if (!x || !(await this.confirmar.preguntar({ titulo: '¿Quitar el logo?', texto: `Los PDF de ${x.nombre} saldrán solo con el nombre del taller.`, accion: 'Quitar', peligro: true }))) return;
    try {
      await this.api.del(`/sucursales/${x.id}/logo`);
      this.sucursales.update((l) => l.map((y) => (y.id === x.id ? { ...y, logo: null } : y)));
      this.actual.set({ ...x, logo: null });
      this.soltarLogo();
      await this.s.cargar();
      this.aviso.ok('Logo quitado');
    } catch (e) { this.aviso.error(mensajeError(e)); }
  }

  elegir(x: Sucursal) {
    void this.cargarLogo(x);
    this.actual.set(x);
    this.f = {
      banco: x.banco ?? '', titular: x.titular ?? '', clabe: x.clabe ?? '', cuenta: x.cuenta ?? '', tarjeta: x.tarjeta ?? '',
      indicacionesPago: x.indicacionesPago ?? '', anticipoPct: x.anticipoPct ?? 0, condiciones: x.condiciones ?? '',
    };
  }

  sugerir() { return sugerencia(Number(this.f.anticipoPct) || 0); }

  async guardar() {
    const x = this.actual();
    if (!x || this.ocupado() || !validarFormulario(this.zona().nativeElement)) return;
    const solo = (t: string) => t.replace(/\D/g, '');
    const body = {
      nombre: x.nombre, direccion: x.direccion, telefono: x.telefono, activa: x.activa,
      banco: this.f.banco.trim(), titular: this.f.titular.trim(), clabe: solo(this.f.clabe), cuenta: this.f.cuenta.replace(/[^\d-]/g, ''),
      tarjeta: solo(this.f.tarjeta), indicacionesPago: this.f.indicacionesPago.trim(), anticipoPct: Math.round(Number(this.f.anticipoPct) || 0),
      condiciones: this.f.condiciones.trim(),
    };
    this.ocupado.set(true);
    try {
      const r = await this.api.put<Sucursal>(`/sucursales/${x.id}`, body);
      this.sucursales.update((l) => l.map((y) => (y.id === r.id ? r : y)));
      this.elegir(r);
      await this.s.cargar();
      this.aviso.ok(`Datos de ${r.nombre} guardados`);
    } catch (e) { this.aviso.error(mensajeError(e)); }
    finally { this.ocupado.set(false); }
  }
}
