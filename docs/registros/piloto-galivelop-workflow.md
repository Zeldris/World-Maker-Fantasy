# Piloto de Galivelop-workflow v0.2.0 en World-Maker-Fantasy

Fase 6 del plan del flujo. Rama `claude/piloto-galivelop-workflow`, desde `main` (`76ec6ae`), 2026-10-22.
Encargo y decisiones: la usuaria aprobó las propuestas de esta sesión (2026-10-22).

## Decisiones

- **`check`** (lo que hoy corre el pre-push, unos 80 s): tsc + lint de backend (con `prisma generate`) y frontend,
  `cobertura.py`, `mapa-agente.py` y `matriz-pruebas.py --comprobar`. Cada orden con npx pasa por `tools/qa/host.sh`
  (sandbox Flatpak de la Deck, `QA-180`).
- **Solo en el CI** (`ci.yml`, como hoy): `bitacora.py`, `enlaces-md.py` (15 s) y los unittest de `tools/qa` (300 s).
- **`relatedTests`**: `fast`, `tools/qa/tests-vitest.sh unidad {files}` (`vitest related` de backend `unit` y
  frontend, más el test de nombres de imágenes, `QA-35`); `slow`, `tests-vitest.sh integracion {files}` (BD real de
  lo que cambia, `QA-98`). Sustituye a `tools/qa/tests-relacionados.sh`.
- **`reviewMark`**: se mantiene `.claude/revision-main.sha`, ahora versionada (el flujo la commitea).
- **`requireRetro: true`**: conserva `QA-91` (sin retro decidida no hay marca).
- **`content`**: `docs/rpgtarkor|registros|producto/`, los `.md` de la raíz y los de las skills. Quedan fuera
  `docs/runbooks/` y `docs/mapa-agente.md`: son instrucciones para los agentes.
- **`designReferences`**: los seis juegos de la regla de diseño de `CLAUDE.md` (X4 primero).
- **CI**: se queda `ci.yml` y se borra el `comprobar.yml` del flujo. Con `install: []` (fricción 11) correría `check`
  sin `npm ci` en `backend/` ni en `frontend/` y fallaría; lo demás ya lo hacen los tres jobs de `ci.yml`, y repetirlo
  en cada push gasta la cuota de Actions (`QA-215`). Lo único nuevo, el `pre-commit` de la base sobre los commits del
  PR (secretos), pasa a `ci.yml` y a `ci-local.sh`.

## Comprobación final (2026-10-22)

- **CI local** (`bash tools/qa/ci-local.sh`, sobre `3b21115`): los tres jobs de `ci.yml` en verde, también el paso nuevo
  del `pre-commit` de la base. El CI de GitHub no se pasa: cuota de Actions agotada (`QA-215`).
- **Paso 6**: un commit de prueba en `frontend/src/main.tsx` y `git push --dry-run origin HEAD:main` → rechazado
  («code changed after the review mark (b54829d)»), y `git reset --hard HEAD~1`. El gancho de `PreToolUse`
  (`revision-antes-de-main.sh`) bloquea (salida 2) `create_pull_request` a `main` desde esta rama y `gh pr create
  --base main`; deja pasar lo demás (`ls`). Fricción 18.
- **Relevo**: un clon nuevo de la rama, como el de la otra cuenta. `session-start.sh` pone `core.hooksPath` y avisa si
  la sesión arranca fuera de la raíz; `doctor.py` todo OK, `bitacora.py check` bien, y `recuperar.py --estado` da la
  fila de la rama, el siguiente paso y los últimos commits. Fricción 19.

## Fricciones

