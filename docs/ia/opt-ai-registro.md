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
| `app.num_ctx` | entero | Contexto pedido, o el efectivo del modelo cargado (`/api/ps`, si no `/api/show`) si la llamada no lo pasa (`QA-162`) |
| `app.turno` | texto | Id del turno: lo abre `/turn/classify` y lo siguen las llamadas de `/turn/narrate` de la misma partida (`QA-162`) |
| `app.intento` | entero | Intento de la cascada de `narrar` (1, 2, o 3 = respaldo) |
| `app.evento` | texto | `rechazo`: línea sin llamada, un guard rechazó el texto de ese intento (`app.rechazo` = motivo) |
| `app.keep_alive` | texto | Tiempo que el modelo sigue cargado |
| `app.duration_ms` | número | Total de la llamada, medido por el cliente |
| `app.load_ms` | número | Carga del modelo (>0 = carga en frío) |
| `app.prefill_ms` | número | Lectura del prompt |
| `app.decode_ms` | número | Generación |
| `app.ttft_ms` | número | Primera palabra (solo en streaming) |
| `app.truncated` | booleano | `input_tokens` ≥ `num_ctx` o caracteres del prompt / 4 > `num_ctx` (el prompt se recortó; Ollama cuenta los tokens ya recortados) |
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

| Tarea · modelo | n | p50 | p95 | ttft p50 | tok in (media) | tok/s | frío | errores |
|---|---|---|---|---|---|---|---|---|
| `narrar` · narrador | 22 | 48,1 s | 82,0 s | 38,5 s | 6.331 | 10,7 | 9 % | 0 % |
| `modo_dinamico` · narrador | 10 | 16,8 s | 22,9 s | — | 1.628 | 12,2 | 0 % | 0 % |
| `dialogo_npc` · narrador | 4 | 9,5 s | 11,7 s | — | 794 | 12,3 | 0 % | 0 % |
| `resumen` · narrador | 1 | 41,7 s | — | — | 3.616 | 12,4 | 0 % | 0 % |
| `clasificar` · qwen2.5 1.5B | 6 | 8,1 s | 8,7 s | — | 1.566 | 37,4 | 100 % | 0 % |
| `narrar_respaldo` · qwen2.5 1.5B | 2 | 11,4 s | 12,3 s | — | 2.050 | 31,8 | 100 % | 0 % |
| `embedding` · nomic-embed-text | 29 | 0,03 s | 0,96 s | — | 34 | — | 21 % | 0 % |

- `narrar`: el prefill manda (p50 de `app.prefill_ms` 36 s de 48 s; el ttft, 38,5 s, suma además la carga y el primer token). Si el motor reutiliza la caché del prompt, el turno tarda unos 20 s
  (7 de 22); si no, unos 50 s (15 de 22). Un `length` a los 89 s, con recarga del modelo (8,7 s), al borde del
  límite de 90 s del intento 1.
- `clasificar` y `narrar_respaldo` (`keep_alive` 0): siempre en frío, 3 s de carga cada vez.
- Recortados: `medir.py` da «-» porque `app.truncated` solo se escribe cuando la llamada pasa `num_ctx`, y ninguna lo pasa; el máximo de entrada fue 7.024 tokens con `num_ctx` 8192
  en el Modelfile del narrador.
- RAG, juego fijo (`npm run rag-eval`, 12 casos de semilla, k=4, tras `reindex-lore`): **recall@4 0,917, MRR 0,861**
  (no sale `estaciones-orcas`; `maktor-aniquilado`, 3.º). Con 4 casos de la ronda (P251, P263, P265, P241, en un
  archivo aparte, sin subir): recall@4 0,25; los trozos esperados están en el índice (`no_recuperado`).
- Tanda anterior del mismo día, **solo CPU por un fallo del arranque** (Ollama sin el `~/.bashrc`, sin GPU):
  `narrar` 26 de 33 por timeout (90 s y 240 s), 12 de 17 turnos narrados por el respaldo; guardada como
  `registro-2026-10-20-solo-cpu.jsonl` y fuera de la comparación. En ella el RAG estaba roto (P274).

**Informe de `/opt-ai`** (2026-10-20, con la skill; sustituye a las propuestas hechas a mano en la ronda, que revisó).
Propuestas **aprobadas por la usuaria el 2026-10-20, sin aplicar** (bitácora, «Propuestas aprobadas»).

