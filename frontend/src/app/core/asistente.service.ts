import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Api } from './api.service';
import { mensajeError } from './aviso.service';
import { SesionService } from './sesion.service';

export interface MensajeAsistente { rol: 'usuario' | 'asistente'; texto: string; error?: boolean }

/**
 * Conversación con el asistente. Hay una por usuario y sucursal (cambiar de sucursal cambia de conversación),
 * y se guarda en la pestaña para no perderla al navegar.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private api = inject(Api);
  private s = inject(SesionService);

  readonly abierto = signal(false);
  readonly pensando = signal(false);
  readonly estado = signal<{ disponible: boolean; limite: number; usadas: number } | null>(null);
  private conversaciones = signal<Record<string, MensajeAsistente[]>>({});

  private clave = computed(() => `${this.s.perfil()?.usuario.id ?? 0}.${this.s.sucursal() ?? 'todas'}`);
  readonly mensajes = computed(() => this.conversaciones()[this.clave()] ?? []);

  constructor() {
    try { this.conversaciones.set(JSON.parse(sessionStorage.getItem('grabix.asistente') ?? '{}')); } catch { /* sin almacenamiento */ }
    effect(() => {
      const c = this.conversaciones();
      try { sessionStorage.setItem('grabix.asistente', JSON.stringify(c)); } catch { /* sin almacenamiento */ }
    });
  }

  async cargarEstado() {
    try { this.estado.set(await this.api.get('/asistente')); } catch { this.estado.set(null); }
  }

  abrir() {
    this.abierto.set(true);
    if (!this.estado()) this.cargarEstado();
  }

  nueva() {
    this.poner([]);
  }

  async preguntar(texto: string) {
    texto = texto.trim();
    if (!texto || this.pensando()) return;
    const previos = this.mensajes().filter((m) => !m.error);
    const lista: MensajeAsistente[] = [...previos, { rol: 'usuario', texto }];
    this.poner(lista);
    this.pensando.set(true);
    const clave = this.clave();
    try {
      const r = await this.api.post<{ texto: string; restantes: number }>('/asistente', { mensajes: lista.slice(-20).map(({ rol, texto }) => ({ rol, texto })) });
      this.poner([...lista, { rol: 'asistente', texto: r.texto }], clave);
      this.estado.update((e) => (e ? { ...e, usadas: e.limite - r.restantes } : e));
    } catch (e) {
      this.poner([...lista, { rol: 'asistente', texto: mensajeError(e), error: true }], clave);
    } finally {
      this.pensando.set(false);
    }
  }

  private poner(lista: MensajeAsistente[], clave = this.clave()) {
    this.conversaciones.update((c) => ({ ...c, [clave]: lista.slice(-40) }));
  }
}
