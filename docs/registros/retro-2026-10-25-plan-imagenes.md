# Retro de `claude/plan-imagenes` (2026-10-25)

**Estado:** decidida por la usuaria (2026-10-25): aplicadas las cuatro (1 → `QA-252`, 2 → `QA-253`, 3 → `QA-254`, 4 → `QA-255`); la 5 no pide cambio.

Sesión del banco de calidad de imágenes (`IMG-15`, rondas 1-7), las reglas de `prompt_ficha.py` y el paso a `main`.
Trabajada en el worktree `../WMF-imagenes` con la sesión abierta en la copia principal. El gasto, en la opt-tokens de la
misma rama (`QA-249`…`QA-251`, ya aplicada).

## Propuestas, de más a menos grave

1. **Los ganchos de `.githooks/` fallan en un worktree** (comprobaciones automáticas; general). Git les pasa
   `GIT_DIR=.git/worktrees/<nombre>` y, con él, `git -C .githooks rev-parse --show-toplevel` da la carpeta de los
   ganchos como raíz. Toda la sesión hizo commit y push con unos envoltorios hechos a mano en el scratchpad
   (`git -c core.hooksPath=<scratchpad>/ganchos-wt`). Sin ellos, el pre-push y la bitácora no comprueban nada.
   Arreglo (aplicado): la raíz sale con `env -u GIT_DIR -u GIT_WORK_TREE`. Test: un commit real en un worktree de
   prueba que el pre-commit rechaza.
   Toca `.githooks/` (hace falta el permiso de la usuaria) y va también a Galivelop-workflow.
2. **`host.sh` no corre en un worktree con cambios sin commit** (acceso a la información; del proyecto). Por eso no se
   pudo comprobar la sintaxis de `tools/ci/mock-ollama.mjs` antes del commit (`node` solo está en el host). Arreglo:
   con cambios sin commit, `host.sh` monta su copia desde `git stash create` (el árbol tal como está) en vez de
   rechazarlo. Test en `tools/qa/tests`.
3. **`banco.sh` sin `pipefail`** lo pilló la revisión: «probar.sh … | tail -2 || echo FALLO» nunca decía FALLO. Otros
   cinco scripts de imágenes no lo llevan: `generar.sh`, `probar.sh`, `calidad.sh`, `pilotos.sh` y `abrir.sh`.
   Es mecánico, así que va un test y no una regla: todo `.sh` de `image-generator/` y `docs/producto/plan-imagenes/`
   empieza con `set -euo pipefail`, o lleva una línea `# sin pipefail: <motivo>` (del proyecto).
4. **`banco.sh` espera la memoria sin decir nada** (del proyecto). La ronda 7 se quedó parada pidiendo 5,2 GB con
   5,0 libres, porque las otras sesiones abiertas ocupan memoria. Se vio solo al mirarla. Arreglo: cada 5 min de espera,
   una línea con los MB libres y los que pide, y el aviso de que se pueden bajar con `LIBRE=`.
5. **El encargo al subagente no llevaba la orden de los tests** (skill `orchestrate-dealer`; sin cambio). Probó con
   `pytest`, que aquí no existe, y hubo que corregirlo por mensaje. La skill ya pide «el check que debe pasar»; el fallo
   fue no aplicarla. No hace falta una regla nueva.

## Lo que funcionó

- La revisión de la fase 1 pilló lo grave: los intentos del banco salían como elementos en la interfaz y contaban para
  el tiempo estimado, y además el `pipefail` de `banco.sh` y las reglas sueltas de `prompt_ficha.py`.
- El pre-push rechazó cerrar `QA-251` sin apuntarlo en «Hecho recientemente».
- `rojo-sin-arreglo.sh` confirmó que los tests nuevos fallan sin su arreglo.

## For Galivelop-workflow

- **`revisado.sh` hace su commit con `-m "Revisado: <sha>"`**: un `commit-msg` del proyecto que pide más líneas (WMF,
  «Siguiente:») lo rechaza y la marca se confirma a mano. Que acepte un cuerpo (`-m` extra) o que los ganchos
  dejen pasar el asunto «Revisado:».

- **Ganchos en worktrees** (propuesta 1): la raíz con `env -u GIT_DIR -u GIT_WORK_TREE git -C "$hookdir" rev-parse --show-toplevel` en `pre-commit` y `pre-push`. Falta lo mismo en `config.py` (`git_toplevel`, que usa `commit-msg`: en un worktree cae en `CLAUDE_PROJECT_DIR` y lee el `gw.json` de la copia principal) y en los `.sh` de `.claude/gw/scripts/`; quitar `GIT_DIR`/`GIT_WORK_TREE` dentro de `git_toplevel` arregla a todos los que lo llaman.
- **`recuperar.py --estado` con los worktrees** (`QA-250`, ya aplicado en la copia del proyecto): el gancho de arranque
  corre donde se abrió la sesión. Ahora da también cada worktree con la fila de su rama. Test en
  `tools/qa/tests/test_recuperar.py`.