- **Por turno** (lo que espera la jugadora): 15 turnos, p50 63,6 s, p95 ~104 s, máx. 133 s. 7 de 15 necesitaron el
  intento 2 de `narrar` y 2 llegaron al respaldo (las 22 llamadas = 15 intentos 1 + 7 intentos 2).
- **Recortados**: el registro da «-», pero el log de Ollama muestra los 2 respaldos truncados de 5.456 a 2.050 tokens
  (qwen con contexto 4096).
- **Errores**: 0 en el registro; en `backend.log`, 1 JSON cortado (intento 1 con `length` a 220 tokens) y 9 rechazos
  de guard (2.ª persona, esquiva con golpe que conectó ×2, combate ya resuelto, temperamento, objeto sin camino…).
- **Caché**: el prefijo fijo ya va primero y reutiliza ~2.600 de ~6.300 tokens por turno; se pierde en 5 de 15
  turnos (2 recargas del narrador, 2 tras `dialogo_npc`/`modo_dinamico`, 1 al entrar en combate por `lengthGuidance`).
- **Recargas del narrador**: 2. Una por `resumen` (usa el narrador con `keep_alive` 5m y le baja la residencia de 1h)
  y otra por desalojo de memoria (1,2 GiB libres) al cargar qwen: el peor turno, 133 s.
- **RAG**: juego fijo recall@4 0,917 y MRR 0,861 (k=8: 1,000 y 0,872). Casos de la ronda (P251, P272, P263; archivos
  temporales en `logs/`, sin subir): recall@4 0,25, MRR 0,25 (k=8: 0,75). P251 y P272 `no_recuperado`; P263 verde →
  `ignorado`. Sin caso de RAG posible: P240, P241, P262, P264, P265, P266, P273 y P274.
- **Privacidad**: `LIVE_TEACHER_CAPTURE_ENABLED=true` en el `.env` manda turnos a proveedores remotos (12 intentos,
  todos con 401/402/403) y el registro no lo recoge: choca con «solo local».
- `modo_dinamico` llega a 203-214 de 220 tokens de tope.

Propuestas, por impacto (cada una se comprueba con `npm run benchmark-turno` antes y después, misma semilla, perfil
`deck`, `IA_REGISTRO` en las dos pasadas, y `medir.py <después> --anterior <antes> --perfil deck`):

| # | Propuesta | Medida | Impacto | Puede empeorar |
|---|---|---|---|---|
| 1 | Menos intentos 2: `num_predict` de 220 a ~300 y atacar en el prompt los dos rechazos más frecuentes | 47 % de turnos con intento 2, +15-25 s cada uno | turno p50 ~64 → ~50 s | narraciones más largas, +~8 s de decode |
| 2 | Recortar la parte variable del prompt (~3.700 tokens sin caché ≈ 30 s), empezando por los repetidos de la memoria (P247) | ~8 s por cada 1.000 tokens | prefill | coherencia: NPC o hechos olvidados |
| 3 | `keep_alive` 1h en `resumen` | 1 de 2 recargas, ~+30 s | una línea | nada visible |
| 4 | Respaldo con contexto suficiente (`num_ctx` 8192 en el intento 3, o prompt propio más corto) | 2 de 2 respaldos recortados | calidad del respaldo | ~120 MB de KV y memoria justa en la Deck |
| 5 | Escalera del RAG (trozos más pequeños; si no, híbrida) con los casos de la ronda en `rag-casos.jsonl` | recall@4 0,25 en la ronda | recall | el 0,917 de las semillas |
| 6 | Registro y `medir.py`: `app.intento`, `app.rechazo`, id de turno, `num_ctx` efectivo; p50/p95 por turno; sin fallidos en p50 y tok/s | el turno real y los recortes no se ven | medición | nada |
| 7 | `lengthGuidance` detrás del bloque fijo | ~1.500 tokens de caché perdidos al entrar en combate (≈12 s) | caché | menos caso a la longitud pedida |
| 8 | `keep_alive` de `clasificar` de 0 a 5m, como experimento | 3 s por llamada | ~24 s por tanda | contradice una decisión deliberada; el único desalojo fue al cargar qwen |
| 9 | Desactivar la captura remota en la Deck y en las tandas, o arreglar las claves | 12 envíos fallidos | privacidad | nada |

