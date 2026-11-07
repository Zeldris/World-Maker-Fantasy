/* Barra de cola persistente (IMG-41): pastilla en la cabecera («1 generando», con progreso) y cajón desplegable con las
   entradas (filtro pendientes / terminadas / fallidas / todas), el paso o el tiempo que queda y el enlace al intento.
   Adaptada de galivelop-image-generator (gimg/ui/js/components/queue-bar.js, MIT, ver ../../LICENSE-GVIG), con la misma
   estructura y las mismas clases; se alimenta de queue-poll.js (aquí no hay store.js ni i18n) y el enlace llama a
   `abrir(entrada)`, que lleva a la pantalla del elemento. Lo de GVIG que espera a IMG-11 (la cola de verdad): el
   estado `en-cola` con su posición, cancelar, subir/bajar y «Vaciar cola». */

import { h, mmss, replace } from '../dom.js';
import { paths } from '../api.js';
import { trapFocus } from '../lib/focus-trap.js';
import * as poll from '../queue-poll.js';

const FILTERS = { pendientes: 'Pendientes', hecho: 'Terminadas', fallido: 'Fallidas', todas: 'Todas' };
const ESTADOS = { generando: 'generando', hecho: 'terminada', fallido: 'fallida' };
const PENDING = ['generando'];
let filter = 'pendientes';
let open = false;
let hosts = null;
let abrir = () => {};

export function initQueueBar(pillHost, drawerHost, alAbrir) {
  hosts = { pillHost, drawerHost };
  if (alAbrir) abrir = alAbrir;
  trapFocus(drawerHost);
  drawerHost.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); toggleQueue(false); } });
  poll.on('changed', render);
  render();
}

export function toggleQueue(force) {
  open = force === undefined ? !open : Boolean(force);
  render();
  if (open) { const title = hosts.drawerHost.querySelector('h2'); if (title) title.focus(); }
  else { const pill = hosts.pillHost.querySelector('button'); if (pill) pill.focus(); }
}

export function isQueueOpen() { return open; }

/** Tiempo restante estimado (ms) de una entrada que genera, o null. */
export function remainingMs(e) {
  if (e.estado === 'generando' && Number.isFinite(e.estimado) && Number.isFinite(e.segundos)) {
    return Math.max(0, (e.estimado - e.segundos) * 1000);
  }
  return null;
}

/** <progress> de una entrada en marcha: pasos si sd-cli los da, si no tiempo sobre la previsión, si no indeterminada. */
export function progressOf(e) {
  const p = h('progress', { aria: { label: 'Progreso de la imagen' } });
  if (e.progreso && e.progreso.pasos) { p.max = e.progreso.pasos; p.value = e.progreso.paso; }
  else if (Number.isFinite(e.estimado) && e.estimado > 0) { p.max = e.estimado; p.value = Math.min(e.estimado * 0.98, e.segundos || 0); }
  return p;
}

let lastSig = null;

function render() {
  if (!hosts) return;
  const entries = poll.entries();
  // Solo se repinta si cambia lo que se ve (cada sondeo vuelve a llamar aquí); lo que genera trae sus segundos.
  const sig = JSON.stringify([open, filter, entries]);
  if (sig === lastSig) return;
  lastSig = sig;
  const active = document.activeElement;
  const fid = active && active.dataset && active.dataset.fid && (hosts.pillHost.contains(active) || hosts.drawerHost.contains(active)) ? active.dataset.fid : null;
  paint(entries);
  if (fid) {
    const again = document.querySelector(`[data-fid="${fid}"]`);
    if (again && again !== document.activeElement) again.focus();
  }
}

function paint(entries) {
  const running = entries.filter((e) => e.estado === 'generando');
  const label = running.length ? `${running.length} generando` : 'Nada en marcha';
  const pill = h('button.queue-pill', {
    type: 'button', class: running.length ? 'is-running' : '', data: { fid: 'pill' }, aria: { expanded: open, controls: 'queue-drawer', label: `Cola: ${label}` },
    onclick: () => toggleQueue(),
  }, h('span.dot', { aria: { hidden: true } }), h('span', {}, label), running.length ? progressOf(running[0]) : null);
  replace(hosts.pillHost, pill);

  const drawer = hosts.drawerHost;
  drawer.hidden = !open;
  // diálogo modal: lo de detrás queda inerte (ni foco ni clic) mientras está abierto
  for (const sel of ['#main', '.app-header']) { const node = document.querySelector(sel); if (node) node.inert = open; }
  if (!open) return;
  const shown = entries.filter((e) => filter === 'todas' || (filter === 'pendientes' ? PENDING.includes(e.estado) : e.estado === filter));
  replace(drawer,
    h('div.row-between', {}, h('h2', { id: 'queue-title', tabindex: '-1', data: { fid: 'title' } }, 'Cola'),
      h('button.btn.btn-icon.btn-ghost', { type: 'button', data: { fid: 'close' }, aria: { label: 'Cerrar la cola' }, onclick: () => toggleQueue(false) }, '✕')),
    h('div.row', { role: 'group', aria: { label: 'Filtrar la cola' } }, Object.entries(FILTERS).map(([f, texto]) =>
      h('button.btn.btn-toggle', { type: 'button', data: { fid: `filter-${f}` }, aria: { pressed: filter === f }, onclick: () => { filter = f; render(); } }, texto))),
    shown.length ? h('div.stack', {}, shown.map(entry)) : h('p.empty', {}, filter === 'pendientes' ? 'Nada en marcha.' : 'Nada que enseñar con este filtro.'),
    h('p.hint', {}, 'Una imagen a la vez: lo terminado se recuerda hasta que se cierra el servidor.'));
}

function entry(e) {
  const who = `${e.tipo}/${e.slug} · ${e.perfil}`;
  const what = [ESTADOS[e.estado] || e.estado];
  if (e.estado === 'generando') {
    if (e.progreso && e.progreso.pasos) what.push(`paso ${e.progreso.paso}/${e.progreso.pasos}`);
    else if (e.progreso && e.progreso.texto) what.push(e.progreso.texto);
    const rem = remainingMs(e);
    what.push(rem === null ? 'sin estimación' : rem ? `quedan ~${mmss(rem)}` : 'casi lista');
  } else if (Number.isFinite(e.segundos)) {
    what.push(mmss(e.segundos * 1000));
  }
  what.push(`semilla ${e.semilla}`, `${e.pasos} pasos`);
  if (e.conReferencia) what.push('con referencia');

  const thumb = e.estado === 'hecho' && e.intento
    ? h('img.thumb', { src: paths.intento(e.tipo, e.slug, e.intento), alt: '' })
    : h('div.thumb-empty');

  const go = (texto) => h('button.btn', { type: 'button', data: { fid: `go-${e.id}` }, onclick: () => { toggleQueue(false); abrir(e); } }, texto);
  const actions = [];
  if (e.estado === 'hecho' && e.intento) actions.push(go('Ver el intento'));
  else if (e.estado !== 'hecho') actions.push(go('Ir al elemento'));
  return h('div.queue-entry', { class: `is-${{ generando: 'running', hecho: 'done', fallido: 'failed' }[e.estado] || e.estado}`, aria: { label: `${who}: ${what.join(', ')}` } },
    thumb,
    h('div', {}, h('div.who', {}, who), h('div.what', {}, what.join(' · ')),
      e.estado === 'generando' ? progressOf(e) : null,
      e.estado === 'fallido' && e.error ? h('div.what.mono', {}, e.error) : null),
    actions.length ? h('div.queue-actions', {}, actions) : null);
}
