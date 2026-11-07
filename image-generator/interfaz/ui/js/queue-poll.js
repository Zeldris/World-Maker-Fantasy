/* Sondeo de GET /api/cola cada 3 s (IMG-41). Adaptado de galivelop-image-generator (gimg/ui/js/queue-poll.js, MIT, ver
   ../LICENSE-GVIG): aquí no hay store.js, así que guarda las entradas él mismo (`entries()`) y avisa con `on('changed')`,
   y de las transiciones (`finished`, `failed`) para los avisos. Se para con la pestaña oculta y vuelve al mostrarla. */

import { api, OfflineError } from './api.js';

export const INTERVAL_MS = 3000;
const listeners = { finished: new Set(), failed: new Set(), changed: new Set() };
let timer = null;
let known = new Map(); // id -> estado del último sondeo
let current = [];
let running = false;

export function on(event, fn) { listeners[event].add(fn); return () => listeners[event].delete(fn); }
export function entries() { return current; }

function emit(event, entry) { for (const fn of listeners[event]) fn(entry); }

export async function refreshNow() {
  let list;
  try {
    list = (await api.cola()).cola;
  } catch (e) {
    if (!(e instanceof OfflineError)) console.warn('cola', e);
    return false;
  }
  if (!Array.isArray(list)) return false;
  const next = new Map();
  let changed = known.size !== list.length;
  for (const e of list) {
    next.set(e.id, e.estado);
    const before = known.get(e.id);
    if (before !== e.estado) changed = true;
    if (before && before !== e.estado) {
      if (e.estado === 'hecho') emit('finished', e);
      else if (e.estado === 'fallido') emit('failed', e);
    }
  }
  known = next;
  current = list;
  if (changed || list.some((e) => e.estado === 'generando')) emit('changed', list);
  return true;
}

function schedule() {
  clearTimeout(timer);
  if (!running || document.visibilityState === 'hidden') return;
  timer = setTimeout(async () => { await refreshNow(); schedule(); }, INTERVAL_MS);
}

export function start() {
  if (running) return;
  running = true;
  document.addEventListener('visibilitychange', onVisibility);
  refreshNow().then(schedule);
}

export function stop() {
  running = false;
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (document.visibilityState === 'visible') { refreshNow().then(schedule); } else { clearTimeout(timer); }
}
