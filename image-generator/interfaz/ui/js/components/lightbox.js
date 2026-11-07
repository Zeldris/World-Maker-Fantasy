/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Caja de luz: la imagen a tamaño real en un <dialog> (foco atrapado por el navegador; Esc cierra). */

import { el } from '../dom.js';

let lastFocus = null;

export function initLightbox() {
  const dlg = el('lightbox');
  el('lightbox-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { el('lightbox-img').removeAttribute('src'); if (lastFocus) lastFocus.focus(); });
}

export function openLightbox(src, caption, alt = '') {
  lastFocus = document.activeElement;
  const img = el('lightbox-img');
  img.src = src;
  img.alt = alt;
  el('lightbox-caption').textContent = caption || '';
  el('lightbox').showModal();
}
