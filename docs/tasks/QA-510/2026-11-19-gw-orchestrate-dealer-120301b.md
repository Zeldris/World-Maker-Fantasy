# 2026-11-19 · gw-orchestrate-dealer · pending · QA-510

## Why

Vía y NPC en el ámbito AsyncLocalStorage del turno (fijarViaTurnoIa) y no por parámetro: todas las llamadas del turno, también en segundo plano, lo heredan sin tocar firmas. La vía se fija en turnResolution.ts con la misma cadena que elige la narración.

## Alternatives

Pasar `via` por cada ollamaGenerate (invasivo); marcar solo la línea de narrar (no cubre dialogo_npc).

## Changed because

Sin cambios.
