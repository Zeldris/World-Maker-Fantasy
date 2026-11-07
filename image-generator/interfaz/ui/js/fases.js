/* Pantalla de fases del elemento (IMG-25, parte 1; diseño `diseno-interfaz-continua.md` §2.0 y la maqueta aprobada
   `docs/prototipos/img-39-pantalla-elemento.html`, que manda sobre el dibujo). Sobre las rutas de IMG-40:
   GET /api/camino y POST /api/fase/{generar,avanzar,atras}; igual con servidor.py que con el simulador (`?mock=1`).
   Pasos F0 → F1 → F2 → F4 (F3 apagada hasta IMG-37), tres paneles (referencia, fase anterior, intento actual con su
   navegador), el prompt de la fase y Atrás / Regenerar / Avanzar. Sin innerHTML: todo con h() de dom.js.
   app.js la llama: `initFases` (una vez), `abrir` (al elegir otro elemento) y, desde su sondeo único, `progreso` y
   `terminado`; `TECLAS` se suma a las de la pantalla. Queda para la parte 2: Marcar ★, variantes nuevas y borrar. */

import { h, el as $, when } from './dom.js';
import { api, paths, describeError } from './api.js';
import { toast } from './components/toast.js';
import * as cola from './queue-poll.js';

const PERFILES_REF = ['banner', 'thumbnail', 'mapa', 'icono'];
const MOTIVO_F3 = 'F3 Recorte llega con IMG-37';
const S = { tipo: null, slug: null, camino: null, variante: null, lectura: null, idx: null, aviso: '', ref: null, promptEnc: '',
  clave: null, generando: false, token: 0, btn: {}, info: {}, orden: [] };
let ctx = { ampliar: () => {}, seguir: () => {} };

const prompt = h('textarea', { id: 'fasesPrompt', spellcheck: 'false', 'aria-describedby': 'fasesPromptAyuda' });
const barra = h('progress', { max: 100, value: 2 });
const barraTexto = h('div.hint');
const progreso_ = h('div.progreso-fase', { role: 'status' }, barra, barraTexto);

export function initFases(opciones, fases) {
  ctx = { ...ctx, ...opciones };
  S.orden = fases.map((f) => f.id);
  S.info = Object.fromEntries(fases.map((f) => [f.id, f]));
}

/* ---------- lo que se deriva del camino ---------- */
const nombreFase = (id) => (S.info[id] ? `${id} ${S.info[id].nombre}` : id);
const variantes = () => (S.camino && S.camino.variantes) || {};
// Sin ninguna variante, la `base` virtual: se crea sola al generar su primer F0.
function variante() {
  const v = variantes()[S.variante];
  return v || { origen: null, faseActual: 'F0', fases: {}, siguientes: null };
}
function registro(v, f) { return v.fases[f] || { aceptada: null, prompt: null, semilla: null, desde: null, entrada: null, desfasada: false, intentos: [] }; }
// La fase de la que parte `f`: la que ya apuntó, o la aceptada de las que llevan a ella (la más avanzada primero).
function previa(v, f) {
  const r = v.fases[f];
  if (r && r.desde) return r.desde;
  const candidatas = S.orden.filter((x) => (S.info[x].siguientes || []).includes(f)).reverse();
  return candidatas.find((x) => v.fases[x] && v.fases[x].aceptada) || null;
}
function siguientes(v) {
  const l = v.siguientes || (S.info[v.faseActual] ? S.info[v.faseActual].siguientes : []);
  return l.filter((s) => !(s === 'F3' && S.tipo === 'location'));
}
function intentos(v, f) { return registro(v, f).intentos.slice().sort((a, b) => a.n - b.n); }
function indiceVisto(lista) { return lista.length ? Math.min(S.idx === null ? lista.length - 1 : S.idx, lista.length - 1) : -1; }
function srcImagen(imagen, lista) {
  const it = lista.find((i) => i.imagen === imagen);
  return paths.intento(S.tipo, S.slug, imagen.replace(/\.png$/, ''), it ? it.fecha : '');
}
function promptPorDefecto(v, f) {
  const lista = intentos(v, f);
  if (lista.length) return lista[lista.length - 1].prompt;
  const p = previa(v, f);
  if (p) return registro(v, p).prompt || '';
  return f === 'F0' ? S.promptEnc : '';
}
const meta = (i) => `s=${i.semilla} · ${i.segundos} s · ${when(i.fecha)}`;

