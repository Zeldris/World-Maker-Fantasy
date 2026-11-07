/* Pantalla del elemento del generador de imágenes (CFG-43), módulo de la página; la sirve servidor.py (/ui/js/app.js).
   IMG-41: sobre la base de GVIG (dom.js, toast, lightbox, tema y talla de letra) y su cliente de API (api.js). Misma
   lógica y mismas rutas /api/ de antes, más la cola en la cabecera (queue-poll.js, queue-bar.js) y los atajos de
   teclado y mando (shortcuts.js, lib/gamepad.js); con `?mock=1` en la URL carga ../mock/api-mock.js en lugar de
   servidor.py. */

import { h, el as $, setVars } from './dom.js';
import { initTheme } from './components/theme.js';
import { initFontScale } from './components/font-scale.js';
import { initLightbox, openLightbox } from './components/lightbox.js';
import { toastOk, toastError, dismissLastToast } from './components/toast.js';
import { api, paths, setTransport, onOffline, describeError } from './api.js';
import * as cola from './queue-poll.js';
import { initQueueBar, toggleQueue, isQueueOpen } from './components/queue-bar.js';
import { initShortcuts, setScreenKeys } from './components/shortcuts.js';
import { initGamepad } from './lib/gamepad.js';
import * as fases from './fases.js';

const TAMANOS = { banner: '1280×512', thumbnail: '768×768', mapa: '832×624', icono: '512×512' };
let elementos = [], actual = null, perfil = null, cargado = null, referencia = null, sondeo = null, perfilesBD = {};

function guardar() { try { localStorage.setItem('generador-cfg43', JSON.stringify({ tipo: actual && actual.tipo, slug: actual && actual.slug, perfil })); } catch { /* sin almacenamiento */ } }
function recordado() { try { return JSON.parse(localStorage.getItem('generador-cfg43') || 'null') || {}; } catch { return {}; } }

/* ---------- ampliar ---------- */
// Sola, por la caja de luz de GVIG; junto a la actual del juego, en un diálogo propio (clases, sin estilos en línea).
function ampliar(src, titulo, juego) {
  if (!juego) return openLightbox(src, titulo);
  const g = $('grande');
  g.replaceChildren(h('figure', {}, h('img', { src, alt: '' }), titulo), h('figure', {}, h('img', { src: juego, alt: '' }), 'Actual del juego'),
    h('button.btn', { type: 'button', onclick: () => g.close() }, 'Cerrar'));
  g.showModal();
}
$('grande').addEventListener('click', (e) => { if (e.target === $('grande')) $('grande').close(); });

/* ---------- lista de elementos ---------- */
async function cargarElementos() {
  const r = await api.elementos();
  elementos = r.elementos;
  $('avisoLista').textContent = r.aviso || '';
  const sel = $('categoria'), previa = sel.value;
  const tipos = [...new Set(elementos.map((e) => e.tipo))].sort();
  sel.replaceChildren(new Option('Todas las categorías', ''));
  for (const t of tipos) sel.add(new Option(`${t} (${elementos.filter((e) => e.tipo === t).length})`, t));
  sel.value = tipos.includes(previa) ? previa : '';
  $('tipos').replaceChildren(...tipos.map((t) => new Option('', t)));
  pintarLista();
}
function pintarLista() {
  const cat = $('categoria').value, texto = $('filtro').value.trim().toLowerCase();
  const vistos = elementos.filter((e) => (!cat || e.tipo === cat) && (!texto || `${e.tipo} ${e.slug} ${e.nombre || ''}`.toLowerCase().includes(texto)));
  const l = $('lista'); l.replaceChildren();
  for (const e of vistos) {
    const marcas = h('div.marcas');
    if (e.intentos) marcas.append(h('span', {}, `${e.intentos} intento${e.intentos === 1 ? '' : 's'}`));
    if (e.elegidas.length) marcas.append(h('span.eleg', {}, '✓ elegida'));
    const miniatura = e.juego ? h('img.miniatura', { loading: 'lazy', alt: '', src: paths.juego(e.juego) }) : h('div.miniatura', { title: 'Sin imagen en el juego' });
    const abrir = () => elegirElemento(e.tipo, e.slug);
    l.append(h('div.elemento', {
      class: actual && actual.tipo === e.tipo && actual.slug === e.slug ? 'activo' : '', role: 'button', tabindex: 0, onclick: abrir,
      onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } } },
      miniatura, h('div', {}, h('div.nombre', {}, (e.nombre || e.slug) + (cat ? '' : ` · ${e.tipo}`)), e.nombre ? h('small.muted', {}, e.slug) : '', marcas)));
  }
  if (!vistos.length) l.append(h('div.elemento', {}, h('small.muted', {}, elementos.length ? 'Sin coincidencias.' : 'Aún no hay elementos: crea uno nuevo o genera sus prompts en la enciclopedia.')));
}
$('categoria').onchange = pintarLista;
$('filtro').oninput = pintarLista;
$('nuevo').onclick = () => { $('nuevoForm').hidden = !$('nuevoForm').hidden; };
$('nuevoOk').onclick = () => {
  const tipo = $('nuevoTipo').value.trim(), slug = $('nuevoSlug').value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(tipo) || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug)) { $('nuevoError').textContent = 'Solo letras sin tilde, cifras, guiones y _.'; return; }
  $('nuevoError').textContent = ''; $('nuevoForm').hidden = true;
  elegirElemento(tipo, slug);
};

