# Qué sacar de otros repos para el narrador, su RAG y su modelo (2026-11-03, `QA-289`)

Encargo: técnicas de proyectos públicos que mejoren la **calidad** (primero) y la **velocidad** del narrador local
(`tarkor-narrador-llama31`, llama 3.1 8B Q4_K_M en Ollama 0.34 sobre la Deck). Solo investigación: no se ha
tocado código ni se ha lanzado Ollama. Por indicación de la usuaria, **no se evalúan modelos alternativos** (ya se
hizo: [informe del scout 2026-10-21](../scout/informes/2026-10-21.md)); en su lugar, cómo mejorar ese modelo.

**Estado: propuestas SIN REVISAR, fuera del roadmap** hasta que la usuaria decida qué entra en `QA-289` o en un hito.

Cada afirmación lleva su fuente; lo que no se pudo comprobar en la fuente va marcado **[sin verificar]**.
Rutas relativas a `backend/src/` salvo que se indique otra cosa.

## Resumen en diez líneas

1. Lo que más calidad da en los repos de rol es **una voz por llamada**: SillyTavern y Talemate nunca piden a un
   modelo que hable por dos personajes en la misma salida. Nuestro `narrateAction` sí lo pide (P311, P263).
2. **Lo que sabe cada NPC** se filtra por código antes de llamar (Talemate «limit to character knowledge», bloques
   de memoria de Letta): nuestra `generateNpcReply` recibe los hechos de la partida sin filtrar por presencia (P266).
3. El lore entra por **claves de entidad** (World Info, Lorebook), no solo por similitud: es la «entrada directa por
   entidad» ya propuesta, y ataca P251/P272 donde fallan los embeddings con nombres propios.
4. La memoria de Generative Agents puntúa recencia·importancia·relevancia; `selectRelevantFacts` ya hace dos de tres
   y busca por la acción, no por quién está en escena (P252).
