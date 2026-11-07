/* Cliente de la API local del generador de imágenes (servidor.py, CFG-43). IMG-41: el transporte es el de GVIG
   (galivelop-image-generator, gimg/ui/js/api.js, MIT, ver ../LICENSE-GVIG); `paths` y `api` son de WMF.
   - Si escribe, la petición lleva `Content-Type: application/json` (servidor.py rechaza otro POST).
   - Un error de la API llega como ApiError {status, code, params, message}; la red caída, como OfflineError.
     servidor.py responde `{error: "texto"}`; también se acepta la forma de GVIG `{error: {code, message, params}}`.
   - El transporte se puede sustituir (`setTransport`) para el simulador sin servidor (`?mock=1`) y para los tests. */

export class ApiError extends Error {
  constructor(status, body) {
    const err = body && body.error;
    const datos = typeof err === 'string' ? { message: err } : (err || {});
    super(datos.message || `error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = datos.code || 'api.unexpected';
    this.params = datos.params || {};
  }
}

export class OfflineError extends Error {
  constructor(cause) { super('El servidor no responde: ¿sigue abierto abrir.sh?'); this.name = 'OfflineError'; this.cause = cause; }
}

const state = { transport: null, offline: false };
const offlineListeners = new Set();

/** transport(method, path, body) -> {status, json}. Si es null se usa fetch. */
export function setTransport(fn) { state.transport = fn; }

/** Avisa de cambios de conectividad: fn(isOffline). */
export function onOffline(fn) { offlineListeners.add(fn); return () => offlineListeners.delete(fn); }
function setOffline(v) {
  if (state.offline === v) return;
  state.offline = v;
  for (const fn of offlineListeners) fn(v);
}
export function isOffline() { return state.offline; }

async function request(method, path, body) {
  if (state.transport) {
    const res = await state.transport(method, path, body);
    if (res.status >= 400) throw new ApiError(res.status, res.json);
    setOffline(false);
    return res.json;
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    setOffline(true);
    throw new OfflineError(e);
  }
  setOffline(false);
  if (res.status === 204) return null;
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

export const get = (path) => request('GET', path);
export const post = (path, body = {}) => request('POST', path, body);

/* ---- rutas de servidor.py (su docstring es el contrato); el simulador sustituye las de imagen ---- */
const enc = encodeURIComponent;
const qs = (q) => Object.entries(q).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
export const paths = {
  inicio: () => '/api/inicio',
  estado: () => '/api/estado',
  cola: () => '/api/cola',
  elementos: () => '/api/elementos',
  elemento: (tipo, slug) => `/api/elemento?${qs({ tipo, slug })}`,
  prompt: (tipo, slug, perfil) => `/api/prompt?${qs({ tipo, slug, perfil })}`,
  referencia: (tipo, slug, perfil) => `/api/referencia?${qs({ tipo, slug, perfil })}`,
  generar: () => '/api/generar',
  camino: (tipo, slug) => `/api/camino?${qs({ tipo, slug })}`,
  faseGenerar: () => '/api/fase/generar',
  faseAvanzar: () => '/api/fase/avanzar',
  faseAtras: () => '/api/fase/atras',
  nota: () => '/api/nota',
  elegir: () => '/api/elegir',
  // imágenes: un intento (con `v` para no ver la de caché tras regenerar) y la del juego (`ruta` de /api/referencia)
  intento: (tipo, slug, nombre, v = '') => `/img/${enc(tipo)}/${enc(slug)}/${enc(nombre)}.png${v ? '?' + enc(v) : ''}`,
  juego: (ruta) => `/ref/${ruta}`,
};

/* ---- llamadas con nombre (lo que consume app.js) ---- */
export const api = {
  inicio: () => get(paths.inicio()),
  estado: () => get(paths.estado()),
  cola: () => get(paths.cola()),
  elementos: () => get(paths.elementos()),
  elemento: (tipo, slug) => get(paths.elemento(tipo, slug)),
  prompt: (tipo, slug, perfil) => get(paths.prompt(tipo, slug, perfil)),
  referencia: (tipo, slug, perfil) => get(paths.referencia(tipo, slug, perfil)),
  generar: (peticion) => post(paths.generar(), peticion),
  camino: (tipo, slug) => get(paths.camino(tipo, slug)),
  faseGenerar: (peticion) => post(paths.faseGenerar(), peticion),
  faseAvanzar: (peticion) => post(paths.faseAvanzar(), peticion),
  faseAtras: (tipo, slug, variante) => post(paths.faseAtras(), { tipo, slug, variante }),
  nota: (tipo, slug, nombre, texto) => post(paths.nota(), { tipo, slug, nombre, texto }),
  elegir: (tipo, slug, nombre) => post(paths.elegir(), { tipo, slug, nombre }),
};

/** Texto legible de cualquier fallo, para los avisos. */
export function describeError(e) {
  if (e instanceof OfflineError || e instanceof ApiError) return e.message;
  return `Error inesperado: ${e && e.message ? e.message : String(e)}`;
}
