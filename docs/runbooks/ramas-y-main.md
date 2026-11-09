<!-- Sacado de AGENTS.md el 2026-11-02 (aviso de tamaño del doctor); AGENTS.md enlaza aquí. -->
# Ramas y `main`: los casos especiales

Lo general (cada sesión su rama, merge y nunca rebase, a `main` con confirmación y CI en verde) está en
[`AGENTS.md`](../../AGENTS.md#ramas-y-main). Aquí, los casos que solo tocan a algunas tareas.

- **«Lleva a `main`» con la usuaria fuera** (usuaria, 2026-10-25, `QA-238`): se deja todo a un paso (retro escrita,
  CI local en verde sobre la fusión con `main`, descripción en `docs/records/pr/`) y se para antes de
  `reviewed.sh`; su decisión sobre la retro es la confirmación que lo lleva a `main`, sin más preguntas.
- **Con la cuota de GitHub Actions agotada, a `main` sin PR** (usuaria, 2026-10-22, `QA-215`): las tres fases de
  [`AGENTS.md`](../../AGENTS.md#antes-de-ir-a-main-tres-fases) igual, pero en vez del PR, la nube fusiona la rama en `main` en un worktree, pasa
  `bash tools/qa/ci-local.sh <worktree>` (los tres jobs de `ci.yml`) hasta verde y sube con `git push origin HEAD:main`.
  Se apunta en la bitácora como «sin PR, CI local». Solo mientras dure la cuota agotada.
- **La sesión local crea su PR con `gh`** (usuaria, 2026-11-03, `QA-285`; antes lo creaba la nube, `QA-184`): `gh`
  vive en `~/.local/bin/gh` con la sesión de la usuaria (`gh auth login` en Konsole) y está enlazado en el sandbox
  Flatpak de VS Code (`~/.var/app/com.visualstudio.code/data/node_modules/bin/gh` y `config/gh`), así que también lo
  ven los ganchos. Si `gh auth status` falla, se dice a la usuaria; nunca se busca la credencial de git. Una sesión
  sin URL de PR (sin `gh` ni herramienta de GitHub) escribe «PR listo», nunca «PR abierto» ni «en borrador»: esas
  palabras en la bitácora solo van con la URL del PR (`QA-262`), y el PR lo crea otra sesión que sí pueda.
- **Una sesión paralela en un worktree hermano** (`../WMF-imagenes`; retro del 2026-11-09): se abre **con ese
  worktree como carpeta** (VS Code en esa ruta). Abierta en la copia principal, el gancho de parada mira la rama de la
  otra sesión y pide subir su trabajo a medias; eso no se obedece.
- **Varios PR listos a la vez, de uno en uno** (usuaria, 2026-11-03, `QA-286`): todos tocan la bitácora, así que al
  fusionar uno el siguiente choca. Se abre y fusiona uno; el siguiente fusiona `main`, pone su marca y solo entonces
  se abre.
- **Tareas del instalador (`INS-*`)** (usuaria, 2026-10-26, `QA-259`): viven en el plan de
  [Instalador-WMF-Tarkor](https://github.com/Zeldris/Instalador-WMF-Tarkor), no en los roadmaps de WMF ni en `taskId`,
  y no rompen la pausa de pruebas: las pide la usuaria. Aquí solo llevan su fila «Tarea en curso» con el enlace a su plan.
- La rama de un subagente vuelve con `bash tools/qa/fusionar.sh <rama> "<mensaje>" --revisada` (no la de `.claude/gw/scripts/`): la de WMF
  resuelve sola los conflictos del registro de hallazgos (`resolver_hallazgos.py`) y pasa los tests del paquete tocado.
