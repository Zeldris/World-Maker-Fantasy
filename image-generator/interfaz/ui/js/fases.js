/* Pantalla de fases del elemento (IMG-25, parte 1; diseño `diseno-interfaz-continua.md` §2.0 y la maqueta aprobada
   `docs/prototipos/img-39-pantalla-elemento.html`, que manda sobre el dibujo). Sobre las rutas de IMG-40:
   GET /api/camino y POST /api/fase/{generar,avanzar,atras}; igual con servidor.py que con el simulador (`?mock=1`).
   Casilla «usar la imagen del juego de referencia» por fase (usarReferencia en generar y avanzar). Parte 2: renombrar el elemento (✎), «Cómo se hizo» (la cadena de pasos de una imagen), «Borrar esta fase» con aviso de
   lo que arrastra (/api/fase/dependientes y /api/fase/borrar) y Marcar ★ en la Final (/api/fase/marcar, tecla M).
   IMG-53: las variantes nuevas empiezan en P1 y siguen P2…P9 → F4 (los Pn que existen y la Final), con selector de motor
   (pasos y Final), 1-2 semillas (pasos) y referencias con rol (`filaMotor`, `filaReferencias`, «Fijar como ancla»);
   F0/F1/F2 solo se ven en las variantes antiguas, sin selector. Pasos antiguos F0 → F1 → F2 → F4 (F3 apagada hasta IMG-37), tres paneles (referencia, fase anterior, intento actual con su
   navegador), el prompt de la fase y Atrás / Regenerar / Avanzar. Sin innerHTML: todo con h() de dom.js.
   app.js la llama: `initFases` (una vez), `abrir` (al elegir otro elemento) y, desde su sondeo único, `progreso` y
   `terminado`; `TECLAS` se suma a las de la pantalla. Queda: las variantes «desde aquí» (IMG-42). */

import { h, el as $, when } from './dom.js';
import { api, paths, describeError } from './api.js';
import { toast, toastOk } from './components/toast.js';
import { confirmAction } from './components/confirm.js';
import * as cola from './queue-poll.js';

const PERFILES_REF = ['banner', 'thumbnail', 'mapa', 'icono'];
const MOTIVO_F3 = 'F3 Recorte llega con IMG-37';
const S = { tipo: null, slug: null, camino: null, variante: null, lectura: null, idx: null, aviso: '', ref: null, promptEnc: '',
  clave: null, generando: false, token: 0, btn: {}, info: {}, orden: [], editando: false, usarRef: {},
  motores: [], motorPorDefecto: 'klein4b', refs: {}, semillas: {} };
const motorRecordado = {};  // IMG-53: el último motor elegido, por elemento (tipo/slug)
const ROLES = ['sujeto', 'lugar', 'equipo', 'estilo'];
let ctx = { ampliar: () => {}, seguir: () => {}, lista: async () => {} };
let avisadaMarca = false;  // el aviso «marcar no es publicar» sale una vez por sesión

const prompt = h('textarea', { id: 'fasesPrompt', spellcheck: 'false', 'aria-describedby': 'fasesPromptAyuda fasesPromptFuente' });
const fuentePrompt = h('div.hint', { id: 'fasesPromptFuente' });
const campoNombre = h('input', { type: 'text', id: 'fasesNombre', maxlength: 120, 'aria-label': 'Nombre del elemento', autocomplete: 'off' });
const casillaRef = h('input', { type: 'checkbox', id: 'fasesUsarRef' });
const barra = h('progress', { max: 100, value: 2 });
const barraTexto = h('div.hint');
const progreso_ = h('div.progreso-fase', { role: 'status' }, barra, barraTexto);

export function initFases(opciones, fases) {
  ctx = { ...ctx, ...opciones };
  S.orden = fases.map((f) => f.id);
  S.motores = ctx.motores || [];
  S.motorPorDefecto = ctx.motorPorDefecto || 'klein4b';
  S.info = Object.fromEntries(fases.map((f) => [f.id, f]));
}

