/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Ayudas de DOM: construir nodos sin innerHTML (ningún dato del servidor se interpreta como HTML),
   variables CSS por CSSOM (la CSP prohíbe `style=` en el marcado, no `el.style`), formatos. */

/** h('button.btn.btn-primary', {type: 'button', onclick: fn, aria: {pressed: true}, data: {id: 3}}, 'texto', nodo…) */
export function h(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'data') { for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv; }
    else if (k === 'aria') {
      // Con llaves: sin ellas, el `else` siguiente se ataba al `if` de dentro del bucle y no se ponía ningún otro
      // atributo (ni href, ni onclick, ni type).
      for (const [ak, av] of Object.entries(v)) if (av !== null && av !== undefined) el.setAttribute('aria-' + ak, av);
    }
    else if (k === 'vars') setVars(el, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'open' || k === 'hidden' || k === 'selected') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function replace(el, ...children) { clear(el); append(el, children); return el; }

/** Variables CSS personalizadas por CSSOM: permitido con `style-src 'self'` (solo bloquea el atributo `style`). */
export function setVars(el, vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === null || v === undefined) el.style.removeProperty('--' + k);
    else el.style.setProperty('--' + k, String(v));
  }
  return el;
}

/** mm:ss a partir de milisegundos (o «—» si no hay dato). */
export function mmss(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Fecha corta, local. */
export function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function el(id) { return document.getElementById(id); }

/** Devuelve el primer antecesor (o el propio nodo) que cumple el selector. */
export function closest(target, selector) { return target instanceof Element ? target.closest(selector) : null; }