| # | Paso | Qué pasó | Cómo se resolvió |
|---|---|---|---|
| 1 | 2, `aplicar.py` | El clasificador del modo automático lo deniega entero («Code from External»), no solo al escribir `.claude/settings.json`: no llega a avisar. | Lo lanza la usuaria en su terminal. |
| 2 | 2 | El `.gitignore` de WMF ignoraba `.claude/*` salvo settings, hooks y skills: `.claude/gw.json` y `.claude/gw/` no se habrían subido, y nada lo avisa. La marca `.claude/revision-main.sha` también estaba ignorada. | Excepciones en `.gitignore`. |
| 3 | 1, `check` | `check` no tiene forma de relanzarse fuera de un sandbox (Flatpak de la Deck): el `pre-push` de WMF se relanzaba entero en el host. | Cada orden con npx, envuelta en `tools/qa/host.sh`. |
| 4 | 3, `opt-ai` | El `medir.py` del flujo no tiene la tabla por turno (TURNOS) que usa `bench-ia.sh`. | El de WMF pasa a `tools/qa/medir-ia.py` (script del proyecto). |
| 5 | 3, `opt-tokens` | El `medir.py` del flujo no trae test; el de WMF sí. Mismas cifras en esta sesión. | `tools/qa/tests/test_medir.py` portado al del flujo (8 tests). |
| 6 | 3, CI | `unittest discover -s .claude/skills/opt-ai` da 0 tests: los scripts del flujo están en `scripts/`, sin `__init__.py`. | `-s .claude/skills/opt-ai/scripts` en `ci.yml` y `ci-local.sh`. |
| 7 | 3 | La salida de los scripts del flujo está en inglés aunque `language: es`. | Se acepta. |
| 8 | 3, `scout-updates` | `compare.py` busca `seal:`, `## Constraints`, la columna `Component` y `## Coverage` en inglés: con la memoria en español (`sello:`, `Restricciones`) da todo `unsealed`. | Esos cuatro textos, en inglés en `docs/scout/arquitectura.md`; apuntado en `.claude/gw/scout-updates.md`. |
| 9 | 3, `scout-updates` | La skill fija la memoria en `.claude/gw/scout/`; la de WMF está en `docs/scout/` y la enlazan informes, roadmap y retros. | Se queda en `docs/scout/`; las notas lo dicen. |
| 10 | 3, `scout-updates` | El banco de calidad por pares (`banco.py`) no está en el flujo; las evals de WMF eran de su skill en español. | Banco a `tools/qa/banco-calidad.py` y `docs/scout/banco/README.md`; evals borradas (en git). Inventario y contraste del flujo, comprobados iguales en WMF y en los casos difíciles. |
| 11 | 3, `settings.json` | Claude Code lanza a la vez los hooks del mismo `SessionStart`: `install` de `gw.json` (npm install) correría en paralelo con el arranque de WMF, que necesita `node_modules` para Prisma, Postgres y migraciones. | `install: []`; las dependencias siguen en `.claude/hooks/session-start.sh`. El gancho de revisión, `recuperar.py` y `core.hooksPath`, los del flujo; el `revision-antes-de-main.sh` de WMF, borrado. |
| 12 | 3, `.githooks` | `protectedPaths` se había puesto en `docs/rpgtarkor/`, pero Claude sí commitea ahí el lore aprobado cuando la usuaria lo pide; lo que el `pre-commit` de WMF paraba era `docs/borradores-opencode/` (`QA-144`). El `pre-commit` del flujo saca la raíz de su ruta: el test de WMF, que lo corría en un repo temporal, miraba el de WMF. | `protectedPaths: ["docs/borradores-opencode/"]`; el test copia gancho, scripts y `gw.json` al repo temporal (10 tests en verde). `pre-push` del flujo: los mismos `check`, y las imágenes (`QA-35`) van en `tests-vitest.sh`. `commit-msg` (`QA-210`) se queda. |
| 13 | 4, inicio | No se puede clonar el repo del flujo (`Zeldris/Galivelop-workflow` es privado y no está entre los de la sesión de la nube; `add_repo` lo deniega). | Se trabaja con la copia instalada en `.claude/gw/` y, de referencia, el clon público de Portal-Galivelop (`REVIEW.md`, `GLOSSARY.md`, `comprobar.yml`). |
| 14 | 4, duplicados de `tools/qa` | Los 7 scripts del flujo hacen lo mismo salvo: `bitacora.py closed` da por apuntada una tarea con un punto sin tachar que empieza por su id (WMF exigía la línea tachada, `QA-85`); `check` ignora una fila «Tarea en curso» sin rama si hay otras buenas; `enlaces-md.py` no tiene la excepción de `docs/registros/pr/` (enlaces desde la raíz, `QA-184`); `rojo-sin-arreglo.sh` toma una orden entera y ya no comprueba que se ejecute exactamente un test (lo sustituye `--fails-with`); `recuperar.py --buscar` busca como texto una expresión mala; `revisado.sh` hace commit de la marca. | Tests de WMF portados a los scripts del flujo (`test_bitacora`, `test_prepush_ramas`, `test_enlaces_md`, `test_recuperar`; 169 en verde) y los 7 borrados. Las descripciones de PR enlazan desde su carpeta (3 arregladas), y dos enlaces rotos del propio piloto (`CLAUDE.md#pruebas-de-juego` → `AGENTS.md`, el banco del scout). CI, `ci-local.sh`, runbook y `EXCEPCIONES` al día. |
| 15 | 4, `REVIEW.md` y `GLOSSARY.md` | `aplicar.py` no propone nada para los archivos que rellena el proyecto (bien), pero sin el repo del flujo no se ven sus plantillas: la marca y las reglas se sacan de `AGENTS.md`, de la skill `domain-modeling` y del `REVIEW.md` de Portal. `GLOSSARY.md` tenía **Rastro** dos veces con dos sentidos. | Marca `<!-- galivelop-workflow v0.2.0 -->` en los dos; en `REVIEW.md`, «Ganchos y scripts del flujo» (lo de Portal, adaptado: PR a `main`, `host.sh`, tests de `tools/qa`); en `GLOSSARY.md`, los dos **Rastro** con su sentido entre paréntesis y «El trabajo con Claude» (bitácora, relevo, marca de revisión). |
| 16 | 4, CI | `comprobar.yml` instala con `install` y prepara Node solo si hay `package.json` en la raíz: en un monorepo con `install: []` (porque lo hace `session-start.sh`) no puede pasar `check`. Además corre en cada push fuera de `main`, aparte del CI que ya tenga el proyecto. | Se decide `ci.yml` (ver Decisiones); `comprobar.yml` borrado y su paso de `pre-commit --rango` llevado a `ci.yml` y `ci-local.sh`. |
| 17 | 4, `doctor.py` | Sin FAIL; un WARN falso: el `.claude/hooks/session-start.sh` de WMF (dependencias, Postgres, Ollama simulado) se llama como el script del flujo y `doctor.py` lo toma por una copia vieja («delete that entry»): borrarlo dejaría la nube sin entorno. | Renombrado a `.claude/hooks/entorno-nube.sh` (`settings.json`, `AGENTS.md`, comandos de la bitácora). `doctor.py`: todo OK. |
| 18 | 6, gancho de PR | `merge_pull_request` del PR #1 (antiguo, ya fusionado, sin `gw.json` en su cabeza) se bloquea bien, pero pide «commit a valid `gw.json` on the PR branch», que no tiene sentido en un PR cerrado. | Nada que hacer en WMF; sugerencia abajo. |
| 19 | 7, relevo | Al arrancar (`startup`), `session-start.sh` no dice nada del estado; la fila de la bitácora solo se inyecta tras `compact`/`clear`. El relevo depende de que `CLAUDE.md` mande leer la bitácora (lo hace). | Nada que cambiar; sugerencia abajo. |

