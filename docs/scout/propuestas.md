# Propuestas · Tarkor

Registro acumulativo de `scout-updates` ([formato](../../.claude/skills/scout-updates/formato-propuestas.md)). Nada se
borra. Las cuatro primeras son comparativas anteriores a la skill (decisión técnica 14,
`docs/arquitectura/04-decisiones-tecnicas.md`), para no reproponerlas.

| Id | Fecha | Componente | Propuesta | Fuente (consulta) | Estado |
|---|---|---|---|---|---|
| P-001 | 2026-10-20 | narrador | `tarkor-narrador` (`qwen2.5:7b`) → `tarkor-narrador-llama31` (`llama3.1:8b-instruct-q4_K_M`) | medida propia, decisión técnica 14 | aplicada |
| P-002 | 2026-10-20 | narrador | `tarkor-narrador-llama31` → Mistral Nemo 12B (`Modelfile.nemo`) | medida propia, decisión técnica 14 | rechazada: 181 s por turno en caliente frente a ~55 s, y rompe palabras con `format` (el tokenizador Tekken choca con la gramática GBNF). Sin probar: Mistral sin `format` |
| P-003 | 2026-10-20 | narrador | `tarkor-narrador-llama31` → Celeste 12B (`Modelfile.celeste`) | medida propia, decisión técnica 14 | rechazada: peor que Nemo, filtra metadatos e inventa PNJ |
| P-004 | 2026-10-20 | cronista | `qwen2.5:1.5b-instruct` → `qwen2.5:3b` | medida propia, decisión técnica 14 | rechazada: más lento con `keepAlive` 0 (recarga en cada llamada) sin ganar calidad |
| P-005 | 2026-10-20 | narrador | `llama3.1:8b` → `gemma3:4b-it-q4_K_M` (Probar, probable) | [informe](informes/2026-10-20.md) (2026-10-20) | propuesta |
| P-006 | 2026-10-20 | narrador | `llama3.1:8b` → `qwen3.5:4b-q4_K_M` (Probar, especulativa) | [informe](informes/2026-10-20.md) (2026-10-20) | propuesta |
| P-007 | 2026-10-20 | narrador | `llama3.1:8b` → `gemma4:e2b-it-qat` (Evaluar, especulativa) | [informe](informes/2026-10-20.md) (2026-10-20) | propuesta |
| P-008 | 2026-10-20 | cronista | `qwen2.5:1.5b-instruct` → `qwen3.5:0.8b-q8_0` (Evaluar, especulativa) | [informe](informes/2026-10-20.md) (2026-10-20) | propuesta |
| P-009 | 2026-10-20 | embeddings | `nomic-embed-text` → `embeddinggemma:300m` (Probar, probable) | [informe](informes/2026-10-20.md) (2026-10-20) | propuesta |
| P-010 | 2026-10-20 | embeddings | `nomic-embed-text` → `qwen3-embedding:0.6b` (Probar, probable) | [informe](informes/2026-10-20.md) (2026-10-20) | propuesta |
| P-011 | 2026-10-20 | Ollama | sin fijar → ≥ 0.31.2 en la Deck (Adoptar, fuerte) | https://github.com/ollama/ollama/issues/14645 (2026-10-20) | propuesta |
| P-012 | 2026-10-20 | prompts de imagen | Groq `llama-3.3-70b-versatile` (apagado) → `openai/gpt-oss-120b` (Adoptar, fuerte) | https://console.groq.com/docs/deprecations (2026-10-20) | propuesta |
| P-013 | 2026-10-20 | prompts de imagen | Cerebras: tier gratuito → trial con tarjeta; al final de la rotación o retirar (Evaluar, fuerte) | https://inference-docs.cerebras.ai/support/rate-limits (2026-10-20) | propuesta |
| P-014 | 2026-10-20 | prompts de imagen | Gemini `gemini-flash-latest` → `gemini-3.8-flash`, probado en vivo antes de fijar (Probar, fuerte) | https://ai.google.dev/gemini-api/docs/models (2026-10-20) | propuesta |
| P-015 | 2026-10-20 | prompts de imagen | Cloudflare Llama 3.3 → `@cf/openai/gpt-oss-120b` (Probar, probable) | https://developers.cloudflare.com/workers-ai/platform/pricing/ (2026-10-20) | propuesta |
| P-016 | 2026-10-20 | prompts de imagen | nuevo: OpenRouter `:free` (Evaluar, fuerte) | https://openrouter.ai/docs/api/reference/limits (2026-10-20) | propuesta |
| P-017 | 2026-10-20 | dependencias | parches de seguridad en lockfiles: fastify, @fastify/static, undici, react-router, vite y transitivas; Prisma sin parche en 6.x (P-019 u `overrides`) (Adoptar, fuerte) | `npm audit` (2026-10-20) | propuesta |
| P-018 | 2026-10-20 | CI | checkout y setup-node v4 → v7, no urgente; runner fijado `ubuntu-24.04` (Adoptar, fuerte) | https://github.com/actions/runner-images/issues/14748 (2026-10-20) | propuesta |
| P-019 | 2026-10-20 | Prisma | 6.19.3 → 7.10.1, también por seguridad (Probar, fuerte) | https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-to-prisma-7 (2026-10-20) | propuesta |
| P-020 | 2026-10-20 | Node.js | 22 → 26 LTS antes de 2027-04 (Evaluar, fuerte) | https://endoflife.date/api/v1/products/nodejs/ (2026-10-20) | propuesta |
| P-021 | 2026-10-20 | dependencias | saltos mayores en espera: TS 7, Vitest 5, react-router 8, @fastify/cors 11, dotenv 18; oxlint unificado (Evaluar, fuerte) | `npm view` (2026-10-20) | propuesta |
