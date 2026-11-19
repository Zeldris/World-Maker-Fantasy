# Retro · 2026-11-19 · gw-update 0.8.0 → 0.8.1

Rama `claude/wonderful-volta-662qt8`. Sesión corta: `apply.py --update` (111 archivos del flujo), marcadores a
v0.8.1, merge de `main`, fase 1 trivial en sesión (0 hallazgos), CI en verde en `2597c159`. Dos reinicios del
worker sin pérdida (todo estaba subido). `/gw-opt-ai` no hace falta: `pendiente-opt-ai.md` no tiene filas sin
analizar. No cierra bloque ni versión del proyecto, así que no hay barrido de leves.

## Candidatos (de más a menos grave)

1. **Guarda de alcance con la marca de una tarea cerrada** (desvíos: 108 `commit-warn` de `QA-511` en un solo
   commit). La marca de tarea en curso seguía en `QA-511`, ya cerrada, y el `pre-commit` pidió apuntar en su ficha
   archivos copiados del flujo. General → flujo: `scope-guard.py` debería saltarse lo `vendored` y `gw-update`
   debería limpiar la marca (o avisar) antes de `--update`.
2. **Fecha «Actualizado» de la bitácora** (un commit rechazado). `handoff.py set-row` reescribe la fila pero no la
   fecha, y el `commit-msg` la rechaza luego. General → flujo: que `set-row`/`close-row` pongan la fecha del día.
3. **Aviso falso de `Findings:`** (`commit-msg` vio la palabra en prosa del cuerpo y avisó). General → flujo: buscar
   solo el trailer o la frase de arreglos de revisión, no la palabra suelta.
4. **`workflowClone` sin fijar** (proyecto). En la nube el flujo está en `/home/user/galivelop-workflow` y en la Deck
   en `../Galivelop-workflow`; `review-scope.py` sin `--workflow` falla. Propuesta: `workflowRepository` en
   `.claude/gw.json` y la ruta por `GW_WORKFLOW` en cada máquina, no `workflowClone`.
5. **Revisión de `gw-opt-tokens`**: el arranque de esta sesión fue el 65 % del corte de compactación, y el 86 % es
   sistema y MCP (`Claude_Docs` no se usa en este proyecto). Propuesta (lo hace la usuaria): desactivar el conector
   `Claude_Docs` en las sesiones de WMF. `/clear` no lo reduce.

## For Galivelop-workflow

- C1: `scope-guard.py` ignora rutas `vendored`; `gw-update` limpia o avisa de una marca de tarea cerrada.
- C2: `handoff.py set-row`/`close-row` actualizan la fila «Actualizado».
- C3: `commit-msg` no avisa de `Findings:` por la palabra en prosa.

**Estado:** decidida por la usuaria (2026-11-19): C1-C3 aplazadas para `gw-harvest` (apartado de arriba); C4 aplazada; C5 aprobada, la aplica la usuaria desactivando el conector `Claude_Docs` en WMF.