/* ---------- ficha del elemento ---------- */
// El perfil que busca el juego para los tipos que no usan miniatura y banner (imageAssets.ts: zoneMapImageUrl, iconoUrlFor).
const PERFIL_DEL_TIPO = { zona: 'mapa', clase: 'icono', especializacion: 'icono' };
function datosElemento() { return elementos.find((e) => e.tipo === actual.tipo && e.slug === actual.slug) || { tipo: actual.tipo, slug: actual.slug, perfiles: [], intentos: 0, elegidas: [], juego: null }; }

async function elegirElemento(tipo, slug, perfilInicial) {
  const cambia = !actual || actual.tipo !== tipo || actual.slug !== slug;
  actual = { tipo, slug };
  const e = datosElemento();
  perfilesBD = Object.fromEntries(e.perfiles.map((p) => [p.perfil, p.usado]));
  $('vacio').hidden = true; $('antigua').hidden = false; $('ficha').hidden = false; $('galeriaSeccion').hidden = false;
  if (cambia) fases.abrir(tipo, slug);  // el camino por fases (fases.js); lo de abajo es la generación suelta de antes
  $('fichaNombre').textContent = slug;
  $('fichaDetalle').textContent = `${tipo} · ${e.intentos} intento${e.intentos === 1 ? '' : 's'}${e.elegidas.length ? ' · elegida: ' + e.elegidas.join(', ') : ''}`;
  const caja = $('fichaImagen'); caja.replaceChildren();
  if (e.juego) caja.append(h('img.ampliable', { src: paths.juego(e.juego), alt: 'Imagen actual del juego', title: 'Imagen actual del juego (clic para ampliar)', onclick: () => ampliar(paths.juego(e.juego), 'Actual del juego') }));
  else caja.append(h('div.hueco.muted', {}, 'El juego aún no tiene imagen'));
  if (cambia) { $('prompt').value = ''; cargado = null; }
  pintarPerfiles();
  const inicial = perfilInicial || (!cambia ? perfil : null) || (recordado().tipo === tipo && recordado().slug === slug ? recordado().perfil : null)
    || (e.perfiles[0] && e.perfiles[0].perfil) || PERFIL_DEL_TIPO[tipo] || 'thumbnail';
  await seleccionarPerfil(inicial, cambia);
  pintarLista();
  await pintarGaleria();
}
function pintarPerfiles() {
  const caja = $('perfiles'); caja.replaceChildren();
  for (const p of Object.keys(TAMANOS)) {
    const nota = p in perfilesBD ? (perfilesBD[p] ? 'prompt usado' : 'prompt base') : 'sin prompt en la enciclopedia';
    caja.append(h('button.btn.btn-toggle', { type: 'button', aria: { pressed: p === perfil }, onclick: () => seleccionarPerfil(p, true) }, p, h('small', {}, `${TAMANOS[p]} · ${nota}`)));
  }
  const filtro = $('filtroPerfil'), previo = filtro.value;
  filtro.replaceChildren(new Option('Todos los perfiles', ''));
  for (const p of Object.keys(TAMANOS)) filtro.add(new Option(p, p));
  filtro.value = previo;
}
async function seleccionarPerfil(p, traer) {
  perfil = p; guardar(); pintarPerfiles();
  if (traer && p in perfilesBD) await traerPrompt();
  else marcarFuente();
  buscarReferencia();
}
async function traerPrompt() {
  const pide = { tipo: actual.tipo, slug: actual.slug, perfil };  // si cambias de perfil antes de que llegue, se descarta
  const vigente = () => actual.tipo === pide.tipo && actual.slug === pide.slug && perfil === pide.perfil;
  try {
    const r = await api.prompt(pide.tipo, pide.slug, pide.perfil);
    if (!vigente()) return;
    $('prompt').value = r.prompt;
    cargado = { ...pide, prompt: r.prompt, fuente: r.fuente };
    marcarFuente();
  } catch (err) { if (vigente()) $('fuente').textContent = describeError(err); }
}
function marcarFuente() {
  const igual = !!cargado && cargado.prompt === $('prompt').value && cargado.tipo === actual.tipo && cargado.slug === actual.slug && cargado.perfil === perfil;
  $('fuente').textContent = igual ? `Prompt ${cargado.fuente} de la enciclopedia (${cargado.tipo}/${cargado.slug}/${cargado.perfil})`
    : (cargado && cargado.perfil === perfil) ? 'Editado aquí: se generará con este texto (el registro dirá «pegado»)' : 'Pegado';
  $('volver').hidden = !(perfil in perfilesBD) || igual;
  return igual;
}
$('prompt').addEventListener('input', marcarFuente);
$('volver').onclick = traerPrompt;
$('azar').onclick = () => { $('semilla').value = Math.floor(Math.random() * 1e6); };