## For Galivelop-workflow

- `aplicar.py`: el aviso del modo automático llega tarde; el clasificador puede denegar la orden entera por ser código
  de otro repo. La guía (paso 2) debería decir de entrada que la lance la persona.
- `aplicar.py`/`doctor.py`: comprobar que `.claude/gw.json`, `.claude/gw/` y `reviewMark` no están en `.gitignore`
  (`git check-ignore`) y avisar con la línea que lo arregla.
- `check`/`pre-push`: un gancho para ejecutar las órdenes dentro de un envoltorio del proyecto (p. ej. `checkWrapper`)
  evitaría repetir `host.sh` en cada orden.
- `opt-ai/scripts/medir.py`: una tabla por turno (duración y tareas de cada turno) haría innecesario el script propio.
- `opt-tokens/scripts/medir.py`: sin test; WMF ofrece el suyo (`tools/qa/tests/test_medir.py`).
- Los scripts de cada skill en `scripts/` piden `-s <skill>/scripts` a `unittest discover`; decirlo en `aplicar.md`.
- Los mensajes de los scripts deberían seguir `language` de `gw.json`.
- `scout-updates/compare.py`: aceptar los títulos en el `language` del proyecto (o una lista en las notas) y `sello`.
- `scout-updates`: dejar elegir la carpeta de la memoria (p. ej. `scoutDir` en `gw.json`).
- `scout-updates`: WMF ofrece su banco por pares a ciegas (`tools/qa/banco-calidad.py`, con test) para el paso 5.
- `session-start.sh`/`install`: los hooks de inicio corren en paralelo; un paso `setup` del proyecto que corra tras
  `install` (en el mismo script del flujo) permitiría dejar las dependencias en `gw.json`.
- `bitacora.py closed`: contar como apuntada solo la línea tachada de «Hecho» (o la que empieza por fecha y nombra el id
  tachado), no cualquier punto que empiece por el id.
- `bitacora.py check`: fallar con una fila «Tarea en curso» sin rama aunque haya otras buenas.
- `enlaces-md.py`: una lista de carpetas cuyos enlaces se resuelven desde la raíz (p. ej. `linkRoots` en `gw.json`), o
  decir en la skill `pr` que la descripción guardada enlaza desde su carpeta.
- `rojo-sin-arreglo.sh`: una opción para exigir que se ejecute exactamente un test (WMF lo contaba en la salida de vitest).
- Dar acceso de lectura al repo del flujo en la nube, o publicar las versiones, para que un piloto pueda comparar.
- `doctor.py`: avisar de términos repetidos en `GLOSSARY.md` (el mismo `**Término**:` dos veces).
- `gw-init`/`aplicar.py`: decir qué marca llevan `REVIEW.md` y `GLOSSARY.md` en un proyecto que ya los tenía.
- `comprobar.yml`: una lista `ciInstall` aparte de `install` (o un paso del proyecto) para monorepos, y el paso del
  `pre-commit --rango` como bloque que se pueda copiar a un CI existente; `doctor.py` no debería proponer
  `comprobar.yml` cuando ya hay otro workflow que corre `check`.
- `doctor.py` (`stale_flow_hooks`): comparar con el contenido o la cabecera `# galivelop-workflow`, no solo con el nombre
  del script; un script del proyecto que se llame igual no es una copia vieja.
- `revision-antes-de-main.sh`: con un PR cerrado o fusionado, decirlo en vez de pedir un `gw.json` en su rama.
- `session-start.sh`: en `startup` y `resume`, una línea con la rama y el siguiente paso de la bitácora (lo que ya da
  `recuperar.py --estado`), para que el relevo no dependa solo de `CLAUDE.md`.