/* ---------- carga ---------- */
async function buscarReferencia(tipo, slug) {
  for (const p of PERFILES_REF) {
    try { const r = await api.referencia(tipo, slug, p); if (r.ruta) return { ruta: r.ruta, perfil: r.perfil || p, deOtro: p !== 'banner' }; } catch { /* siguiente perfil */ }
  }
  return null;
}
export async function abrir(tipo, slug) {
  const token = ++S.token;
  Object.assign(S, { tipo, slug, camino: null, variante: null, lectura: null, idx: null, aviso: '', ref: null, promptEnc: '', clave: null });
  $('fases').hidden = false;
  render();
  try {
    const [camino, ref, enc, est] = await Promise.all([api.camino(tipo, slug), buscarReferencia(tipo, slug),
      api.prompt(tipo, slug, 'banner').catch(() => ({ prompt: '' })), api.estado()]);
    if (token !== S.token) return;
    Object.assign(S, { camino, ref, promptEnc: enc.prompt || '' });
    S.variante = Object.keys(camino.variantes)[0] || 'base';
    if (est.enMarcha) { S.generando = true; ctx.seguir(); }
  } catch (err) { if (token === S.token) S.aviso = describeError(err); }
  if (token === S.token) render();
}
async function recargar(preferida) {
  const token = ++S.token, tipo = S.tipo, slug = S.slug;
  try {
    const camino = await api.camino(tipo, slug);
    if (token !== S.token) return;
    S.camino = camino;
    if (preferida && camino.variantes[preferida]) S.variante = preferida;
    else if (!camino.variantes[S.variante]) S.variante = Object.keys(camino.variantes)[0] || 'base';
    S.lectura = null; S.idx = null;
  } catch (err) { if (token === S.token) S.aviso = describeError(err); }
  render();
}

/* ---------- el sondeo único de app.js (seguir) ---------- */
export function progreso(e) {
  const nuevo = !S.generando;
  S.generando = true;
  const resto = Math.max(0, e.estimado - e.segundos);
  barra.value = Math.max(2, Math.min(97, 100 * e.segundos / e.estimado));
  const fase = e.paso ? `paso ${e.paso}/${e.pasos}` : e.progreso;
  barraTexto.textContent = `${e.perfil || 'Generando'} · ${fase} · ${e.segundos} s · ${resto ? 'quedan ~' + resto + ' s' : 'casi lista'}`;
  if (nuevo && S.tipo) render();
}
export async function terminado(e) {
  S.generando = false;
  if (S.tipo && e && e.tipo === S.tipo && e.slug === S.slug) await recargar(e.variante); else render();
}

