# Retro 2026-11-03 · `claude/gh-en-la-deck`

**Sesión:** Deck, 2026-11-03. Cierre de ramas (paso 2 de la línea), `IMG-4` cerrada e `IMG-6` replanteada, `gh`
instalado en la Deck (`QA-285`) y PR #80 y #81 creados y fusionados desde aquí.

**Estado:** las tres aprobadas por la usuaria (2026-11-03). La 2, aplicada en `ramas-y-main.md` (`QA-286`); la 1 y la 3,
que son del flujo, apuntadas abajo para Galivelop-workflow (`QA-287`).

## Candidatas, de más a menos grave

1. **La matriz de `main` no dice lo que ya jugó la otra cuenta** (navegación; general). `matriz-pruebas.py` en
   `main` daba CR-43/55/56/63 «sin jugar», pero `claude/wonderful-volta-662qt8` ya los había jugado (tandas 30-43 de
   `plan-comprobacion-puerta.md`). Casi se repite una ronda entera; lo evitó mirar a mano `git log` de las ramas
   remotas. Propuesta: que `recuperar.py --estado` enseñe también la fila «Tarea en curso» de cada rama remota con
   commits más nuevos que `main` (hoy solo enseña las de los worktrees locales). Va a Galivelop-workflow.
2. **Dos PR que tocan la bitácora a la vez cuestan una vuelta más** (proyecto). Al fusionar el #81, el #80 chocó en
   `traspaso.md` y `21-roadmap.md`: otra fusión de `main`, otra marca y otros 7 minutos de CI. Propuesta: una línea
   en `docs/runbooks/ramas-y-main.md`: con varios PR listos, se abren y fusionan de uno en uno, y el siguiente
   fusiona `main` justo antes de abrirse.
3. **`revisado.sh` no dice `--footer` cuando falla el commit** (general). Se corrió dos veces sin `--footer`; el
   `commit-msg` rechazó el commit y el aviso solo decía «retry: bash revisado.sh», así que la marca se commiteó a mano.
   `AGENTS.md` ya lo explica: el fallo es del aviso. Propuesta: que el aviso sugiera
   `--footer "Siguiente: <paso>"`. Va a Galivelop-workflow.

Sin candidata: el gancho `revision-antes-de-main.sh` no veía `gh` en el sandbox Flatpak; se arregló con los enlaces
de `QA-285`, ya documentados en `ramas-y-main.md`.

## For Galivelop-workflow

- `recuperar.py --estado`: also print the «in progress» row of every remote branch newer than the protected branch,
  not only local worktrees, so a session sees work another account already did (candidate 1).
- `revisado.sh`: when the mark commit fails on a `commit-msg` hook, suggest `--footer "<required last line>"` in the
  error (candidate 3).
