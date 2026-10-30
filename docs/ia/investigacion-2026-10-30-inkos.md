# Qué sacar de InkOS (2026-10-30)

Repo: [Narcooo/inkos](https://github.com/Narcooo/inkos), licencia **AGPL-3.0-only** (`LICENSE`, `package.json`).
**No se copia código**: solo ideas reimplementadas. Lo leyó un subagente con un clon superficial (último commit
`53adac4`, 2026-10-24, versión 2.0.0 en `package.json`, ~10,9k estrellas); no se ejecutó nada.

**Estado: propuestas SIN REVISAR, fuera del roadmap** (usuaria, 2026-10-30); apuntadas en la bitácora,
«Propuestas sin revisar».

## Qué es

Un agente en TypeScript para escribir novelas, guiones y ficción interactiva (CLI, TUI y Studio web). El LLM propone
acciones tipadas y el código valida y guarda el estado. Rutas relativas a `packages/core/src/`:

- **Agentes** (`agents/`): planner, composer, writer, continuity (auditor), reviser, state-validator, entre otros.
  Hacen al menos 6-8 llamadas por capítulo.
- **Estado**: es JSON validado con Zod (`models/runtime-state.ts`). El LLM entrega un delta y lo aplica un reductor
  (`state/state-reducer.ts`). Los `.md` son vistas legibles.
- **Memoria larga**: BM25 con SQLite FTS5 (`retrieval/local-search.ts`). Después un LLM elige qué candidatos entran
  (`utils/memory-retrieval.ts`). No usa embeddings.
- **Auditor** (`agents/continuity.ts`): hace una llamada con salida estructurada. Cada observación tiene que citar
  líneas reales del texto como evidencia; si no las cita, se descarta. Los criterios (continuidad, motivación, punto de
  vista, ganchos…) son una guía cualitativa en un skill.
- **Revisión**: ya no es automática. La pide el usuario o el agente, y un auditor caído nunca autoriza reescribir.
- **Modo interactivo** (`play/`): un grafo del mundo en SQLite. Las pistas avanzan por estados (unknown → hinted →
  seen → verified). Hace una llamada por turno que devuelve escena y mutación a la vez, y en ella el LLM decide también
  las reglas. El contexto se arma por prioridad, con fragmentos protegidos o comprimibles y un presupuesto de tokens
  (`play-runner.ts#buildContextBrief`, `harness/context-compiler.ts`).
- **Modelos**: trabaja con varios proveedores y trae un preset de Ollama, pero todo depende de salida estructurada y
  está pensado para modelos grandes. No se ha probado con un 8B o un 1.5B.

## Valoración frente a WMF

| Pieza (ruta) | Qué hace | En WMF | Valoración |
|---|---|---|---|
| Auditor con evidencia citada (`agents/continuity.ts`) | Si el hallazgo no cita líneas, se descarta | — | **En parte**: su versión barata, por código (abajo, 1) |
| Contexto con prioridad y presupuesto (`harness/context-compiler.ts`) | Trozos protegidos o comprimibles dentro del presupuesto | `retrieveLore` con `topK` 4 fijo | **Aporta** |
| BM25 + selección por LLM (`retrieval/local-search.ts`) | Primero busca palabras exactas, luego el LLM elige | pgvector + `nomic-embed-text` | **En parte**: BM25 sí (es la híbrida ya propuesta); la selección por LLM no cabe en la latencia |
| Estados de pista (`models/play.ts`, `play/play-reducer.ts`) | Qué ha visto ya el jugador de cada misterio | Cronista | **En parte** |
| Ganchos con id y estado (`models/runtime-state.ts`) | Hilos abiertos, en curso o cerrados | Cronista | **En parte** |
| Mutación tipada + reductor | El LLM propone, el código aplica | Reglas deterministas antes de narrar | **No encaja**: WMF ya lo hace mejor (el LLM no decide reglas) |
| Reviser, state-validator, guía de estilo | Más llamadas al LLM | Ajuste fino del 8B | **No encaja**: cada una suma unos 30 s en la Deck |

## Qué traer, por orden de valor

1. **Comprobación de evidencia por código tras narrar**, sin llamar al LLM: mira si la narración nombra las entidades
   o los hechos clave de los trozos de lore que recibió. Así se mide el «narrador ignora el lore» (P263), y se podría
   regenerar solo cuando falte algo crítico. La idea es nuestra, inspirada en su auditor: InkOS no lo hace así.
2. **BM25 junto a pgvector** (`tsvector` o `pg_trgm`): coincide con la propuesta de RAG híbrida
   ([investigación](investigacion-2026-10-30-rag-rlm.md)) y la refuerza.
3. **Contexto por prioridad con presupuesto**: el trozo de la entidad nombrada va protegido y el resto se recorta
   dentro de los 8192 tokens. Encaja con la «entrada directa por entidad».
4. **Estados de lore mostrado** (insinuado, visto, verificado): el lore ya enseñado no se repite y el pendiente gana
   prioridad.
5. **Traza de recuperación por turno** (candidatos y puntuaciones), para depurar P251, P272 y P263 con datos.

Lo que no se vio: el auditor antiguo de «33 dimensiones», `observer.ts`, el Reflector, el número exacto de llamadas
y el comportamiento real con Ollama.
