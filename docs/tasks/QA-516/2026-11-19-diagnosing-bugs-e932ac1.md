# 2026-11-19 · diagnosing-bugs · pending · QA-516

## Why

El arreglo de P479 (17-11) solo casaba el nombre de pila de quien tenía `NpcState`, pero hablar no lo crea: en el
dump `t13b2-ketg` (restaurado en una base aparte) Ulkha y Torgash están en `DiscoveredEntity` y sin `NpcState`. Sin
Ulkha en escena, `elegirInterlocutor` cae en el primero (Torgash, P482) y `npcInterpelado` falla (P479, al narrador).

## Alternatives

- Crear `NpcState` al hablar: cambia qué cuenta como «encontrado» en muchos sitios (candidatos, combate); más riesgo.
- Que el vocativo elija interlocutor fuera de la escena: no arregla la escena y saltaría el filtro de presencia.

## Changed because

Primera versión.
