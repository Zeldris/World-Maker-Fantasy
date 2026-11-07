/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Confirmación modal de una acción que no se deshace (p. ej. «Vaciar cola»): un `dialog` con título, mensaje y dos
   botones. Resuelve true si se confirma y false si se cancela o se cierra con Esc. El foco empieza en «Cancelar»
   (lo seguro) y vuelve a `opener` (un nodo o una función que lo devuelve, por si el original se repintó). */

import { h } from '../dom.js';

// Cambio respecto a GVIG: sin i18n.js (solo español), «Cancelar» va escrito aquí.
export function confirmAction({ title, message, confirmLabel, opener = null }) {
  return new Promise((resolve) => {
    let answer = false;
    const cancel = h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancelar');
    const ok = h('button.btn.btn-danger', { type: 'button', onclick: () => { answer = true; dlg.close(); } }, confirmLabel);
    const dlg = h('dialog.confirm', { aria: { labelledby: 'confirm-title', describedby: 'confirm-message' } },
      h('h2', { id: 'confirm-title' }, title), h('p', { id: 'confirm-message' }, message), h('div.row', {}, ok, cancel));
    dlg.addEventListener('keydown', (ev) => ev.stopPropagation());
    dlg.addEventListener('close', () => {
      dlg.remove();
      const back = typeof opener === 'function' ? opener() : opener;
      if (back && back.isConnected) back.focus();
      resolve(answer);
    });
    document.body.append(dlg);
    dlg.showModal();
    cancel.focus();
  });
}
