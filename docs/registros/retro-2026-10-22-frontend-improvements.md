# Retro del PR de los arreglos de la puerta de pruebas (2026-10-22)

Lo revisado: lo que entra con el PR a `main` desde `claude/frontend-improvements-roadmap-0mpckt`
(`git log origin/main..HEAD`):

- los arreglos de la puerta de pruebas: reabiertos P27, P99, P158, P169; P70 (texto); P275-P303
  ([hallazgos](pruebas-0.3-hallazgos.md));
- el `/code-review --max-findings all` previo y sus arreglos (vasallaje, Casa de obras, rebelión, milicia solo de la
  Capital); lo leve quedó como pendiente en la fila compartida de la bitácora.

También se revisan `opt-tokens`, `orchestrate-dealer`, `selector` y `/code-review`.

**Estado (2026-10-22): la usuaria aprobó T1, T2, R1, R2, R4, R5 y R6; rechazó R3.** Aplicadas en la rama
(`orchestrate-dealer`): T1 → `QA-201`, T2 → `QA-202`, R1 → `QA-203`, R2 → `QA-204`. Al paso 3.4, sin implementar:
R4 → `QA-205` (test intermitente de cronista), R5 → `QA-206` (`fusionar.sh`), R6 → `QA-207` (`medir.py`).

## Medida

`/opt-tokens` de las últimas 24 h: la principal hizo 376 llamadas, 42 M de entrada, contexto medio 108k (suelo 84k,
techo 142k), 8 compactaciones. Los subagentes, 155 M (78 % de la entrada): 103 M con `opus` y 52 M con `sonnet`; cada
uno arranca con ~52k. Los más caros, implementaciones con `opus`: Casa de obras (28,7 M, 265 llamadas) y tanda G
(28,3 M).

## Propuestas

- **T1. Arreglos de una revisión con `sonnet`.** Los tres agentes de arreglos fueron con `opus` (7,4 M cada uno),
  aunque el `selector` ya pedía `sonnet` con el plan cerrado. Contrapeso: el revisor sigue en `opus`.
- **T2. La principal hace el arreglo de un archivo.** Los dos últimos arreglos (Ayuntamiento dañado, mejora con la
  base en la cola) costaron ~10 llamadas en la principal frente a 70-80 de un subagente.
- **R1. Antes del PR, solo lo grave.** Cada arreglo del `/code-review` se revisaba y traía más hallazgos; la usuaria
  notó que se acumulaban los cambios.
- **R2. El encargo comprueba la rama de partida.** Varios worktrees de agentes salieron de `main`.
- **R3. Recordar el castellano tras compactar.** Rechazada.
- **R4. Test intermitente de cronista** (`decisionesFaccion`/`deudaDeVida`) en la suite completa.
- **R5. `fusionar.sh`**: error de `getcwd` si se lanza dentro del worktree que borra; no avisa del bloqueo con el
  agente vivo.
- **R6. `medir.py`**: 382k de contexto medio de toda la sesión frente a ~110k de los tramos que enseña.
