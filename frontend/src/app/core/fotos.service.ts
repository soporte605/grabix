import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const LADO = 1600;
const LADO_MINI = 480;
/** El servidor acepta hasta 3 MB por foto; dejamos margen. */
const MAX_BASE64 = 2_400_000;

export interface FotoLista { imagen: string; miniatura: string; ancho: number; alto: number }

type Fuente = { img: CanvasImageSource; ancho: number; alto: number; cerrar(): void };

/**
 * Reduce una imagen a `lado` px. WebP si el navegador lo genera (Safari no), si no JPEG.
 * `jpeg` fuerza JPEG sobre fondo blanco (para la vista previa de WhatsApp, que no maneja transparencia).
 */
function reducir(f: Fuente, lado: number, calidad: number, jpeg = false) {
  const k = Math.min(1, lado / Math.max(f.ancho, f.alto));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(f.ancho * k));
  c.height = Math.max(1, Math.round(f.alto * k));
  const g = c.getContext('2d')!;
  if (jpeg) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(f.img, 0, 0, c.width, c.height);
  let url = jpeg ? '' : c.toDataURL('image/webp', calidad);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', calidad);
  return { url, ancho: c.width, alto: c.height };
}

/** Abre la imagen. Los SVG (diseños exportados) se cargan con <img> porque createImageBitmap no los acepta. */
async function abrir(archivo: File): Promise<Fuente> {
  if (!archivo.type.startsWith('image/')) throw new Error('Ese archivo no es una imagen');
  if (archivo.type === 'image/svg+xml') {
    const u = URL.createObjectURL(archivo);
    const img = new Image();
    img.src = u;
    await img.decode().catch(() => { URL.revokeObjectURL(u); throw new Error('No pudimos leer ese SVG'); });
    // Un SVG sin tamaño propio se dibuja a 1600 px de ancho.
    const ancho = img.naturalWidth || 1600, alto = img.naturalHeight || Math.round(ancho * 0.75);
    const k = Math.max(1, LADO / Math.max(ancho, alto));
    return { img, ancho: ancho * k, alto: alto * k, cerrar: () => URL.revokeObjectURL(u) };
  }
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('No pudimos leer esa imagen. Prueba con una imagen JPG o PNG.');
  });
  return { img: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() };
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
    const f = await abrir(archivo);
    try {
      let g = reducir(f, LADO, 0.82);
      if (g.url.length > MAX_BASE64) g = reducir(f, 1200, 0.72);
      const m = reducir(f, LADO_MINI, 0.7);
      return { imagen: g.url, miniatura: m.url, ancho: g.ancho, alto: g.alto };
    } finally { f.cerrar(); }
  }

  /** Prueba de diseño: además, un JPEG ligero para que WhatsApp lo muestre en la vista previa del enlace. */
  async prepararDiseno(archivo: File): Promise<FotoLista & { vista: string }> {
    const f = await abrir(archivo);
    try {
      let g = reducir(f, LADO, 0.88);
      if (g.url.length > MAX_BASE64) g = reducir(f, 1200, 0.75);
      const m = reducir(f, LADO_MINI, 0.75);
      let v = reducir(f, 1200, 0.8, true);
      if (v.url.length > 400_000) v = reducir(f, 900, 0.72, true);
      return { imagen: g.url, miniatura: m.url, vista: v.url, ancho: g.ancho, alto: g.alto };
    } finally { f.cerrar(); }
  }

  /** Logo para el PDF: PNG (conserva la transparencia) de hasta 800 px; si pesa mucho, JPEG sobre blanco. */
  async prepararLogo(archivo: File): Promise<string> {
    const f = await abrir(archivo);
    try {
      const k = Math.min(1, 800 / Math.max(f.ancho, f.alto));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(f.ancho * k));
      c.height = Math.max(1, Math.round(f.alto * k));
      c.getContext('2d')!.drawImage(f.img, 0, 0, c.width, c.height);
      const png = c.toDataURL('image/png');
      return png.length < 1_800_000 ? png : reducir(f, 800, 0.9, true).url;
    } finally { f.cerrar(); }
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
