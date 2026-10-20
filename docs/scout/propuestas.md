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
