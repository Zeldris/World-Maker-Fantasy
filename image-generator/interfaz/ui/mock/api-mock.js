/* Servidor fingido para probar la interfaz sin servidor.py ni sd-cli (solo con `?mock=1`, IMG-41). Idea y forma del
   simulador de GVIG (galivelop-image-generator, gimg/ui/mock/api-mock.js, MIT, ver ../LICENSE-GVIG); el contrato es el
   de servidor.py (su docstring), en memoria: nada se guarda y al recargar vuelve a empezar.
   - Las imágenes se pintan con <canvas> (data: URL, que la CSP permite) sustituyendo `paths.intento` y `paths.juego`.
   - Una generación tarda 2 s por paso; con la semilla 13 falla, para ver el aviso de error y el log.
   - /api/cola da lo que genera y lo terminado, y empieza con dos de ejemplo (una hecha y una fallida).
   - Fases (IMG-40, diseño §3.0): /api/camino y /api/fase/{generar,avanzar,atras} con las reglas de scripts/camino.py
     (grafo, fase de entrada aceptada, avanzar borra las imágenes no aceptadas salvo las que sirven de entrada, fases
     desfasadas, atrás, semilla por defecto); un intento de fase tarda 2 s por paso de su receta y con la semilla 13 falla.
   - IMG-25 (parte 2): /api/camino/renombrar, /api/fase/{borrar,dependientes,marcar} con las mismas reglas y mensajes.
   - `&rapido=1` en la URL acorta cada paso a 50 ms (para los tests de navegador).
   No se carga en uso normal: app.js solo lo importa si la URL lleva `?mock=1`. */

import { paths } from '../js/api.js';

const PERFILES = ['banner', 'thumbnail', 'mapa', 'icono'];
const TAMANOS = { banner: [1280, 512], thumbnail: [768, 768], mapa: [832, 624], icono: [512, 512] };
const PALETA = ['#3b2a1e', '#8a5a2b', '#c9a227', '#2f5d50', '#6b2d2d', '#d8cbb0'];
const ahora = () => new Date().toISOString().slice(0, 19);
const hace = (s) => new Date(Date.now() - s * 1000).toISOString().slice(0, 19);
const sello = (iso) => iso.replace(/[-:]/g, '').replace('T', '-');

const intento = (perfil, semilla, pasos, fecha, extra = {}) => ({
  fecha, nombre: `${perfil}-s${semilla}-p${pasos}-${sello(fecha)}`, perfil, prompt: 'base', semilla: String(semilla),
  pasos: String(pasos), 'tamaño': TAMANOS[perfil].join('x'), extra: '', salida: '0', segundos: String(pasos * 18),
  imagen: true, nota: '', elegida: false, destino: '', conReferencia: false, textoPrompt: '', ...extra });

const datos = {
  'fauna/aullador-rojo': {
    nombre: 'Aullador rojo', juego: 'fauna/aullador-rojo-banner.png', perfilJuego: 'banner',
    prompts: { banner: { usado: null, base: 'a red howler beast on a dry ridge at dusk, side view, painterly, muted earth tones' },
      thumbnail: { usado: 'red howler beast portrait, painterly', base: 'red howler beast' } },
    intentos: [intento('banner', 4021, 6, hace(7200), { nota: 'buena silueta, el rojo demasiado vivo' }),
      intento('banner', 4022, 6, hace(3600), { conReferencia: true, extra: '-r' }),
      intento('thumbnail', 7, 4, hace(1800), { imagen: false, salida: '1', segundos: '12' })],
    elegidas: {},
  },
  'flora/cardo-brujula': {
    nombre: 'Cardo brújula', juego: null,
    prompts: { thumbnail: { usado: null, base: 'a compass thistle, spiky violet flower heads pointing north, field guide plate' } },
    intentos: [intento('thumbnail', 42, 6, hace(5400))], elegidas: {},
  },
  'zona/llanos-de-ceniza': {
    nombre: 'Llanos de ceniza', juego: 'zona/llanos-de-ceniza-mapa.png', perfilJuego: 'mapa',
    prompts: { mapa: { usado: null, base: 'ash plains seen from above, cracked grey earth, old riverbeds, hand-drawn map style' },
      banner: { usado: 'Use the reference image only as a guide for lighting, contrast and shadows. Create a new image: ash plains at dusk', base: 'ash plains' } },
    intentos: [], elegidas: {},
  },
  'clase/cazador': { nombre: 'Cazador', juego: null, prompts: {}, intentos: [], elegidas: {} },
};
for (const [clave, e] of Object.entries(datos)) {
  for (const f of e.intentos) f.textoPrompt = (e.prompts[f.perfil] && (e.prompts[f.perfil].usado || e.prompts[f.perfil].base)) || `${clave} (pegado)`;
}
const elegirInicial = datos['fauna/aullador-rojo'];
elegirInicial.elegidas.banner = elegirInicial.intentos[0].nombre;

