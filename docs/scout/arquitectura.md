# Arquitectura · Tarkor

Mantenida por `scout-updates` ([skill](../../.claude/skills/scout-updates/SKILL.md)). Cada sección lleva su sello;
para contrastar: `python3 .claude/skills/scout-updates/contrastar.py docs/scout/arquitectura.md`.

## Restricciones

Confirmadas por la usuaria el 2026-10-20.

- **Hardware mínimo: Steam Deck** (16 GB LPDDR5 compartidos CPU/GPU; iGPU con 1 GB de VRAM fija y 8 GB de GTT,
  decisión técnica 12). Los equipos mayores son una fase final del roadmap.
- **Memoria: nunca más que el narrador actual.** Un candidato no puede ocupar más memoria que
  `tarkor-narrador-llama31` en su pico. Se comprueba en la Deck con `bash tools/qa/bench-ia.sh` (8 turnos):
  - sin uso de swap;
  - al menos 2 GB libres en el pico;
  - el turno no tarda más que ahora.

  Motivo: no dañar el equipo ni la experiencia de juego. El riesgo real es entrar en swap y que el juego se
  arrastre o se cierre; el narrador actual ya está probado sin ese problema. El pico medido está por apuntar; se
  estima en unos 6 GB (4,9 GB de pesos Q4_K_M y ~1 GB de caché KV con `num_ctx` 8192).
- **Ejecución:** los modelos del juego, siempre locales (Ollama), sin internet. Claude se usa para buscar y,
  opcionalmente, como juez del banco.
- **Idioma:** español narrativo.
- **Coste:** primero lo gratuito o de bajo coste. Lo de pago, solo con el coste desglosado y frente a la mejor
  opción gratuita.
- **Licencias:**
  - admitidas sin condiciones: Apache 2.0 y MIT;
  - admitidas con sus condiciones apuntadas en la propuesta: las comunitarias de Llama y Gemma;
  - excluidas: las no comerciales o solo de investigación (Tarkor podría publicarse).
- **Salida estructurada:** el narrador genera JSON forzado con `format` (gramática GBNF, `narrador.ts`). Un
  candidato tiene que dar JSON válido y buena prosa a la vez. La familia Mistral falló así (decisión técnica 14).

## Modelos de IA
<!-- sello: 2026-10-20 · b945f6d · backend/.env.example, backend/src/config/env.ts, backend/Modelfile, backend/Modelfile.llama31, backend/Modelfile.qwen3cronista, backend/Modelfile.fast, backend/Modelfile.nemo, backend/Modelfile.celeste, backend/Modelfile.finetuned -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| narrador | `tarkor-narrador-llama31` (base `llama3.1:8b-instruct-q4_K_M`, `num_ctx` 8192, temperatura 0,7) | narrar cada turno con JSON forzado | `env.ts` `OLLAMA_MODEL_NARRADOR`, `.env.example`, `Modelfile.llama31` |
| cronista | `qwen2.5:1.5b-instruct` (986 MB) | clasificar la acción y resumir capítulos; `keepAlive` 0 para no convivir con el narrador | `env.ts` `OLLAMA_MODEL_CRONISTA`, `.env.example` |
| sugerencias | `qwen3.5:4b` (`think: false`) | sugerir acciones a la jugadora | `env.ts` `OLLAMA_MODEL_SUGERENCIAS`, `.env.example` |
| embeddings | `nomic-embed-text` | RAG del lore (`retrieval.ts`) | `env.ts` `OLLAMA_MODEL_EMBEDDINGS` |
| narradores alternativos (sin uso) | `Modelfile` (`qwen2.5:7b`), `Modelfile.fast` (`qwen2.5:3b`), `Modelfile.nemo`, `Modelfile.celeste`, `Modelfile.finetuned`, `Modelfile.qwen3cronista` (`qwen3:1.7b`) | comparativas anteriores, ver `propuestas.md` | `backend/Modelfile*` |

Diagnóstico de partida (2026-10-20, [diseño](../ia/skill-scout-updates.md)): el turno del narrador tarda unos 48 s,
de los que unos 36 s son prefill de un prompt de unos 6.300 tokens. Recortar el prompt es de `opt-ai`; aquí se
busca **calidad**.

banco · narrador: casos con `IA_CASOS=<ruta fuera del repositorio>` jugando una tanda (10-15 situaciones
variadas, `tarea` = `narrar`). El SYSTEM está en `Modelfile.llama31`: los candidatos sin ese Modelfile lo necesitan
en el caso (`ollama show --system tarkor-narrador-llama31`). Rúbrica: `docs/scout/banco/narrador-rubrica.md`.

## Servicios externos
<!-- sello: 2026-10-20 · b945f6d · backend/.env.example, backend/src/config/env.ts -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| prompts de imagen | rotación con failover: Cerebras `gpt-oss-120b`, Mistral `mistral-large-latest`, SambaNova `DeepSeek-V3.1`, Cloudflare `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, Gemini `gemini-flash-latest`, Groq `llama-3.3-70b-versatile` | prompts de imagen, solo tiers gratuitos; Ollama como último recurso | `env.ts` (`*_MODEL`, `*_API_KEY`), `lib/aiProviders/orchestrator.ts` |
| profesor en vivo (DPO) | la misma rotación cloud | pares elegido/rechazado jugando, apagado por defecto | `env.ts` `LIVE_TEACHER_CAPTURE_*` |

## Runtimes
<!-- sello: 2026-10-20 · b945f6d · .github/workflows/ci.yml, backend/package.json, frontend/package.json -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| Node.js | 22 | backend, frontend y CI | `ci.yml` (`node-version`); sin `.nvmrc` ni `engines` |
| TypeScript | `~6.0.2` | backend y frontend | `backend/package.json`, `frontend/package.json` |
| Ollama | sin fijar en el repositorio | motor de IA local | instalado en la Deck |
| PostgreSQL | sin fijar en el repositorio | base de datos (Prisma) | `DATABASE_URL` |

## Dependencias
<!-- sello: 2026-10-20 · b945f6d · backend/package.json, frontend/package.json, tools/playwright-e2e/package.json -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| Fastify (+ `@fastify/cors`, `@fastify/static`) | `^5.2.0` | servidor del backend | `backend/package.json` |
| Prisma (`prisma`, `@prisma/client`) | `^6.1.0` | ORM y migraciones | `backend/package.json` |
| undici | `^8.7.0` | fetch sin timeouts para Ollama (`setupFetch.ts`) | `backend/package.json` |
| React, React DOM, React Router | `^19.2.7`, `^7.18.1` | interfaz | `frontend/package.json` |
| Vite, Tailwind | `^8.1.1`, `^4.3.3` | build y estilos | `frontend/package.json` |
| Vitest | `^4.1.10` | tests | los dos `package.json` |
| oxlint | `^1.76.0` / `^1.71.0` (distintas) | lint | los dos `package.json` |
| Playwright | `^1.62.1` | pruebas de extremo a extremo | `tools/playwright-e2e/package.json` |

El resto: 27 directas en total, con sus lockfiles.

## Infraestructura y CI
<!-- sello: 2026-10-20 · b945f6d · .github/workflows/ci.yml -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| `actions/checkout`, `actions/setup-node` | v4 | CI | `ci.yml` |
| runners | `ubuntu-24.04` y `ubuntu-latest` (mezclados) | CI | `ci.yml` |
