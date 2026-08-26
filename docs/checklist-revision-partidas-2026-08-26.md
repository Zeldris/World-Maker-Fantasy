# Checklist — revisión de las dos partidas reales (2026-08-26)

Hallazgos de revisar las partidas `cms82odjc...` (pausada) y `cmt95ns3f...` (en curso), jugadas antes
de aplicar el checklist de las 3 auditorías del 2026-08-25. Detalle completo de cada uno en
`revisar-partida-hallazgos.md` § "2026-08-26 — revisión de las dos partidas reales tras el checklist
de las 3 auditorías".

- [x] 1. "Ataque Básico" pega el nombre del enemigo pegado a "...mano principal" — commit `d2aa600`
  (frontend, `useCombatFlow.ts` + test nuevo en `useCombatFlow.test.tsx`)
- [x] 2. Partida "Gorhorn" duplicada al crear personaje (React StrictMode monta el efecto dos veces)
  — commit `d2aa600` (frontend, `GameView.tsx`, `creatingSaveRef`)
- [x] 3. Combate real sin narración contra Quio — causa raíz CONFIRMADA y arreglada (commit
  pendiente): "Remato a X" dispara a la vez `detectsExecuteIntent` y `detectsAttackIntent`; el
  intercambio normal caía a `npcsInSceneVivos[0]` (cualquier bystander) porque el objetivo real ya
  estaba CONVALECIENTE. `combateActivo` ahora exige `executeTargets.length === 0`. Test de
  regresión en `turn.integration.test.ts`, verificado que reproduce el bug exacto sin el fix.
- [x] 4. Dos ejemplos nuevos de "errores gramaticales sueltos del modelo" ("lame", "cortejar la luz
  del sol") — solo documentados, mismo criterio que el resto de esa familia (sin corrector genérico)

**No incluido aquí**: la petición de rediseñar CONVALECIENTE (capturar/matar/dejar vivir, ya no
victoria automática) — anotada en `docs/21-roadmap.md`, a desarrollar cuando se cierre este checklist.
