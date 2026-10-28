import { Component, computed, input, model, signal } from '@angular/core';
import { evaluarClave } from '../core/clave';
import { Icono } from './icono';

const COLORES = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-ok', 'bg-ok'];
const TEXTOS = ['text-bad', 'text-bad', 'text-warn', 'text-ok', 'text-ok'];

/** Campo de contraseña con botón para mostrarla y, si `medidor`, la barra de seguridad con sus requisitos. */
@Component({
  selector: 'app-campo-clave',
  imports: [Icono],
  host: { class: 'campo' },
  template: `
    <label [for]="entrada()">{{ etiqueta() }}<ng-content select="[etiqueta]" /></label>
    <div class="relative">
      <input class="!pr-11" [id]="entrada()" [name]="entrada()" [type]="ver() ? 'text' : 'password'" [value]="valor()" (input)="valor.set($any($event.target).value)"
        [attr.autocomplete]="autocomplete()" [attr.aria-describedby]="medidor() ? entrada() + '-seg' : null" required>
      <button type="button" class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-tenue hover:text-marca"
        (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="ver()">
        <app-icono class="text-xl" [nombre]="ver() ? 'ojo-no' : 'ojo'" />
      </button>
    </div>
    @if (medidor() && valor()) {
      <div [id]="entrada() + '-seg'" class="mt-1 flex flex-col gap-1.5" aria-live="polite">
        <div class="flex items-center gap-2">
          <div class="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
            @for (i of [1, 2, 3, 4]; track i) {
              <span class="h-1.5 rounded-full transition-colors" [class]="f().nivel >= i ? colores[f().nivel] : 'bg-linea'"></span>
            }
          </div>
          <span class="w-20 text-right text-xs font-semibold" [class]="textos[f().nivel]">{{ f().etiqueta }}</span>
        </div>
        <ul class="grid gap-0.5 text-sm">
          @for (r of f().requisitos; track r.texto) {
            <li class="flex items-start gap-1.5" [class]="r.ok ? 'text-ok' : r.obligatorio ? 'text-tinta' : 'text-tenue'">
              @if (r.ok) { <app-icono nombre="ok" /> } @else { <span class="inline-block size-[1.2em] text-center leading-[1.2em]">·</span> }
              <span>{{ r.texto }}@if (!r.obligatorio) { <span class="text-tenue"> (recomendado)</span> }</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class CampoClave {
  /** id del <input> (no se pone en el elemento anfitrión para no duplicarlo). */
  entrada = input.required<string>();
  etiqueta = input('Contraseña');
  autocomplete = input('new-password');
  medidor = input(false);
  /** Correo, nombre o taller: la contraseña no debe contenerlos. */
  personales = input<(string | null | undefined)[]>([]);
  valor = model('');
  ver = signal(false);
  colores = COLORES;
  textos = TEXTOS;
  f = computed(() => evaluarClave(this.valor(), this.personales()));
  /** Para que el formulario padre sepa si puede enviar. */
  valida = computed(() => this.f().valida);
}