/* ---------- fases (reglas de scripts/camino.py; el test comprueba que FASES es igual que camino.FASES) ---------- */
// IMG-53: el prompt corto de estilo de la Final (docs/producto/plan-imagenes/banco/prompts/r37-final-corta.txt; servidor.py lo lee de ahí)
const PROMPT_FINAL = 'The same figure, in the same composition, as the reference image, which is a rough study: keep its shapes and proportions and render it with full detail. Change nothing in the figure, the weapon, the rock ledge, the valley, the tents, the mesas, the sky or the light. Style: photorealistic fantasy matte painting, cinematic concept art, high contrast, deep shadows. The image is completely textless.';
const FASES = [
  { id: 'F0', nombre: 'Boceto', receta: 'f0-boceto', siguientes: ['F1', 'F4'], disponible: true },
  { id: 'F1', nombre: 'Forma', receta: 'f1-forma', siguientes: ['F2', 'F4'], disponible: true },
  { id: 'F2', nombre: 'Detalle', receta: 'f2-detalle', siguientes: ['F4'], disponible: true },
  // IMG-53: cadena de pasos P1…P9 (cada uno parte de la aceptada del anterior; la Final, del paso aceptado más alto)
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `P${n}`, nombre: `Paso ${n}`, receta: 'paso', siguientes: n < 9 ? [`P${n + 1}`, 'F4'] : ['F4'], disponible: true })),
  { id: 'F4', nombre: 'Final', receta: 'f4-final', siguientes: ['F3'], disponible: true, promptPorDefecto: PROMPT_FINAL },
  { id: 'F3', nombre: 'Recorte', receta: 'recorte', siguientes: [], disponible: false },
];
const POR_ID = Object.fromEntries(FASES.map((f) => [f.id, f]));
const NOMBRES_PASO = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `P${n}`);
const ENTRADA = { F0: [], F1: ['F0'], F2: ['F1'], F4: [...NOMBRES_PASO].reverse().concat(['F2', 'F1', 'F0']), F3: ['F4'],
  ...Object.fromEntries(NOMBRES_PASO.map((p, i) => [p, i ? [NOMBRES_PASO[i - 1]] : []])) };
const PASOS_FASE = { F0: 4, F1: 8, F2: 16, F4: 4, ...Object.fromEntries(NOMBRES_PASO.map((p) => [p, 4])) };
const ESTIMADO_FASE = { F0: 36, F1: 300, F2: 300, F4: 160, ...Object.fromEntries(NOMBRES_PASO.map((p) => [p, 40])) };
/* IMG-53: motores (scripts/motores.py; segundos: paso a 480x192 y Final; `estimacion` = aún sin medir). qwen-edit y longcat
   salen como no disponibles para que la interfaz enseñe ese estado. */