/* ---------- acciones ---------- */
async function accion(fn) {
  S.aviso = '';
  try { await fn(); } catch (err) { S.aviso = describeError(err); render(); }
}
function lanzado() { S.generando = true; S.lectura = null; S.idx = null; barra.value = 2; barraTexto.textContent = 'Empezando…'; cola.refreshNow(); render(); ctx.seguir(); }
const regenerar = () => accion(async () => {
  await api.faseGenerar({ tipo: S.tipo, slug: S.slug, variante: S.variante, fase: variante().faseActual, prompt: prompt.value });
  lanzado();
});
const atras = () => accion(async () => {
  const r = await api.faseAtras(S.tipo, S.slug, S.variante);
  S.camino = r.camino; S.lectura = null; S.idx = null; render();
});
const avanzar = (siguiente, n) => accion(async () => {
  const r = await api.faseAvanzar({ tipo: S.tipo, slug: S.slug, variante: S.variante, fase: variante().faseActual, intento: n, siguiente });
  S.camino = r.camino; S.lectura = null; S.idx = null;
  if (r.lanzado) lanzado();
  else { render(); toast(`Aceptado, pero no se lanzó ${nombreFase(siguiente)}: ${r.motivo || 'sin motivo'}`); }
});
function ver(d) {
  const v = variante(), lista = intentos(v, v.faseActual);
  if (S.lectura || !lista.length) return;
  S.idx = Math.max(0, Math.min(lista.length - 1, indiceVisto(lista) + d));
  render();
}
function pulsar(nombre, k = 0) {
  const b = nombre === 'avanzar' ? (S.btn.avanzar || [])[k] : S.btn[nombre];
  if (b && !b.disabled && b.isConnected) b.click();
}
export const TECLAS = [
  { keys: ['R'], label: 'Regenerar la fase (o Generar, si no tiene intentos)', run: () => pulsar('regenerar') },
  { keys: ['A'], label: 'Atrás: reabrir la fase anterior', run: () => pulsar('atras') },
  { keys: ['Enter'], label: 'Avanzar por la primera opción', run: () => pulsar('avanzar', 0) },
  { keys: ['F'], label: 'Avanzar por la segunda opción', run: () => pulsar('avanzar', 1) },
  { keys: ['ArrowLeft'], label: 'Intento anterior de la fase', run: () => ver(-1) },
  { keys: ['ArrowRight'], label: 'Intento siguiente de la fase', run: () => ver(1) },
];

/* ---------- pintar ---------- */
function marco(titulo, ...contenido) { return h('div.marco', {}, h('h3', {}, titulo), ...contenido); }
function hueco(...texto) { return h('div.hueco', {}, ...texto); }
function imagen(src, titulo) { return h('img.ampliable', { src, alt: titulo, title: 'Clic para ampliar', onclick: () => ctx.ampliar(src, titulo) }); }

function pasos(v) {
  const l = h('ol.pasos', { 'aria-label': 'Fases del camino' });
  for (const id of S.orden) {
    if (id === 'F3' && S.tipo === 'location') continue;  // un fondo no se recorta
    const r = v.fases[id], actual = id === v.faseActual, disponible = S.info[id].disponible;
    const est = r && r.desfasada ? ['⚠', 'desfasada'] : r && r.aceptada ? ['✓', 'aceptada'] : actual ? ['●', 'actual'] : ['·', 'sin hacer'];
    const abierta = (S.lectura || v.faseActual) === id;
    const clic = actual ? () => { S.lectura = null; render(); } : r ? () => { S.lectura = id; render(); } : null;
    const apagado = !disponible || !clic;
    l.append(h('li', {}, h('button.btn.paso', { type: 'button', disabled: apagado, 'data-fase': id, class: `${r && r.desfasada ? 'desfasada' : r && r.aceptada ? 'hecha' : ''}${abierta ? ' abierta' : ''}`,
      aria: { current: actual ? 'step' : null }, title: !disponible ? MOTIVO_F3 : apagado ? 'Aún sin hacer' : `${nombreFase(id)}: ${est[1]}${r && !actual ? ' (ver lo guardado)' : ''}`,
      onclick: clic }, `${est[0]} ${nombreFase(id)}`, !disponible ? h('small', {}, 'llega con IMG-37') : null)));
  }
  return l;
}