/* ---------- referencia ---------- */
async function buscarReferencia() {
  referencia = null;
  if (actual) { try { const r = await api.referencia(actual.tipo, actual.slug, perfil); if (r.ruta) referencia = r; } catch { /* sin referencia */ } }
  $('refBloque').hidden = !referencia;
  if (referencia) $('refNombre').textContent = referencia.perfil === perfil ? `(${referencia.ruta})` : `(${referencia.ruta}: de otro perfil)`;
  pintarReferencia();
}
function pintarReferencia() {
  const ver = referencia && $('usarRef').checked;
  $('refPrevia').hidden = !ver;
  if (ver) $('refPrevia').src = paths.juego(referencia.ruta);
}
$('usarRef').onchange = pintarReferencia;
$('refPrevia').onclick = () => ampliar($('refPrevia').src, 'Referencia');

/* ---------- generar y progreso ---------- */
function mostrarResultado(texto, ok, detalle) {
  const r = $('resultado'); r.hidden = !texto; r.className = 'notice ' + (ok ? 'notice-ok' : 'notice-bad'); r.replaceChildren();
  if (!texto) return;
  r.append(texto);
  if (detalle) r.append(h('details', {}, h('summary', {}, 'Ver el final del log'), h('pre', {}, detalle)));
}
async function generar() {
  const peticion = { tipo: actual.tipo, slug: actual.slug, perfil, prompt: $('prompt').value, desdeBase: marcarFuente(),
    semilla: Number($('semilla').value), pasos: Number($('pasos').value), usarReferencia: !$('refBloque').hidden && $('usarRef').checked };
  mostrarResultado('');
  try { await api.generar(peticion); cola.refreshNow(); $('generar').disabled = true; $('progreso').hidden = false; $('relleno').value = 2; $('progresoTexto').textContent = 'Empezando…'; seguir(); }
  catch (err) { mostrarResultado(describeError(err), false); }
}
$('generar').onclick = generar;