/* ---------- lo que se deriva del camino ---------- */
const nombreFase = (id) => (S.info[id] ? `${id} ${S.info[id].nombre}` : id);
const variantes = () => (S.camino && S.camino.variantes) || {};
// Sin ninguna variante, la `base` virtual: se crea sola al generar su primer paso (P1; F0 solo en un servidor sin pasos).
function variante() {
  const v = variantes()[S.variante];
  return v || { origen: null, faseActual: S.info.P1 ? 'P1' : 'F0', fases: {}, siguientes: null };
}
/* IMG-53: P1…P9 son los pasos (motor, semillas y referencias con rol); la Final también elige motor y referencias. */
const esPaso = (f) => /^P[1-9]$/.test(f);
const esAntigua = (f) => f === 'F0' || f === 'F1' || f === 'F2';
const sinEntrada = (f) => f === 'F0' || f === 'P1';
const conMotor = (f) => esPaso(f) || f === 'F4';
const topeRefs = (f) => (f === 'P1' ? 4 : 3);  // con imagen de entrada, 3 (la entrada cuenta una de 4)
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
/* IMG-50: el inicio de los prompts antiguos pide usar una imagen de referencia. Sobra: si la casilla está marcada, fase.py añade el suyo. */
const sinInicioDeReferencia = (texto) => texto.replace(/^Use the reference image[^:]*:\s*/i, '');
const FUENTES = { usado: 'con el que se hizo la imagen del juego', base: 'base de la enciclopedia' };
function pintarFuente() {
  const propuesto = !!S.promptEnc && prompt.value === S.promptEnc;
  fuentePrompt.textContent = propuesto && FUENTES[S.fuenteEnc] ? `Propuesto: el prompt ${FUENTES[S.fuenteEnc]}.` : '';
}
function promptPorDefecto(v, f) {
  const lista = intentos(v, f);
  if (lista.length) return lista[lista.length - 1].prompt;
  const p = previa(v, f);
  // IMG-53: la Final de una cadena de pasos propone la pasada corta de estilo, no el «cambia solo esto» del último paso
  if (f === 'F4' && esPaso(p || '') && S.info.F4 && S.info.F4.promptPorDefecto) return S.info.F4.promptPorDefecto;
  if (p) return registro(v, p).prompt || '';
  return sinEntrada(f) ? S.promptEnc : '';
}
const marcadaImg = (imagen) => !!imagen && ((S.camino && S.camino.marcadas) || []).some((m) => m.variante === S.variante && m.imagen === imagen);
// Solo para apagar el botón: la regla es la de camino.intento_desfasado y la aplica el servidor.
const desfasado = (v, a) => !!a.desde && a.entrada !== ((v.fases[a.desde] || {}).aceptada || null);
const MOTIVO_DESFASE = 'Esta Final salió de un boceto que ya no es el aceptado: genera otra';
const meta = (i) => `s=${i.semilla}${i.motor ? ` · motor ${i.motor}` : ''} · ${i.segundos} s · ${when(i.fecha)}${i.referencia ? ' · con referencia' : ''}${(i.referencias || []).length ? ` · con ${i.referencias.length} ${i.referencias.length === 1 ? 'referencia' : 'referencias'}` : ''}`;
const MARCA_MEDIDA = { ok: '✓', aviso: '⚠', falla: '✗' };
const decimal = (x, n) => x.toFixed(n).replace('.', ',');
const valorMedido = (nombre, m, n, titulo) => h('span', { title: titulo }, `${nombre} ${decimal(m.valor, n)} ${MARCA_MEDIDA[m.estado]}`);
/* La medida del intento (scripts/medir/medida.py): los intentos anteriores a ella no la llevan. */
function lineaMedida(a) {
  const m = a.medida;
  if (!m) return null;
  const color = 'Distancia de color con la imagen del juego';
  const partes = [];
  if (m.ssim) partes.push(valorMedido('SSIM', m.ssim, 2, 'Parecido de forma con la imagen de la que parte: por debajo de 0,7 puede haberse perdido la forma. No mira el detalle.'));
  if (m.emd) partes.push(valorMedido('EMD Cb', m.emd.cb, 1, `${color}: bien hasta 6, falla por encima de 11,4.`), valorMedido('Cr', m.emd.cr, 1, `${color}: bien hasta 7,5, falla por encima de 13,5.`), ...(m.emd.y ? [valorMedido('Y', m.emd.y, 1, 'Distancia de luminosidad con la imagen del juego: bien hasta 20, falla por encima de 43.')] : []));
  else if (!m.error) partes.push('sin medida de color: no tiene imagen del juego');
  if (m.error) partes.push(`no se pudo medir (${m.error})`);
  return h('div.meta', { 'data-medida': '' }, ...partes.flatMap((p, i) => (i ? [' · ', p] : [p])));
}
/* Lo elegido en la casilla mientras se está en el elemento; si no, lo que llevó el último intento de la fase. */
const claveRef = (f) => `${S.variante}/${f}`;
function usaRef(v, f) {
  const elegido = S.usarRef[claveRef(f)];
  if (elegido !== undefined) return elegido;
  const lista = intentos(v, f);
  return lista.length ? !!lista[lista.length - 1].referencia : false;
}

