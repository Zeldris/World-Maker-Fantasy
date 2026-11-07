/* Servidor fingido para probar la interfaz sin servidor.py ni sd-cli (solo con `?mock=1`, IMG-41). Idea y forma del
   simulador de GVIG (galivelop-image-generator, gimg/ui/mock/api-mock.js, MIT, ver ../LICENSE-GVIG); el contrato es el
   de servidor.py (su docstring), en memoria: nada se guarda y al recargar vuelve a empezar.
   - Las imágenes se pintan con <canvas> (data: URL, que la CSP permite) sustituyendo `paths.intento` y `paths.juego`.
   - Una generación tarda 2 s por paso; con la semilla 13 falla, para ver el aviso de error y el log.
   - El contrato de fases (`camino.json`, diseño §3.0) entra aquí cuando `IMG-40` fije sus rutas.
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
    prompts: { mapa: { usado: null, base: 'ash plains seen from above, cracked grey earth, old riverbeds, hand-drawn map style' } },
    intentos: [], elegidas: {},
  },
  'clase/cazador': { nombre: 'Cazador', juego: null, prompts: {}, intentos: [], elegidas: {} },
};
for (const [clave, e] of Object.entries(datos)) {
  for (const f of e.intentos) f.textoPrompt = (e.prompts[f.perfil] && (e.prompts[f.perfil].usado || e.prompts[f.perfil].base)) || `${clave} (pegado)`;
}
const elegirInicial = datos['fauna/aullador-rojo'];
elegirInicial.elegidas.banner = elegirInicial.intentos[0].nombre;

let trabajo = { enMarcha: false };

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
  const seg = Math.floor(((trabajo.fin || Date.now()) - trabajo.inicio) / 1000);
  if (trabajo.enMarcha && seg >= trabajo.pasos * 2) terminar(seg);
  const e = { ...trabajo, salida: [...trabajo.salida], segundos: seg };
  if (e.enMarcha) { e.paso = Math.min(e.pasos, Math.floor(seg / 2)); e.progreso = e.paso ? 'difusión' : 'cargando el modelo'; }
  return e;
}
function terminar(seg) {
  const t = trabajo, e = datos[`${t.tipo}/${t.slug}`];
  const falla = t.semilla === 13;
  const f = intento(t.perfil, t.semilla, t.pasos, ahora(), { prompt: t.desdeBase ? 'base' : 'pegado', textoPrompt: t.prompt,
    conReferencia: t.conReferencia, extra: t.conReferencia ? '-r' : '', imagen: !falla, salida: falla ? '1' : '0', segundos: String(seg) });
  e.intentos.push(f);
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
    if (ruta === '/api/inicio') return ok({ perfiles: PERFILES, mundo: 'helek-sirik (simulador ?mock=1)' });
    if (ruta === '/api/estado') return ok(verTrabajo());
    if (ruta === '/api/elementos') {
      verTrabajo();
      return ok({ aviso: 'Simulador (?mock=1): datos de ejemplo, nada se guarda.', elementos: Object.entries(datos).map(([clave, e]) => {
        const [tipo, slug] = clave.split('/');
        return { tipo, slug, nombre: e.nombre, juego: e.juego, intentos: e.intentos.length,
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
      trabajo = { enMarcha: true, tipo: body.tipo, slug: body.slug, perfil: body.perfil, conReferencia: !!body.usarReferencia,
        inicio: Date.now(), salida: [], nombre: null, rc: null, pasos, semilla, estimado: pasos * 2 + 1, desdeBase: !!body.desdeBase,
        prompt: body.desdeBase && p ? (p.usado || p.base) : body.prompt };
      return ok({ ok: true }, 202);
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