const MOTORES = [
  { id: 'klein4b', nombre: 'FLUX.2 klein 4B', disponible: true, faltan: [], pasos: 4, segundosEstimados: { paso: 40, final: 160 }, estimacion: false },
  { id: 'klein9b', nombre: 'FLUX.2 klein 9B (Q4)', disponible: true, faltan: [], pasos: 4, segundosEstimados: { paso: 80, final: 320 }, estimacion: true },
  { id: 'klein9b-consistencia', nombre: 'FLUX.2 klein 9B + consistencia', disponible: true, faltan: [], pasos: 4, segundosEstimados: { paso: 90, final: 360 }, estimacion: true },
  { id: 'qwen-edit', nombre: 'Qwen-Image-Edit 2511 (Q3)', disponible: false, faltan: ['modelos/diffusion/qwen-image-edit-2511-Q3_K_S.gguf'], pasos: 20, segundosEstimados: { paso: 400, final: 1600 }, estimacion: true },
  { id: 'longcat', nombre: 'LongCat Image Edit (Q4)', disponible: false, faltan: ['modelos/diffusion/longcat_edit_bfl_format-Q4_K_M.gguf'], pasos: 20, segundosEstimados: { paso: 400, final: 1600 }, estimacion: true },
  { id: 'flux3', nombre: 'FLUX.3 klein (fotorrealista)', disponible: true, faltan: [], pasos: 8, segundosEstimados: { paso: 300, final: 900 }, estimacion: true },
];
const SEMILLA_F0 = 3;
const caminos = {};
const PASO_MS = new URLSearchParams(location.search).get('rapido') === '1' ? 50 : 2000;
const camino = (tipo, slug) => (caminos[`${tipo}/${slug}`] = caminos[`${tipo}/${slug}`] || { nombre: '', variantes: {}, marcadas: [] });
const siguientesDe = (fase, tipo) => POR_ID[fase].siguientes.filter((s) => !(s === 'F3' && tipo === 'location'));
const vistaCamino = (tipo, slug) => {
  const c = JSON.parse(JSON.stringify(camino(tipo, slug)));
  for (const v of Object.values(c.variantes)) v.siguientes = siguientesDe(v.faseActual, tipo);
  return c;
};
class CaminoInvalido extends Error {}
function faseDeEntrada(v, fase) {
  if (!POR_ID[fase]) throw new CaminoInvalido(`Fase desconocida: ${fase}`);
  if (!ENTRADA[fase].length) return null;
  const c = ENTRADA[fase].find((x) => v && v.fases[x] && v.fases[x].aceptada);
  if (c) return c;
  throw new CaminoInvalido(`Falta una fase aceptada (${fase === 'F4' ? 'un paso P1…P9, F2, F1 o F0' : ENTRADA[fase].join(' o ')}) para generar ${fase} ${POR_ID[fase].nombre}`);
}
function semillaPorDefecto(v, fase, prompt, referencia) {
  const f = v && v.fases[fase];
  if (!f || !f.intentos.length) return !ENTRADA[fase].length ? SEMILLA_F0 : v.fases[faseDeEntrada(v, fase)].semilla;
  const ultimo = f.intentos[f.intentos.length - 1];
  return prompt === ultimo.prompt && (referencia || null) === (ultimo.referencia || null) ? Math.max(...f.intentos.map((i) => i.semilla)) + 1 : ultimo.semilla;
}
const enUso = (v) => {
  const usadas = new Set();
  for (const r of Object.values(v.fases)) { usadas.add(r.entrada); r.intentos.forEach((i) => usadas.add(i.entrada)); }
  return usadas;
};
function desfasar(v, origen, nueva) {
  const cola = Object.entries(v.fases).filter(([, r]) => r.desde === origen && r.entrada !== nueva).map(([f]) => f);
  const vistas = new Set();
  while (cola.length) {
    const f = cola.pop();
    if (vistas.has(f)) continue;
    vistas.add(f);
    v.fases[f].desfasada = true;
    cola.push(...Object.entries(v.fases).filter(([, r]) => r.desde === f).map(([g]) => g));
  }
}
function avanzarCamino(c, tipo, variante, fase, n, siguiente) {
  const v = c.variantes[variante], f = v && v.fases[fase];
  if (!f) throw new CaminoInvalido(`La variante ${variante} no tiene la fase ${fase}`);
  const elegido = f.intentos.find((i) => i.n === n);
  if (!elegido) throw new CaminoInvalido(`No existe el intento ${n} de ${fase} en ${variante}`);
  if (!elegido.imagen) throw new CaminoInvalido(`El intento ${n} de ${fase} falló y no tiene imagen: no se puede aceptar`);
  if (fase === 'F4') throw new CaminoInvalido('Desde F4 Final no se avanza: la Final se marca (★)');
  const permitidas = siguientesDe(fase, tipo);
  if (!permitidas.includes(siguiente)) {
    throw new CaminoInvalido(`Desde ${fase} no se puede avanzar a ${siguiente} en ${tipo} (permitidas: ${permitidas.join(', ') || 'ninguna'})`);
  }
  if (!POR_ID[siguiente].disponible) throw new CaminoInvalido(`${siguiente} ${POR_ID[siguiente].nombre} no está disponible todavía (llega con IMG-37)`);
  const usadas = enUso(v);
  for (const i of f.intentos) if (i.n !== n && i.imagen && !usadas.has(i.imagen)) i.imagen = null;
  Object.assign(f, { aceptada: elegido.imagen, prompt: elegido.prompt, semilla: elegido.semilla, desfasada: false });
  if ('entrada' in elegido) Object.assign(f, { desde: elegido.desde, entrada: elegido.entrada });
  desfasar(v, fase, elegido.imagen);
  v.faseActual = siguiente;
}
function atrasCamino(c, variante) {
  const v = c.variantes[variante];
  if (!v) throw new CaminoInvalido(`La variante ${variante} no existe`);
  const f = v.fases[v.faseActual];
  const previa = f ? f.desde : ENTRADA[v.faseActual].find((x) => v.fases[x] && v.fases[x].aceptada);
  if (!previa) throw new CaminoInvalido(`No hay fase anterior a ${v.faseActual} a la que volver`);
  v.faseActual = previa;
}
/* IMG-25 (parte 2): renombrar, borrar lo guardado y marcar ★, con las reglas y los mensajes de scripts/camino.py. */
function renombrarCamino(c, nombre) {
  const limpio = String(nombre === undefined || nombre === null ? '' : nombre).trim();
  if (!limpio) throw new CaminoInvalido('El nombre está vacío');
  if (limpio.length > 120) throw new CaminoInvalido('El nombre es demasiado largo: 120 caracteres como mucho');
  c.nombre = limpio;
}
function varianteDe(c, variante) {
  const v = c.variantes[variante];
  if (!v) throw new CaminoInvalido(`La variante ${variante} no existe`);
  return v;
}
function tramo(v, fase) {
  if (!POR_ID[fase]) throw new CaminoInvalido(`Fase desconocida: ${fase}`);
  const salida = [fase];
  for (const f of salida) for (const [g, r] of Object.entries(v.fases)) if (r.desde === f && !salida.includes(g)) salida.push(g);
  return salida;
}
function borrables(c, variante, fases) {
  const v = c.variantes[variante], candidatas = new Set(), usadas = new Set();
  for (const f of fases) if (v.fases[f]) v.fases[f].intentos.forEach((i) => { if (i.imagen) candidatas.add(i.imagen); });
  for (const [w, vw] of Object.entries(c.variantes)) {
    for (const [g, r] of Object.entries(vw.fases)) {
      if (w === variante && fases.includes(g)) continue;
      usadas.add(r.entrada); usadas.add(r.aceptada); r.intentos.forEach((i) => usadas.add(i.entrada));
    }
  }
  return new Set([...candidatas].filter((x) => !usadas.has(x)));
}
function dependientesCamino(c, variante, fase) {
  const v = varianteDe(c, variante), fases = tramo(v, fase), b = borrables(c, variante, fases);
  return { fases, marcadas: c.marcadas.filter((m) => m.variante === variante && b.has(m.imagen)).map((m) => m.imagen),
    variantes: Object.entries(c.variantes).filter(([w, vw]) => w !== variante && vw.origen && vw.origen.variante === variante && fases.includes(vw.origen.fase)).map(([w]) => w) };
}
function borrarFase(c, variante, fase) {
  const v = varianteDe(c, variante);
  if (!POR_ID[fase]) throw new CaminoInvalido(`Fase desconocida: ${fase}`);
  if (!(v.fases[fase] && v.fases[fase].intentos.some((i) => i.imagen))) throw new CaminoInvalido('No hay nada guardado en esta fase');
  const fases = tramo(v, fase), desde = v.fases[fase].desde, b = borrables(c, variante, fases);
  for (const f of fases) {
    const r = v.fases[f];
    r.intentos.forEach((i) => { if (i.imagen && b.has(i.imagen)) i.imagen = null; });
    Object.assign(r, { aceptada: null, prompt: null, semilla: null, desfasada: false });
  }
  c.marcadas = c.marcadas.filter((m) => !(m.variante === variante && b.has(m.imagen)));
  const sinSalida = !v.fases[v.faseActual] && ENTRADA[v.faseActual].length && !ENTRADA[v.faseActual].some((x) => v.fases[x] && v.fases[x].aceptada);
  if (fases.includes(v.faseActual) || sinSalida) v.faseActual = desde || (NOMBRES_PASO.includes(fase) ? 'P1' : 'F0');
}
function intentoDesfasado(v, it) {
  return !!it.desde && it.entrada !== ((v.fases[it.desde] || {}).aceptada || null);
}
function marcarCamino(c, variante, n, marcada) {
  const v = varianteDe(c, variante), f = v.fases.F4;
  if (!f) throw new CaminoInvalido('Solo se marca ★ en la Final');
  const it = f.intentos.find((i) => i.n === n);
  if (!it) throw new CaminoInvalido(`No existe el intento ${n} de F4 en ${variante}`);
  if (!marcada) { c.marcadas = c.marcadas.filter((m) => !(m.variante === variante && m.imagen === it.imagen)); return; }
  if (!it.imagen) throw new CaminoInvalido(`El intento ${n} de F4 falló o ya no tiene imagen: no se puede marcar`);
  if (intentoDesfasado(v, it)) throw new CaminoInvalido('Esta Final salió de un boceto que ya no es el aceptado: genera otra');
  if (!c.marcadas.some((m) => m.variante === variante && m.imagen === it.imagen)) c.marcadas.push({ imagen: it.imagen, variante, pautasVersion: null });
  Object.assign(f, { aceptada: it.imagen, prompt: it.prompt, semilla: it.semilla, desfasada: false });
  if ('entrada' in it) Object.assign(f, { desde: it.desde, entrada: it.entrada });
}
const conCamino = (fn) => { try { return fn(); } catch (e) { if (e instanceof CaminoInvalido) return mal(400, e.message); throw e; } };

