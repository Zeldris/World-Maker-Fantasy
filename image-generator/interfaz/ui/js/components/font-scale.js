/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Talla de texto (UI.9): Normal, Grande o Muy grande; escala el `font-size` de <html> con `--font-scale` y se guarda en el navegador. */

const KEY = 'gvig.fontScale';
const SIZES = ['normal', 'large', 'xlarge'];

export function initFontScale(select) {
  let saved = 'normal';
  try { saved = localStorage.getItem(KEY) || 'normal'; } catch { /* sin almacenamiento */ }
  if (!SIZES.includes(saved)) saved = 'normal';
  apply(saved);
  select.value = saved;
  select.addEventListener('change', () => {
    apply(select.value);
    try { localStorage.setItem(KEY, select.value); } catch { /* sin almacenamiento */ }
  });
}

function apply(size) {
  if (size === 'large' || size === 'xlarge') document.documentElement.dataset.fontScale = size;
  else delete document.documentElement.dataset.fontScale;
}