De las propuestas a mano: se sostienen «avisar sin GPU», «reindexar el lore» (detector: `rag-eval` con código 1 en los
casos `debe_pasar`) y la de medición; **se cae** «prefijo fijo primero» (ya está hecho); cambian la de casos del RAG
(P241 y P265 son del motor; falta P272), la del límite del intento 1 (con GPU no hubo timeouts: mejor atacar las
causas) y la de `keep_alive`, que pasa a experimento.

**Umbral propuesto** (Deck con GPU, por turno): primera palabra p50 ≤ 30 s; turno p50 ≤ 45 s y p95 ≤ 75 s;
`modo_dinamico` y `dialogo_npc` p50 ≤ 15 s. Hoy `narrar` no cumple ninguno.

## Medidas de las propuestas (`QA-160`…`QA-168`, rama `claude/opt-ai-mejoras`)

Cada pasada: `logs/bench.sh <etiqueta> 8` (sin subir) restaura la partida de la ronda (`cmvgnd5ke0001rivyqqjpdezo`,
Gorhorn, Día 42) en `tarkor_juego`, arranca con `IA_PERFIL=deck` e `IA_REGISTRO` y pasa `benchmark-turno` (8 turnos,
mismas acciones). Columnas de `medir.py` por turno (`QA-162`).

| Pasada | Cambio | turno p50 | turno p95 | primera palabra p50 | intento 2 | respaldo | narrar tok_in | Nota |
|---|---|---|---|---|---|---|---|---|
| `01-ref` | `QA-160` + instrumentación de `QA-162` | 61,0 s | 74,4 s | 45,2 s | 29 % | 14 % | 6.292 | prefill de `narrar` 38,8 s; respaldo recortado (2.050 tokens de entrada con `num_ctx` 4096 y ~16.000 caracteres); rechazos: `combateIniciado` con NPC no agresor ×3, «quedan orcos del Clan Maktor» ×1 |
| `02-qa161` (12 turnos) | `QA-161` | 73,0 s | 101,0 s | 47,8 s | 40 % | 30 % | 6.419 | más rechazos que `01-ref` (2.ª persona ×2, `combateIniciado` ×3, equipo, repetición, luna): ruido del muestreo, no de `QA-161`; el `resumen` del turno 9 no recarga el narrador |
| `04-qa163` | `QA-163` | 61,1 s | 77,3 s | 45,4 s | 29 % | 0 % | 6.487 | rechazos: 2.ª persona ×1, cambio de equipo ×1; ningún `combateIniciado` (en `01-ref` y `02`, 6 de 11) |
| `05-qa164` | `QA-164` | 38,1 s | 63,6 s | 22,7 s | 29 % | 0 % | 6.344 | frente a `04`: prefill del intento 1 en caliente 13-16 s (antes ~37 s); el primer turno tras arrancar sigue en ~39 s; rechazos iguales (equipo ×1, 2.ª persona ×1) |
| `06-qa165` | `QA-165` | 32,8 s | 66,1 s | 21,3 s | 14 % | 0 % | 6.374 | los 8 turnos no entran en combate: lo que mide `QA-165` es la reproducción de abajo; dos turnos seguidos con la misma frase de Ulkha («¿Qué busca?»), que el filtro de repetición no pilla |
| `07-qa167` | `QA-167` | 31,6 s | 48,0 s | 21,3 s | 0 % | 0 % | 6.368 | `bench.sh` reindexa tras restaurar el dump; lore pertinente (el lugar primero, «El cielo sin luna» al mirar el cielo); score_1 0,735 → 0,760 |

- **`QA-160`**: sin A/B (medirla mandaría turnos fuera). Comprobado: con `arrancar-juego.sh` el servidor no avisa y
  `backend.log` no tiene ningún intento de `live-teacher`. El `.env` de la Deck también queda en `false` (no se sube).
- **`QA-161`**: el `resumen` (turno 9, al cumplir 15 acciones) sale con `keep_alive` 1h, carga 30 ms (en caliente) y
  el `narrar` siguiente carga en 2,9 ms: no hay recarga. En la ronda, el `resumen` con 5m costó una recarga de ~30 s.
  Los 8 primeros turnos no cambian por `QA-161`; la diferencia con `01-ref` es de rechazos (ruido entre pasadas de
  ±10 s en p50 con 8 turnos: las comparaciones de las siguientes se leen con eso en cuenta).