function apuntarIntento(c, variante, fase, p) {
  const v = c.variantes[variante] = c.variantes[variante] || { origen: null, faseActual: 'P1', fases: {} };
  const [desde, entrada] = p.entrada || [null, null];
  const f = v.fases[fase] = v.fases[fase] || { aceptada: null, prompt: null, semilla: null, desde, entrada, desfasada: false, intentos: [] };
  if (!f.aceptada) Object.assign(f, { desde, entrada });
  const n = Math.max(0, ...f.intentos.map((i) => i.n)) + 1;
  f.intentos.push({ n, prompt: p.prompt, semilla: p.semilla, imagen: p.falla ? null : `${variante}-${fase.toLowerCase()}-${n}.png`,
    desde, entrada, segundos: p.segundos, fecha: ahora(), salida: p.falla ? 1 : 0, ...(p.referencia ? { referencia: p.referencia } : {}), ...(p.motor ? { motor: p.motor } : {}), ...(p.referencias ? { referencias: p.referencias } : {}), ...(p.medida ? { medida: p.medida } : {}), ...(p.falla ? { error: 'ERROR: sd-cli terminó con 1 (simulado: semilla 13)' } : {}) });
  v.faseActual = fase;
  return n;
}
/* Lanza una fase en el simulador; lanza CaminoInvalido o Error con el motivo (400) como servidor.py. */
function lanzarFase(b) {
  const { tipo, slug, variante, fase } = b;
  if (!POR_ID[fase]) return mal(400, `fase desconocida: ${fase}`);
  if (!POR_ID[fase].disponible) return mal(400, `${fase} ${POR_ID[fase].nombre} no está disponible todavía (llega con IMG-37)`);
  const prompt = String(b.prompt || '').trim();
  if (!prompt) return mal(400, 'el prompt está vacío');
  const semilla = b.semilla === undefined || b.semilla === null ? null : Number(b.semilla);
  if (semilla !== null && !(Number.isInteger(semilla) && semilla >= 0 && semilla <= 2 ** 31 - 1)) return mal(400, 'la semilla: de 0 a 2147483647');
  const c = camino(tipo, slug), v = c.variantes[variante] || null;
  const juego = b.usarReferencia ? (datos[`${tipo}/${slug}`] || {}).juego : null;
  if (b.usarReferencia && !juego) return mal(400, `no hay imagen de ${tipo}/${slug} en image-generator/referencias/images/`);
  const referencia = juego ? juego.split('/').pop() : null;
  // IMG-53: motor, semillas (1-4) y referencias con rol [{rol, imagen}] (solo se validan los campos; el simulador no abre las imágenes)
  const esPaso = fase === 'F4' || NOMBRES_PASO.includes(fase);
  const motor = b.motor ? MOTORES.find((m) => m.id === b.motor) : null;
  if (b.motor && !motor) return mal(400, `motor desconocido: ${b.motor} (${MOTORES.map((m) => m.id).join(', ')})`);
  if (motor && !esPaso && motor.id !== 'klein4b') return mal(400, `el motor ${motor.id} solo vale en los pasos (P1…P9) y en la Final, no en ${fase}`);
  if (motor && esPaso && !motor.disponible) return mal(400, `el motor ${motor.id} no está completo: falta ${motor.faltan.join(', ')}`);
  const semillas = b.semillas === undefined ? 1 : Number(b.semillas);
  if (!(Number.isInteger(semillas) && semillas >= 1 && semillas <= 4)) return mal(400, 'semillas: de 1 a 4');
  const referencias = Array.isArray(b.referencias) ? b.referencias : [];
  if (referencias.some((r) => !['sujeto', 'lugar', 'equipo', 'estilo'].includes(r.rol) || !r.imagen || String(r.imagen).startsWith('/') || String(r.imagen).includes('..'))) return mal(400, 'referencia sin un rol válido o con una imagen fuera de referencias/ y de intentos/');
  if (referencias.length > (ENTRADA[fase].length ? 3 : 4)) return mal(400, 'demasiadas referencias con rol');
  try { faseDeEntrada(v, fase); } catch (e) { return mal(400, e.message); }
  verTrabajo();
  if (trabajo.enMarcha) return mal(400, 'ya hay una imagen generándose (aquí o un sd-cli suelto); espera a que acabe');
  trabajo = { enMarcha: true, id: siguienteId++, tipo, slug, variante, fase, perfil: `${fase} ${POR_ID[fase].nombre}`, conReferencia: !!ENTRADA[fase].length && (fase === 'F4' || NOMBRES_PASO.includes(fase)) || !!juego || referencias.length > 0, referencia,
    inicio: Date.now(), salida: [], nombre: null, rc: null, pasos: esPaso && motor ? motor.pasos : PASOS_FASE[fase], semilla,
    estimado: (esPaso && motor && motor.id !== 'klein4b' ? motor.segundosEstimados[fase === 'F4' ? 'final' : 'paso'] : ESTIMADO_FASE[fase]) * semillas,
    prompt, motor: esPaso ? (motor ? motor.id : 'klein4b') : null, semillas, referencias };
  return ok({ ok: true }, 202);
}

