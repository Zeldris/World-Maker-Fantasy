# Diseño: skill `opt-ai` (implementada, 2026-10-20)

Estado: **implementada** (2026-10-20) en [`.claude/skills/opt-ai/`](../../.claude/skills/opt-ai/SKILL.md)
(núcleo genérico, adaptador `proyecto.md`, `motores.md`, `medir.py`), con el registro por llamada del backend
(`IA_REGISTRO`/`IA_PERFIL`, [formato](opt-ai-registro.md)) y `npm run rag-eval` sobre `backend/ia/rag-casos.jsonl`.
Se lanza tras cada tanda de pruebas para buscar
mejoras en los modelos de IA local del juego: tiempos, RAG, configuración y problemas.

## Decisiones de la usuaria (2026-10-20)

| Tema | Decisión |
|---|---|
| Hardware | La **Steam Deck es el mínimo** del juego y siempre se mide. Además, perfiles de máquina con su configuración según lo que tenga cada sistema. |
| Autonomía | **Solo propone.** Mide y redacta; no cambia configuración, índice ni modelos sin aprobación. |
| Web | **Fuera de esta skill.** Irá en otra skill aparte, `scout-updates`, de búsqueda de actualizaciones de todos los elementos del juego (se valora en el futuro). |
| Proveedores | **Solo local**, pero sin atarse a Ollama (llama.cpp, LM Studio, vLLM…). La skill tiene que ser **genérica y reutilizable en otros proyectos**. |

## Forma: núcleo genérico + adaptador por proyecto

Como `opt-tokens` (`SKILL.md` genérico + `proyecto.md`):

- **`SKILL.md` (genérico):** los pasos, el formato del registro y el del informe. No nombra Tarkor ni Ollama.
- **`proyecto.md` (Tarkor):**
  - Tareas de IA y su modelo (narrar, clasificar, sugerir, crónica, embeddings; ver `backend/src/config/env.ts`).
  - Dónde está el registro y cómo se reindexa el RAG (`reindex-lore`, `services/retrieval.ts`).
  - El juego fijo de preguntas del RAG.
  - Los perfiles de máquina.
  - Qué P del registro de hallazgos son de IA.
- **Adaptador de motor:** traduce la respuesta de cada motor al formato común:
  - Ollama: `total_duration`, `load_duration`, `prompt_eval_count`, `eval_count`.
  - llama.cpp: `timings`.
  - Servidores compatibles con OpenAI: `usage`.

## Paso 0 (requisito): registro por llamada

Hoy no se guarda. Cada llamada al modelo y al RAG añade una línea JSONL con:

- **Llamada al modelo:**
  - Perfil de máquina, motor, modelo, tarea y si el modelo ya estaba cargado.
  - Tokens de entrada y de salida, tiempo de carga y de primera palabra, tiempo total.
  - Si el texto se recortó por el contexto.
- **RAG:**
  - La consulta, los trozos recuperados con su puntuación y cuáles entraron en el prompt.
  - El tiempo del embedding y el de la búsqueda.

Se activa con una variable de entorno durante las rondas.

## Pasos de la skill (con orchestrate-dealer; 1-3 en paralelo)

1. **Medir** (script, sin modelo).
   - Por perfil y tarea: p50, p95, tokens por segundo, cargas en frío y textos recortados.
   - Comparado con la tanda anterior; la Steam Deck, siempre.
2. **RAG frente a las incoherencias.** Por cada P de IA de la ronda (inventa, contradice lore, nombre equivocado), dónde falló:
   - No estaba en el índice.
   - No se recuperó (trozos, embedding, top-k).
   - Se recuperó y el modelo lo ignoró (prompt o modelo).

   Cada caso amplía el **juego fijo de preguntas** (pregunta → trozo esperado). Se mide su acierto en cada tanda para ver si el RAG mejora o empeora.
3. **Configuración por perfil:** contexto, máximo de salida, tiempo que el modelo sigue cargado, temperatura, cuantización, razonamiento, llamadas en paralelo y si una tarea cabe en un modelo menor.
   - Cada propuesta, con el experimento que la mediría (`benchmark-turno` antes y después).
   - En la Deck, comprobando que cabe en memoria.
4. **Informe.**
   - Mejoras ordenadas por impacto, coste y riesgo, cada una con su prueba y cómo comprobarla.
   - Problemas: regresiones, modelos que no caben en un perfil, tareas que superan el tiempo aceptable.

   Se presenta a la usuaria; lo que apruebe entra como tarea.

## Resuelto al implementar (valores por defecto, 2026-10-20)

- Perfiles: `deck`, `cpu`, `gpu8` y `gpu12`, por la variable `IA_PERFIL` al arrancar; sin ella, `desconocido` (y `medir.py` avisa).
- Tiempo aceptable por tarea: sale de la primera medición en la Deck; hasta entonces no se marcan problemas por tiempo.
- La skill vive en `.claude/skills/opt-ai` (genérica: para otro proyecto se copia y se cambia `proyecto.md`).
- Se implementó ya, como mejora del entorno de trabajo (aprobada por la usuaria).
- Sin juez LLM: el RAG se mide con recall@k sobre casos escritos a mano.

## Al terminar la implementación (usuaria, 2026-10-20)

- **`retro` y `opt-tokens` miran también las skills propias** (`.claude/skills/` que no son de Matt Pocock: `opt-ai`, `opt-tokens`, `retro`, `orchestrate-dealer`, `selector`, `pr`…) y las tienen en cuenta en sus propuestas: si una skill falló, sobra o puede mejorar con lo visto en la sesión.
- **Antes del diseño final:** ideas de herramientas parecidas en la web y de las skills de Matt Pocock (hecho: se copiaron `research` y `to-questionnaire`).