- **Hallazgo de `02`**: el prefill del intento 1 es de ~37 s para ~6.500 tokens, pero el del intento 2 (~5.900) baja a
  4,5-6 s y el calentamiento en frío lee 2.848 tokens en 3,8 s: entre turnos no se aprovecha la caché del prefijo.
- **`QA-162`**: instrumentación sin A/B (ya estaba en `01-ref`); lo que mide es lo de la tabla. `rag-eval` en
  `tarkor_juego` con los 4 casos de la ronda en `rag-casos.jsonl` (16 en total): recall@4 0,750, MRR 0,708 (k=8: 0,938 y
  0,739), 0 `debe_pasar` fallidos; de los de la ronda, solo `p263-ulkha-serhu` sale (puesto 1). Referencia de `QA-167`.
- **`QA-163`**: el `format` solo deja en `combateIniciado.npcSlugs` los posibles agresores (y solo `null` si no hay
  ninguno), con el texto del prompt a juego, y `num_predict` del intento 1 de 220 a 300 (1 de 39 intentos 1 se cortaba
  por longitud). Desaparece el rechazo más frecuente; los intentos 2 se quedan en 29 % por otros rechazos (2.ª persona,
  equipo), pero ninguno llega al respaldo (14 % → 0 %). La latencia no cambia: el coste es el prefill (`QA-164`).
- **`QA-164`**: el estado de la partida (con la hora) y «TU PROPIA NARRACIÓN DEL TURNO ANTERIOR» pasan detrás de los
  hechos de la escena (`buildNarrationPrompt`), que casi no cambian entre turnos: el prefijo común pasa de ~5.900
  caracteres a todo lo anterior a la memoria de la sesión. Turno p50 61 → 38 s y primera palabra 45 → 23 s: cumplen el
  umbral; p95 64 s también. Las narraciones no pierden la hora ni la escena. Los repetidos de la memoria (P247) se quedan
  fuera: van al final del prefijo y son ≤1.800 caracteres, poco frente al corte de la hora.
- **`QA-165`**: `lengthGuidance` pasa del principio del bloque fijo a justo antes de ACCIÓN DEL JUGADOR. Reproducción
  con un prompt real (6.427 tokens) y la caché caliente: entrar en combate costaba 50,4 s de prefill con el orden viejo y
  1,4 s con el nuevo. Arreglado de paso un fallo de `QA-164`: el intento 2 recortaba los hechos con un `replace` del
  bloque entero, que ya no casaba cuando había narración anterior (el prompt la saca aparte); ahora usa `hechosBlock`.
- **`QA-166`**: el respaldo (`qwen2.5:1.5b-instruct`) lleva el prompt recortado del intento 2 y `num_ctx` 8192. Sin pasada
  de `benchmark-turno` (solo cambia el intento 3, que no salió en `04`…`06`); reproducción con un prompt real y el
  `format` de `narrar`: con 4096 lee 2.050 de 5.257 tokens y narra hechos sueltos sin la acción (7,8 s); con 8192 lee
  el prompt entero y narra la acción con Ulkha en escena (15,5 s). RAM: ~4 GB disponibles con el narrador cargado.
- **`QA-167`**: peldaño 1 de la escalera (tamaño de trozo). Cada fragmento de `loreChunks.ts` se indexa en trozos de
  ~400 caracteres por frases, con el título delante y el texto entero en la fila; `retrieveLore` se queda con el mejor
  trozo por título (`DISTINCT ON`), así que el prompt no crece. Simulación previa con los 16 casos: 600 → 0,812,
  400 → 0,875, 250 → 0,875. `rag-eval` tras reindexar: recall@4 0,750 → 0,875, MRR 0,708 → 0,755, 0 `debe_pasar`
  fallidos; suben `p251` (5 → 4), `p272-orco-maktor` (10 → 3), `maktor-aniquilado` (3 → 1) y `estaciones-orcas` (8 → 5);
  baja `jakut-faerus` (1 → 2). Sigue sin salir `p272-ulkha-maktor-compuesta` (pregunta doble): sería el peldaño 2
  (híbrida), que no se sube sin más casos que lo pidan.
