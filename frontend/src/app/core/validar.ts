/**
 * Validación de formularios en el navegador, con mensajes en español debajo de cada campo.
 * Se apoya en los atributos del HTML (required, minlength, min, max, type="email") de los campos
 * dentro de `.campo`, así cada formulario solo declara sus reglas en el template.
 */

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const CONTROLES = '.campo input:not([type=checkbox]):not([type=radio]):not([type=range]), .campo select, .campo textarea';

/** Mensaje del primer problema del control, o null si está bien. */
function problema(c: Control): string | null {
  if (c.disabled || c.closest('[hidden]') || !c.offsetParent) return null;
  const v = c.value.trim();
  if (c.required && !v) return c instanceof HTMLSelectElement ? 'Elige una opción' : 'Este campo es obligatorio';
  if (!v) return null;
  if (c instanceof HTMLSelectElement) return null;
  const min = (c as HTMLInputElement).minLength;
  if (min > 0 && v.length < min) return `Debe tener al menos ${min} ${min === 1 ? 'carácter' : 'caracteres'}`;
  if (c instanceof HTMLInputElement) {
    if (c.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Escribe un correo válido, por ejemplo nombre@correo.com';
    if (c.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) return 'Escribe un número válido';
      if (c.min !== '' && n < Number(c.min)) return Number(c.min) === 0 ? 'No puede ser negativo' : `Debe ser al menos ${c.min}`;
      if (c.max !== '' && n > Number(c.max)) return `No puede ser mayor a ${c.max}`;
    }
  }
  return null;
}

/** Muestra (o quita, con null) el mensaje de error debajo del control. */
export function marcarCampo(c: Control, msg: string | null) {
  const campo = c.closest('.campo');
  if (!campo) return;
  let p = campo.querySelector<HTMLElement>(':scope > .error-campo');
  campo.classList.toggle('con-error', !!msg);
  c.toggleAttribute('aria-invalid', !!msg);
  if (!msg) { p?.remove(); return; }
  if (!p) {
    p = document.createElement('p');
    p.className = 'error-campo';
    p.id = `${c.id || 'campo'}-error`;
    p.setAttribute('role', 'alert');
    campo.appendChild(p);
    c.setAttribute('aria-describedby', p.id);
    // El aviso se va en cuanto el usuario corrige el campo.
    const limpiar = () => { if (!problema(c)) marcarCampo(c, null); };
    c.addEventListener('input', limpiar);
    c.addEventListener('change', limpiar);
  }
  p.textContent = msg;
}

/** Revisa los campos dentro de `raiz`; marca los que tienen problema y enfoca el primero. Devuelve true si todo está bien. */
export function validarFormulario(raiz: ParentNode): boolean {
  let primero: Control | null = null;
  for (const c of Array.from(raiz.querySelectorAll<Control>(CONTROLES))) {
    const msg = problema(c);
    marcarCampo(c, msg);
    if (msg && !primero) primero = c;
  }
  if (primero) {
    primero.focus();
    primero.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  return !primero;
}

/**
 * Marca los campos que rechazó el servidor (`campos`: nombre del campo → mensaje).
 * Busca en la ventana abierta más reciente, o en la página, un control con `name` igual al campo.
 */
export function marcarErroresServidor(campos: Record<string, string>) {
  const dialogos = document.querySelectorAll('[role=dialog]');
  const raiz: ParentNode = dialogos[dialogos.length - 1] ?? document;
  let primero: Control | null = null;
  for (const [k, msg] of Object.entries(campos)) {
    const c = raiz.querySelector<Control>(`[name="${CSS.escape(k)}"]`);
    if (!c) continue;
    marcarCampo(c, msg);
    primero ??= c;
  }
  primero?.focus();
}
