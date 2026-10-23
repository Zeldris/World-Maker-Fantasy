# Retro del PR de las pruebas de Mundo vivo (2026-10-23)

Lo revisado: lo que entra con el PR a `main` desde `claude/pruebas-mundo-vivo` (`git log origin/main..HEAD`):

- las tandas 22-27 del [reparto](plan-comprobacion-mundo-vivo.md), jugadas en la Deck (10 pasadas con las repeticiones):
  Mundo vivo sin jugar de la matriz y arreglados sin comprobar ([hallazgos](pruebas-0.3-hallazgos.md)); nuevos P320-P330;
- lo preparado para poder jugarlas, con permiso de la usuaria: la montura de pruebas (`WMF_MONTURA_PRUEBAS`), los
  escenarios `mv-*`, el paso `preparar ganado:`, los arreglos de `o.sh pulsar`/`mover` y el Ollama simulado en
  `arrancar-juego.sh`;
- el `/code-review --max-findings all` previo y sus 4 arreglos (los 8 leves, en la bitácora).

También se revisan `opt-tokens`, `orchestrate-dealer` y `/code-review`.

**Estado (2026-10-23): la usuaria aprobó T1, T2, R1, R2 y R3.** Se aplican en la rama: T1 → `QA-216`, T2 → `QA-217`,
R1 → `QA-218`, R2 → `QA-219`, R3 → `QA-220`.

## Medida

`/opt-tokens` de la sesión: la principal hizo 112 llamadas, 11,5 M de entrada, contexto medio 103k (igual que el
2026-10-22), 1 compactación. Los 20 subagentes, 60 M (84 % de la entrada), casi todo `sonnet`, con ~37k de arranque.
Cuatro pasadas de juego (23, 24, 25 y parte de la 24b) cerraron casi nada porque el estado que pedía cada hallazgo no
estaba en el escenario: ~15 M, una cuarta parte de lo gastado por los subagentes.

## Propuestas

| # | Qué | Dónde | Por qué | Riesgo |
|---|---|---|---|---|
| T1 | **Preparar antes de jugar**: antes de repartir una tanda, la principal comprueba que el escenario de cada id da el estado que pide la fila (montura, lugar visitado, animal, convaleciente…); si falta, primero un subagente de preparar | línea de `orchestrate-dealer` en `AGENTS.md` y «Qué se prueba» del runbook de rondas | ~15 M de tandas que no cerraron nada | ninguno |
| T2 | `matriz-pruebas.py --comprobar` (o un check nuevo) falla si el plan de comprobación nombra un escenario sin `.dump` en `tools/qa/escenarios/` | `tools/qa/` + check | lo comprobable, a un script; la columna de escenario del plan es la base de T1 | ninguno |
| R1 | Arreglar en `o.sh` lo que cada tanda redescubría: `combate` que ataca al leer (separar `combate` de solo lectura), entradas de «Viajar» (`o.sh viajar-a <lugar>`), `puntos`/`interactuar` con el mapa cerrado o la tarjeta abierta (abrir o avisar), `captura` al scratchpad | `tools/playwright-e2e/mcp/`, `tools/qa/deck/o.sh` | 5 de 6 tandas gastaron llamadas en lo mismo (`fallos-herramientas.md`, tandas 23-27); una partida se perdió por un `combate` de lectura | medio: tocar el driver; con tests y una tanda corta de prueba |
| R2 | Tests de comportamiento para `pulsar.js`/`mover.js` (una página HTML de prueba con modal, leyenda y mapa) en vez de buscar trozos del código | `tools/qa/tests/` | el `/code-review` encontró el orden de pasadas de `pulsar` que los tests de texto no ven (hallazgo 11) | bajo; pide Playwright en el host |
| R3 | Paso `preparar convaleciente:<npc>` con las funciones del juego, y rehacer `mv-pozo-guchapo-conv` con él (hoy lleva un `NpcState` insertado a mano, contra `QA-151`) | `backend/src/scripts/prepararReino.ts` | P95 salió «sin ver» dos veces con ese escenario | bajo |

## Skills

- `/code-review` del diff previo encontró 12 (4 medios, en herramientas de pruebas); la revisión corta tras cada
  subagente no vio el orden de pasadas de `pulsar`. Sin cambios en la skill: es lo que cubre R2.
- `orchestrate-dealer`: tandas dentro del tope (51-64 llamadas) salvo la 24a (81) y la preparación de la ronda (79).
  Lo que falló fue repartir tandas sin el estado que pedían (T1).
- `opt-tokens`: `medir.py` sirvió; contexto medio de la principal estable (103k).

## For Galivelop-workflow

- `orchestrate-dealer`, regla de tandas manuales: «antes de repartir una tanda, comprueba que el estado de partida da
  la precondición de cada comprobación; si no, el primer trozo es prepararla». Es la versión general de T1.
