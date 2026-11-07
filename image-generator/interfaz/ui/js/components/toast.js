/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Avisos flotantes. Los informativos van a #toasts (role=status, aria-live=polite); los de error se anuncian además en
   #alerts (role=alert, aria-live=assertive). Un aviso con acción (p. ej. «Ir al intento») no se cierra solo. */

import { h, el } from '../dom.js';

// Cambio respecto a GVIG: sin i18n.js (la interfaz de WMF es solo en español), «Cerrar» va escrito aquí.
const DEFAULT_MS = 6000;

export function toast(message, { kind = 'info', action = null, timeout = DEFAULT_MS } = {}) {
  const host = el('toasts');
  const node = h('div.toast', { class: kind === 'ok' ? 'toast-ok' : kind === 'bad' ? 'toast-bad' : '' }, h('span', {}, message));
  if (action) {
    node.append(action.href
      ? h('a.btn', { href: action.href, onclick: () => node.remove() }, action.label)
      : h('button.btn', { type: 'button', onclick: () => { action.onclick(); node.remove(); } }, action.label));
  }
  // Esc con el foco dentro del aviso lo cierra (y no sigue al Esc global, que cerraría otro)
  node.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); node.remove(); } });
  node.append(h('button.btn.btn-ghost.btn-icon', { type: 'button', aria: { label: 'Cerrar' }, onclick: () => node.remove() }, '✕'));
  host.append(node);
  if (kind === 'bad') { const a = el('alerts'); a.textContent = ''; a.textContent = message; }
  if (!action && timeout > 0) setTimeout(() => node.remove(), timeout);
  return node;
}

export const toastError = (message) => toast(message, { kind: 'bad', timeout: 10000 });
export const toastOk = (message, opts) => toast(message, { kind: 'ok', ...opts });

/** Esc global: cierra el último aviso. Devuelve si había alguno. */
export function dismissLastToast() {
  const last = el('toasts').lastElementChild;
  if (last) last.remove();
  return Boolean(last);
}
