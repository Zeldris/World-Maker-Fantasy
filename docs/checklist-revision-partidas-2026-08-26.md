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
  `081b340`): "Remato a X" dispara a la vez `detectsExecuteIntent` y `detectsAttackIntent`; el
  intercambio normal caía a `npcsInSceneVivos[0]` (cualquier bystander) porque el objetivo real ya
  estaba CONVALECIENTE. `combateActivo` ahora exige `executeTargets.length === 0`. Test de
  regresión en `turn.integration.test.ts`, verificado que reproduce el bug exacto sin el fix.
- [x] 4. Dos ejemplos nuevos de "errores gramaticales sueltos del modelo" ("lame", "cortejar la luz
  del sol") — solo documentados, mismo criterio que el resto de esa familia (sin corrector genérico)

## Cola vieja de `revisar-partida-hallazgos.md`, cerrada de paso en la misma pasada

- [x] 5. Caché de tirada de recolección (un slot por partida, no por oficio) — commit `e3ee484`.
  `Save.harvestRollCache` pasa a mapa `oficio → entrada`; `/confirmar` invalida solo lo tocado.
- [x] 6. Hallazgo desactualizado del 2026-08-21 (endedAt en inventario/progression/habilidades
  marcado "PENDIENTE") — commit `40976be`, solo corrección de documentación: ya estaba FIJADO por
  el checklist de las 3 auditorías (item 10, `rejectIfEnded`), el documento no se había actualizado.
- [x] 7. Ataque a Múrgol narrado como si fuera contra Cruzavientos (2026-08-14) — commit `6c3239c`.
  Guard nuevo `hasFalseCombatTargetName` (narrador.ts): rechaza la narración si no nombra al
  objetivo real del intercambio de este turno pero sí nombra a otro NPC presente en la escena.

## Lo que queda realmente pendiente fuera de este checklist

**`deuda-tecnica-hallazgos.md`** — 2 grupos "menores agrupados" (services/, routes/), prioridad baja
consciente, sin bug real detrás. No tocados.

**`revisar-partida-hallazgos.md`** — hallazgos de narración/gameplay reales sin arreglar (todos
necesitan reproducción en vivo con `logs/backend.log` — sin rastro persistido en base de datos que
confirme la causa raíz al 100%, arriesgar un fix sin esa evidencia es lo mismo que "arreglar a
ciegas" que se ha evitado durante toda esta sesión):
- Quio narrado en 3 ubicaciones distintas el mismo día (2026-08-23) — ligado a un pendiente de
  diseño ya aparcado explícitamente por la usuaria (anclar TODO el catálogo de fauna por zona).
- Cruzavientos ataca repetidamente y nunca se narra quién es (2026-08-23) — sin ningún NpcState/
  pendingNpcAttack persistido de Cruzavientos en la partida real; necesita reproducirse con log
  activo para saber si es solo narrativo o si el motor deja atacar a un NPC no anclado a la escena.
- Ruptidar "ataca" en combate pese a ser INOFENSIVO/"No ataca" (2026-08-23) — no está claro si es
  daño mecánico real o solo dramatización narrativa; necesita el mismo tipo de log.
- Ruptidar descrito como "insecto" con "alas rotas" (es un reptil sin alas) (2026-08-23) — la `bio`
  correcta ya existe en el catálogo, el modelo la ignoró; alucinación pura, no hay nada que
  corregir en datos. Primer caso de este subtipo, a vigilar si se repite.
- Posible reaparición de Gistera Koh sin nombrarla (2026-08-08) — un solo caso, sin patrón
  determinista barato sin riesgo de falsos positivos.
- Roca Luclara minable en Hondonada del Eco pese a `harvestSourceHomeLocationSlug` distinto
  (2026-08-25) — **pregunta de diseño para la usuaria** (¿debería bloquearse por ubicación, o el
  campo es solo lore sin efecto mecánico por diseño?), no un bug de código a secas.
- Capacidad de inventario por filas vs. por cantidad (2026-08-08) — pregunta de diseño, no bug.
- Familia "errores gramaticales/inglés colado del modelo" (~6 entradas, 2026-08-08 a 2026-08-26) —
  decisión ya tomada de NO construir un corrector genérico; se quedan solo como registro fechado.

**`docs/21-roadmap.md`** — 8 items sin marcar, todos feature/diseño (no bugs), varios aplazados a
propósito por decisión explícita de la usuaria:
- `comerciablePct`/`cortejablePct` — sin sistema detrás, confirmado que se quedan así por ahora.
- `Npc.levelMax`/`percepcionPasivaFor` — en cola, pendientes de diseño propio.
- "Trabajador de Reino" — bloquea 22 NPC del Campamento Serhu + oficio de agricultura.
- Quién enseña un oficio nuevo — aplazado a propósito, baja prioridad.
- Miel Lebude / profesión de cocina por raza-región — idea suelta, prioridad muy baja.
- Botones "Aceptar"/"Cancelar" al ofrecer misión (2026-08-25).
- NPCs que aparecen por narración no se marcan en la pestaña "Zona" (2026-08-25).
- **CONVALECIENTE deja de ser "victoria automática"** (capturar/matar/dejar vivir) — petición
  explícita de la usuaria (2026-08-26), aparcada a propósito hasta cerrar esta ronda de bugs.
