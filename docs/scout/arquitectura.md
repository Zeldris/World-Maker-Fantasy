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
- **Ejecución:** los modelos del juego, siempre locales (Ollama), sin internet. El agente de código (Claude Code) busca y
  juzga el banco.
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
| narrador fine-tuneado (sin uso) | `Modelfile.finetuned` (base: un `.gguf` propio aún sin exportar) | plan de fine-tune y DPO ([diseño](../ia/fine-tuning-ia-local.md)); las comparativas descartadas se borraron el 2026-10-20, ver `propuestas.md` | `backend/Modelfile.finetuned` |
| propuestas de lore (OpenCode) | `qwen35-9b-32k` (base `qwen3.5:9b`, `num_ctx` 32768, temperatura 0,15, salida 4096), plugin `opencode-ollama-toolcall-proxy` (sin versión fijada) | agente `narrador-lore`: solo lee el canon (`docs/canon-opencode/`) y propone lore en `docs/borradores-opencode/`, fuera del juego | `opencode.json`, `modelfiles/qwen35-9b-32k.Modelfile`, `.opencode/prompts/narrador-lore.txt` |

Diagnóstico de partida (2026-10-20, [diseño](../ia/skill-scout-updates.md)): el turno del narrador tarda unos 48 s,
de los que unos 36 s son prefill de un prompt de unos 6.300 tokens. Recortar el prompt es de `opt-ai`; aquí se
busca **calidad**.

banco · narrador: casos con `IA_CASOS=<ruta fuera del repositorio>` jugando una tanda (10-15 situaciones
variadas, `tarea` = `narrar`). El SYSTEM está en `Modelfile.llama31`: los candidatos sin ese Modelfile lo necesitan
en el caso (`ollama show --system tarkor-narrador-llama31`). Rúbrica: `docs/scout/banco/narrador-rubrica.md`.

## Servicios externos
<!-- sello: 2026-10-20 · bda4496b · backend/.env.example, backend/src/config/env.ts, backend/prisma/schema.prisma -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| prompts de imagen | rotación con failover: Cerebras `gpt-oss-120b`, Mistral `mistral-large-latest`, SambaNova `DeepSeek-V3.1`, Cloudflare `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, Gemini `gemini-flash-latest`, Groq `llama-3.3-70b-versatile` | prompts de imagen, solo tiers gratuitos; Ollama como último recurso | `env.ts` (`*_MODEL`, `*_API_KEY`), `lib/aiProviders/orchestrator.ts` |
| profesor en vivo (DPO) | la misma rotación cloud | pares elegido/rechazado jugando, apagado por defecto | `env.ts` `LIVE_TEACHER_CAPTURE_*` |
| Supabase (alternativa, sin uso) | Postgres alojado con pooler (6543 transacción, 5432 sesión) | solo para jugar desde varios dispositivos; por defecto, Postgres local | `.env.example` (comentado), `schema.prisma` `directUrl` |

## Runtimes
<!-- sello: 2026-10-20 · bda4496b · .github/workflows/ci.yml, backend/package.json, frontend/package.json, backend/.env.example, backend/prisma/schema.prisma, docs/arquitectura/15-instalacion.md -->

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| Node.js | 22 | backend, frontend y CI | `ci.yml` (`node-version`); sin `.nvmrc` ni `engines` |
| TypeScript | `~6.0.2` | backend y frontend | `backend/package.json`, `frontend/package.json` |
| Ollama | sin fijar en el repositorio | motor de IA local | instalado en la Deck |
| PostgreSQL | 16, imagen `pgvector/pgvector:pg16` (contenedor `tarkor-postgres`, Podman) | base de datos (Prisma); CI con Postgres 16 | `DATABASE_URL`, `15-instalacion.md`, `ci.yml` |
| pgvector | la de la imagen; `CREATE EXTENSION vector` a mano (Prisma no la gestiona) | `vector(768)` del RAG de lore | `schema.prisma`, `15-instalacion.md` |
| SteamOS (Deck) | raíz de solo lectura; lo compilado va en `distrobox`; GPU por Vulkan (RADV) | plataforma del hardware mínimo | `15-instalacion.md` |

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

## Planificados
<!-- sello: 2026-10-20 · bda4496b · docs/arquitectura/reutilizables/01-generacion-imagenes-local.md, docs/arquitectura/reutilizables/02-voces-y-sonidos-locales.md, docs/arquitectura/reutilizables/03-agente-desarrollo-local.md, docs/arquitectura/20-instalador-distribuible.md -->

Diseñados y sin implementar: fuera del roadmap hasta que se implementen (decisión del 2026-10-13,
[README](../arquitectura/reutilizables/README.md)). Se buscan como el resto: sale antes de implementarlos lo que ya
haya cambiado. **Sus restricciones están por confirmar**: corren sin el juego abierto y fuera de partida, así que el
tope de memoria del narrador no les aplica tal cual.

| Componente | Versión | Uso | Dónde se configura |
|---|---|---|---|
| generador de imágenes | FLUX.2 [klein] 4B (Apache 2.0; el 9B es no comercial) en `stable-diffusion.cpp` con Vulkan, GGUF de `leejet`, codificador Qwen3-4B; ~7 GB en disco; Colab de respaldo | retratos y escenas, con el juego cerrado | `01-generacion-imagenes-local.md` |
| voces | `qwentts.cpp` (MIT) con Qwen3-TTS (Apache 2.0): VoiceDesign 1.7B para diseñar, Base para producir; CPU o Vulkan | voces por raza | `02-voces-y-sonidos-locales.md` |
| agente de desarrollo local | Aider con `qwen3:14b` en Ollama (Vulkan) en la Deck; Devstral Small 2 (24B, Apache 2.0) solo en un PC de 24 GB | programar sin coste recurrente, con el stack parado | `03-agente-desarrollo-local.md` |
| instalador | Tauri, backend Node como sidecar y Postgres portátil empaquetado | distribuir el juego | `20-instalador-distribuible.md` |
