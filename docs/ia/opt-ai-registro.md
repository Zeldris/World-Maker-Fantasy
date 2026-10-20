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
| `app.task` | texto | Tarea del proyecto (en Tarkor: `narrar`, `clasificar`, `sugerir`, `cronica`, `resumen`, `embedding`, `rag`…) |
| `app.machine_profile` | texto | Perfil de máquina (`IA_PERFIL`; en Tarkor `deck`, `cpu`, `gpu8`, `gpu12`; sin variable, `desconocido`) |
| `app.num_ctx` | entero | Contexto pedido |
| `app.keep_alive` | texto | Tiempo que el modelo sigue cargado |
| `app.duration_ms` | número | Total de la llamada, medido por el cliente |
| `app.load_ms` | número | Carga del modelo (>0 = carga en frío) |
| `app.prefill_ms` | número | Lectura del prompt |
| `app.decode_ms` | número | Generación |
| `app.ttft_ms` | número | Primera palabra (solo en streaming) |
| `app.truncated` | booleano | `input_tokens` ≥ `num_ctx` (el prompt se recortó) |
| `app.error` | texto | Mensaje si la llamada falló |
| `app.rag.query` | texto | Consulta del RAG (solo `retrieval`) |
| `app.rag.k` | entero | Trozos pedidos |
| `app.rag.results` | lista `{id, score}` | Trozos devueltos, en orden |
| `app.rag.embed_ms` · `app.rag.search_ms` | número | Embedding de la consulta y búsqueda |

## Casos del RAG (`rag-casos.jsonl`)

Una línea por caso: `{"id": "…", "pregunta": "…", "esperados": ["<id o fuente del trozo>", …], "origen": "P-número o
semilla", "causa": "ausente|no_recuperado|ignorado|null", "debe_pasar": true}`. `debe_pasar` (opcional): si el caso no sale en el top-k, `npm run rag-eval` termina con código 1. En Tarkor el id de trozo de `esperados` es su título en `loreChunks.ts` (los UUID de BD cambian en cada reindexado). El script de evaluación devuelve por caso el puesto del
primer trozo esperado y, en total, recall@k y MRR.