5. Los frontends ponen las instrucciones que más deben pesar **cerca del final** (Author's Note, `Insertion Order`):
   confirma el riesgo de mover todas las reglas al prefijo. Veredicto: prefijo estable **y** un recordatorio corto
   junto a la acción, medido.
6. El primer corte de caché que conocemos sin medir: `generateNpcReply` cambia el `system` del mismo modelo y, con
   concurrencia 1, el turno siguiente vuelve a preprocesar todo el prefijo.
7. Velocidad con Ollama 0.34: solo muestreo y tamaño del prompt/esquema. `--cache-reuse`, n-gram speculative y
   control vectors piden `llama-server` directo (el registro ya admite el proveedor `llama.cpp`).
8. Un modelo borrador en la iGPU Vulkan es hoy contraproducente (llama.cpp #23126); descartado.
9. Muestreo: `min_p` y `repeat_penalty` sí pasan por `options`; DRY y XTC no existen en Ollama (#7504 abierta).
10. Afinado: la cadena ya existe (`export-dpo-dataset.ts`, Unsloth → GGUF → Ollama); el dato es la propia partida
    (turnos aceptados frente a `app.rechazo_texto`), no un dataset en español, porque no hay ninguno de rol fantástico.

## Punto de partida (del registro de `opt-ai`)

- Turno p50 34,7 s (`11-base`): prefill ~13-14 s, decode ~13 s a ~10,5 tok/s, clasificar 3,3 s.
- La caché de prefijo funciona (prompt idéntico, 0,1 s); por turno cambian ~1.600 tokens de cola a ~120 tok/s.
- Orden del prompt (`services/narrador.ts#buildNarrationPrompt`, l. 1112-1389): ejemplo → `fixedInstructions` →
  PERSONAJE → HECHOS (ordenados por estabilidad) → ESTADO → narración anterior → CONOCIMIENTO DE FONDO (RAG) →
  grounding → tirada → combate → `lengthGuidance` → ACCIÓN → «Responde solo con el JSON pedido».
- Petición (`lib/ollama.ts#buildRequestBody`, l. 59-81): `system`, `prompt`, `format` (esquema JSON), `options`
  con `num_predict`, `temperature`, `num_ctx`, `num_thread`, `use_mlock`. **Nada más de muestreo.**
- Modelfile (`backend/Modelfile.llama31`): `FROM llama3.1:8b-instruct-q4_K_M`, SYSTEM de ~3.300 caracteres,
  `temperature 0.7`, `num_ctx 8192`. La plantilla heredada es la de llama3.1 (`system`/`user`/`assistant` con
  `<|start_header_id|>`), comprobada con `/api/show`.
- Nota: el encargo decía «segunda persona», pero el código exige **tercera persona** («NARRA SIEMPRE EN TERCERA
  PERSONA», l. 1237) y `hasSecondPersonLeak` (l. 1946) rechaza la segunda fuera de citas. Todo lo de abajo respeta eso.

## Tabla priorizada

Calidad primero. «Tiempo» es ganancia de latencia esperada por turno; «medir» es la orden del repo con la que se
comprueba. `R` = ronda de pruebas con el escenario que pide cada hallazgo (`docs/registros/pruebas-0.3-hallazgos.md`).

| # | Técnica | Fuente | Problema | Dónde en nuestro código | Calidad / tiempo | Coste | Riesgo | Cómo medirlo |
|---|---|---|---|---|---|---|---|---|
| 1 | **Una voz por llamada.** El narrador describe y, como mucho, da **una** línea del NPC que habla; si hablan dos, la segunda sale de `generateNpcReply` o se corta. Guard por código: dos hablantes distintos entre comillas sin acotación → rechazo | SillyTavern, group chats: «Swap character cards» (solo la ficha del personaje activo en contexto; «Join» avisa de personajes «confused about themselves») [[ST group]](https://docs.sillytavern.app/usage/core-concepts/groupchats/); Talemate: el agente Conversation («Actor») genera «character-driven dialogue and actions» para un personaje por llamada [[Talemate]](https://vegu-ai.github.io/talemate/user-guide/agents/conversation/) | P311 (voces mezcladas Ulkha/Gorhorn), P263 (NPC se contradice en la misma réplica) | `services/narrador.ts#narrateAction` (l. 1403) y guards (l. 1808-2508); `generateNpcReply` (l. 957) ya existe con nombre oculto y `temperature 0.4` | Calidad: alta en los dos hallazgos. Tiempo: el guard es gratis; una segunda llamada por turno solo cuando hablan dos NPC (+8-12 s en ese turno) | Medio (1-2 días) | Si se delega **toda** réplica a una segunda llamada, cada turno con diálogo sube ~10 s; por eso solo el segundo hablante | `R` con el escenario de P311; contar `app.rechazo_texto` por voz mezclada antes/después; `bench-ia.sh <et> --anterior 11-base` para ver que el p50 no sube |
| 2 | **Lo que sabe cada NPC.** Cada hecho guardado lleva quién estaba presente (zona, NPC en escena, «público»); `generateNpcReply` recibe solo los hechos que ese NPC presenció o que son públicos, y el trasfondo de su ficha | Talemate: «Limit to character knowledge» filtra historial y recuerdos «according to what the character knows»; lo no presenciado se sustituye por «a one-line gap» [[Talemate]](https://vegu-ai.github.io/talemate/user-guide/agents/conversation/); Letta: bloques `persona`/`human` por agente, compartibles y `read_only` [[Letta]](https://docs.letta.com/guides/agents/memory-blocks); ST «Character Lore» (lorebook por personaje) [[ST WI]](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) | P266 (el NPC sabe el nombre del jugador sin que se lo digan), P263 en parte | `services/worldFacts.ts#appendSessionFacts` (l. 108: añadir metadato de presencia) y `generateNpcReply` («HECHOS YA ESTABLECIDOS…») | Calidad: alta para NPC; ninguna en tiempo (el prompt del NPC se acorta) | Medio (migración de `SessionFact` + filtro) | Hechos «públicos» mal etiquetados dejan a un NPC sin contexto; empezar con regla simple: hecho = conocido por los NPC presentes en ese turno | `R` con P266; test unitario del filtro |
| 3 | **Entrada directa por entidad + claves.** Antes de la búsqueda semántica, si la acción, los NPC en escena o la zona coinciden con el título o alias de un `LoreChunk`, ese trozo entra fijo y «protegido»; los semánticos rellenan el presupuesto | ST World Info: activación por `Key`, `Scan Depth`, `Include Names`, filtros AND/NOT, `Recursive Scan`; la búsqueda vectorial es «no determinista: para resultados predecibles, usa palabras clave» [[ST WI]](https://docs.sillytavern.app/usage/core-concepts/worldinfo/); NovelAI Lorebook: claves (regex, `&`), `Always On`, `Search Range`, `Cascading Activation`, `Reserved Tokens` [[NovelAI]](https://docs.novelai.net/en/text/lorebook/) | P251, P272 (`no_recuperado` con nombres propios) | `services/retrieval.ts#retrieveLore` (l. 44) y donde se arma `backgroundLore` en `services/turnResolution.ts`; títulos de `scripts/loreChunks.ts` | Calidad: alta en recall con nombres (es el peldaño 2 de `QA-167`, ya propuesto); tiempo ±0 (coincidencia por texto, ms) | Bajo-medio | Claves demasiado genéricas («clan») meten trozos irrelevantes: claves = nombres propios y alias | `npm run rag-eval` sobre `backend/ia/rag-casos.jsonl` (P251, P272 `debe_pasar`) |
| 4 | **Buscar por la escena, no solo por la acción**, y añadir «importancia». La consulta de embeddings = acción + NPC presentes + zona; cada hecho con una importancia 1-3 por código (hito, combate, misión = 3) que suma a recencia y similitud | Generative Agents: `score = recencia + importancia + relevancia` (α=1 cada una, min-max), recencia con decaimiento 0,995 por hora de juego [[arXiv 2304.03442]](https://arxiv.org/abs/2304.03442) | P252 (callback por entidad no usado), P251 en parte | `services/worldFacts.ts#selectRelevantFacts` (l. 150: hoy recencia + similitud con la acción) | Calidad: media; tiempo ±0 | Bajo | Hechos «importantes» antiguos desplazan a los recientes: mantener `RECENCY_GUARANTEED` | `R` con P252; test de `selectRelevantFacts` |
| 5 | **Recordatorio corto junto a la acción** (3-4 líneas: tercera persona, una voz, no inventar lore, JSON), con las reglas largas intactas en el prefijo. Es el veredicto de abajo | KoboldCpp: Memory «always injected into the start of each prompt», Author's Note «injected near the end of the prompt», con «Strength» = a qué distancia del final [[Kobold]](https://github.com/LostRuins/koboldcpp/wiki); ST: `Insertion Order` mayor = «más cerca del final del contexto y tienen más impacto», posición `@ D` (profundidad) [[ST WI]](https://docs.sillytavern.app/usage/core-concepts/worldinfo/); «Lost in the Middle»: rendimiento mayor «at the beginning or end of the input context» [[arXiv 2307.03172]](https://arxiv.org/abs/2307.03172) | Obediencia a las reglas con un prompt de ~18.000 caracteres; P263 (persona mezclada), P272 (lore inventado) | `buildNarrationPrompt`: `fixedInstructions` (l. 1237-1257) y el tramo ACCIÓN DEL JUGADOR (l. 1298-1303) | Calidad: posible subida de obediencia; tiempo: +30-40 tokens de prefill (<0,5 s) | Bajo (horas) | Que el recordatorio repita lo que ya está y el modelo lo ignore igual; medir, no suponer | `bench-ia.sh 15-recordatorio --anterior 11-base` + rechazos por motivo |
| 6 | **Localizar los cortes de caché con datos**: registrar por llamada `prompt_eval_count` (tokens no cacheados) y el modelo/`system` usados; el primer corte conocido es `generateNpcReply` (mismo modelo, otro `system`) | Ollama `/api/generate` devuelve `prompt_eval_count` y `prompt_eval_duration` [[api.md]](https://github.com/ollama/ollama/blob/main/docs/api.md); Kobold: el shift solo sobrevive «so long as memory is not changed» [[Kobold]](https://github.com/LostRuins/koboldcpp/wiki) | Prefill de 13-14 s cuando el prefijo debería estar cacheado | `lib/ollama.ts` (l. 104, 172: ya se lee `prompt_eval_count`; falta volcarlo al registro y al `medir-ia.py`); `generateNpcReply` l. 957-990 (comentario sobre «cambiar de `system`») | Tiempo: es el paso previo a cualquier ganancia de prefill; calidad ±0 | Bajo | Ninguno | Con los prompts de `14-casos`, tabla turno → `prompt_eval_count`; es el «siguiente paso» de la bitácora |
| 7 | **Contextual Retrieval**: al indexar, cada trozo lleva una línea de contexto (región, clan, casta) generada una vez; luego híbrida BM25 (`tsvector`) + RRF | Anthropic: fallos de recuperación −35 % con embeddings contextuales, −49 % con BM25 contextual, −67 % con reranker; trozos de «no more than a few hundred tokens» [[Anthropic]](https://www.anthropic.com/engineering/contextual-retrieval) | P251/P272 (`no_recuperado`) | `scripts/loreChunks.ts` (indexado) y `retrieveLore` | Calidad: media-alta en recall; tiempo por turno ±0 (coste solo al indexar) | Bajo-medio | Cifras de Anthropic con sus corpus y modelos grandes, no con `nomic-embed-text`; medir con nuestros casos | `npm run rag-eval` |
| 8 | **Muestreo**: `min_p 0.05-0.1`, `repeat_penalty 1.05-1.1` con `repeat_last_n 256`, `top_p` fuera. Sin DRY/XTC en Ollama | ST: Min P «funciona mejor con valores de 0.1 a 0.01» [[ST samplers]](https://docs.sillytavern.app/usage/common-settings/); DRY penaliza «tokens that would extend… a sequence that has previously occurred», valores 0.8/1.75/2 [[PR 5677]](https://github.com/oobabooga/text-generation-webui/pull/5677); XTC umbral 0.1, prob. 0.5, con Min-P 0.02 y DRY 0.8 [[PR 6335]](https://github.com/oobabooga/text-generation-webui/pull/6335); Ollama acepta `min_p`, `repeat_penalty`, `repeat_last_n`, `presence_penalty`, `frequency_penalty` en `options` [[api.md]](https://github.com/ollama/ollama/blob/main/docs/api.md); DRY/XTC: issue abierta sin respuesta [[#7504]](https://github.com/ollama/ollama/issues/7504) | Frases repetidas entre turnos (`isTooSimilarToLast`, `hasRepeatedDialogueLine`), «¿Has visto algo?» | `lib/ollama.ts#buildRequestBody` (hoy solo `temperature`) o `Modelfile.llama31` | Calidad: media en repetición; tiempo ±0 | Muy bajo | `repeat_penalty` alto rompe el JSON y la gramática del español; con `format` activo, `min_p` es inocuo | `bench-ia.sh 16-muestreo --anterior 11-base`; rechazos por repetición |
| 9 | **Esquema JSON más corto** por turno: `newFacts` acotado (máx. 3), campos opcionales solo cuando el turno los puede necesitar (como ya se hace con Reino), `num_predict` 260 | llama.cpp: la gramática puede ir por LLGuidance, «very fast» (parser en <0,5 % de tokens) [[llama.cpp grammars]](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md); el coste del esquema en la ruta de Ollama **[sin verificar]** | Decode de ~13 s dominado por tokens de salida | `buildNarrationPrompt` (`format`, l. 1305+) | Tiempo: cada 10 tokens de salida ≈ 1 s; calidad ±0 | Bajo | Recortar `newFacts` pierde memoria de partida; probar 3 antes que 2 | `bench-ia.sh` con `app.decode_ms` y `eval_count` |
| 10 | **`llama-server` directo** (proveedor `llama.cpp` del registro): `--cache-reuse 256` (reutiliza trozos de KV no prefijo por desplazamiento), `--spec-type ngram-simple` (sin modelo borrador), `-ctk q8_0 -ctv q8_0 -fa on`, `-np 1` | README del server: `--cache-reuse` / `n_cache_reuse` «min chunk size to attempt reusing from the cache via KV shifting» (0 por defecto); `--spec-type` con `ngram-simple`, `ngram-map-k`, `ngram-cache`; `--slot-save-path` [[server README]](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md); prompt lookup: «2x-4x in input-grounded tasks», roleplay la que menos [[apoorvumang]](https://github.com/apoorvumang/prompt-lookup-decoding) | Los ~1.600 tokens de cola que cambian por turno; decode de 13 s | `lib/ollama.ts` (`gen_ai.provider.name` ya admite `llama.cpp`); la plantilla llama3.1 pasaría a `--jinja` o a prompt crudo | Tiempo: `cache-reuse` solo gana lo que coincida por trozos (ESTADO, narración anterior): **[sin verificar]** en nuestro prompt; n-gram en rol gana poco | Alto (otro servidor en la Deck y en el empaquetado; dos rutas de IA) | Dos binarios que mantener; Vulkan y `cache-reuse` pueden fallar juntos **[sin verificar]** | Mismo `bench-ia.sh` con el proveedor cambiado; solo si 5-9 no bastan |
| 11 | **Afinado LoRA/DPO del narrador** con datos de las partidas: `chosen` = turnos aceptados por los guards y por la usuaria en ronda; `rejected` = salidas con `app.rechazo_texto`; QLoRA en Colab con Unsloth; merge → GGUF (imatrix) → `ollama create` | Unsloth: `learning_rate 2e-4`, 1-3 épocas, batch 2 × acumulación 4, exportar con llama.cpp a GGUF para Ollama [[Unsloth]](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide); nuestra cadena [`fine-tuning-ia-local.md`](fine-tuning-ia-local.md) y `scripts/export-dpo-dataset.ts` | P263 (`ignorado`: el trozo llega y no se usa), persona mezclada, estilo | `scripts/export-dpo-dataset.ts`, `services/liveTeacherCapture.ts`, `scripts/compare-narrador-models.ts` (escenarios held-out) | Calidad: la única vía que ataca «el modelo no obedece»; tiempo ±0 (mismo tamaño) | Alto (días; GPU en la nube) | El intento de 2026-10-20 se descartó; sin dataset de rol fantástico en español (no existe público) hay que generar todo; sobreajuste a 300 ejemplos | `compare-narrador-models.ts` sobre `eval.jsonl` + `bench-ia.sh`; es el hito 0.8 |
| 12 | **Cuantización Q5_K_M / Q6_K con imatrix** (bartowski) en vez de Q4_K_M | Tamaños: Q4_K_M 4,92 GB, Q5_K_M 5,73, Q6_K 6,60 («near perfect, recommended»); «The I-quants are not compatible with Vulcan» [[bartowski]](https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF); PPL wikitext: FP16 6,40, Q6_K 6,42, Q5_K_M 6,46, Q4_K_M 6,58 **[sin verificar que sea con imatrix]** [[fedric95]](https://huggingface.co/fedric95/Meta-Llama-3.1-8B-Instruct-GGUF) | Errores sutiles de coherencia atribuibles a la cuantización | `backend/Modelfile.llama31` (`FROM`) | Calidad: pequeña (PPL −2 %); tiempo: decode ligado al ancho de banda, **−15/−30 % de tok/s estimado [sin verificar]** | Bajo (descargar y `ollama create`) | Más RAM compartida en la Deck (16 GB UMA) con el generador de imágenes aparte | `bench-ia.sh 17-q5km --anterior 11-base` + `compare-narrador-models.ts` |
| 13 | **Control vectors** (estilo «descriptive», «narration focus», «ornate» sobre llama 3.1 8B) | llama.cpp `--control-vector`, `--control-vector-scaled <f> <factor>` [[PR 5970]](https://github.com/ggml-org/llama.cpp/pull/5970); vectores para Meta-Llama-3.1-8B-Instruct: ejes Language, Storytelling, Character Focus; «too many… may damage the model's output» [[jukofyork]](https://huggingface.co/jukofyork/creative-writing-control-vectors-v3.0); Ollama no los expone **[sin verificar: no hay rastro en docs ni API]** | Estilo plano, exceso de diálogo | Solo con `llama-server` (fila 10) | Calidad: desconocida en español y con JSON **[sin verificar]** | Medio (requiere 10) | Degradar el JSON o el español | Solo tras 10; `bench-ia.sh` |

## Veredicto: reglas al prefijo estable, solo lo variable y un recordatorio junto a la acción

La propuesta: pasar todo el texto fijo de reglas al prefijo cacheado y dejar junto a la acción solo lo variable más
una línea de recordatorio; ganancia estimada 4-5 s por turno; riesgo: un 8B obedece menos lo que queda lejos.

**Lo que ya es así.** `fixedInstructions` (l. 1237) va al principio desde `QA-164`/`QA-165`; lo que queda cerca de
la acción es `lengthGuidance`, `rollBlock`, `combatBlock` y «Responde solo con el JSON pedido». El SYSTEM del
Modelfile (3.300 caracteres) ya forma parte del prefijo. Así que la ganancia de 4-5 s **no sale de mover reglas**:
los 13-14 s de prefill vienen de los ~1.600 tokens de cola que cambian (HECHOS reordenados, ESTADO, narración
anterior, lore RAG) y de los cortes de caché (fila 6), no de las reglas.

**El riesgo es real, y los frontends lo tienen en cuenta a propósito.** KoboldCpp separa Memory (inicio, cacheable)
de Author's Note (cerca del final, «Strength» regula la distancia); SillyTavern da más `Insertion Order` a lo que debe
pesar más porque va «más cerca del final»; «Lost in the Middle» mide el valle entre principio y final. Nuestra
experiencia encaja: el bug de 2026-08-27 (salto a segunda persona) se arregló con instrucción en el prefijo, pero
P263 (persona mezclada) sigue abierto con la regla allí. No hay cifra fiable de cuánto pierde un 8B por distancia
**[sin verificar: los porcentajes de «instruction sandwich» que circulan son de blogs]**.

**Veredicto.** No mover más al prefijo: ya está. Hacer lo contrario en pequeño: un recordatorio de 3-4 líneas
inmediatamente antes de ACCIÓN DEL JUGADOR (tercera persona por el nombre; una sola voz con acotación; nada que no
esté en HECHOS o CONOCIMIENTO DE FONDO; JSON). Cuesta <0,5 s de prefill. Y limpiar `fixedInstructions`: los
comentarios históricos («bug real jugando en vivo, 2026-09-15…») están **dentro del prompt** y son cientos de tokens
que el modelo lee cada turno sin ayudarle; eso sí acorta el prefijo (gratis con caché) y, sobre todo, la carga de
atención. Medir con `bench-ia.sh 15-recordatorio --anterior 11-base` y con el recuento de rechazos por motivo
(`app.rechazo_texto`) en los mismos prompts de `14-casos`. Si el recordatorio no baja rechazos, se quita.

Lo que sí da los 4-5 s es la fila 6: encontrar los cortes (el `system` distinto de `generateNpcReply` es uno seguro,
porque Ollama con concurrencia 1 guarda un solo contexto por modelo) y, si se confirma, dar al NPC el mismo `system`
que al narrador con sus instrucciones en el `prompt`, o un modelo/alias aparte.

## Mejorar `tarkor-narrador-llama31` (sustituye a «modelos alternativos»)

### Muestreo

- Hoy solo `temperature 0.7`; llama.cpp aplica sus valores por defecto al resto. `min_p`, `top_k`, `top_p`,
  `repeat_penalty`, `repeat_last_n`, `presence_penalty`, `frequency_penalty`, `penalize_newline` y `seed` van en
  `options` (ejemplo «sets every available option» de [api.md](https://github.com/ollama/ollama/blob/main/docs/api.md));
  `typical_p` está desaconsejado. `mirostat` no aparece en ese ejemplo **[sin verificar si sigue admitido]**.
- Los repos de rol recomiendan Min-P bajo y DRY en vez de `repeat_penalty` ([PR 5677](https://github.com/oobabooga/text-generation-webui/pull/5677):
  las penalizaciones clásicas «don't actually prevent looping reliably» y distorsionan la gramática); XTC para
  romper clichés ([PR 6335](https://github.com/oobabooga/text-generation-webui/pull/6335)), con avisos de fallos de
  formato y de «modelo más tonto» en algunos casos. **Ollama no tiene DRY ni XTC** ([#7504](https://github.com/ollama/ollama/issues/7504)
  abierta desde 2024-11, sin respuesta). Con `format` JSON, XTC sería además arriesgado.
- Propuesta mínima (fila 8): `min_p 0.05`, `top_p 1`, `repeat_penalty 1.05`, `repeat_last_n 256`; `seed` fijo solo en
  el bench. Valores de la comunidad para llama 3.1 **[sin verificar en fuente primaria]**.

### Plantilla, `/api/chat` frente a `/api/generate` y Modelfile

- Ollama aplica la TEMPLATE de llama3.1 al `system` + `prompt` (comprobado con `/api/show`): nuestro prompt entero
  va como un único turno `user`. Con `raw: true` «no formatting will be applied» y no devuelve `context`; no cambia
  calidad ni velocidad, solo control. `/api/chat` permitiría mandar la narración anterior como turno `assistant` y
  los hechos como `system`, pero la caché de prefijo depende del mismo texto resultante, no del endpoint: sin
  ganancia esperable, y rehacer `narrateAction`. **Descartado** salvo que se migre a `llama-server`.
- El SYSTEM del Modelfile y `fixedInstructions` repiten reglas (tercera persona, acotaciones): consolidar en uno de
  los dos ahorra tokens y una fuente de contradicción. Lo que cambie con el `system` por petición (NPC) rompe la
  caché: ver fila 6.
- `draft_num_predict` existe en la referencia del Modelfile de Ollama, pero sin instrucción para declarar un modelo
  borrador en 0.34 **[sin verificar que 0.34 lo use en GGUF/Vulkan; las notas de versión solo citan MLX]**.

### Cuantización

Fila 12. Q5_K_M (5,73 GB) y Q6_K (6,60 GB) caben en la Deck; la ganancia de PPL es pequeña y el decode baja con el
tamaño. Los IQ4 con imatrix no sirven: bartowski avisa de que los I-quants no son compatibles con Vulkan. Si se
prueba, con el GGUF imatrix de bartowski y `ollama create` desde un Modelfile idéntico salvo `FROM`.

### LoRA / afinado

- Cadena ya montada: `scripts/export-dpo-dataset.ts` (jsonl `prompt`/`chosen`/`rejected` para TRL `DPOTrainer`),
  `scripts/generate-distillation-dataset.ts` (317/57), `scripts/compare-narrador-models.ts` (held-out),
  [`fine-tuning-ia-local.md`](fine-tuning-ia-local.md) (Colab + Unsloth). Unsloth: `lr 2e-4`, 1-3 épocas, exportar a
  GGUF para Ollama; el adaptador LoRA pesa ~100 MB.
- Datasets de rol en **español**: no hay ninguno de fantasía. PIPPA y RP-Opus son en inglés (RP-Opus CC BY-NC);
  ChatSubs (subtítulos, CC BY-NC) y SpanishCasualChat son conversación general, no rol; `Kiya_conversational_dataset_es`
  **[sin verificar contenido ni licencia]**. Axolotl sirve igual que Unsloth para QLoRA; sin ventaja aquí.
- El dato bueno es el nuestro: cada turno ya se guarda (`IA_CASOS`, `app.rechazo_texto`), y una ronda de pruebas
  produce pares naturales (salida rechazada por guard → `rejected`; salida aceptada y jugada → `chosen`). Para
  `chosen` sin profesor en la nube (privacidad, ver `opt-ai`), vale la narración corregida a mano por la usuaria o la
  aceptada en ronda. Mínimo razonable antes de entrenar: ~300 pares limpios **[sin verificar: Unsloth no da mínimo]**.
- Pedir la LoRA sobre el modelo **base FP16/BF16**, no sobre el Q4: luego merge y cuantizar con imatrix.

### Control vectors

Solo en llama.cpp (`--control-vector`, PR 5970; servidor desde PR 6289); Ollama no los expone. jukofyork publica
vectores para Meta-Llama-3.1-8B-Instruct (ejes «Language: simple/ornate», «Storytelling: explicit/descriptive»,
«Character Focus: narration/dialogue»), entrenados en inglés, y avisa de que combinar muchos ejes daña la salida.
Entrenar los propios con repeng pide pares de prompts en español. Vale como experimento tras la fila 10, no antes.

## Lo descartado y por qué

- **Modelo borrador en la iGPU** (speculative draft): en Vulkan con ambos modelos en la misma iGPU, llama.cpp #23126
  reporta el borrador «unos 0,014 t/s» y peor que sin él; cerrado por inactividad sin respuesta de mantenedores.
  Ollama 0.34 tampoco lo ofrece para GGUF. Fuera hasta que Vulkan tenga `seq_rm` parcial.
- **Context shift de KoboldCpp**: solo vale si el prefijo no cambia y «no usas world info»; nuestro RAG y el reorden
  de hechos lo cortan cada turno. Lo que sí se aprovecha es la idea de Memory/Author's Note (fila 5).
- **Vector Storage de SillyTavern como sustituto de claves**: la propia doc lo llama no determinista; ya usamos
  embeddings; lo que falta son las claves (fila 3).
- **Reranker o `bge-m3`**: un modelo más en la Deck; solo si 3 y 7 no bastan (ya dicho en
  [investigacion-2026-10-30-rag-rlm.md](investigacion-2026-10-30-rag-rlm.md)).
- **Letta/MemGPT como motor**: su valor es el bloque de memoria por persona y el `read_only`; se replica con un
  filtro por código (fila 2) sin su agente ni sus llamadas extra.
- **Talemate como arquitectura**: pide «16k tokens or more, 32k recommended», JSON y tool calling fiables y modelos
  27-31B; la conversación básica «work with older or smaller models», pero el director y las perspectivas no.
  Solo se toma el patrón de un actor por llamada y el filtro de conocimiento.
- **Más llamadas por turno** (auditor, revisor, resumen por zona con LLM): cada una son 8-30 s en la Deck. El
  resumen de lore por zona sí, pero **una vez al indexar** (fila 7), nunca por turno.
- **`/api/chat` y `raw`**: sin ganancia de caché ni de calidad (arriba).
- **Mirostat**: con `format` JSON y `num_predict` 300, la entropía objetivo no aporta frente a `min_p`; y no está
  confirmado en la lista actual de `options` de Ollama.
- **Modelos alternativos**: fuera por indicación de la usuaria.

## Qué no se pudo verificar

- Coste de la gramática JSON en la ruta de Ollama (no la de llama.cpp con LLGuidance).
- Ganancia real de `--cache-reuse` con nuestro prompt y de n-gram speculative en Vulkan.
- Efecto de Q5_K_M/Q6_K en tok/s sobre Van Gogh (estimación por ancho de banda); PPL de fedric95 con o sin imatrix.
- Valores de muestreo «para llama 3.1» de la comunidad; si `mirostat` sigue en `options`.
- Si `draft_num_predict` hace algo en 0.34 con GGUF.
- Comportamiento de control vectors en español y con salida JSON.
- Cifras de pérdida de obediencia por distancia de la instrucción en un 8B.
- Contenido y licencia de `Kiya_conversational_dataset_es`; mínimo de ejemplos para DPO.
- Mantella y SkyrimNet: solo se leyó la portada («NPCs remember past conversations with you»); el detalle de su
  memoria por NPC (importancia, decaimiento) es de terceros.

## Fuentes

- SillyTavern: [World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/),
  [Group chats](https://docs.sillytavern.app/usage/core-concepts/groupchats/),
  [Samplers](https://docs.sillytavern.app/usage/common-settings/)
- [KoboldCpp wiki](https://github.com/LostRuins/koboldcpp/wiki) (Context Shifting, Fast Forwarding, Memory, Author's Note)
- [NovelAI Lorebook](https://docs.novelai.net/en/text/lorebook/)
- Talemate: [Conversation agent](https://vegu-ai.github.io/talemate/user-guide/agents/conversation/),
  [Model expectations](https://vegu-ai.github.io/talemate/getting-started/model-expectations/)
- [Letta memory blocks](https://docs.letta.com/guides/agents/memory-blocks)
- [Generative Agents, arXiv 2304.03442](https://arxiv.org/abs/2304.03442); [Lost in the Middle, arXiv 2307.03172](https://arxiv.org/abs/2307.03172)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- llama.cpp: [server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md),
  [grammars](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md),
  [PR 5970 control vectors](https://github.com/ggml-org/llama.cpp/pull/5970),
  [issue 23126 draft en Vulkan](https://github.com/ggml-org/llama.cpp/issues/23126)
- [Prompt lookup decoding](https://github.com/apoorvumang/prompt-lookup-decoding)
- Ollama: [api.md](https://github.com/ollama/ollama/blob/main/docs/api.md), [Modelfile](https://docs.ollama.com/modelfile),
  [issue 7504 DRY/XTC](https://github.com/ollama/ollama/issues/7504), [releases](https://github.com/ollama/ollama/releases)
- Samplers: [DRY, PR 5677](https://github.com/oobabooga/text-generation-webui/pull/5677), [XTC, PR 6335](https://github.com/oobabooga/text-generation-webui/pull/6335)
- Cuantización: [bartowski GGUF](https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF), [fedric95 PPL](https://huggingface.co/fedric95/Meta-Llama-3.1-8B-Instruct-GGUF)
- [Unsloth, guía de fine-tuning](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide);
  [jukofyork control vectors v3.0](https://huggingface.co/jukofyork/creative-writing-control-vectors-v3.0)
