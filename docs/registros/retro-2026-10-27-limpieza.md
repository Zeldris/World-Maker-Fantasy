# Retro · `claude/limpieza` (`QA-271`, 2026-10-27)

**Estado:** pendiente (la retro de la rama se hace en la fase 2 antes de `main`; esta entrada se adelantó el
2026-10-27 para que `gw-harvest` la recoja).

## For Galivelop-workflow

### `revisado.sh`: su commit no pasa un `commit-msg` que exige «Siguiente:»

- **Qué pasó** (2026-10-27, `claude/lore-enciclopedia`): `revisado.sh` escribe la marca y hace su commit con solo el
  asunto («Revisado: <sha>»). El gancho `.githooks/commit-msg` de este proyecto (`QA-210`) rechaza, con `CLAUDECODE=1`,
  cualquier commit sin una línea `Siguiente: …`, así que el script acaba en «could not commit .claude/revision-main.sha»
  y la marca hubo que commitearla a mano (`8ec40657`), con el mismo asunto y un cuerpo con «Siguiente:».
- **Propuesta:** que el commit de la marca lleve cuerpo, con la línea que pide el gancho, por idioma (`language` de
  `gw.json`): es → `Siguiente: crear el PR (o fusionar) con el CI en verde.`; en → `Next: open the PR (or merge) with
  CI green.`. En `revisado.sh`, donde hoy está `git commit -q -m "$subject" -- "$mark"`:

  ```bash
  if [ "$language" = "es" ]; then subject="Revisado: $head"; next="Siguiente: crear el PR (o fusionar) con el CI en verde."
  else subject="Reviewed: $head"; next="Next: open the PR (or merge) with CI green."; fi
  { git add -- "$mark" && git commit -q -m "$subject" -m "$next" -- "$mark"; } || {
  ```

  Alternativa, si el flujo prefiere no suponer qué gancho hay: documentar en el mensaje de error del script que el commit
  se puede hacer a mano con el asunto `Revisado: <sha>` y lo que pida el gancho.
- **Por qué al flujo y no aquí:** `revisado.sh` es una copia de Galivelop-workflow v0.2.0; una edición local se pierde
  en la siguiente actualización (skill `retro`). Mientras no llegue, el apaño es el commit a mano.
- **No bloquea:** la marca se escribe igual (`.claude/revision-main.sha` queda en el índice); solo falla el commit.