let trabajo = { enMarcha: false };
/* La cola (GET /api/cola): lo terminado, el más reciente primero; empieza con los dos intentos de ejemplo del aullador. */
const aullador = datos['fauna/aullador-rojo'].intentos;
const entradaCola = (id, estado, f, extra = {}) => ({ id, estado, tipo: 'fauna', slug: 'aullador-rojo', perfil: f.perfil,
  semilla: Number(f.semilla), pasos: Number(f.pasos), conReferencia: f.conReferencia, intento: estado === 'hecho' ? f.nombre : null,
  segundos: Number(f.segundos), estimado: Number(f.segundos), progreso: null, error: null, ...extra });
const historial = [entradaCola(2, 'fallido', aullador[2], { error: 'ERROR: sd-cli terminó con 1 (simulado)' }),
  entradaCola(1, 'hecho', aullador[1])];
let siguienteId = 3;

/* ---------- imágenes pintadas ---------- */
const cache = new Map();
function pintar(texto, perfil, semilla) {
  const clave = `${texto}|${perfil}|${semilla}`;
  if (cache.has(clave)) return cache.get(clave);
  const [w, h] = (TAMANOS[perfil] || [512, 512]).map((n) => Math.round(n / 4));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const n = Math.abs(Number(semilla) || 0);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, PALETA[n % PALETA.length]); grad.addColorStop(1, PALETA[(n + 3) % PALETA.length]);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h - 26, w, 26);
  g.fillStyle = '#f3ead8'; g.font = '13px sans-serif'; g.fillText(texto, 8, h - 9);
  const url = c.toDataURL('image/png');
  cache.set(clave, url);
  return url;
}
paths.intento = (tipo, slug, nombre) => {
  // un intento de fase (IMG-40): `<variante>-f<n>-<intento>`; una Final con las proporciones del banner, las demás del boceto
  const v = Object.values((caminos[`${tipo}/${slug}`] || { variantes: {} }).variantes);
  const it = v.flatMap((x) => Object.entries(x.fases)).flatMap(([fase, r]) => r.intentos.map((i) => ({ ...i, fase }))).find((i) => i.imagen === `${nombre}.png`);
  if (it) return pintar(`${slug} · ${nombre}`, 'banner', it.semilla);
  const f = (datos[`${tipo}/${slug}`] || { intentos: [] }).intentos.find((x) => x.nombre === nombre);
  return pintar(`${slug} · ${nombre}`, f ? f.perfil : 'thumbnail', f ? f.semilla : 0);
};
paths.juego = (ruta) => {
  const perfil = (ruta.match(/-(banner|thumbnail|mapa|icono)\.\w+$/) || [])[1] || 'thumbnail';
  return pintar(`juego · ${ruta}`, perfil, ruta.length);
};

