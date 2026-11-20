# 2026-11-20 · code-review · pending · QA-521

## Why

Revisión de bloque (fase 1, QA-292) del diff desde 7897147a: 1 importante (`escenario.sh cargar` dejaba el juego caído con Ollama real sin perfil) y 5 leves.

## Alternatives

Recuperar el perfil dentro de la guarda de `arrancar-juego.sh` (no hay perfil que recuperar tras un reinicio); se para antes de tocar nada. Los 3 leves de `iaRegistro.ts`, a `pendientes-leves.md`.

## Changed because

—
