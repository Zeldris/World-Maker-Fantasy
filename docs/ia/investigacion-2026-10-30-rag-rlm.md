# RLM, Vectorless RAG y alternativas para el RAG del lore (2026-10-30)

Pregunta de la usuaria: ¿encajan los Recursive Language Models ([alexzhang13/rlm](https://github.com/alexzhang13/rlm))
o el «Vectorless RAG» (estilo PageIndex) con nuestra IA local, o hay algo mejor? Solo análisis, sin código.

**Conclusión:** ni RLM ni Vectorless RAG, de momento. Lo que encaja es el peldaño 2 de la escalera del RAG
(`QA-167`, [roadmap-front](../producto/roadmap-front.md)): búsqueda híbrida y entrada directa por entidad.

## Punto de partida

- Narrador `tarkor-narrador-llama31` (8B ajustado, `num_ctx` 8192); cronista `qwen2.5:1.5b`; embeddings
  `nomic-embed-text` (`backend/src/config/env.ts`). Turno p50 29-35 s en la Deck ([registro](opt-ai-registro.md)).
- RAG: `b/services/retrieval.ts#retrieveLore`, 255 filas en pgvector, `topK` 4, búsqueda ~8 ms. Se bajó de 6 a 4
  porque el prefill de un prompt más largo llevaba narrar a 170-220 s.
- `npm run rag-eval`: semillas recall@4 0,917; casos de la ronda 0,25 antes de `QA-167` (0,875 después, con los 16
  casos de `backend/ia/rag-casos.jsonl`). Los fallos que quedan:
  - **P251, P272: `no_recuperado`.** Preguntas centradas en nombres propios («Clan Serhu», «Ulkha Ketg», «Clan
    Maktor»), que es justo donde fallan los embeddings. P272 además es una pregunta doble.
  - **P263: `ignorado`.** El trozo llega y el narrador no lo usa. Es cosa del modelo (prompt o ajuste fino,
    [fine-tuning-ia-local.md](fine-tuning-ia-local.md)), no de la búsqueda.

## RLM (Recursive Language Models): no encaja

- El contexto va como variable de un REPL de Python; el modelo escribe código para leerlo y se llama a sí mismo sobre
  trozos (`llm_query`, `rlm_query`). Pensado para contextos de millones de tokens; nuestro lore cabe en 4 trozos.
- Coste: una reproducción independiente midió 3,6 s sin RLM frente a 89,3 s con profundidad 1 y 344,5 s con
  profundidad 2, y con la RLM el acierto bajó en esa tarea, todo ello con modelos grandes en la nube
  ([arXiv 2603.02615](https://arxiv.org/pdf/2603.02615)). En la Deck, varias llamadas más por turno no caben.
- El README no nombra Ollama (recomienda vLLM para modelos locales). El REPL `local` ejecuta con `exec` el código que
  genera el modelo: no sirve dentro del juego empaquetado. Necesita además un modelo que programe bien.
- Fuentes: [repo](https://github.com/alexzhang13/rlm), [paper](https://arxiv.org/abs/2512.24601v1),
  [minRLM](https://infosecwriteups.com/minrlm-a-token-efficient-recursive-language-model-implementation-and-benchmark-bdc6840a3b00).

## Vectorless RAG (PageIndex): no encaja tal cual

- Índice en árbol tipo tabla de contenidos; el LLM baja por las ramas hasta tener bastante evidencia. Va bien con
  documentos largos y muy estructurados; el 98,7 % de FinanceBench es una cifra del propio proyecto, sin verificar.
- Una llamada al LLM por cada paso del árbol, frente a milisegundos de la búsqueda vectorial; también cuesta indexar
  ([lilting.ch](https://lilting.ch/en/articles/pageindex-llm-tree-rag),
  [Rubinlake](https://rubinlake.com/es/technology-radar/ai-and-data-engineering/pageindex),
  [themenonlab](https://themenonlab.blog/blog/pageindex-vs-vector-databases-rag-showdown)).
- Lo que sí aprovechamos es la idea: el lore ya está organizado por región, clan y personaje, así que se puede
  recorrer con código determinista, sin LLM (opción 2 de abajo).

## Alternativas, de más barata a más cara

1. **Híbrida: BM25 + vector, mezcladas con RRF.** Ataca P251 y P272: BM25 encuentra nombres exactos. Postgres ya
   trae `tsvector`, así que no hace falta otro servicio y la latencia casi no sube. Es el peldaño 2 de `QA-167`
   ([wz-it](https://wz-it.com/en/knowledge/ki/hybrid-search-reranking/),
   [rebeccamdeprey](https://rebeccamdeprey.com/blog/hybrid-retrieval-in-practice)).
2. **Entrada directa por entidad.** Si la acción nombra un clan, un NPC o un lugar conocido (BD o títulos de
   `b/scripts/loreChunks.ts`), su trozo entra seguro antes que los semánticos. Es determinista, como el resto de
   decisiones que van antes de narrar.
3. **Contextual Retrieval** (técnica de Anthropic): al indexar, cada trozo lleva una línea de contexto (región, clan,
   casta). Se genera una sola vez y no cuesta nada por turno. Contextual Retrieval con BM25 y reranker redujo un 67 %
   los fallos de recuperación en las pruebas de Anthropic ([medium](https://medium.com/@dewasheesh.rana/bm25-vs-sparse-vs-hybrid-search-in-rag-from-layman-to-pro-e34ff21c4ada)).
4. **Reranker o embeddings `bge-m3`** (dan vectores densos y dispersos a la vez). Mejora el orden de los resultados,
   pero añade un modelo más en la Deck. Solo si 1-3 no bastan.
5. **GraphRAG / LightRAG.** La extracción del grafo pide modelos grandes (hay quien recomienda 32B o más), y nuestras
   relaciones ya están en la BD del juego. No compensa
   ([LightRAG](https://dev.to/criticalmynd/lightrag-tutorial-getting-started-with-knowledge-graph-based-rag-526n),
   [graphrag-local-ollama](https://github.com/OnlyPiglet/graphrag-local-ollama)).

**Recomendación:** 1 + 2 juntas, medidas con `npm run rag-eval` sobre `rag-casos.jsonl` (`P251`, `P272` como
`debe_pasar`). Cuando se vuelva al roadmap entra como peldaño 2 de `QA-167`, o como tarea de una retro si la usuaria
lo aprueba antes. P263 va aparte (prompt o ajuste fino).
