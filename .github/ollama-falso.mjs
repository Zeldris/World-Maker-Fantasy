// Ollama falso para el CI (2026-09-28): el backend necesita embeddings para crear el mundo
// (`reindex-lore`) y los tests de integración llaman a Ollama en algunos caminos. Sin GPU ni
// modelos en GitHub Actions, esto imita las rutas que usa el backend con respuestas fijas:
// `/api/embed` devuelve vectores deterministas de 768 dimensiones (como nomic-embed-text).
// Copiado de app/e2e/ollama-falso.mjs del repo Instalador-WMF-Tarkor.
//
// Uso: node .github/ollama-falso.mjs [puerto]

import { createServer } from 'node:http'

const puerto = Number(process.argv[2] ?? 11499)
const descargados = new Set()
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function cuerpo(req) {
  let datos = ''
  for await (const trozo of req) datos += trozo
  return datos ? JSON.parse(datos) : {}
}

createServer(async (req, res) => {
  const json = (v, estado = 200) => {
    res.writeHead(estado, { 'content-type': 'application/json' })
    res.end(JSON.stringify(v))
  }
  const ruta = req.url
  if (ruta === '/api/version') return json({ version: '0.34.3-falso' })
  if (ruta === '/api/tags') return json({ models: [...descargados].map((name) => ({ name })) })
  if (ruta === '/api/ps') return json({ models: [] })
  if (ruta === '/api/pull') {
    const { model } = await cuerpo(req)
    res.writeHead(200, { 'content-type': 'application/x-ndjson' })
    res.write(JSON.stringify({ status: 'pulling manifest' }) + '\n')
    for (let i = 1; i <= 5; i++) {
      await esperar(80)
      res.write(JSON.stringify({ status: `pulling ${model}`, digest: `sha256:${model}`, total: 500, completed: i * 100 }) + '\n')
    }
    res.write(JSON.stringify({ status: 'success' }) + '\n')
    descargados.add(model === 'nomic-embed-text' ? 'nomic-embed-text:latest' : model)
    return res.end()
  }
  if (ruta === '/api/embed') {
    // Vector determinista de 768 dimensiones (como nomic-embed-text) a partir del texto.
    const { input } = await cuerpo(req)
    const textos = Array.isArray(input) ? input : [input]
    const vector = (t) => {
      let h = 2166136261
      return Array.from({ length: 768 }, (_, i) => {
        h = Math.imul(h ^ (t.charCodeAt(i % Math.max(1, t.length)) || 0) ^ i, 16777619)
        return ((h >>> 0) % 2000) / 1000 - 1
      })
    }
    return json({ model: 'nomic-embed-text', embeddings: textos.map((t) => vector(String(t))) })
  }
  if (ruta === '/api/generate') {
    const { model } = await cuerpo(req)
    if (![...descargados].some((d) => d.startsWith(model))) return json({ error: `model '${model}' not found` }, 404)
    return json({ response: ' La niebla del estrecho se abre y deja ver las hogueras de Berig. ', eval_count: 60, eval_duration: 5e9 })
  }
  json({ error: 'ruta desconocida' }, 404)
}).listen(puerto, '127.0.0.1', () => console.log(`http://127.0.0.1:${puerto}`))