function seguir() {
  clearTimeout(sondeo);
  sondeo = setTimeout(async () => {
    let e;
    try { e = await api.estado(); } catch (err) { mostrarResultado(describeError(err), false); $('generar').disabled = false; fases.terminado(null); return; }
    if (e.enMarcha) {
      $('progreso').hidden = false;
      fases.progreso(e);
      const resto = Math.max(0, e.estimado - e.segundos);
      $('relleno').value = Math.max(2, Math.min(97, 100 * e.segundos / e.estimado));
      const fase = e.paso ? `paso ${e.paso}/${e.pasos}` : e.progreso;
      $('progresoTexto').textContent = `${fase[0].toUpperCase() + fase.slice(1)} · ${e.segundos} s · ${resto ? 'quedan ~' + resto + ' s' : 'casi lista'}`;
      return seguir();
    }
    $('generar').disabled = false; $('progreso').hidden = true;
    await fases.terminado(e);
    if (e.rc === 0) { mostrarResultado(`Lista en ${e.segundos} s: ${e.nombre}`, true); toastOk(`Imagen lista: ${e.nombre}`); }
    else if (e.rc !== null && e.rc !== undefined) { mostrarResultado(`Falló (salida ${e.rc}) tras ${e.segundos} s: ${e.salida.slice(-3).join(' · ')}`, false, e.logFinal || e.salida.join('\n')); toastError(`La generación falló (salida ${e.rc}).`); }
    await cargarElementos();
    if (actual) { const a = actual; await elegirElemento(a.tipo, a.slug, perfil); }
  }, 1000);
}

/* ---------- galería ---------- */
function datosIntento(f) {
  return `${f.perfil} · semilla ${f.semilla} · ${f.pasos} pasos · ${f.conReferencia ? 'con referencia' : 'sin referencia'} · ${f.segundos} s · prompt ${f.prompt} · ${f.fecha.replace('T', ' ').slice(0, 16)}`;
}
async function pintarGaleria() {
  const a = actual, g = $('galeria');
  let filas;
  try { filas = await api.elemento(a.tipo, a.slug); } catch (err) { g.textContent = describeError(err); return; }
  if (!actual || actual.tipo !== a.tipo || actual.slug !== a.slug) return;
  const filtro = $('filtroPerfil').value;
  let juego = null;
  try { const r = await api.referencia(a.tipo, a.slug, filtro || perfil); if (r.ruta) juego = r; } catch { /* sin imagen del juego */ }
  const juegoSrc = juego ? paths.juego(juego.ruta) : null;
  g.replaceChildren();
  if (juego) g.append(h('div.tarjeta.juego', {}, h('span.distintivo.neutro', {}, 'Actual del juego'),
    h('img.ampliable', { src: juegoSrc, alt: '', onclick: () => ampliar(juegoSrc, 'Actual del juego') }),
    h('div.cuerpo', {}, h('div.titulo', {}, 'Actual del juego'), h('div.datos', {}, `${juego.ruta}${juego.perfil === (filtro || perfil) ? '' : ' (de otro perfil)'}`))));
  const vistas = filas.filter((f) => !filtro || f.perfil === filtro);
  vistas.sort((x, y) => Number(y.elegida) - Number(x.elegida));  // la elegida destacada, primero (estable)
  if (!vistas.length) g.append(h('p.muted', {}, 'Aún no hay imágenes de este elemento: genera la primera.'));
  for (const f of vistas) g.append(tarjeta(f, juegoSrc));
}
function tarjeta(f, juegoSrc) {
  const a = actual, src = paths.intento(a.tipo, a.slug, f.nombre, f.fecha);
  const nota = h('textarea', { placeholder: 'Qué te parece, qué sobra, qué falta…', 'aria-label': 'Nota de la imagen' }); nota.value = f.nota;
  const ok = h('span.ok');
  nota.onchange = async () => { try { await api.nota(a.tipo, a.slug, f.nombre, nota.value); ok.textContent = 'guardada ✓'; } catch (err) { ok.textContent = describeError(err); } };
  nota.oninput = () => { ok.textContent = ''; };
  const aviso = (texto, bien) => { const av = $('avisoGaleria'); av.hidden = false; av.className = 'notice ' + (bien ? 'notice-ok' : 'notice-bad'); av.textContent = texto; };
  const elegir = h('button.btn.btn-primary', { type: 'button', onclick: async () => {
    try { const r = await api.elegir(a.tipo, a.slug, f.nombre); await cargarElementos(); await elegirElemento(a.tipo, a.slug, perfil);
      aviso(`Copiada a image-generator/${r.destino}. Para verla en el juego, cópiala a backend/uploads/images/${a.tipo}/.`, true); }
    catch (err) { aviso(describeError(err), false); } } }, f.elegida ? '✓ Elegida (repetir)' : 'Elegir esta');
  elegir.disabled = !f.imagen; elegir.title = f.destino;
  const reutilizar = h('button.btn', { type: 'button', onclick: () => {
    perfil = f.perfil; pintarPerfiles(); $('prompt').value = f.textoPrompt; $('semilla').value = f.semilla; $('pasos').value = f.pasos;
    cargado = null; marcarFuente(); guardar(); buscarReferencia(); $('ficha').scrollIntoView({ behavior: 'smooth' }); } }, 'Reutilizar prompt y semilla');
  return h('div.tarjeta', { class: f.elegida ? 'elegida' : '' },
    f.elegida ? h('span.distintivo', {}, '✓ Elegida') : null,
    f.imagen ? h('img.ampliable', { src, alt: '', onclick: () => ampliar(src, f.nombre, juegoSrc) }) : h('div.sin-imagen', {}, `Sin imagen (salida ${f.salida})`),
    h('div.cuerpo', {}, h('div.titulo', {}, f.perfil, h('small.muted', {}, ' · ' + f.nombre)), h('div.datos', {}, datosIntento(f)),
      nota, h('div.botones', {}, elegir, reutilizar, ok),
      h('details', {}, h('summary', {}, 'Prompt'), h('pre', {}, f.textoPrompt))));
}
$('filtroPerfil').onchange = pintarGaleria;

