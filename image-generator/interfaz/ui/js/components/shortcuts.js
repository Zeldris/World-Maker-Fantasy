/* Atajos de teclado (y del mando de la Deck, que Steam Input traduce a teclas: cruceta = flechas, A = Intro,
   B = Escape). Adaptado de galivelop-image-generator (gimg/ui/js/components/shortcuts.js, MIT, ver ../../LICENSE-GVIG):
   la mecánica, el interruptor de una tecla y el diálogo de ayuda son los de GVIG; la tabla de teclas es de cada
   pantalla (`setScreenKeys`; diseño §3.4, IMG-41), y los textos van en español sin i18n. Ninguno actúa mientras el
   foco está en un campo de texto, y los de la pantalla tampoco con un diálogo o la cola abiertos. */

import { h, el, replace } from '../dom.js';

const GLOBAL = [
  [['?'], 'Esta ayuda'],
  [['Q'], 'Abrir o cerrar la cola'],
  [['Esc'], 'Cerrar la cola, la imagen, los ajustes o esta ayuda'],
  [['Tab'], 'Siguiente control (Mayús+Tab, el anterior)'],
];

const TECLA_VISTA = { ArrowLeft: '←', ArrowRight: '→', Enter: 'Intro' };
const ONE_KEY = 'gvig.oneKey';

/** Interruptor «atajos de una tecla» (WCAG 2.1.4): activado por defecto, se guarda en el navegador. */
export function oneKeyEnabled() {
  try { return localStorage.getItem(ONE_KEY) !== 'off'; } catch { return true; }
}

function setOneKey(on) {
  try { localStorage.setItem(ONE_KEY, on ? 'on' : 'off'); } catch { /* sin almacenamiento: vale la sesión */ }
}

export function isTyping(target) {
  return target instanceof Element && (target.closest('input, textarea, select, [contenteditable="true"]') !== null);
}

// La pantalla en curso: título del grupo en la ayuda y sus teclas, [{ keys: ['G'], label, run }].
let screen = { title: '', keys: [] };
let queueOpen = () => false;

/** Cambia la tabla de teclas de la pantalla (cada pantalla trae la suya: Avanzar, Regenerar, Atrás y ★ en IMG-43). */
export function setScreenKeys(title, keys) { screen = { title, keys }; }

export function initShortcuts({ toggleQueue, closeAll, isQueueOpen }) {
  if (isQueueOpen) queueOpen = isQueueOpen;
  const dlg = el('shortcuts');
  el('shortcuts-close').addEventListener('click', () => dlg.close());
  el('help').addEventListener('click', () => openHelp());
  document.addEventListener('keydown', (e) => {
    // el cajón de la cola atiende su Esc (preventDefault): aquí no se cierra además el último aviso
    if (e.key === 'Escape') { if (!e.defaultPrevented) closeAll(); return; }
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!oneKeyEnabled()) return;
    if (e.key === '?') { e.preventDefault(); openHelp(); return; }
    if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); toggleQueue(); return; }
    if (queueOpen() || document.querySelector('dialog[open]')) return;
    // Intro sobre un botón, enlace o resumen es suyo (activarlo), no un atajo de la pantalla
    if (e.key === 'Enter' && e.target instanceof Element && e.target.closest('button, a, summary, [role="button"]')) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const hit = screen.keys.find((k) => k.keys.includes(key));
    if (hit) { e.preventDefault(); hit.run(); }
  });
}

export function openHelp() {
  const groups = [['En toda la interfaz', GLOBAL]];
  if (screen.keys.length) groups.push([screen.title, screen.keys.map((k) => [k.keys, k.label])]);
  replace(el('shortcuts-body'), groups.map(([group, items]) => h('section.shortcut-group', {},
    h('h3', {}, group),
    h('dl', {}, items.map(([keys, label]) => [h('dt', {}, keys.map((k) => h('kbd.kbd', {}, TECLA_VISTA[k] || k))), h('dd', {}, label)])))),
  h('label.check', {}, h('input', { type: 'checkbox', checked: oneKeyEnabled(), onchange: (ev) => setOneKey(ev.target.checked) }),
    h('span', {}, 'Atajos de una tecla (?, Q y las letras de la pantalla)')),
  h('p.hint', {}, 'Si te estorban con un lector de pantalla o un mando, desactívalos: el resto de la interfaz funciona igual con el ratón y el Tab.'),
  h('p.hint', {}, 'Con el mando de la Steam Deck (Steam Input, perfil «teclado»): cruceta = flechas, A = Intro, B = Esc, panel táctil = ratón. En el modo escritorio basta el panel táctil y el teclado en pantalla.'),
  h('p.hint', {}, 'Un mando suelto (API Gamepad) se activa solo al conectarlo: cruceta = moverse por los controles, A = Intro, B = Esc, Y = «?».'));
  el('shortcuts').showModal();
}
