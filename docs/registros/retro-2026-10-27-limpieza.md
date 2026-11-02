# Retro · `claude/limpieza` (`QA-271`, 2026-10-27)

**Estado:** decidida (usuaria, 2026-11-02): `QA-278` y `QA-279` aprobadas, en `roadmap-front.md` (limpieza del repo).

## Qué pasó (2026-11-02)

- El borrado y el check, en verde a la primera. El primer CI local salió con todo el backend en rojo: el contenedor
  `tarkor-postgres` llevaba 4 días parado («container state improper» en 7 pasos). Arrancado a mano, verde (`d14741bf`).
- `/code-review` cazó una mención viva a `obsoleto/` en `image-generator/README.md` que la entrada daba por corregida,
  y que el SQL de arcano a magia era la única vía de migrar una base anterior al 2026-09-01 (se deja borrado: era de
  un solo uso contra la base local; va como puerta de un solo sentido en la descripción).
- Tokens (`/opt-tokens`, a ojo): la rama se cerró dentro de una sesión larga con otras dos tareas (LoRA en Kaggle e
  `IMG-28`) y 8 compactaciones; lo de esta rama fue poco, pero se pagó con el contexto de las otras.

## Propuestas para la usuaria

1. **`QA-278` · `ci-local.sh` mira Postgres antes del backend:** si `tarkor-postgres` no está en marcha, lo arranca
   (o para con «Postgres parado: `podman start tarkor-postgres`»), en vez de siete pasos en rojo sin decir por qué.
   Test en `tools/qa/tests/`. Hito: la puerta de pruebas (herramienta de QA).
2. **`QA-279` · Las rutas borradas no se citan:** una comprobación del check que, para cada archivo borrado en la rama
   contra `origin/main`, busque su ruta en los `.md` y scripts vivos (sin registros ni retros) y la liste. Lo que
   cazó la revisión a mano lo haría el script (regla «lo comprobable lo hace un script»).
3. **Sin cambio:** una tarea pequeña como esta, en su propia sesión desde el principio; ya lo dice «cada sesión, su
   rama», no hace falta otra regla.

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