function panelReferencia() {
  if (!S.ref) return marco('Referencia', hueco('Sin referencia'));
  const src = paths.juego(S.ref.ruta);
  return marco('Referencia (la imagen del juego)', imagen(src, 'Referencia'), h('div.meta', {}, S.ref.deOtro ? `${S.ref.ruta} (de otro perfil)` : S.ref.ruta));
}
function panelAnterior(v, f) {
  const p = previa(v, f);
  if (!p) return marco('Fase anterior', hueco(f === 'F0' ? 'El boceto sale solo del prompt.' : 'Falta una fase anterior aceptada.'));
  const r = registro(v, p), desf = r.desfasada ? h('span.aviso-desfase', {}, ' ⚠ desfasada') : null;
  const titulo = h('h3', {}, `Aceptada en ${nombreFase(p)}`, desf);
  if (!r.aceptada) return h('div.marco', {}, titulo, hueco('Sin imagen aceptada.'));
  return h('div.marco', {}, titulo, imagen(srcImagen(r.aceptada, r.intentos), `Aceptada en ${nombreFase(p)}`), h('div.meta', {}, `s=${r.semilla}`));
}
function panelIntento(v, f) {
  const lista = intentos(v, f), i = indiceVisto(lista), a = lista[i];
  const nav = lista.length ? h('span.nav-intentos', {},
    h('button.btn.btn-icon', { type: 'button', 'aria-label': 'Intento anterior', title: 'Intento anterior (←)', disabled: i <= 0, onclick: () => ver(-1) }, '◀'),
    h('span', { 'data-intento': 'contador' }, `${i + 1}/${lista.length}`),
    h('button.btn.btn-icon', { type: 'button', 'aria-label': 'Intento siguiente', title: 'Intento siguiente (→)', disabled: i >= lista.length - 1, onclick: () => ver(1) }, '▶')) : null;
  const cab = h('div.cab-marco', {}, h('h3', {}, a ? `Intento ${a.n} de ${nombreFase(f)}` : `${nombreFase(f)} · sin intentos`), nav);
  if (!a) return h('div.marco.actual', {}, cab, hueco(`${f === 'F0' ? 'Elemento nuevo. ' : 'Esta fase aún no tiene imagen. '}«Generar» la pide.`));
  const r = registro(v, f), etiquetas = [];
  if (a.imagen && r.aceptada === a.imagen) etiquetas.push(h('span.ok', {}, 'aceptado'));
  if (a.imagen) return h('div.marco.actual', {}, cab, imagen(srcImagen(a.imagen, lista), `Intento ${a.n} de ${nombreFase(f)}`), h('div.meta', {}, meta(a), ' ', ...etiquetas));
  // sin imagen: fallido (salida distinta de 0) o borrado al avanzar
  const fallo = a.salida !== 0 && a.salida !== undefined && a.salida !== null;
  return h('div.marco.actual', {}, cab, hueco(
    h('strong', {}, fallo ? `Falló (salida ${a.salida})` : 'Imagen borrada al avanzar'),
    h('div', {}, `Prompt: ${a.prompt}`), h('div', {}, `Semilla: ${a.semilla}`),
    fallo && a.error ? h('pre', {}, a.error) : null), h('div.meta', {}, meta(a)));
}
function lecturaFase(v) {
  const f = S.lectura, r = registro(v, f);
  return h('div.lectura', {}, h('h3', {}, `${nombreFase(f)} · lo guardado`),
    r.aceptada ? imagen(srcImagen(r.aceptada, r.intentos), `${nombreFase(f)} aceptada`) : hueco('Esta fase no tiene imagen aceptada.'),
    h('div.meta', {}, r.desfasada ? '⚠ desfasada: se aceptó otra imagen en la fase de la que sale. ' : '', r.semilla !== null && r.semilla !== undefined ? `s=${r.semilla}` : ''),
    h('pre.prompt-leido', {}, r.prompt || '(sin prompt guardado)'),
    h('div.acciones', {}, h('button.btn.btn-primary', { type: 'button', onclick: () => { S.lectura = null; render(); } }, `Volver a ${nombreFase(v.faseActual)}`)));
}

