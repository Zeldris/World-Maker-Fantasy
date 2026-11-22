# 2026-11-19 · gw-orchestrate-dealer · pending · QA-505

## Why

2 de 7 rechazos de P481 anticipaban el golpe; 3 de 5 usaban «impacto» sin daño.

## Alternatives

Quitar `impact[oó]` de la regex: perdía «el impacto le parte…».

## Changed because

`stripImpactoSinDano` en `hasFalseCombatHit`: el sustantivo solo cuenta si el resto de la frase (sin lo negado) trae daño.
