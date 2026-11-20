**Título:** Ronda local 2 (Deck, Ollama real): guardas de combate, lore en la réplica del NPC, registro de IA y vigilante de memoria (QA-353…QA-519)

## Summary

Ocho tandas jugadas en la Deck con el narrador local (L1-L8), los arreglos que salieron y dos `/gw-opt-ai`.

```diff
 turno (turnResolution.ts)
   clasificar
     npcScene: nombre de pila de un PRINCIPAL conocido lo mete en escena        (QA-516, P479, P482)
   narrar (narrador.ts)
+    combate: lo que cambia entre rondas, al final de los hechos                 (QA-509)
     guardas de golpe falso / objeto sin camino
-      saltaban con «pero… esquiva», escudo, «no consigue», impacto sin daño
+      cuentan la oración entera                                                 (QA-505, QA-512, QA-517)
+    defensa sin acierto: el rival sigue en pie                                  (QA-508)
   dialogo_npc
+    lore de la entidad nombrada, visto desde el NPC, sin secretos               (QA-518)
 retrieval.ts
+  «los Maktor» → «Clan Maktor» (palabra propia del título)                      (QA-513)
 iaRegistro.ts
+  vía, interlocutor y línea del corte del prefijo de cada turno                 (QA-510, QA-507)
 tools/
+  vigilante de memoria de la ronda; IA_CASOS junto a IA_REGISTRO               (QA-353, QA-519)
```

El recalentado del prefijo del narrador (`QA-514`) se probó con una tanda A/B y se quitó: con Ollama 0.34.2,
`dialogo_npc` no desaloja la caché.

Retro: [`retro-2026-11-20-ronda-local-2.md`](../../retro-2026-11-20-ronda-local-2.md). `gw-worker` versionado
(`.gitignore` lo dejaba fuera) y `QA-520`, barrido de `iaRegistro.ts`, al roadmap.

## Evidence

- **Antes:** tanda L1 con 4 caídas al respaldo por «golpe de otro bando» (P473); P479 sin el NPC en escena; la
  réplica de Ulkha sin el lore de lo nombrado.
  **Después:** tanda L5, 15 turnos de combate 1v1 con 0 rechazos de las guardas; L8, réplica con el lore de la
  entidad. Tests nuevos en `narrador.test.ts`, `narradorNpcReply.test.ts`, `turn.integration.test.ts`,
  `retrieval.test.ts`, `npcScene.test.ts`, `test_ia_ronda.py`.
- Revisiones de bloque (`QA-292`) con `Findings:` 3; fase 1 final, 0 hallazgos. CI de la rama en el PR.

## Merge Danger

**Door:** two-way. Sin migraciones; todo es código del narrador, guardas y herramientas de QA.

**Blast Radius:** narración. Una guarda más permisiva puede dejar pasar un golpe falso; se medirá en la próxima
ronda (P485, P491-P493 siguen abiertos para jugar con Ollama real).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