function acciones(v, f) {
  const lista = intentos(v, f), a = lista[indiceVisto(lista)], sigs = siguientes(v), b = S.btn = { avanzar: [] };
  const ocupado = S.generando ? 'Hay una generación en curso: espera a que acabe' : null;
  b.atras = h('button.btn', { type: 'button', 'data-accion': 'atras', onclick: atras, disabled: !!ocupado || !previa(v, f), title: ocupado || (previa(v, f) ? 'Reabrir la fase anterior (A)' : 'No hay fase anterior') }, 'Atrás ', h('kbd.kbd', {}, 'A'));
  const sinPrompt = !prompt.value.trim() ? 'El prompt está vacío' : null;
  b.regenerar = h('button.btn', { type: 'button', 'data-accion': 'regenerar', onclick: regenerar, disabled: !!(ocupado || sinPrompt), title: ocupado || sinPrompt || 'Otra semilla, o la misma si editas el prompt (R)' },
    lista.length ? 'Regenerar ' : 'Generar ', h('kbd.kbd', {}, 'R'));
  const der = h('div.acciones-der', {}, b.regenerar);
  if (f === 'F4') {
    der.append(h('button.btn.btn-primary', { type: 'button', disabled: true, title: 'Marcar ★ llega con la parte 2' }, 'Marcar ★'));
  } else {
    sigs.forEach((s, k) => {
      const no = ocupado || (!S.info[s] || !S.info[s].disponible ? `${nombreFase(s)} aún no está disponible` : null) || (!a ? 'Aún no hay intentos que aceptar' : null)
        || (!a.imagen ? 'Un intento sin imagen no se puede aceptar' : null);
      const nombre = s === 'F4' ? 'Avanzar a la Final' : `Avanzar por ${S.info[s] ? S.info[s].nombre : s}`;
      const bt = h('button.btn', { type: 'button', class: k === 0 ? 'btn-primary' : '', disabled: !!no, 'data-siguiente': s, title: no || `Aceptar este intento y pasar a ${nombreFase(s)} (${k === 0 ? 'Intro' : 'F'})`,
        onclick: () => avanzar(s, a.n) }, nombre + ' ', h('kbd.kbd', {}, k === 0 ? 'Intro' : 'F'));
      b.avanzar.push(bt); der.append(bt);
    });
  }
  return h('div.acciones', {}, b.atras, der);
}

function render() {
  const raiz = $('fases');
  S.btn = {};
  if (!S.tipo) { raiz.hidden = true; return; }
  const v = variante(), f = v.faseActual, vs = Object.keys(variantes());
  const sel = h('select', { id: 'fasesVariante', 'aria-label': 'Variante', disabled: vs.length < 2, onchange: (ev) => { S.variante = ev.target.value; S.lectura = null; S.idx = null; render(); } },
    ...(vs.length ? vs : ['base']).map((x) => h('option', { value: x, selected: x === S.variante }, x)));
  const cab = h('div.row-between.cab-fases', {}, h('h2', {}, 'Camino por fases'), h('label.row', {}, h('span.muted', {}, 'Variante'), sel));
  const hijos = [cab];
  if (S.aviso) hijos.push(h('div.notice.notice-bad', { role: 'alert' }, S.aviso));
  if (!S.camino) { hijos.push(h('p.muted', {}, S.aviso ? '' : 'Cargando…')); raiz.replaceChildren(...hijos); return; }
  hijos.push(pasos(v));
  if (S.lectura && S.lectura !== f && v.fases[S.lectura]) hijos.push(lecturaFase(v));
  else {
    S.lectura = null;
    const clave = `${S.tipo}/${S.slug}/${S.variante}/${f}/${intentos(v, f).length}`;
    if (clave !== S.clave) { S.clave = clave; prompt.value = promptPorDefecto(v, f); }
    hijos.push(h('div.tres', {}, panelReferencia(), panelAnterior(v, f), panelIntento(v, f)),
      h('div.field', {}, h('label', { for: 'fasesPrompt' }, `Prompt de ${nombreFase(f)}`), prompt,
        h('div.hint', { id: 'fasesPromptAyuda' }, 'Editarlo mantiene la semilla; sin cambios, Regenerar usa otra.')),
      acciones(v, f));
    if (S.generando) hijos.push(progreso_);
  }
  raiz.replaceChildren(...hijos);
}
prompt.addEventListener('input', () => {  // el motivo de «Regenerar» depende de que haya texto
  if (S.btn.regenerar) {
    const vacio = !prompt.value.trim();
    S.btn.regenerar.disabled = vacio || S.generando;
    S.btn.regenerar.title = S.generando ? 'Hay una generación en curso: espera a que acabe' : vacio ? 'El prompt está vacío' : 'Otra semilla, o la misma si editas el prompt (R)';
  }
});
