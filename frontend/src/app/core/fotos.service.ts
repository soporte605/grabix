import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const LADO = 1600;
const LADO_MINI = 480;
/** El servidor acepta hasta 3 MB por foto; dejamos margen. */
const MAX_BASE64 = 2_400_000;

export interface FotoLista { imagen: string; miniatura: string; ancho: number; alto: number }

/** Reduce una imagen a `lado` px. WebP si el navegador lo genera (Safari no), si no JPEG. */
function reducir(bmp: ImageBitmap, lado: number, calidad: number) {
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  let url = c.toDataURL('image/webp', calidad);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', calidad);
  return { url, ancho: c.width, alto: c.height };
}

/**
 * Fotos de trabajos: las prepara en el teléfono antes de subirlas (más ligeras, sin datos de ubicación)
 * y las descarga con la sesión, porque una etiqueta <img> no puede mandar el token.
 */
@Injectable({ providedIn: 'root' })
export class FotosService {
  private http = inject(HttpClient);
  private cache = new Map<string, Promise<string>>();

  async preparar(archivo: File): Promise<FotoLista> {
    if (!archivo.type.startsWith('image/')) throw new Error('Ese archivo no es una imagen');
    const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' }).catch(() => {
      throw new Error('No pudimos leer esa imagen. Prueba con una foto JPG o PNG.');
    });
    try {
      let g = reducir(bmp, LADO, 0.82);
      if (g.url.length > MAX_BASE64) g = reducir(bmp, 1200, 0.72);
      const m = reducir(bmp, LADO_MINI, 0.7);
      return { imagen: g.url, miniatura: m.url, ancho: g.ancho, alto: g.alto };
    } finally { bmp.close(); }
  }

  /** URL local (blob:) de la foto o su miniatura. */
  url(id: number, mini = false): Promise<string> {
    const k = `${id}:${mini ? 1 : 0}`;
    let p = this.cache.get(k);
    if (!p) {
      p = firstValueFrom(this.http.get(`/api/fotos/${id}/archivo`, { params: mini ? { mini: '1' } : {}, responseType: 'blob' })).then((b) => URL.createObjectURL(b));
      p.catch(() => this.cache.delete(k));
      this.cache.set(k, p);
    }
    return p;
  }

  olvidar(id: number) {
    for (const k of [`${id}:0`, `${id}:1`]) {
      void this.cache.get(k)?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
      this.cache.delete(k);
    }
  }
}
