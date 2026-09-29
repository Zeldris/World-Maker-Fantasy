// Ollama simulado para pruebas en la nube: responde /api/generate (normal y streaming), /api/embed,
// /api/tags y /api/ps. Con `format` (JSON Schema) sintetiza un objeto válido; sin él, texto plano.
// Overrides en caliente: MOCK_OVERRIDES (JSON) — { "<propiedad>": valor } se aplica a cualquier
// schema que tenga esa propiedad en su nivel superior. Log de peticiones en MOCK_LOG.
import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.PORT ?? 11434);
const OVERRIDES = process.env.MOCK_OVERRIDES ?? '/tmp/mock-ollama-overrides.json';
const LOG = process.env.MOCK_LOG ?? '/tmp/mock-ollama.log';

function overrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')); } catch { return {}; }
}

function extractAction(prompt) {
  const m = prompt.match(/(?:ACCI[ÓO]N(?: DEL JUGADOR)?|Acción del jugador|El jugador (?:dice|hace))[^:\n]*:\s*"?([^\n"]{3,200})/i);
  return m ? m[1].trim() : null;
}

function narrationFor(prompt) {
  const action = extractAction(prompt);
  return action
    ? `El personaje lleva a cabo lo que se propone (${action.slice(0, 80)}). El entorno responde en calma y nada fuera de lo común ocurre.`
    : 'El personaje observa con atención a su alrededor. El viento mueve la hierba y nada fuera de lo común ocurre.';
}

function synth(schema, key, prompt, depth = 0) {
  if (!schema || depth > 6) return null;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.enum) {
    const nonNull = schema.enum.filter((v) => v !== null);
    if (schema.enum.includes(null)) return null;
    if (key === 'banda') return 'corta';
    if (key === 'duracionEstimadaMinutos') return 5;
    if (key === 'dificultad') return 12;
    return nonNull[0];
  }
  if (types.includes('null') && types.includes('object')) return null;
  if (types.includes('null') && types.includes('string')) return null;
  const t = types.find((x) => x !== 'null');
  switch (t) {
    case 'object': {
      const out = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = synth(v, k, prompt, depth + 1);
      return out;
    }
    case 'array': {
      if (key === 'suggestions') return ['Miro a mi alrededor con calma.', 'Sigo mi camino con cautela.', 'Reviso mi equipo.'];
      if (key === 'opciones') return ['Observarlo de lejos', 'Seguir mi camino'];
      const n = schema.minItems ?? 0;
      return Array.from({ length: n }, () => synth(schema.items, key, prompt, depth + 1));
    }
    case 'string':
      if (/narra|reply|text|summary|resumen/i.test(key ?? '')) return narrationFor(prompt);
      if (key === 'razon') return 'Acción cotidiana sin riesgo.';
      return 'algo';
    case 'number':
    case 'integer':
      return schema.minimum ?? 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

function respond(body) {
  const prompt = body.prompt ?? '';
  if (body.format && typeof body.format === 'object') {
    const obj = synth(body.format, null, prompt);
    const ov = overrides();
    for (const [k, v] of Object.entries(ov)) if (obj && k in obj) obj[k] = v;
    return JSON.stringify(obj);
  }
  if (body.format === 'json') return JSON.stringify({ narration: narrationFor(prompt) });
  return narrationFor(prompt);
}

function vec(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: 768 }, (_, i) => Math.sin(h + i) * 0.1);
}

http
  .createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      let body = {};
      try { body = data ? JSON.parse(data) : {}; } catch {}
      const url = req.url ?? '';
      if (url.startsWith('/api/generate')) {
        const text = respond(body);
        fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), model: body.model, keys: body.format?.properties ? Object.keys(body.format.properties) : null, promptHead: (body.prompt ?? '').slice(0, 160), out: text.slice(0, 400) }) + '\n');
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
          const mid = Math.floor(text.length / 2);
          res.write(JSON.stringify({ model: body.model, response: text.slice(0, mid), done: false }) + '\n');
          res.write(JSON.stringify({ model: body.model, response: text.slice(mid), done: false }) + '\n');
          res.end(JSON.stringify({ model: body.model, response: '', done: true }) + '\n');
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ model: body.model, response: text, done: true }));
        }
        return;
      }
      if (url.startsWith('/api/embed')) {
        const inputs = Array.isArray(body.input) ? body.input : [body.input ?? body.prompt ?? ''];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ model: body.model, embeddings: inputs.map(vec), embedding: vec(inputs[0]) }));
        return;
      }
      if (url.startsWith('/api/tags') || url.startsWith('/api/ps')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [{ name: 'tarkor-narrador', model: 'tarkor-narrador' }] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Ollama is running');
    });
  })
  .listen(PORT, () => console.log(`mock-ollama en :${PORT}`));