/* ---------- la generación avanza sola ---------- */
function verTrabajo() {
  if (!trabajo.inicio) return { ...trabajo };
  const ms = (trabajo.fin || Date.now()) - trabajo.inicio, seg = Math.floor(ms / 1000);
  if (trabajo.enMarcha && ms >= trabajo.pasos * PASO_MS) terminar(seg);
  const e = { ...trabajo, salida: [...trabajo.salida], segundos: seg };
  if (e.enMarcha) { e.paso = Math.min(e.pasos, Math.floor(ms / PASO_MS)); e.progreso = e.paso ? 'difusión' : 'cargando el modelo'; }
  return e;
}
/* Como scripts/medir/medida.py, con los valores sacados de la semilla para que salgan los tres estados. */
function medidaSimulada(semilla, conAnterior, conJuego) {
  const medida = {};
  if (conAnterior) { const valor = 0.55 + (semilla % 40) / 100; medida.ssim = { valor, estado: valor >= 0.7 ? 'ok' : 'aviso' }; }
  if (conJuego) {
    const cb = 3 + semilla % 11, cr = 4 + semilla % 12, y = 10 + semilla % 50;
    medida.emd = { cb: { valor: cb, estado: cb <= 6 ? 'ok' : cb <= 11.4 ? 'aviso' : 'falla' }, cr: { valor: cr, estado: cr <= 7.5 ? 'ok' : cr <= 13.5 ? 'aviso' : 'falla' }, y: { valor: y, estado: y <= 20 ? 'ok' : y <= 43 ? 'aviso' : 'falla' } };
  }
  return medida;
}
function terminarFase(seg) {
  const t = trabajo, c = camino(t.tipo, t.slug), v = c.variantes[t.variante];
  const semilla = t.semilla === null ? semillaPorDefecto(v, t.fase, t.prompt, t.referencia) : t.semilla;
  const origen = faseDeEntrada(v, t.fase);
  const falla = semilla === 13;
  let n;
  for (let k = 0; k < (t.semillas || 1); k++) { // semillas consecutivas, un intento por cada una
    n = apuntarIntento(c, t.variante, t.fase, { prompt: t.prompt, semilla: semilla + k, segundos: seg, falla, referencia: t.referencia,
      motor: t.motor, referencias: t.referencias && t.referencias.length ? t.referencias : null,
      entrada: origen ? [origen, v.fases[origen].aceptada] : null, medida: falla ? null : medidaSimulada(semilla + k, !!origen, !!(datos[`${t.tipo}/${t.slug}`] || {}).juego) });
    if (falla) break;
  }
  const nombre = `${t.variante}-${t.fase.toLowerCase()}-${n}`;
  const error = 'ERROR: sd-cli terminó con 1 (simulado: semilla 13)';
  historial.unshift({ id: t.id, estado: falla ? 'fallido' : 'hecho', tipo: t.tipo, slug: t.slug, variante: t.variante, fase: t.fase, perfil: t.perfil,
    semilla, pasos: t.pasos, conReferencia: t.conReferencia, intento: falla ? null : nombre, segundos: seg, estimado: t.estimado,
    progreso: null, error: falla ? error : null });
  trabajo = { ...t, semilla, enMarcha: false, fin: Date.now(), rc: falla ? 1 : 0, nombre: falla ? null : nombre,
    salida: [...t.salida, falla ? error : `imagen: ${nombre}.png`], logFinal: falla ? 'ggml_vulkan: out of memory (simulado)\nsd-cli: fallo al decodificar' : undefined };
}
function terminar(seg) {
  if (trabajo.fase) return terminarFase(seg);
  const t = trabajo, e = datos[`${t.tipo}/${t.slug}`];
  const falla = t.semilla === 13;
  const f = intento(t.perfil, t.semilla, t.pasos, ahora(), { prompt: t.desdeBase ? 'base' : 'pegado', textoPrompt: t.prompt,
    conReferencia: t.conReferencia, extra: t.conReferencia ? '-r' : '', imagen: !falla, salida: falla ? '1' : '0', segundos: String(seg) });
  e.intentos.push(f);
  historial.unshift({ id: t.id, estado: falla ? 'fallido' : 'hecho', tipo: t.tipo, slug: t.slug, perfil: t.perfil, semilla: t.semilla,
    pasos: t.pasos, conReferencia: t.conReferencia, intento: falla ? null : f.nombre, segundos: seg, estimado: t.estimado,
    progreso: null, error: falla ? 'ERROR: sd-cli terminó con 1 (simulado: semilla 13)' : null });
  trabajo = { ...t, enMarcha: false, fin: Date.now(), rc: falla ? 1 : 0, nombre: f.nombre,
    salida: [...t.salida, falla ? 'ERROR: sd-cli terminó con 1 (simulado: semilla 13)' : `listo: ${f.nombre}.png`],
    logFinal: falla ? 'ggml_vulkan: out of memory (simulado)\nsd-cli: fallo al decodificar' : undefined };
}

