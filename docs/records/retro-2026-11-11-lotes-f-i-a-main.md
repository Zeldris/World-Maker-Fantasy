# Retro: lotes F-I (P440-P452) de la puerta de pruebas, antes de `main`

Rama `claude/wonderful-volta-662qt8`, 2026-11-11. Lotes F-I (tandas 110-115), `WMF_HUIDA_PRUEBAS` para P443 y la
fase 1 contra `origin/main`: 16 hallazgos; arreglado H12 (`ba5d55b5`); H1, H8-H10, H13 y H15 refutados; 9 leves.

**Estado:** aprobada entera por la usuaria (2026-11-11) y aplicada: candidatas 1-3 en `QA-317`, `QA-318` y `QA-319`
(la 3 también abajo, para Galivelop-workflow); gw-opt-tokens 1 en `QA-320`, 2 y 3 en `QA-321`, 4 ya era `QA-305`.

## Leves de la revisión, sin arreglar

- H2-H6: scripts `preparar*` de escenarios (H4 lanza `throw` en vez de devolver `{error}`).
- H7: falta `porcionDelDia` en el aviso de P381.
- H11: desempate de `ORDEN_LOG` por id.
- H14: consulta de compañeros sin combate.
- H16: el respaldo del narrador omite la acción.

## Candidatas de la retro

1. **El comentario de P299 en `dailyTick.ts` contradice P444** (código, proyecto). Dice que «si el Ayuntamiento sigue
   en pie, los de su región no caen… ni por su rebelión», pero desde P444 el Ayuntamiento sigue en pie con su
   territorio perdido y el resto cae. La revisión marcó H1 por eso y un subagente lo «arregló» rompiendo un test.
   Cambio: el comentario cita P444 (si cae el territorio del Ayuntamiento, caen los de su región y él no).
2. **La revisión comprueba los P citados antes de dar un hallazgo** (`REVIEW.md`, proyecto). 6 de 16 hallazgos fueron
   refutados; H1 contradecía un P ya jugado. Regla: si el código cita un `P<n>`, el hallazgo que lo contradiga se
   contrasta con `python3 tools/qa/marca-hallazgo.py --ver P<n>` antes de proponerse.
3. **El subagente de arreglos no commitea sin la bitácora** (`gw-orchestrate-dealer`, Galivelop-workflow). Su commit
   salió sin `traspaso.md`, el gancho de parada lo pidió y el `--amend` lo bloquea el modo automático: hizo falta un
   segundo commit. Cambio: el encargo dice «deja el cambio sin commitear» o «actualiza la fila con `handoff.py` y
   commitea junto».

## gw-opt-tokens (desde `fd58780`)

455 llamadas en la principal, 113k de contexto medio, techo ~143k, 6 compactaciones en la tarea.

1. **Estado del plan con una orden** (proyecto): `plan-comprobacion-puerta.md` se leyó 45 veces (1,65M arrastrados) y
   `pruebas-0.3-hallazgos.md` 46 (0,88M), casi siempre con `grep`/`sed` para saber qué tanda o lote toca.
   `tools/qa/plan.py` (`--pendiente`, `--tanda N`) daría la tanda siguiente, los lotes abiertos y sus P. Ahorro
   ~2M por rama. Riesgo: ninguno, lee el mismo archivo.
2. **La principal no lee entero `rondas-de-pruebas.md`** (proyecto, ya es `QA-209`): se leyó entero 2 veces y por
   trozos 9 (1,35M arrastrados). Cambio: `orden.sh --runbook <sección>` o un `sed` de «Qué se prueba» en el runbook.
   Riesgo: ninguno; quien juega sigue leyéndolo entero.
3. **Diagnóstico de código en subagente** (proyecto, usar `gw-orchestrate-dealer`): `moralGrupo.ts` 15 lecturas y
   `prepararReino.ts` 10 en la principal. Ahorro ~0,5M. Riesgo: el subagente sin contexto redescubre; el encargo
   lleva el P y el `archivo:línea`.
4. **`/clear` al cerrar cada lote** (`QA-305`): 6 compactaciones en esta tarea, 45 en la sesión. Se pide al acabar
   esta fase.

## For Galivelop-workflow

- **El encargo de arreglos de `gw-orchestrate-dealer` dice qué hacer con el commit** (candidata 3, `QA-319` en WMF):
  «deja el cambio sin commitear» o «actualiza tu fila con `handoff.py` y commitéala junto». Un subagente commiteó sin
  `traspaso.md`, el gancho de parada lo pidió y el `--amend` lo bloquea el modo automático: hizo falta un segundo commit.
