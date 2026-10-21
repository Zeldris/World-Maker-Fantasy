**Título:** Puerta de pruebas: P240 y P260 arreglados, ronda Mundo vivo (3.2), tandas 1-7 del 3.3 y escenarios nuevos (QA-188 a QA-194)

## Summary

El paso 3 de «La línea» (`21-roadmap.md`) avanza: dos graves arreglados, la ronda de Mundo vivo cerrada, más de la
mitad de los arreglados comprobados jugando y herramientas de escenarios para lo que pedía estado.

```text
3.1  P240  la misión de vida «Recuperar el honor de los Maktor» lleva questSlug HONOR_MAKTOR
           → el narrador ya no puede cerrarla (questProgress solo admite COMPLETADA)
     P260  la ficha del orco enfurecido no destripa el encargo de Uhuld Koh
3.2  ronda Mundo vivo: 8/19 filas de la matriz jugadas, P275-P302 apuntados
3.3  tandas 1-7 de plan-comprobacion-3.3.md: 73 comprobados jugando,
     reabiertos P99, P158, P169, P27; nuevo P303
```

```diff
 backend/src/scripts/
+├── prepararReino.ts        # escenario.sh preparar: súbditos, guarnición, combate con rivales dados
+└── prepararReinoLib.ts
 tools/qa/
+├── deck/                   # atajos de la Deck, antes en logs/shim (QA-188, QA-192)
 ├── escenario.sh            # + preparar; guardar aborta si falla pg_dump
 └── escenarios/
+    ├── construir.sh        # rehace las instantáneas paso a paso
+    └── 5 .dump nuevos      # compañero NPC, defensas, guerra, hambre y sed, combate con capitán
```

Retro aplicada (`docs/registros/retro-2026-10-21-puerta-pruebas.md`): `orchestrate-dealer` con tandas de 6-8
hallazgos, captura solo para lo visual y revisión corta también sin worktree (`QA-189`, `QA-190`); `opt-tokens`
lee solo la fila de la bitácora (`QA-194`). Quedan como tareas del 3.4: `QA-191` y `QA-193`.

## Evidence

- **Antes:** el narrador devolvía `questProgress: FALLIDA` para la misión de vida al darle pan a Gistera y la
  cerraba. **Después:** `turn.integration.test.ts` › describe P240 (2 tests) y `distillationValidation.test.ts`
  (solo COMPLETADA) en verde.
- **Antes:** la bio del orco enfurecido nombraba a Uhuld Koh. **Después:** `catalogoSinNotasInternas.test.ts` › P260 en verde.
- Backend: `tsc` limpio, `oxlint` sin errores (610 archivos), vitest de los archivos tocados 499/499
  (`turn.integration`, `catalogoSinNotasInternas`, `distillationValidation`, `prepararReinoLib`, `narrador`).
  Frontend sin cambios. `tools/qa/tests`: 127/129; los 2 de `test_host` fallan solo dentro del Flatpak de VS Code
  (la rama no toca `host.sh`).
- `/code-review --max-findings all` contra `origin/main`: 11 hallazgos, 10 arreglados (`bd61001e`); el de la fase
  2: 13, arreglados (`77bc00fa`).

## Merge Danger

**Door:** one-way

La migración `20261021120000_quest_honor_maktor` pone `questSlug` a la misión de vida y devuelve a ACTIVA las que
el narrador marcó FALLIDA. El suceso «misión fallida» del Cronista se queda en esas partidas (decisión de la
usuaria: las partidas guardadas no necesitan compatibilidad).

**Blast Radius:** partidas

Solo toca la misión de vida de Gorhorn en las partidas existentes. Lo demás son docs, herramientas de QA e
instantáneas `.dump` (~5 MB).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
