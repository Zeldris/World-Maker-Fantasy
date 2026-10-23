# Retro: piloto de Galivelop-workflow v0.2.0 y revisión antes de `main` (2026-10-23)

**Estado (2026-10-23):** pendiente: se presenta a la usuaria antes de `revisado.sh` y de la fusión a `main`.

Rama `claude/piloto-galivelop-workflow`. Fuentes: el [registro del piloto](piloto-galivelop-workflow.md) (fricciones
1-25), el `/code-review --max-findings all` contra `origin/main` (12 hallazgos) y `/opt-tokens --since 76b4f16`.

## Gasto (`/opt-tokens`)

- Piloto desde `76b4f16`: 136 llamadas, 4 compactaciones, contexto medio 115k (techo 123-144k). Está por debajo del
  umbral de 150k de `orchestrate-dealer`; 1 subagente (`opus`, 20 llamadas).
- Lo más releído: este registro y `AGENTS.md` (19 veces cada uno), `traspaso.md` (16). Son lecturas cortas con
  `sed`/`grep`, no archivos enteros. No hay propuesta de ahorro que compense su riesgo.
- La media de la sesión entera (373k) sale de los tramos de antes de `QA-109`, no del piloto.

## Propuestas, por gravedad

1. **Probar `host.sh` en la Deck** (proyecto). El arreglo de las fricciones 20-21 (`host.sh` rehace el worktree del
   `pre-push` dentro de `.git/` en el sandbox Flatpak) solo se ha probado con un `flatpak-spawn` falso.
   Propuesta: la usuaria hace en la Deck un push con el árbol sucio (modo worktree) y mira que el check pasa. Si
   falla, `git push` desde un árbol limpio. Riesgo de no hacerlo: el primer push sucio desde la Deck se para.
2. **`revisado.sh` y los borradores** (flujo; fricción 22). En la Deck, con un borrador de Álvaro sin commit, no se
   puede escribir la marca. En WMF: `git stash -u` antes y `git stash pop` después. Propuesta: anotarlo en el paso 6
   de [`skills-y-modelos.md`](../runbooks/skills-y-modelos.md) hasta que el flujo lo arregle.
3. **Palabras del Estado de la retro** (flujo; fricción 23). Propuesta: una línea en el paso 6 de
   `skills-y-modelos.md` con las palabras que acepta `requireRetro` («aplicadas», «rechazadas», «aplazadas»).
4. **Logs fijos de `tests-vitest.sh`** (proyecto, leve; hallazgo F10). Dos pushes a la vez se pisan
   `/tmp/pre-push-*.log`. Propuesta: un `mktemp` por push, con su test.
5. **Gancho de `main` en cada Bash** (flujo; fricción 24). Se queda como está; la propuesta va al flujo.

## For Galivelop-workflow

Las sugerencias 20-25 del [registro del piloto](piloto-galivelop-workflow.md#for-galivelop-workflow) y además:

- `retro`: decir en la skill qué palabras del Estado acepta `requireRetro`.
- `opt-tokens/medir.py`: con `--hours 0` en una sesión de varios días, avisar de que la media de la sesión entera
  mezcla tramos con otra ventana de compactación.
