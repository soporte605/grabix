import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Llamadas a la API como promesas, más cómodas en componentes con signals. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  get<T>(url: string, params?: Record<string, string>) { return firstValueFrom(this.http.get<T>('/api' + url, { params })); }
  post<T>(url: string, body?: unknown) { return firstValueFrom(this.http.post<T>('/api' + url, body ?? {})); }
  put<T>(url: string, body: unknown) { return firstValueFrom(this.http.put<T>('/api' + url, body)); }
  patch<T>(url: string, body: unknown) { return firstValueFrom(this.http.patch<T>('/api' + url, body)); }
  del<T>(url: string) { return firstValueFrom(this.http.delete<T>('/api' + url)); }

  /** Descarga el PDF como archivo. */
  async descargarPdf(url: string, nombre: string) {
    const b = await firstValueFrom(this.http.get('/api' + url, { responseType: 'blob' }));
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = nombre.endsWith('.pdf') ? nombre : `${nombre}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60_000);
  }

  /** Abre el PDF en otra pestaña (en el celular lo muestra el visor del sistema). */
  async abrirPdf(url: string) {
    const ventana = window.open('', '_blank');
    const b = await firstValueFrom(this.http.get('/api' + url, { responseType: 'blob' }));
    const u = URL.createObjectURL(b);
    if (ventana) ventana.location.href = u;
    else window.location.href = u;
    setTimeout(() => URL.revokeObjectURL(u), 60_000);
  }

  /** Pide el texto de WhatsApp y abre el chat. La ventana se abre antes para que el navegador no la bloquee. */
  async whatsapp(url: string) {
    const ventana = window.open('', '_blank');
    try {
      const r = await this.post<{ url: string }>(url);
      if (ventana) ventana.location.href = r.url;
      else window.location.href = r.url;
    } catch (e) {
      ventana?.close();
      throw e;
    }
  }
}
