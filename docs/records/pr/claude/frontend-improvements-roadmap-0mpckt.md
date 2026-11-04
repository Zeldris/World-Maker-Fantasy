# QA-235…QA-239: carpeta de difusión, skill gw-media-content y retro aplicada

## Qué cambia

- **`docs/difusion/`**: contenido para publicar en X, LinkedIn, Reddit, Discord y el Portal Galivelop, con una carpeta
  por actualización. Incluye:
  - un `README.md` con las reglas;
  - una `guia-canales.md` con el tono, la longitud y las imágenes de cada canal;
  - la `_plantilla/`;
  - el ejemplo `2026-10-23-mundo-vivo/`, con su ficha de datos con fuentes, los cinco canales en `es` y `en` (`gl`
    solo en el Portal) y tres imágenes propias en `medios/`: tarjeta, diagrama y captura del mapa del Pozo.
- **Skill `gw-media-content`** (`.claude/skills/gw-media-content/`): crea una carpeta o completa una existente con lo
  que aún no se ha publicado, para los canales que se pidan.
  - `render.mjs` convierte las fuentes HTML, SVG, PNG o JPG de `medios/fuente/` en WebP de 1600 px y en su `-mini` de
    720 px.
  - `comprobar.py` busca huecos de la plantilla, jerga interna, mensajes de X de más de 280, un hilo fuera de 2 a 4
    mensajes, un JSON del Portal inválido e imágenes sin renderizar, sin listar o sin texto alternativo.
  - La nota de WMF (`.claude/gw/gw-media-content.md`) explica cómo sacar capturas con los escenarios guardados.
- **Comprobaciones:** `comprobar.py` entra en el check (`.claude/gw.json`), y sus 11 tests entran en `ci.yml` y en
  `tools/qa/ci-local.sh`.
- **Retro aplicada** (aprobada entera por la usuaria, 2026-10-25):
  - `QA-236`: `tools/qa/skills-con-tests.py` falla si los tests de una skill no corren en `ci.yml` y en
    `ci-local.sh`; entra en el check con `test_herramientas_con_test` (script de skill sin test al lado).
  - `QA-237`: `tools/qa/bitacora-check.sh` (la comprobación de la bitácora del pre-push) entra en el check.
  - `QA-238`: regla en `AGENTS.md` para «lleva a `main`» con la usuaria fuera.
  - `QA-239`: `ci-local.sh` en un worktree sin rojos falsos (`test_commit_msg`, `test_host` y `npm ci` sobre el enlace
    de `node_modules`).
- **Roadmap, bitácora y retro:** `QA-235` a `QA-239` están tachadas en `roadmap-front.md` y en `21-roadmap.md`, y la retro está en
  `docs/registros/retro-2026-10-25-difusion.md`.

## Evidencia

- No toca `backend/src` ni `frontend/src`. El `tsc` y el `oxlint` de backend y frontend del check siguen en verde.
- `python3 -m unittest discover -s .claude/skills/gw-media-content/scripts`: 11 tests OK. Un test nuevo falla sin su
  arreglo, según `rojo-sin-arreglo.sh`.
- `comprobar.py` da OK en el ejemplo.
- La revisión de código antes de `main` dio 13 hallazgos, todos arreglados en `a9eb7bbf`.
- `python3 -m unittest discover -s tools/qa/tests`: OK, también en un worktree. Los tests nuevos
  (`test_skills_con_tests`, `test_bitacora_check`) fallan sin su arreglo.

## Riesgo

Sin migraciones y sin cambios en las partidas guardadas. Solo hay documentación, una skill y comprobaciones nuevas en el
check.

## Queda

- La usuaria valida el estilo del ejemplo antes de publicar nada.
- Las propuestas 1-3 de la retro quedan también para Galivelop-workflow.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01CprfyerCkZJQW72S2ekkQ8
