/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Tema: auto (prefers-color-scheme), claro u oscuro; guardado en el navegador (propuesta.md «Técnica»). */

const KEY = 'gvig.theme';

export function initTheme(select) {
  let saved = 'auto';
  try { saved = localStorage.getItem(KEY) || 'auto'; } catch { /* sin almacenamiento */ }
  apply(saved);
  select.value = saved;
  select.addEventListener('change', () => {
    apply(select.value);
    try { localStorage.setItem(KEY, select.value); } catch { /* sin almacenamiento */ }
  });
}

function apply(mode) {
  if (mode === 'light' || mode === 'dark') document.documentElement.dataset.theme = mode;
  else delete document.documentElement.dataset.theme;
}
