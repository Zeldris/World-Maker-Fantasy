# Retro: ronda local 2 a `main` (`claude/ronda-local-2`, 2026-11-20)

**Estado:** aprobada (usuario, 2026-11-20): R1 aprobada, apuntada como `QA-520` en `roadmap-front.md`; R2 aplicada (`50251e47`); las notas para Galivelop-workflow, decididas: quedan aquí para `gw-harvest`.

Fuentes: sesión `6b88b4e7` (QA-518, QA-519, revisión de bloque), esta sesión (fase 1 y `/gw-opt-tokens`),
`task.py deviations` y `docs/records/pendientes-leves.md`.

## Lo que fue bien

- Las revisiones de bloque (`QA-292`) dejaron la fase 1 final en dos commits pequeños: 0 hallazgos, sin subagente.
- Sesión principal sana: 82k de contexto medio, techo 102k, sin compactar, 0 errores de herramienta.

## Propuestas

### R1. Barrido de `iaRegistro.ts` (`QA-520`, proyecto)

Dos leves abiertos en el mismo script, tocado en este bloque (P494 lo usa para ver qué entra en cada réplica):
`lineaDeLaDiferencia` apunta a la línea equivocada cuando el bloque solo pierde la cola o empieza por `\n`, y
`prefijo_linea` guarda 48 caracteres, que en líneas largas no llegan a la diferencia. Una tarea `QA-520` que cierra
los dos, en el hito de las pruebas (tarea de retro). `vigilante-memoria.sh` también tiene dos, pero no se tocó en el
último bloque; queda para otro barrido.

### R2. `gw-worker` versionado (proyecto, ya aplicado en `/gw-opt-tokens`)

`.gitignore` excluía `.claude/agents/`; el subagente ligero de `QA-332` nunca llegó a ninguna sesión y los subagentes
de la rama arrancaron como `general-purpose` (~41k). Commit `50251e47`.

## For Galivelop-workflow

- **`measure.py`, sesión de otra rama.** Con la sesión nueva por debajo de `minCalls`, dice medir «la sesión anterior
  de la misma rama» y midió `c40c5330` (`claude/marca-imagenes`, 16-nov) en vez de `6b88b4e7`
  (`claude/ronda-local-2`, 20-nov). Filtrar por `gitBranch` del log, y si no hay ninguna, decirlo.
- **`gw-init`/`doctor.py` no ven `.claude/agents/` ignorado.** El instalador escribe `.claude/agents/gw-worker.md`,
  pero un `.gitignore` con `.claude/*` lo deja fuera de git sin aviso. `doctor.py`: comprobar que el archivo existe y
  que `git check-ignore` no lo ignora; `gw-init`: añadir `!.claude/agents/` como hace con `.claude/gw/`.
- **`scope-guard.py`, archivos de cierre.** ~120 desviaciones en la rama; las rutas que más se repiten son el roadmap
  (`roadmap-front.md` 14, `21-roadmap.md` 11) y el registro de hallazgos, que se tocan al cerrar *cualquier* tarea
  (AGENTS: tachar en el roadmap). `flow_files` debería incluir `roadmapFiles` y `pendingFile`.
- **Marca de tarea vieja.** El trabajo de `QA-519` se hizo con la marca en `QA-518` (35 avisos de alcance).
  `task.py new <id>` debería dejar la nueva tarea como actual, o el aviso del `pre-commit` proponer
  `task.py current <id>` cuando el commit lleva `Refs:` de otra tarea.
