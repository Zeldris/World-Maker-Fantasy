<!-- Sacado de AGENTS.md el 2026-11-02 (aviso de tamaño del doctor); AGENTS.md enlaza aquí. -->
# Ramas y `main`: los casos especiales

Lo general (cada sesión su rama, merge y nunca rebase, a `main` con confirmación y CI en verde) está en
[`AGENTS.md`](../../AGENTS.md#ramas-y-main). Aquí, los casos que solo tocan a algunas tareas.

- **«Lleva a `main`» con la usuaria fuera** (usuaria, 2026-10-25, `QA-238`): se deja todo a un paso (retro escrita,
  CI local en verde sobre la fusión con `main`, descripción en `docs/registros/pr/`) y se para antes de
  `revisado.sh`; su decisión sobre la retro es la confirmación que lo lleva a `main`, sin más preguntas.
- **Con la cuota de GitHub Actions agotada, a `main` sin PR** (usuaria, 2026-10-22, `QA-215`): las tres fases de
  [`AGENTS.md`](../../AGENTS.md#antes-de-ir-a-main-tres-fases) igual, pero en vez del PR, la nube fusiona la rama en `main` en un worktree, pasa
  `bash tools/qa/ci-local.sh <worktree>` (los tres jobs de `ci.yml`) hasta verde y sube con `git push origin HEAD:main`.
  Se apunta en la bitácora como «sin PR, CI local». Solo mientras dure la cuota agotada.
- **El PR de una sesión local lo crea Claude en la nube** (usuaria, 2026-10-21, `QA-184`): en la Deck no hay `gh` ni
  herramienta de GitHub. Tras la fase 3, la local sube la descripción a `docs/registros/pr/<rama>.md` y deja en su
  fila de la bitácora «PR listo» con el título, en el último commit; la nube comprueba que nada va detrás de ese
  commit, pasa `revisado.sh`, crea el PR y sigue con el CI y la fusión. Una sesión sin URL de PR escribe «PR
  listo», nunca «PR abierto» ni «en borrador»: esas palabras en la bitácora solo van con la URL del PR (`QA-262`).
- **Tareas del instalador (`INS-*`)** (usuaria, 2026-10-26, `QA-259`): viven en el plan de
  [Instalador-WMF-Tarkor](https://github.com/Zeldris/Instalador-WMF-Tarkor), no en los roadmaps de WMF ni en `taskId`,
  y no rompen la pausa de pruebas: las pide la usuaria. Aquí solo llevan su fila «Tarea en curso» con el enlace a su plan.
- La rama de un subagente vuelve con `bash tools/qa/fusionar.sh <rama> "<mensaje>" --revisada` (no la de `.claude/gw/scripts/`): la de WMF
  resuelve sola los conflictos del registro de hallazgos (`resolver_hallazgos.py`) y pasa los tests del paquete tocado.
