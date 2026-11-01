import { inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Api } from './api.service';

export interface ConfigPublica {
  whatsapp: string | null;
  pixelId: string | null;
  legal: { responsable: string; domicilio: string | null; correo: string };
}

const VACIA: ConfigPublica = { whatsapp: null, pixelId: null, legal: { responsable: 'Elikar Systems', domicilio: null, correo: 'soporte@elikarsystems.com' } };

/** Rutas públicas donde se mide la campaña. Dentro del sistema (/app) y en pedidos de clientes no se carga el Pixel. */
const MEDIBLE = /^\/(?:$|\?|#|registro|entrar|privacidad|terminos)/;

type Fbq = ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: unknown };

/**
 * Configuración pública (WhatsApp, Pixel de Meta, datos legales) y medición de la campaña.
 * El Pixel solo se carga si el servidor tiene META_PIXEL_ID y solo en la landing, registro y avisos legales.
 */
@Injectable({ providedIn: 'root' })
export class PublicoService {
  private api = inject(Api);
  private router = inject(Router);
  readonly config = signal<ConfigPublica>(VACIA);
  private carga?: Promise<ConfigPublica>;
  private pixel = false;
  private enviados = new Set<string>();

  cargar() {
    return (this.carga ??= this.api.get<ConfigPublica>('/publico/config').then(
      (c) => (this.config.set(c), c),
      () => VACIA,
    ));
  }

  /** Se llama una vez al arrancar: registra PageView en cada navegación pública. */
  iniciarMedicion() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (MEDIBLE.test(e.urlAfterRedirects)) void this.evento('PageView');
    });
  }

  /** Envía un evento al Pixel (si está configurado). `unaVez` evita repetirlo en la misma visita. */
  async evento(nombre: string, datos?: Record<string, unknown>, unaVez = false) {
    if (unaVez && this.enviados.has(nombre)) return;
    const c = await this.cargar();
    if (!c.pixelId || !this.cargarPixel(c.pixelId)) return;
    if (unaVez) this.enviados.add(nombre);
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    fbq?.('track', nombre, datos);
  }

  private cargarPixel(id: string) {
    if (this.pixel) return true;
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
    if (!w.fbq) {
      // Código base de Meta, sin el PageView automático (lo mandamos por ruta).
      const f = function (...a: unknown[]) {
        if (f.callMethod) f.callMethod(...a);
        else f.queue.push(a);
      } as Fbq;
      f.push = f;
      f.loaded = true;
      f.version = '2.0';
      f.queue = [];
      w.fbq = w._fbq = f;
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(s);
    }
    w.fbq!('init', id);
    this.pixel = true;
    return true;
  }
}
