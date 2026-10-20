# Registro por llamada de `opt-ai` (formato común)

Una línea JSON por llamada, en el archivo que diga `IA_REGISTRO` (sin la variable no se escribe nada). Nombres
`gen_ai.*` del vocabulario GenAI de OpenTelemetry (semantic-conventions-genai, estado «Development», consultado el
2026-10-20); lo propio, con prefijo `app.`. Campos ausentes se omiten, no van a `null`.

| Campo | Tipo | Qué es |
|---|---|---|
| `ts` | ISO 8601 UTC | Fin de la llamada |
| `gen_ai.operation.name` | `text_completion` · `chat` · `embeddings` · `retrieval` | Tipo de llamada |
| `gen_ai.provider.name` | texto | Motor: `ollama`, `llama.cpp`, `lmstudio`, `vllm` |
| `gen_ai.request.model` | texto | Modelo pedido |
| `gen_ai.request.max_tokens` | entero | `num_predict` o equivalente |
| `gen_ai.request.temperature` | número | |
| `gen_ai.usage.input_tokens` | entero | Tokens del prompt (Ollama: `prompt_eval_count`) |
| `gen_ai.usage.output_tokens` | entero | Tokens generados (Ollama: `eval_count`) |
| `gen_ai.response.finish_reason` | texto | `stop`, `length`, `error`… |
| `app.task` | texto | Tarea del proyecto (en Tarkor: `narrar`, `narrar_respaldo`, `clasificar`, `sugerir`, `dialogo_npc`, `combate`, `modo_dinamico`, `resumen`, `prompts_imagen`, `embedding`, `rag`; `calentar` es el calentamiento al arrancar y se excluye del análisis) |
| `app.machine_profile` | texto | Perfil de máquina (`IA_PERFIL`; en Tarkor `deck`, `cpu`, `gpu8`, `gpu12`; sin variable, `desconocido`) |
| `app.num_ctx` | entero | Contexto pedido (solo sale si la llamada lo pasa) |
| `app.keep_alive` | texto | Tiempo que el modelo sigue cargado |
| `app.duration_ms` | número | Total de la llamada, medido por el cliente |
| `app.load_ms` | número | Carga del modelo (>0 = carga en frío) |
| `app.prefill_ms` | número | Lectura del prompt |
| `app.decode_ms` | número | Generación |
| `app.ttft_ms` | número | Primera palabra (solo en streaming) |
| `app.truncated` | booleano | `input_tokens` ≥ `num_ctx` (el prompt se recortó). Aproximado: con la caché del prefijo, `prompt_eval_count` solo cuenta los tokens nuevos |
| `app.error` | texto | Mensaje si la llamada falló |
| `app.rag.query` | texto | Consulta del RAG (solo `retrieval`) |
| `app.rag.k` | entero | Trozos pedidos |
| `app.rag.results` | lista `{id, score}` | Trozos devueltos, en orden |
| `app.rag.embed_ms` · `app.rag.search_ms` | número | Embedding de la consulta y búsqueda |

**Privacidad:** `app.rag.query` guarda el texto que escribió el jugador (y `app.error` puede citar fragmentos del
prompt). El archivo del registro no se comparte ni se pega sin limpiarlo antes.

## Casos del RAG (`rag-casos.jsonl`)

Una línea por caso: `{"id": "…", "pregunta": "…", "esperados": ["<id o fuente del trozo>", …], "region": "<región, opcional>", "origen": "P-número o
semilla", "causa": "ausente|no_recuperado|ignorado|null", "debe_pasar": true}`. `region` (opcional): la región del jugador; la consulta sale como en el juego (`pregunta — región`, con el lore del otro continente excluido). `debe_pasar` (opcional): si el caso no sale en el top-k, `npm run rag-eval` termina con código 1. En Tarkor el id de trozo de `esperados` es su título en `loreChunks.ts` (los UUID de BD cambian en cada reindexado). El script de evaluación devuelve por caso el puesto del
primer trozo esperado y, en total, recall@k y MRR.

## Medidas por tanda

### 2026-10-20 · Deck (`deck`), primera pasada (sin anterior)

Tanda de 16:36 a 17:38 en la partida de pruebas «IA y diálogos», día 1: 9 textos libres al narrador, 3 escenas de
Interactuar, 5 rondas de combate y 1 «Responder». Ollama 0.34.2 por Vulkan (33/33 capas en la GPU), flash attention,
KV `q8_0`, `OLLAMA_IGPU_ENABLE=1`. Registro: `backend/ia/registro-2026-10-20.jsonl` (85 líneas, sin subir).

| Tarea · modelo | n | p50 | p95 | ttft p50 | tok in p50 | tok/s | frío | errores |
|---|---|---|---|---|---|---|---|---|
| `narrar` · narrador | 22 | 48,1 s | 82,0 s | 38,5 s | 6.331 | 10,7 | 9 % | 0 % |
| `modo_dinamico` · narrador | 10 | 16,8 s | 22,9 s | — | 1.628 | 12,2 | 0 % | 0 % |
| `dialogo_npc` · narrador | 4 | 9,5 s | 11,7 s | — | 794 | 12,3 | 0 % | 0 % |
| `resumen` · narrador | 1 | 41,7 s | — | — | 3.616 | 12,4 | 0 % | 0 % |
| `clasificar` · qwen2.5 1.5B | 6 | 8,1 s | 8,7 s | — | 1.566 | 37,4 | 100 % | 0 % |
| `narrar_respaldo` · qwen2.5 1.5B | 2 | 11,4 s | 12,3 s | — | 2.050 | 31,8 | 100 % | 0 % |
| `embedding` · nomic-embed-text | 29 | 0,03 s | 0,96 s | — | 34 | — | 21 % | 0 % |

- `narrar`: el prefill manda (p50 36 s de 48 s). Si el motor reutiliza la caché del prompt, el turno tarda unos 20 s
  (7 de 22); si no, unos 50 s (15 de 22). Un `length` a los 89 s, con recarga del modelo (8,7 s), al borde del
  límite de 90 s del intento 1.
- `clasificar` y `narrar_respaldo` (`keep_alive` 0): siempre en frío, 3 s de carga cada vez.
- Recortados: sin medir (el registro no lleva `num_ctx`); el máximo de entrada fue 7.024 tokens con `num_ctx` 8192
  en el Modelfile del narrador.
- RAG, juego fijo (`npm run rag-eval`, 12 casos de semilla, k=4, tras `reindex-lore`): **recall@4 0,917, MRR 0,861**
  (no sale `estaciones-orcas`; `maktor-aniquilado`, 3.º). Con 4 casos de la ronda (P251, P263, P265, P241, en un
  archivo aparte, sin subir): recall@4 0,25; los trozos esperados están en el índice (`no_recuperado`).
- Tanda anterior del mismo día, **solo CPU por un fallo del arranque** (Ollama sin el `~/.bashrc`, sin GPU):
  `narrar` 26 de 33 por timeout (90 s y 240 s), 12 de 17 turnos narrados por el respaldo; guardada como
  `registro-2026-10-20-solo-cpu.jsonl` y fuera de la comparación. En ella el RAG estaba roto (P274).
