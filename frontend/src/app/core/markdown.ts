/**
 * Markdown mínimo para las respuestas del asistente: párrafos, listas, **negritas** y enlaces internos (/app/...).
 * Primero se escapa todo el HTML, así que el texto del modelo nunca se inserta como marcado.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function enLinea(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((\/app\/[A-Za-z0-9/_-]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

export function markdown(texto: string): string {
  const out: string[] = [];
  let lista: 'ul' | 'ol' | null = null;
  const cerrar = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const crudo of texto.split('\n')) {
    const l = crudo.trim();
    const v = /^[-*•]\s+(.*)$/.exec(l);
    const n = /^\d+[.)]\s+(.*)$/.exec(l);
    if (v || n) {
      const tipo = v ? 'ul' : 'ol';
      if (lista !== tipo) { cerrar(); out.push(`<${tipo}>`); lista = tipo; }
      out.push(`<li>${enLinea((v ?? n)![1])}</li>`);
    } else if (!l) {
      cerrar();
    } else {
      cerrar();
      out.push(`<p>${enLinea(l.replace(/^#+\s*/, ''))}</p>`);
    }
  }
  cerrar();
  return out.join('');
}
