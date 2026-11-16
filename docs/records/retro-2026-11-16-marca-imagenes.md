# Retro de `claude/marca-imagenes` (`UX-41`), 2026-11-16

Antes del PR a `main`. Fuentes: la sesión que hizo el trabajo (f69159de, 117 llamadas, 109k de contexto medio) y la
de las fases antes de `main`. Con ella, el `/gw-opt-tokens` de la tarea (`QA-364`…`QA-366`).

**Estado:** aprobada por Álvaro y aplicada (R1 como `QA-367`, R2 como `QA-368`); R3 y R4 decididas: van al flujo.

## R1 · Hojas de piezas de interfaz hechas a mano (`QA-367`, proyecto)

La sesión montó hojas de WebP sobre madera con `ffmpeg` suelto: dos fallos por alturas distintas (`hstack`) y varias
piezas leídas una a una. `hoja.sh --archivos` no servía: casilla con el tamaño de la primera imagen, sin fondo para
el alfa y enlaces `.png`. Arreglo: casillas fijas con `pad`, `FONDO=<color>` y cualquier imagen que lea `ffprobe`.

## R2 · CSS sin uso de los subagentes (`QA-368`, proyecto)

La revisión de código halló `.corner-bracket-gold` y `.plank-panel.is-active` sin uso, del commit de subagentes «sin
revisar». Es mecánico: `tools/qa/css-sin-uso.py` entra en el check. Las props sin uso (`Tabs.imagen`) las sigue
mirando la revisión.

## For Galivelop-workflow

- **R3 · Traer `main` con el árbol sucio.** El ledger de métricas siempre está modificado (lo escriben los ganchos).
  Con `stash` + `merge`, el conflicto dejó el `stash pop` sin aplicar y se descartó: 9 líneas del ledger perdidas,
  recuperadas de un commit suelto. Propuesta: un `merge-main.py` que haga commit del ledger (o se niegue con el árbol
  sucio) antes de `git merge origin/<protegida>`, y que `AGENTS.md` apunte a él en el paso 4.
- **R4 · Repetir un commit rechazado por `pre-commit`.** El aviso de `handoff` lleva a repetir el commit; con
  `git commit -F .git/COMMIT_EDITMSG` sale el mensaje del commit anterior, porque un rechazo en `pre-commit` no
  escribe el nuevo (así salió `5d82648d`). Propuesta: que el aviso diga «repite el mismo `git commit -m …`» y nunca
  remita a `COMMIT_EDITMSG` salvo cuando rechaza `commit-msg`.
