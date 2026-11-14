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

- Propuesta para el flujo P6 (skill + script, patch): la fase de cierre de `retro`/`pr` y la ayuda de `revisado.sh`
  no avisan de que un `commit-msg` que pide `Siguiente:` (P5) rechaza el commit de la marca sin `--footer`. Si P5
  entra, `revisado.sh` debería poner la línea por defecto (`Siguiente: crear el PR`) cuando la opción esté activa.
- Propuesta para el flujo P7 (skill, minor): `gw-media-content/scripts/comprobar.py` sin argumentos sale con 2, y un
  `check` que lo corría (`comprobar.py > /dev/null`, WMF hasta `f2e83984`) deja de validar `docs/difusion`. Una
  opción para comprobar todas las piezas de `mediaContent.dir` (y no contar como error las normas de Reddit sin
  leer, que dependen de la usuaria) devolvería la comprobación al `check`. Mientras, WMF filtra el texto en inglés de
  su salida (`tools/qa/difusion.py`), que se rompe si cambia la redacción: mejor un código de salida propio para los
  avisos (p. ej. `--normas-como-aviso`).
- Propuestas para el flujo P8-P13 (scripts, patch), de la revisión de código del PR de WMF del 2026-11-02 sobre la
  copia v0.4.3, sin verificar a fondo:
  - P8 `bitacora.py closed`: acepta un id que aparezca en cualquier línea fechada, no solo en «Hecho recientemente»;
    el test que lo cubre (`test_bitacora.py`, ~l. 148) se relajó.
  - P9 gancho Stop `antes-de-parar.py`: no excluye `protectedPaths` (un borrador sin commit bloquea parar) y deja
    parar si lo único tocado es la bitácora; a la vez, bloquea parar con cualquier archivo sin seguir (lo de un
    subagente, una edición a medias que pidió la usuaria), lo que empuja a tocar la bitácora solo para poder parar.
  - P10 `prepush-ramas.sh`: comprueba la bitácora solo en la punta que se sube, no en cada commit nuevo.
  - P11 `guardia-config.py`: a `GIT_WRITES` le faltan `reset --hard`, `stash pop`, `merge`, `checkout <rama>`, y
    trata una ruta `$VAR` como la raíz.
  - P12 `doctor.py`: ante un gancho sin cabecera (propio a propósito) recomienda `/gw-update`, que lo sobrescribiría.
  - P13 `bitacora.py`: la regex `GLUED_ITEM` da falsos positivos; `recuperar.py fit_log` recorta primero las filas
    de otros worktrees (P1).
  - P14 `tope-subagentes.py`: el contador `/tmp/gw-subagents-<sesión>` no se borra nunca y se acumula en una
    máquina que dura (la Deck).
  - P15 `guardia-config.py` protege también `.claude/gw.json`: la plantilla de `CLAUDE.md` que avisa de los permisos
    debería nombrarlo (WMF lo añadió a mano).
  - P16 (v0.5.0) `apply.py --update` con un `log` que se mueve (`docs/registros` → `docs/records`): siembra la
    plantilla de la bitácora en la ruta nueva antes del movimiento y sobrescribe la movida (se recuperó de `HEAD`).
    Debería sembrar solo si, tras los movimientos, el archivo no existe.
  - P17 (v0.5.0) `check.yml` es obligatorio y corre en cada push de rama fuera de la protegida: con un CI propio
    (`ci.yml`, solo PR y `main`) se duplica en los PR y gasta cuota en cada push. Falta una clave (p. ej.
    `ciOnPush: false`) para dejarlo solo en los pull request.
  - P18 (v0.5.0) `apply.py` deja un script con nombre viejo si otro archivo cita un nombre igual en otra ruta
    (`tools/qa/fusionar.sh`, `tools/qa/mapa-agente.py`, o un comentario): debería casar la ruta entera
    (`.claude/gw/scripts/<nombre>`). En WMF se quitaron a mano (usuaria, 2026-11-04). Y `apply.py --check` sale 1
    con un gancho propio declarado: falta una clave para marcar archivos del proyecto (p. ej. `ownFiles`).
    Una comprobación siempre en rojo deja de mirarse (retro del 2026-11-04, R3).
  - P19 (v0.5.0) La skill `gw-update` debería mandar la comparación de cada `.gw-new` a un subagente barato que
    devuelva la tabla de desvíos, y su fase 1 dejar fuera las copias idénticas del flujo (retro del 2026-11-04, R2;
    ya en dos actualizaciones de WMF).
  - P20 (v0.6.0) El aviso de nombres antiguos de `apply.py` (`plan_legacy_names`) cuenta como uso un nombre tras `/`
    (`tools/qa/fusionar.sh`, `tools/qa/mapa-agente.py`, herramientas del proyecto): para no tener avisos fijos, WMF
    deja `AGENTS.md` y `ci.yml` enteros en `legacyNamesSkip` y un nombre viejo que vuelva ahí no avisa. Pide que una
    ruta que no sea `.claude/gw/scripts/` no case, o una lista de nombres propios del proyecto (revisión del
    2026-11-14, rama `claude/gw-update-0.6`).
  - P21 (v0.6.0) El `commit-msg` debería rechazar `Findings:` o `Retries:` a principio de línea fuera del último
    párrafo: git solo lee trailers ahí, y `f68916df` (`Findings: 8` en un párrafo propio) no cuenta para
    `change-size.py` (aviso falso de revisión pendiente) ni para `metrics.py quality` (retro del 2026-11-14, R1).
  - P22 (v0.6.0) El ledger de métricas deja commits propios («ledger de la sesión», dos iguales en
    `claude/gw-update-0.6`) y choca entre ramas: que `metrics.record` lo meta en el commit de trabajo o use un
    archivo por rama que `metrics.py` junte al leer (retro del 2026-11-14, R3).
  - P23 (v0.6.0) `apply.py --update` renombró nombres antiguos en el histórico (`roadmap-front.md`: `fusionar.sh` →
    `merge-branch.sh`, que en WMF no existe): que no toque `recordsDir` ni los roadmaps y nunca renombre hacia un
    archivo inexistente; va con P20 (retro del 2026-11-14, R4).

## Se queda en WMF

- `.githooks/commit-msg` como archivo propio (sin cabecera de versión; el doctor lo avisa): mientras P4 y P5 no estén
  arriba, `/gw-update` no debe reemplazarlo. Con v0.5.0 (`commitNext: true`) sigue propio porque el del flujo pide
  `Siguiente:` también fuera de Claude Code (usuaria, 2026-11-04); por eso `apply.py --check` sale 1 solo por él (P18).
- Los textos en español de los comentarios y mensajes de los ganchos.
