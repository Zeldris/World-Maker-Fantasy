# QA-235: carpeta de difusión y skill gw-media-content

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
- **Roadmap, bitácora y retro:** `QA-235` está tachada en `roadmap-front.md` y en `21-roadmap.md`, y la retro está en
  `docs/registros/retro-2026-10-25-difusion.md`.

## Evidencia

- No toca `backend/src` ni `frontend/src`. El `tsc` y el `oxlint` de backend y frontend del check siguen en verde.
- `python3 -m unittest discover -s .claude/skills/gw-media-content/scripts`: 11 tests OK. Un test nuevo falla sin su
  arreglo, según `rojo-sin-arreglo.sh`.
- `comprobar.py` da OK en el ejemplo.
- La revisión de código antes de `main` dio 13 hallazgos, todos arreglados en `a9eb7bbf`.

## Riesgo

Sin migraciones y sin cambios en las partidas guardadas. Solo hay documentación, una skill y una comprobación nueva en
el check.

## Queda

- La usuaria valida el estilo del ejemplo antes de publicar nada.
- Las propuestas de la retro esperan su decisión.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01CprfyerCkZJQW72S2ekkQ8