/* ---------- carga ---------- */
async function buscarReferencia(tipo, slug) {
  for (const p of PERFILES_REF) {
    try { const r = await api.referencia(tipo, slug, p); if (r.ruta) return { ruta: r.ruta, perfil: r.perfil || p, deOtro: p !== 'banner' }; } catch { /* siguiente perfil */ }
  }
  return null;
}
export async function abrir(tipo, slug) {
  const token = ++S.token;
  Object.assign(S, { tipo, slug, camino: null, variante: null, lectura: null, idx: null, aviso: '', ref: null, promptEnc: '', fuenteEnc: null, clave: null, editando: false, usarRef: {} });
  $('fases').hidden = false;
  render();
  try {
    const [camino, ref, enc, est] = await Promise.all([api.camino(tipo, slug), buscarReferencia(tipo, slug),
      api.prompt(tipo, slug, 'banner').catch(() => ({ prompt: '' })), api.estado()]);
    if (token !== S.token) return;
    Object.assign(S, { camino, ref, promptEnc: sinInicioDeReferencia(enc.prompt || ''), fuenteEnc: enc.fuente || null });
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
  try { await fn(); } catch (err) {
    S.aviso = describeError(err); render();
    if (err && err.status === 400) toast(S.aviso);  // lo que la API rechaza (motor sin archivos, referencia que no existe…) se ve también como aviso
  }
}
/* ---------- IMG-53: motor, semillas y referencias con rol de los pasos y la Final ---------- */
const motorDe = (id) => S.motores.find((m) => m.id === id);
function motorElegido(v, f) {
  const guardado = motorRecordado[`${S.tipo}/${S.slug}`];
  const ultimo = (intentos(v, f).filter((i) => i.motor).pop() || {}).motor;
  for (const id of [guardado, ultimo, S.motorPorDefecto]) { const m = motorDe(id); if (m && m.disponible) return m.id; }
  return S.motorPorDefecto;
}
const claveVariante = () => `${S.tipo}/${S.slug}/${S.variante}`;  // semillas y referencias se quedan al cambiar de elemento y volver
const semillasElegidas = () => S.semillas[claveVariante()] || 2;
const refsDe = () => S.refs[claveVariante()] || (S.refs[claveVariante()] = []);
/* Lo que se añade a la petición de lanzar `destino`: nada en F0/F1/F2 (la API rechaza ahí el motor). */
function extras(v, destino, desde) {
  if (!conMotor(destino)) return {};
  const x = { motor: motorElegido(v, desde) };
  if (esPaso(destino)) x.semillas = semillasElegidas();
  const refs = refsDe().slice(0, topeRefs(destino));
  if (refs.length) x.referencias = refs.map((r) => ({ rol: r.rol, imagen: r.imagen }));
  return x;
}
/* Las imágenes que se pueden usar como referencia: la del juego del elemento y los intentos con imagen de sus variantes. */
function opcionesImagen() {
  const l = [];
  if (S.ref) l.push({ valor: S.ref.ruta, etiqueta: `Juego: ${S.ref.ruta}` });
  for (const [nv, v] of Object.entries(variantes())) {
    for (const id of S.orden) {
      for (const i of ((v.fases[id] || {}).intentos || []).slice().sort((a, b) => a.n - b.n)) {
        if (i.imagen) l.push({ valor: i.imagen, etiqueta: `${nv} · ${nombreFase(id)} · intento ${i.n}` });
      }
    }
  }
  return l;
}
function fijarAncla(imagen) {
  const lista = refsDe();
  if (lista.length >= topeRefs(variante().faseActual) || lista.some((r) => r.imagen === imagen)) return;
  lista.push({ rol: 'sujeto', imagen });
  render();
  toastOk('Fijada como ancla: va como referencia «sujeto» en los pasos y en la Final.');
}
/* El atajo de la técnica de doble ancla (escena + retrato fijo): solo donde hay referencias con rol. */
function botonAncla(imagen) {
  const f = variante().faseActual;
  if (!imagen || !(esPaso(f) || f === 'F4')) return null;
  const ya = refsDe().some((r) => r.imagen === imagen), lleno = refsDe().length >= topeRefs(f);
  return h('button.btn', { type: 'button', 'data-accion': 'fijar-ancla', disabled: ya || lleno || S.generando,
    title: ya ? 'Ya está entre las referencias' : lleno ? `Ya hay ${topeRefs(f)} referencias` : 'Añadirla como referencia «sujeto»: se mantiene igual en los pasos siguientes',
    onclick: () => fijarAncla(imagen) }, 'Fijar como ancla');
}
function lanzado() { S.generando = true; S.lectura = null; S.idx = null; barra.value = 2; barraTexto.textContent = 'Empezando…'; cola.refreshNow(); render(); ctx.seguir(); }
const regenerar = () => accion(async () => {
  const v = variante(), f = v.faseActual, x = extras(v, f, f);
  await api.faseGenerar({ tipo: S.tipo, slug: S.slug, variante: S.variante, fase: f, prompt: prompt.value, ...x,
    usarReferencia: !x.referencias && !!S.ref && usaRef(v, f) });  // referencias con rol y la imagen del juego no se mezclan
  lanzado();
});
const atras = () => accion(async () => {
  const r = await api.faseAtras(S.tipo, S.slug, S.variante);
  S.camino = r.camino; S.lectura = null; S.idx = null; render();
});
const avanzar = (siguiente, n) => accion(async () => {
  const v = variante(), f = v.faseActual;
  // la siguiente fase sale con lo que se ve marcado, salvo que ya se eligiera otra cosa en ella
  const x = extras(v, siguiente, f);
  const usar = !x.referencias && !!S.ref && (S.usarRef[claveRef(siguiente)] ?? usaRef(v, f));
  S.usarRef[claveRef(siguiente)] = usar;
  const r = await api.faseAvanzar({ tipo: S.tipo, slug: S.slug, variante: S.variante, fase: f, intento: n, siguiente, usarReferencia: usar, ...x });
  S.camino = r.camino; S.lectura = null; S.idx = null;
  if (r.lanzado) lanzado();
  else { render(); toast(`Aceptado, pero no se lanzó ${nombreFase(siguiente)}: ${r.motivo || 'sin motivo'}`); }
});
const guardarNombre = () => accion(async () => {
  const r = await api.renombrar(S.tipo, S.slug, campoNombre.value);
  S.camino = r.camino; S.editando = false; render();
  await ctx.lista().catch(() => {});
});
function editarNombre() {
  campoNombre.value = (S.camino && S.camino.nombre) || '';
  S.editando = true; S.aviso = ''; render();
}
function cancelarNombre() { S.editando = false; render(); }
campoNombre.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); guardarNombre(); }
  else if (ev.key === 'Escape') { ev.stopPropagation(); cancelarNombre(); }  // cierra solo la edición, no el resto de lo abierto
});
const borrar = (fase) => accion(async () => {
  const dep = await api.faseDependientes(S.tipo, S.slug, S.variante, fase);
  const partes = [`Se borran las imágenes de ${dep.fases.map(nombreFase).join(', ')}.`];
  if (dep.marcadas.length) partes.push(`Arrastra ${dep.marcadas.length} ★ marcada${dep.marcadas.length === 1 ? '' : 's'}: ${dep.marcadas.join(', ')}.`);
  if (dep.variantes.length) partes.push(`Las variantes que salen de ahí conservan su copia: ${dep.variantes.join(', ')}.`);
  partes.push('Quedan prompts y semillas.');
  const si = await confirmAction({ title: `Borrar ${nombreFase(fase)} y lo que sigue en ${S.variante}`, message: partes.join(' '), confirmLabel: 'Borrar', opener: () => S.btn.borrar });
  if (!si) return;
  const r = await api.faseBorrar(S.tipo, S.slug, S.variante, fase);
  S.camino = r.camino; S.lectura = null; S.idx = null; render();
  await ctx.lista().catch(() => {});
});
const marcar = (n, marcada) => accion(async () => {
  const r = await api.faseMarcar(S.tipo, S.slug, S.variante, n, marcada);
  S.camino = r.camino; render();
  if (marcada && !avisadaMarca) { avisadaMarca = true; toastOk('★ Marcada: lista para combinar. Marcar no es publicar.'); }
  await ctx.lista().catch(() => {});
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
  { keys: ['M'], label: 'Marcar ★ (o quitarla) en la Final', run: () => pulsar('marcar') },
  { keys: ['ArrowLeft'], label: 'Intento anterior de la fase', run: () => ver(-1) },
  { keys: ['ArrowRight'], label: 'Intento siguiente de la fase', run: () => ver(1) },
];

/* ---------- pintar ---------- */
function marco(titulo, ...contenido) { return h('div.marco', {}, h('h3', {}, titulo), ...contenido); }
function hueco(...texto) { return h('div.hueco', {}, ...texto); }
function imagen(src, titulo) { return h('img.ampliable', { src, alt: titulo, title: 'Clic para ampliar', onclick: () => ctx.ampliar(src, titulo) }); }

function pasos(v) {
  const l = h('ol.pasos', { 'aria-label': 'Pasos del camino' });
  const antigua = S.orden.some((x) => esAntigua(x) && (v.fases[x] || v.faseActual === x));  // variante de antes de IMG-53
  for (const id of S.orden) {
    if (id === 'F3' && S.tipo === 'location') continue;  // un fondo no se recorta
    if (esAntigua(id) && !antigua) continue;  // las variantes nuevas van por pasos: solo los Pn que existen y la Final
    if (esPaso(id) && !v.fases[id] && v.faseActual !== id) continue;
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

/* La cadena que llevó a una imagen, de F0 a ella: por `desde`/`entrada` hacia atrás. `base` = lo de la imagen vista. */
function comoSeHizo(v, f, base) {
  const pasos = [{ fase: f, semilla: base.semilla, prompt: base.prompt, imagen: base.imagen, referencia: base.referencia, referencias: base.referencias, intentos: registro(v, f).intentos }];
  let { desde, entrada } = base;
  while (desde && pasos.length < 8) {
    const r = registro(v, desde), it = entrada ? r.intentos.find((i) => i.imagen === entrada) : null;
    if (!it) { pasos.push({ fase: desde, perdido: true }); break; }
    pasos.push({ fase: desde, semilla: it.semilla, prompt: it.prompt, imagen: it.imagen, referencia: it.referencia, referencias: it.referencias, intentos: r.intentos });
    ({ desde, entrada } = it);
  }
  pasos.reverse();
  const lista = h('ol.como', {}, ...pasos.map((p) => h('li', {},
    p.imagen ? h('img.mini.ampliable', { src: srcImagen(p.imagen, p.intentos), alt: `${nombreFase(p.fase)}`, onclick: () => ctx.ampliar(srcImagen(p.imagen, p.intentos), nombreFase(p.fase)) }) : null,
    h('div', {}, h('strong', {}, nombreFase(p.fase)), p.perdido ? ' · ya no está guardada' : ` · s=${p.semilla}${p.referencia ? ` · con la imagen del juego (${p.referencia})` : ''}${(p.referencias || []).length ? ` · con ${p.referencias.map((x) => `${x.rol}: ${x.imagen}`).join(', ')}` : ''}`),
    p.perdido ? null : h('div.meta', {}, p.prompt))));
  return h('details.como-se-hizo', { 'data-como': 'pasos' }, h('summary', {}, 'Cómo se hizo'), lista);
}

function panelReferencia() {
  if (!S.ref) return marco('Referencia', hueco('Sin referencia'));
  const src = paths.juego(S.ref.ruta);
  return marco('Referencia (la imagen del juego)', imagen(src, 'Referencia'), h('div.meta', {}, S.ref.deOtro ? `${S.ref.ruta} (de otro perfil)` : S.ref.ruta));
}
function panelAnterior(v, f) {
  const p = previa(v, f);
  if (!p) return marco('Fase anterior', hueco(f === 'F0' ? 'El boceto sale solo del prompt.' : f === 'P1' ? 'El fondo sale solo del prompt.' : 'Falta una fase anterior aceptada.'));
  const r = registro(v, p), desf = r.desfasada ? h('span.aviso-desfase', {}, ' ⚠ desfasada') : null;
  const titulo = h('h3', {}, `Aceptada en ${nombreFase(p)}`, desf);
  if (!r.aceptada) return h('div.marco', {}, titulo, hueco('Sin imagen aceptada.'));
  return h('div.marco', {}, titulo, imagen(srcImagen(r.aceptada, r.intentos), `Aceptada en ${nombreFase(p)}`), h('div.meta', {}, `s=${r.semilla} `, botonAncla(r.aceptada)));
}
function panelIntento(v, f) {
  const lista = intentos(v, f), i = indiceVisto(lista), a = lista[i];
  const nav = lista.length ? h('span.nav-intentos', {},
    h('button.btn.btn-icon', { type: 'button', 'aria-label': 'Intento anterior', title: 'Intento anterior (←)', disabled: i <= 0, onclick: () => ver(-1) }, '◀'),
    h('span', { 'data-intento': 'contador' }, `${i + 1}/${lista.length}`),
    h('button.btn.btn-icon', { type: 'button', 'aria-label': 'Intento siguiente', title: 'Intento siguiente (→)', disabled: i >= lista.length - 1, onclick: () => ver(1) }, '▶')) : null;
  const cab = h('div.cab-marco', {}, h('h3', {}, a ? `Intento ${a.n} de ${nombreFase(f)}` : `${nombreFase(f)} · sin intentos`), nav);
  if (!a) return h('div.marco.actual', {}, cab, hueco(`${sinEntrada(f) ? 'Elemento nuevo. ' : 'Esta fase aún no tiene imagen. '}«Generar» la pide.`));
  const r = registro(v, f), etiquetas = [];
  if (a.imagen && r.aceptada === a.imagen) etiquetas.push(h('span.ok', {}, 'aceptado'));
  if (a.imagen && r.aceptada === a.imagen) etiquetas.push(botonAncla(a.imagen));
  if (a.imagen && marcadaImg(a.imagen)) etiquetas.push(h('span.estrella', { title: 'Marcada: lista para combinar' }, '★'));
  if (a.imagen) return h('div.marco.actual', {}, cab, imagen(srcImagen(a.imagen, lista), `Intento ${a.n} de ${nombreFase(f)}`), h('div.meta', {}, meta(a), ' ', ...etiquetas),
    lineaMedida(a), comoSeHizo(v, f, a));
  // sin imagen: fallido (salida distinta de 0) o borrado al avanzar
  const fallo = a.salida !== 0 && a.salida !== undefined && a.salida !== null;
  return h('div.marco.actual', {}, cab, hueco(
    h('strong', {}, fallo ? `Falló (salida ${a.salida})` : 'Imagen borrada'),
    h('div', {}, `Prompt: ${a.prompt}`), h('div', {}, `Semilla: ${a.semilla}`),
    fallo && a.error ? h('pre', {}, a.error) : null), h('div.meta', {}, meta(a)));
}
function botonBorrar(v, f) {
  const motivo = S.generando ? 'Hay una generación en curso: espera a que acabe' : !registro(v, f).intentos.some((i) => i.imagen) ? 'No hay nada guardado en esta fase' : null;
  S.btn.borrar = h('button.btn', { type: 'button', 'data-accion': 'borrar', disabled: !!motivo, onclick: () => borrar(f),
    title: motivo || `Borrar las imágenes de ${nombreFase(f)} y de lo que sigue (quedan prompts y semillas)` }, 'Borrar esta fase');
  return S.btn.borrar;
}
function lecturaFase(v) {
  const f = S.lectura, r = registro(v, f);
  return h('div.lectura', {}, h('h3', {}, `${nombreFase(f)} · lo guardado`),
    r.aceptada ? imagen(srcImagen(r.aceptada, r.intentos), `${nombreFase(f)} aceptada`) : hueco('Esta fase no tiene imagen aceptada.'),
    h('div.meta', {}, r.desfasada ? '⚠ desfasada: se aceptó otra imagen en la fase de la que sale. ' : '', r.semilla !== null && r.semilla !== undefined ? `s=${r.semilla}` : '',
      marcadaImg(r.aceptada) ? h('span.estrella', { title: 'Marcada: lista para combinar' }, ' ★') : null),
    h('pre.prompt-leido', {}, r.prompt || '(sin prompt guardado)'),
    r.aceptada ? comoSeHizo(v, f, { semilla: r.semilla, prompt: r.prompt, imagen: r.aceptada, desde: r.desde, entrada: r.entrada, referencia: (r.intentos.find((i) => i.imagen === r.aceptada) || {}).referencia, referencias: (r.intentos.find((i) => i.imagen === r.aceptada) || {}).referencias }) : null,
    h('div.acciones', {}, h('button.btn.btn-primary', { type: 'button', onclick: () => { S.lectura = null; render(); } }, `Volver a ${nombreFase(v.faseActual)}`),
      botonAncla(r.aceptada), botonBorrar(v, f)));
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
    const marcada = !!a && marcadaImg(a.imagen);
    const no = ocupado || (!a ? 'Aún no hay intentos que marcar' : null) || (!a.imagen ? 'Un intento sin imagen no se puede marcar' : null)
      || (!marcada && desfasado(v, a) ? MOTIVO_DESFASE : null);
    b.marcar = h('button.btn.btn-primary', { type: 'button', 'data-accion': 'marcar', disabled: !!no, onclick: () => marcar(a.n, !marcada),
      title: no || (marcada ? 'Quitar la ★ de esta Final (M)' : 'Marcar esta Final: queda lista para combinar, no se publica (M)') },
    marcada ? 'Quitar ★ ' : 'Marcar ★ ', h('kbd.kbd', {}, 'M'));
    der.append(b.marcar);
  } else {
    sigs.forEach((s, k) => {
      const no = ocupado || (!S.info[s] || !S.info[s].disponible ? `${nombreFase(s)} aún no está disponible` : null) || (!a ? 'Aún no hay intentos que aceptar' : null)
        || (!a.imagen ? 'Un intento sin imagen no se puede aceptar' : null);
      const nombre = s === 'F4' ? 'Avanzar a la Final' : esPaso(s) ? `Añadir ${nombreFase(s)}` : `Avanzar por ${S.info[s] ? S.info[s].nombre : s}`;
      const bt = h('button.btn', { type: 'button', class: k === 0 ? 'btn-primary' : '', disabled: !!no, 'data-siguiente': s, title: no || `Aceptar este intento y pasar a ${nombreFase(s)} (${k === 0 ? 'Intro' : 'F'})`,
        onclick: () => avanzar(s, a.n) }, nombre + ' ', h('kbd.kbd', {}, k === 0 ? 'Intro' : 'F'));
      b.avanzar.push(bt); der.append(bt);
    });
  }
  return h('div.acciones', {}, h('div.acciones-izq', {}, b.atras, botonBorrar(v, f)), der);
}

function filaReferencia(v, f) {
  if (!S.ref) return null;  // sin imagen del juego no hay nada que elegir
  casillaRef.checked = usaRef(v, f);
  casillaRef.disabled = S.generando || refsDe().length > 0 && conMotor(f);
  return h('label.check', { for: 'fasesUsarRef', title: 'Tarda bastante más; el modelo puede reinventar el elemento (IMG-1)' }, casillaRef,
    f === 'F4' ? ' Usar también la imagen del juego de referencia (junto al boceto) ' : ' Usar la imagen del juego de referencia ',
    h('span.hint', {}, S.ref.ruta));
}

/* IMG-53: el motor del paso o de la Final, y cuántas semillas (1 o 2) lanza un paso. */
function filaMotor(v, f) {
  if (!conMotor(f) || !S.motores.length) return null;  // en F0/F1/F2 no hay selector: la API solo admite klein4b
  const elegido = motorElegido(v, f), clave = f === 'F4' ? 'final' : 'paso';
  const sel = h('select', { id: 'fasesMotor', 'data-campo': 'motor', disabled: S.generando, 'aria-describedby': 'fasesMotorAyuda',
    onchange: (ev) => { motorRecordado[`${S.tipo}/${S.slug}`] = ev.target.value; render(); } },
  ...S.motores.map((m) => {
    const seg = m.segundosEstimados ? `${m.estimacion ? '~' : ''}${m.segundosEstimados[clave]} s` : '';
    const falta = !m.disponible ? `Falta: ${(m.faltan || []).join(', ')}` : '';
    return h('option', { value: m.id, selected: m.id === elegido, disabled: !m.disponible, title: falta },
      `${m.nombre}${seg ? ` · ${seg}` : ''}${m.disponible ? '' : ' (no disponible)'}`);
  }));
  const m = motorDe(elegido), muchas = esPaso(f) ? semillasElegidas() : 1;
  const faltan = S.motores.filter((x) => !x.disponible);
  const ayuda = [m && m.segundosEstimados ? `${m.estimacion ? '~' : ''}${m.segundosEstimados[clave] * muchas} s en total${m.estimacion ? ' (estimado, aún sin medir)' : ''}.` : '',
    faltan.length ? `No disponibles: ${faltan.map((x) => `${x.nombre} (falta ${(x.faltan || []).join(', ')})`).join('; ')}.` : ''].filter(Boolean).join(' ');
  const hijos = [h('div.field', {}, h('label', { for: 'fasesMotor' }, 'Motor'), sel)];
  if (esPaso(f)) {
    hijos.push(h('div.field', {}, h('label', { for: 'fasesSemillas' }, 'Semillas'),
      h('select', { id: 'fasesSemillas', 'data-campo': 'semillas', disabled: S.generando, title: 'Cuántos intentos saca cada vez, con semillas seguidas',
        onchange: (ev) => { S.semillas[claveVariante()] = Number(ev.target.value); render(); } },
      ...[1, 2].map((n) => h('option', { value: n, selected: n === semillasElegidas() }, String(n))))));
  }
  return h('div.motor-paso', {}, h('div.fila-motor', {}, ...hijos), h('div.hint', { id: 'fasesMotorAyuda' }, ayuda));
}

/* IMG-53: referencias con rol, hasta 3 con imagen de entrada (P1, que no tiene, hasta 4). */
function filaReferencias(f) {
  if (!conMotor(f)) return null;
  const lista = refsDe(), opciones = opcionesImagen(), tope = topeRefs(f);
  const filas = lista.map((r, k) => {
    const rol = h('select', { 'aria-label': `Rol de la referencia ${k + 1}`, 'data-campo': 'ref-rol', onchange: (ev) => { r.rol = ev.target.value; } },
      ...ROLES.map((x) => h('option', { value: x, selected: x === r.rol }, x)));
    const img = h('select', { 'aria-label': `Imagen de la referencia ${k + 1}`, 'data-campo': 'ref-imagen', onchange: (ev) => { r.imagen = ev.target.value; } },
      ...(opciones.some((o) => o.valor === r.imagen) ? [] : [h('option', { value: r.imagen, selected: true }, r.imagen)]),
      ...opciones.map((o) => h('option', { value: o.valor, selected: o.valor === r.imagen }, o.etiqueta)));
    return h('li', { 'data-ref': String(k) }, rol, img,
      h('button.btn.btn-icon', { type: 'button', 'aria-label': `Quitar la referencia ${k + 1}`, title: 'Quitar', onclick: () => { lista.splice(k, 1); render(); } }, '✕'));
  });
  const no = S.generando ? 'Hay una generación en curso' : lista.length >= tope ? `Como mucho ${tope} referencias en esta fase` : !opciones.length ? 'Aún no hay imágenes que usar: ni la del juego ni intentos' : null;
  const anadir = h('button.btn', { type: 'button', 'data-accion': 'anadir-ref', disabled: !!no, title: no || 'Añadir una referencia con rol',
    onclick: () => { lista.push({ rol: 'sujeto', imagen: opciones[0].valor }); render(); } }, 'Añadir referencia');
  return h('div.referencias', { 'data-campo': 'referencias' }, h('div.label', { id: 'fasesRefsT' }, `Referencias con rol (${lista.length}/${tope})`),
    filas.length ? h('ul.lista-refs', { 'aria-labelledby': 'fasesRefsT' }, ...filas) : h('div.hint', {}, 'Sin referencias: el paso parte solo de la imagen aceptada y del prompt.'),
    anadir);
}

function nombreElemento() {
  if (S.editando) {
    return h('div.nombre-elemento', {}, campoNombre,
      h('button.btn.btn-primary', { type: 'button', 'data-accion': 'guardar-nombre', onclick: guardarNombre }, 'Guardar'),
      h('button.btn', { type: 'button', onclick: cancelarNombre }, 'Cancelar'));
  }
  return h('div.nombre-elemento', {}, h('strong', { 'data-nombre': 'actual' }, S.camino.nombre || S.slug),
    h('button.btn.btn-icon', { type: 'button', 'data-accion': 'renombrar', 'aria-label': 'Renombrar el elemento', title: 'Renombrar el elemento', onclick: editarNombre }, '✎'));
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
  if (S.camino) hijos.push(nombreElemento());
  if (S.aviso) hijos.push(h('div.notice.notice-bad', { role: 'alert' }, S.aviso));
  if (!S.camino) { hijos.push(h('p.muted', {}, S.aviso ? '' : 'Cargando…')); raiz.replaceChildren(...hijos); return; }
  hijos.push(pasos(v));
  if (S.lectura && S.lectura !== f && v.fases[S.lectura]) hijos.push(lecturaFase(v));
  else {
    S.lectura = null;
    const clave = `${S.tipo}/${S.slug}/${S.variante}/${f}/${intentos(v, f).length}`;
    if (clave !== S.clave) { S.clave = clave; prompt.value = promptPorDefecto(v, f); }
    pintarFuente();
    hijos.push(h('div.tres', {}, panelReferencia(), panelAnterior(v, f), panelIntento(v, f)),
      h('div.field', {}, h('label', { for: 'fasesPrompt' }, `Prompt de ${nombreFase(f)}`), prompt,
        h('div.hint', { id: 'fasesPromptAyuda' }, 'Editarlo mantiene la semilla; sin cambios, Regenerar usa otra.'), fuentePrompt),
      filaMotor(v, f), filaReferencias(f),
      filaReferencia(v, f),
      acciones(v, f));
    if (S.generando) hijos.push(progreso_);
  }
  raiz.replaceChildren(...hijos);
  if (S.editando) { campoNombre.focus(); campoNombre.select(); }
}
casillaRef.addEventListener('change', () => { S.usarRef[claveRef(variante().faseActual)] = casillaRef.checked; });
prompt.addEventListener('input', () => {  // el motivo de «Regenerar» depende de que haya texto
  pintarFuente();
  if (S.btn.regenerar) {
    const vacio = !prompt.value.trim();
    S.btn.regenerar.disabled = vacio || S.generando;
    S.btn.regenerar.title = S.generando ? 'Hay una generación en curso: espera a que acabe' : vacio ? 'El prompt está vacío' : 'Otra semilla, o la misma si editas el prompt (R)';
  }
});
