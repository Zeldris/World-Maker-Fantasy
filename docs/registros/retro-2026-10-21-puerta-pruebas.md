# Retro del PR de la puerta de pruebas (2026-10-21)

Lo revisado: lo que entra con el PR a `main` desde `claude/puerta-pruebas` (`git log origin/main..HEAD`):

- los arreglos de P240 y P260 (paso 3.1 de la línea) y el diseño de construcción por tier en la bandeja;
- el paso 3.2 (Mundo vivo) y las tandas 1-7 del 3.3 (`plan-comprobacion-3.3.md`);
- los escenarios nuevos (`prepararReino.ts`, `construir.sh`, `escenario.sh preparar`) y sus `.dump`;
- el `/code-review --max-findings all` previo: 11 hallazgos, 10 arreglados en `bd61001e` (la migración de P240 se deja:
  las partidas guardadas no necesitan compatibilidad); el de la fase 2: 13 hallazgos, arreglados en `77bc00fa`.

También se revisan `opt-tokens`, `opt-ai`, `orchestrate-dealer` y `/code-review`.

**Estado (2026-10-21): aprobadas todas por la usuaria; 1, 2, 3, 5 y 7 aplicadas en la rama** (`QA-188`, `QA-189`,
`QA-190`, `QA-192`, `QA-194`); **4 y 6 entran como tareas del paso 3.4** (`QA-191`, `QA-193`).

## Medida (`/opt-tokens`)

Sesión principal: 184 llamadas, 2 compactaciones, contexto medio 107k. Subagentes: 22, 1.084 llamadas, 85M de
entrada (el 81 % del total). Arranque medio de un subagente: 35k. Las tandas 6 y 7 hicieron 87 y 99 llamadas (tope
60) y 15-19 capturas JPG cada una, ~95 % de lo que metieron en su contexto. `/opt-ai` no midió nada: las tandas con
Ollama real no llevaban `IA_REGISTRO`.

## Lo que funcionó

- El reparto por tandas en serie con subagentes `sonnet`: la principal no lanzó ni una orden del driver.
- El `/code-review` final encontró 11 fallos reales en las herramientas de escenarios.

## Propuestas

1. **Herramientas de la Deck en git** (`QA-188`). Los atajos de `logs/shim/` (ignorado por git) los citaba el runbook
   7 veces; la otra cuenta no los tenía. Pasan a `tools/qa/deck/`, con `_path.sh` para los envoltorios de podman.
2. **Tandas cortas y sin capturas de más** (`QA-189`, `orchestrate-dealer`): 6-8 hallazgos por tanda y captura solo
   para lo visual.
3. **Revisión corta también sin worktree** (`QA-190`, `orchestrate-dealer`): el subagente de escenarios hizo commit
   en la rama y su código no se revisó hasta el `/code-review` final.
4. **Escenario `reino-combate-capitan` con un solo capitán** y la regla de jugar una vez cada escenario nuevo antes
   de darlo por cerrado (`QA-191`, pendiente): hoy salen 3 rivales y Gorhorn muere en 3 rondas.
5. **Registro de IA siempre activo en la Deck** (`QA-192`): `tools/qa/deck/juego.sh` pone `IA_PERFIL=deck` e
   `IA_REGISTRO`.
6. **Vía de QA para forzar el azar** (`QA-193`, pendiente): iniciativa, emboscada e interrupción de viaje, para
   P29, P69, P90, P46 y P47, que llevan varias tandas sin salir.
7. **Leer solo la fila de la bitácora** (`QA-194`, `opt-tokens/proyecto.md`): 12 lecturas enteras, ~419k arrastrados.
