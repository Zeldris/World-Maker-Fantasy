# Propuestas para Galivelop-workflow

Lo que WMF cambió a propósito en su copia del flujo y conviene llevar arriba, para que el próximo `/gw-update` no lo
pise. Se aplica **desde el repo del flujo** (skill `gw-harvest`, `scripts/recoger.py` sobre este repo); desde WMF no
se edita el flujo. Cada entrada cita la ruta y el commit de WMF.

## Para Galivelop-workflow

Cosecha del 2026-11-02, tras `/gw-update` v0.2.0 → v0.4.3 (commit `f2e83984`; flujo en `0e04504`, v0.4.3).

- Propuesta para el flujo P1 (script, patch): `recuperar.py --estado` muestra también la fila de la bitácora de cada
  otro worktree con rama (`other_worktrees()`, `.claude/gw/scripts/recuperar.py` @ `f2e83984`, WMF `IMG-15`). El
  gancho de inicio corre en la carpeta donde se abrió la sesión; una sesión que trabaja en un worktree leía la
  bitácora entera para encontrar su fila. Solo se listan los worktrees que tienen fila propia (`logRows`): el de un
  subagente no la tiene y su «añade tu fila» despistaría. Test en `tools/qa/tests/test_recuperar.py`.
- Propuesta para el flujo P2 (test, patch): `skills/gw-media-content/scripts/test_cifras.py`,
  `test_log_path_through_the_config_reader_when_the_project_has_one`, busca `scripts/config.py` tres carpetas arriba,
  que solo existe en el repo del flujo; instalado (`.claude/skills/…`) da FileNotFoundError. Arreglo en WMF @
  `f2e83984`: si no está, `AQUI.parents[2] / "gw"` (la disposición de `aplicar.py`).
- Propuesta para el flujo P3 (test, patch): `skills/opt-ai/scripts/test_medir.py`, clase `MedirTest`: `medir.main()`
  lee el `.claude/gw/opt-ai.md` del proyecto donde corre y cambia las tablas que el test espera. Arreglo en WMF @
  `f2e83984`: `mock.patch.object(medir, 'repo_root', return_value=None)` en `run_main`.
- Propuesta para el flujo P4 (plantilla de gancho, patch): `templates/githooks/commit-msg` corre
  `git diff --cached` aunque no haya árbol de trabajo (un test que llama al gancho desde fuera de un repo, o un
  repo desnudo) y falla. En `.githooks/commit-msg` @ `f2e83984` la comprobación de la bitácora va dentro de
  `git rev-parse --is-inside-work-tree`.
- Propuesta para el flujo P5 (regla nueva, minor; a decidir): una línea final `Siguiente: <paso>` obligatoria en los
  commits hechos por Claude Code (`CLAUDECODE=1`), salvo merges, reverts, cherry-picks, squash y rebase
  (`.githooks/commit-msg`, WMF `QA-210`): dos commits de subagentes salieron sin el dato que necesita el relevo.
  Como opción de `.claude/gw.json` (p. ej. `commitNextLine`), con la etiqueta en el idioma del proyecto.

## Se queda en WMF

- `.githooks/commit-msg` como archivo propio (sin cabecera de versión; el doctor lo avisa): mientras P4 y P5 no estén
  arriba, `/gw-update` no debe reemplazarlo.
- Los textos en español de los comentarios y mensajes de los ganchos.
