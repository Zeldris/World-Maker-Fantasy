# Retro del PR de las pruebas del Reino (2026-10-22)

Lo revisado: lo que entra con el PR a `main` desde `claude/pruebas-reino` (`git log origin/main..HEAD`):

- las tandas 15-21 del [reparto](plan-comprobacion-reino.md), jugadas en la Deck: Mundo vivo sin jugar de la matriz y
  los arreglados P275-P303 ([hallazgos](pruebas-0.3-hallazgos.md)); nuevos P312-P319;
- el `/code-review --max-findings all` previo (solo documentos y dos instantáneas) y sus arreglos.

También se revisan `opt-tokens`, `orchestrate-dealer` y `/code-review`.

**Estado (2026-10-22): la usuaria aprobó T1, T2, R1, R2, R3, R4 y R5.** Aplicadas en la rama: T1 → `QA-208`,
T2 → `QA-209`, R1 → `QA-210`, R2 → `QA-211`, R4 → `QA-212`, R3 → `QA-213`, R5 → `QA-214`.

## Medida

`/opt-tokens` de la sesión: la principal hizo 71 llamadas, 7,2 M de entrada, contexto medio 102k, 1 compactación. Los
9 subagentes, 31,6 M (81 % de la entrada), casi todo `sonnet` en tandas de 47-69 llamadas con ~75k de contexto medio y
~33k de arranque. Lo que más arrastró en la principal fue leer entero el runbook de rondas (35 KB, ~520k arrastrados)
sin jugar.

## Propuestas

| # | Qué | Por qué |
|---|---|---|
| T1 | «Fallos de las herramientas» fuera del runbook, a un registro; en el runbook, los trucos vigentes | 22,8 KB de 34 KB que cada subagente de tanda leía entero (~330k por tanda) |
| T2 | El runbook lo relee quien juega, no la principal que reparte | ~520k arrastrados en la principal |
| R1 | Gancho `commit-msg` que pide `Siguiente:` | Dos commits de subagentes (instantáneas) salieron sin él |
| R2 | `escenario.sh guardar` valida la descripción | `t16-reino` y `t20-mundo` llevaban el id de la partida en el índice |
| R3 | `matriz-pruebas.py --comprobar` señala «jugado» con prueba «parcial» | CR-9 y otras seis pasaron a «jugado» con el texto viejo e inflaban el recuento |
| R4 | Reabrir solo si el arreglo no funciona; otro fallo, fila nueva | P293 se reabrió con otro fallo; la revisión lo partió en P319 |
| R5 | `*.kate-swp` en `.gitignore` | El temporal de Kate se coló en un `git add docs/` |

## Skills

- `/code-review` del diff previo encontró lo que las tandas no vieron (índice roto, P293 mezclado, matriz inflada);
  el de los commits de la retro, que el pre-push no explicaba la prueba parcial y que el test del gancho dependía del
  repo real. Sin cambios en la skill.
- `orchestrate-dealer`: tandas dentro del tope de ~60 llamadas salvo la 18 (69). Sin cambios.
- `opt-tokens`: `medir.py` sirvió; el mayor gasto de la principal salía del `CLAUDE.md`, no de una herramienta (T2).