/* ---------- elementos ---------- */
function elemento(tipo, slug) {
  const clave = `${tipo}/${slug}`;
  if (!datos[clave]) datos[clave] = { nombre: null, juego: null, prompts: {}, intentos: [], elegidas: {} };
  return datos[clave];
}
function filas(tipo, slug) {
  const e = elemento(tipo, slug);
  return e.intentos.map((f) => {
    const destino = `generated/${tipo}/${slug}/${slug}-${f.perfil}.png`;
    return { ...f, destino, elegida: e.elegidas[f.perfil] === f.nombre };
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const ok = (json, status = 200) => ({ status, json });
const mal = (status, error) => ({ status, json: { error } });

export async function transport(method, url, body) {
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 120));
  const u = new URL(url, location.origin);
  const q = Object.fromEntries(u.searchParams);
  const ruta = u.pathname;
  if (method === 'GET') {
    if (ruta === '/api/inicio') return ok({ perfiles: PERFILES, mundo: 'helek-sirik (simulador ?mock=1)', fases: JSON.parse(JSON.stringify(FASES)), motores: JSON.parse(JSON.stringify(MOTORES)), motorPorDefecto: 'klein4b' });
    if (ruta === '/api/camino') return ok(vistaCamino(q.tipo, q.slug));
    if (ruta === '/api/fase/dependientes') return conCamino(() => ok(dependientesCamino(camino(q.tipo, q.slug), q.variante, q.fase)));
    if (ruta === '/api/estado') return ok(verTrabajo());
    if (ruta === '/api/cola') {
      const t = verTrabajo();
      const ahoraMismo = t.enMarcha ? [{ id: t.id, estado: 'generando', tipo: t.tipo, slug: t.slug, ...(t.fase ? { variante: t.variante, fase: t.fase } : {}), perfil: t.perfil, semilla: t.semilla,
        pasos: t.pasos, conReferencia: t.conReferencia, intento: null, segundos: t.segundos, estimado: t.estimado,
        progreso: { texto: t.progreso, paso: t.paso || null, pasos: t.paso ? t.pasos : null }, error: null }] : [];
      return ok({ cola: [...ahoraMismo, ...historial] });
    }
    if (ruta === '/api/elementos') {
      verTrabajo();
      return ok({ aviso: 'Simulador (?mock=1): datos de ejemplo, nada se guarda.', elementos: Object.entries(datos).map(([clave, e]) => {
        const [tipo, slug] = clave.split('/');
        const cam = caminos[clave];
        return { tipo, slug, nombre: (cam && cam.nombre) || e.nombre, marcadas: cam ? cam.marcadas.length : 0, juego: e.juego, intentos: e.intentos.length,
          perfiles: Object.entries(e.prompts).map(([perfil, p]) => ({ perfil, usado: !!p.usado })),
          elegidas: PERFILES.filter((p) => e.elegidas[p]) };
      }) });
    }
    if (ruta === '/api/elemento') return ok(filas(q.tipo, q.slug));
    if (ruta === '/api/prompt' || ruta === '/api/referencia') {
      if (!PERFILES.includes(q.perfil)) return mal(400, `perfil desconocido: ${q.perfil}`);
      const e = elemento(q.tipo, q.slug);
      if (ruta === '/api/referencia') return ok(e.juego ? { ruta: e.juego, perfil: e.perfilJuego } : { ruta: null });
      const p = e.prompts[q.perfil];
      return p ? ok({ prompt: p.usado || p.base, fuente: p.usado ? 'usado' : 'base' }) : mal(404, 'esa entidad no tiene prompt para ese perfil');
    }
  }
  if (method === 'POST') {
    if (ruta === '/api/generar') {
      verTrabajo();
      if (trabajo.enMarcha) return mal(400, 'ya hay una imagen generándose (aquí o un sd-cli suelto); espera a que acabe');
      if (!PERFILES.includes(body.perfil)) return mal(400, `perfil desconocido: ${body.perfil}`);
      const pasos = Number(body.pasos), semilla = Number(body.semilla);
      if (!(pasos >= 1 && pasos <= 20)) return mal(400, 'los pasos tienen que ir de 1 a 20');
      const e = elemento(body.tipo, body.slug), p = e.prompts[body.perfil];
      trabajo = { enMarcha: true, id: siguienteId++, tipo: body.tipo, slug: body.slug, perfil: body.perfil, conReferencia: !!body.usarReferencia,
        inicio: Date.now(), salida: [], nombre: null, rc: null, pasos, semilla, estimado: pasos * 2 + 1, desdeBase: !!body.desdeBase,
        prompt: body.desdeBase && p ? (p.usado || p.base) : body.prompt };
      return ok({ ok: true }, 202);
    }
    if (ruta === '/api/fase/generar') { verTrabajo(); return lanzarFase(body); }
    if (ruta === '/api/fase/avanzar') {
      verTrabajo();
      const { tipo, slug, variante, fase, siguiente } = body, c = camino(tipo, slug);
      try { avanzarCamino(c, tipo, variante, fase, Number(body.intento), siguiente); } catch (e) { if (e instanceof CaminoInvalido) return mal(400, e.message); throw e; }
      const r = lanzarFase({ tipo, slug, variante, fase: siguiente, prompt: NOMBRES_PASO.includes(fase) && siguiente === 'F4' ? PROMPT_FINAL : c.variantes[variante].fases[fase].prompt, usarReferencia: body.usarReferencia, motor: body.motor, semillas: body.semillas, referencias: body.referencias });
      return ok({ camino: vistaCamino(tipo, slug), ...(r.status === 202 ? { lanzado: true } : { lanzado: false, motivo: r.json.error }) });
    }
    if (ruta === '/api/camino/renombrar') {
      return conCamino(() => { renombrarCamino(camino(body.tipo, body.slug), body.nombre); return ok({ camino: vistaCamino(body.tipo, body.slug) }); });
    }
    if (ruta === '/api/fase/borrar') {
      verTrabajo();
      if (trabajo.enMarcha && trabajo.tipo === body.tipo && trabajo.slug === body.slug) return mal(400, 'hay una generación en marcha de este elemento: espera a que acabe para borrar');
      return conCamino(() => { borrarFase(camino(body.tipo, body.slug), body.variante, body.fase); return ok({ camino: vistaCamino(body.tipo, body.slug) }); });
    }
    if (ruta === '/api/fase/marcar') {
      if (typeof body.marcada !== 'boolean') return mal(400, 'marcada tiene que ser true o false');
      return conCamino(() => { marcarCamino(camino(body.tipo, body.slug), body.variante, Number(body.intento), body.marcada); return ok({ camino: vistaCamino(body.tipo, body.slug) }); });
    }
    if (ruta === '/api/fase/atras') {
      try { atrasCamino(camino(body.tipo, body.slug), body.variante); } catch (e) { if (e instanceof CaminoInvalido) return mal(400, e.message); throw e; }
      return ok({ camino: vistaCamino(body.tipo, body.slug) });
    }
    if (ruta === '/api/nota') {
      const f = elemento(body.tipo, body.slug).intentos.find((x) => x.nombre === body.nombre);
      if (!f) return mal(400, `no hay intento ${body.nombre}`);
      f.nota = body.texto || '';
      return ok({ ok: true });
    }
    if (ruta === '/api/elegir') {
      const e = elemento(body.tipo, body.slug), f = e.intentos.find((x) => x.nombre === body.nombre);
      if (!f || !f.imagen) return mal(400, `no hay imagen ${body.nombre} en ${body.tipo}/${body.slug}`);
      e.elegidas[f.perfil] = f.nombre;
      return ok({ destino: `generated/${body.tipo}/${body.slug}/${body.slug}-${f.perfil}.png` });
    }
  }
  return mal(404, 'no existe');
}