/* ---------- inicio ---------- */
// `--header-h` sigue la altura real de la cabecera (cambia a ≤640 px): el menú de ajustes se coloca bajo ella.
function medirCabecera() {
  const cab = document.querySelector('.app-header');
  const poner = () => setVars(document.documentElement, { 'header-h': `${cab.offsetHeight}px` });
  poner();
  if (window.ResizeObserver) new ResizeObserver(poner).observe(cab);
}
// Esc: cierra a la vez diálogos, cola y ajustes; sin nada abierto, el último aviso (como en GVIG).
function cerrarTodo() {
  const algo = isQueueOpen() || document.querySelector('dialog[open], :popover-open') !== null;
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  if (isQueueOpen()) toggleQueue(false);
  if ($('settings').matches(':popover-open')) $('settings').hidePopover();
  if (!algo) dismissLastToast();
}
// Las teclas de esta pantalla: las de fases (fases.js: Regenerar, Atrás, Avanzar, intentos) y las de siempre.
const TECLAS = [
  { keys: ['/'], label: 'Ir al filtro de elementos', run: () => $('filtro').focus() },
  { keys: ['G'], label: 'Generar imagen suelta (con la generación antigua desplegada)', run: () => { if ($('antigua').open && !$('ficha').hidden && !$('generar').disabled) $('generar').click(); } },
];
async function iniciar() {
  if (new URLSearchParams(location.search).get('mock') === '1') setTransport((await import('../mock/api-mock.js')).transport);
  onOffline((sin) => { if (sin) toastError('Sin conexión con el servidor: ¿sigue abierto abrir.sh?'); });
  initTheme($('theme'));
  initFontScale($('font-scale'));
  initLightbox();
  medirCabecera();
  // la cola (pastilla y cajón de GVIG): su enlace abre el elemento en el perfil de la entrada
  initQueueBar($('queue-pill'), $('queue-drawer'), (e) => elegirElemento(e.tipo, e.slug, e.perfil));
  cola.start();
  setScreenKeys('En la pantalla del elemento', [...fases.TECLAS, ...TECLAS]);
  initShortcuts({ toggleQueue, closeAll: cerrarTodo, isQueueOpen });
  initGamepad();
  const ini = await api.inicio();
  fases.initFases({ ampliar, seguir }, ini.fases || []);
  $('mundo').textContent = `mundo ${ini.mundo} · todo se guarda en image-generator/generated/`;
  await cargarElementos();
  const e = await api.estado();
  const r = recordado();
  if (e.enMarcha) { $('generar').disabled = true; $('progreso').hidden = false; await elegirElemento(e.tipo, e.slug, e.perfil); seguir(); }
  else if (r.tipo && r.slug) await elegirElemento(r.tipo, r.slug, r.perfil);
}
iniciar().catch((err) => { $('avisoLista').textContent = describeError(err); });
