# Retro 2026-11-09 · imágenes: estudio por categorías, receta y limpieza (`IMG-54`)

**Estado:** aprobada y aplicada por la usuaria (2026-11-09): 1 (línea en `ramas-y-main.md`), 3 (`conservar` en
`camino.avanzar`, con `CAMINO_CONSERVAR=1`, y su test) y G1-G2 decididos para Galivelop-workflow.

Sesión en el worktree `../WMF-imagenes` (rama `claude/imagenes-por-fases`), abierta con la copia principal como carpeta
de trabajo, que es de otra sesión (`claude/generador-mapas`). Una compactación a mitad de tanda; se siguió sin pérdida
con el scratchpad y `estudio-categorias.md`.

## Candidatos, de más a menos grave

1. **El gancho de parada exige push y commit de la rama de otra sesión** (siete veces en la sesión). `before-stop.py`
   mira el repo de arranque (`CLAUDE_PROJECT_DIR`), no el worktree donde trabaja la sesión; solo conoce los de
   `.claude/worktrees/`. Obedecerlo habría subido trabajo a medias de la sesión del mapa.
   - *Proyecto:* una sesión paralela en un worktree hermano se abre **con ese worktree como carpeta** (el `.claude/`
     va en git, así que carga sus ganchos). Una línea en [`ramas-y-main.md`](../runbooks/ramas-y-main.md).
   - *Workflow:* ver abajo (G1).
2. **El gancho pide push en plena generación**, contra la memoria «nada más mientras genera» (ya pasó en r25). Se
   resolvió no obedeciendo, a mano. Ver G2.
3. **`camino.avanzar` borra los intentos no elegidos de la fase.** En un estudio eso pierde las imágenes que se
   comparan; hubo que inventar una variante nueva (`rec-*`) por experimento. *Proyecto:* opción `--conservar` en
   `avanzar` (o en `fase.py`) que mueve los no elegidos a `intentos/descartados/` en vez de borrarlos.
4. **Auditoría de ruido con un falso positivo**: el subagente dio por huérfano `investigacion-motor.md` (lo citan cinco
   documentos) y por inexistente `map-generator/` (no está en esta rama). Se comprobó antes de borrar. *Proyecto:*
   sin cambio; el encargo ya pedía evidencia por candidato, y la verificación de la sesión principal lo cazó.
5. **Lo que funcionó**: la segunda opinión de Fable sin enseñarle la conclusión llegó por su lado a lo mismo y añadió
   tres ideas (luz como exposición, paleta limitada, nada pequeño en P1). Vale como patrón para diagnósticos de imagen.

## For Galivelop-workflow

- **G1.** `before-stop.py`: cuando la sesión trabaja en otro worktree (no solo `.claude/worktrees/`), no exigir nada
  sobre la rama de arranque si su fila de la bitácora es de otra sesión; o leer una marca de la sesión
  (p. ej. `GW_SESSION_WORKTREE`) que diga dónde trabaja.
- **G2.** `before-stop.py`: una lista `busyProcesses` en `.claude/gw.json` (aquí `sd-cli`); si alguno corre, el push
  pasa a aviso en vez de bloqueo.
