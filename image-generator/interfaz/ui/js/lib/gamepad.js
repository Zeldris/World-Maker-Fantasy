/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Mando (UI.9): solo está activo mientras hay un mando conectado. Cruceta = flechas, A = Intro, B = Escape, Y = «?».
   Steam Input ya traduce el mando de la Deck a teclas; esto cubre un mando suelto con la API Gamepad.
   Un KeyboardEvent sintético no tiene acción por defecto (no mueve el foco, no pulsa botones): se despacha igualmente
   sobre el elemento enfocado para que reaccionen los manejadores de la app (atajos, galería, editor de cajas) y, si
   nadie llamó a preventDefault, se hace aquí lo que haría el navegador. Escape lo resuelve el manejador global de la
   app (cierra cola, retoque, diálogos y el menú «Ajustes» a la vez, como la tecla de verdad). */

import { FOCUSABLE } from './focus-trap.js';
import { openHelp } from '../components/shortcuts.js';

const REPEAT_DELAY = 400;
const REPEAT_EVERY = 120;
// botones del mapeo estándar → tecla
const BUTTONS = { 0: 'Enter', 1: 'Escape', 3: '?', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
const REPEATING = new Set([12, 13, 14, 15]);
const FOCUSABLE_ALL = `${FOCUSABLE}, textarea:not(:disabled), summary`;

const held = new Map();   // «índice del mando:botón» → { next: instante de la siguiente repetición }
const pads = new Set();
let raf = 0;

export function initGamepad() {
  window.addEventListener('gamepadconnected', (e) => { if (e.gamepad) pads.add(e.gamepad.index); start(); });
  window.addEventListener('gamepaddisconnected', (e) => { if (e.gamepad) pads.delete(e.gamepad.index); if (!pads.size) stop(); });
  // un mando ya conectado antes de cargar la página aparece en getGamepads() sin evento hasta que se pulsa un botón
  if (connected().length) start();
}

function connected() {
  try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter((g) => g && g.connected !== false); } catch { return []; }
}

function start() { if (!raf) raf = requestAnimationFrame(tick); }
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; held.clear(); }

function tick(now) {
  raf = 0;
  const list = connected();
  if (!list.length && !pads.size) { held.clear(); return; }
  for (const pad of list) {
    if (pad.mapping && pad.mapping !== 'standard') continue;
    for (const index of Object.keys(BUTTONS).map(Number)) {
      const id = `${pad.index}:${index}`;
      const b = pad.buttons && pad.buttons[index];
      if (b && (b.pressed || b.value > 0.5)) {
        const state = held.get(id);
        if (!state) { held.set(id, { next: now + REPEAT_DELAY }); press(BUTTONS[index]); }       // flanco: solo al pulsar
        else if (REPEATING.has(index) && now >= state.next) { state.next = now + REPEAT_EVERY; press(BUTTONS[index]); }
      } else held.delete(id);
    }
  }
  start();
}

/** Despacha la tecla sobre el foco y, si nadie la atendió, hace la acción por defecto del navegador. */
export function press(key) {
  const target = document.activeElement || document.body;
  const dialogs = document.querySelectorAll('dialog[open]');
  const topDialog = dialogs[dialogs.length - 1];
  const topPopover = [...document.querySelectorAll(':popover-open')].pop();
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  if (ev.defaultPrevented) return;
  if (key === 'Escape') escape(topDialog, topPopover);
  else if (key === 'Enter') activate(document.activeElement);
  else if (key === '?') { if (!document.querySelector('#shortcuts[open]')) openHelp(); }
  else if (key.startsWith('Arrow')) arrow(key);
}

/** Lo que hace el Esc del navegador si el manejador global no lo vio (los diálogos que cortan la propagación del
    `keydown`) o no lo cierra (popovers que no son «Ajustes»): cancelar el diálogo de arriba, si no el popover. */
function escape(dialog, popover) {
  if (dialog) {
    if (!dialog.open) return;
    if (dialog.requestClose) dialog.requestClose();
    else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
  } else if (popover && popover.matches(':popover-open')) popover.hidePopover();
}

function activate(node) {
  if (!node || node === document.body) return;
  if (node.matches('select')) { if (node.showPicker) { try { node.showPicker(); } catch { /* sin gesto de usuario */ } } }
  else if (node.matches('button, a[href], summary, input[type=checkbox], input[type=radio], input[type=button], input[type=submit], [tabindex="0"]')) node.click();
}

function arrow(key) {
  const node = document.activeElement;
  // en un <select> izquierda y derecha cambian la opción; arriba y abajo siguen moviendo el foco (si no, no se saldría de él)
  if (node && node.matches('select:not([multiple])') && (key === 'ArrowLeft' || key === 'ArrowRight')) { stepSelect(node, key === 'ArrowRight' ? 1 : -1); return; }
  moveFocus(key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1);
}

function stepSelect(select, step) {
  const to = Math.min(select.options.length - 1, Math.max(0, select.selectedIndex + step));
  if (to === select.selectedIndex) return;
  select.selectedIndex = to;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Donde se mueve el foco: el diálogo modal de más arriba, el cajón de la cola, el menú abierto o toda la página. */
function scope() {
  const dialogs = document.querySelectorAll('dialog[open]');
  if (dialogs.length) return dialogs[dialogs.length - 1];
  const pop = [...document.querySelectorAll(':popover-open')].pop();
  if (pop) return pop;
  const modal = [...document.querySelectorAll('[role=dialog][aria-modal=true]')].find((n) => !n.hidden && n.getClientRects().length > 0);
  return modal || document.body;
}

function moveFocus(step) {
  const nodes = [...scope().querySelectorAll(FOCUSABLE_ALL)].filter((n) => n.getClientRects().length > 0 && !n.closest('[inert]') && n.tabIndex >= 0);
  if (!nodes.length) return;
  const at = nodes.indexOf(document.activeElement);
  const to = at < 0 ? (step > 0 ? 0 : nodes.length - 1) : Math.min(nodes.length - 1, Math.max(0, at + step));
  nodes[to].focus();
}
