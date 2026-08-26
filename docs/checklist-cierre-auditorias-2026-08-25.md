# Checklist — cierre de hallazgos de las 3 auditorías (2026-08-25)

Consolidado de todo lo que quedó PENDIENTE en `revisar-partida-hallazgos.md` (código),
`deuda-tecnica-hallazgos.md` y `lore-hallazgos.md`, más las 2 decisiones de diseño ya tomadas con la
usuaria. Orden elegido: primero riesgo funcional real, luego guards de honestidad, luego
mantenibilidad backend/frontend, y al final la prosa de lore (menor riesgo). Cada item se marca aquí
Y en su hallazgo de origen al cerrarse (FIJADO), con commit propio y verificación completa
(`tsc -b` + tests) antes de pasar al siguiente.

## Bloque 1 — riesgo funcional real

- [x] 1. Combate múltiple: escalar atributos de NPC por nivel (`npcAttributesForLevel`, hoy en crudo) — commit `66fb663`, incluyó arreglar `companion.attributes` nunca poblado
- [x] 2. Condición de carrera: confirmar tameo (tope de compañeros / slot domador duplicado) — commit `6f99995`
- [x] 3. Condición de carrera: `cazar/confirmar` puede crear 2 `CombatEncounter` — commit `9bcab7b`
- [x] 4. Condición de carrera: `combat/flee` pisa `pendingCombatNpcSlugs` en paralelo — commit `475ef52` (de paso arregló la mitad del item 10: `endedAt` faltante en la respuesta de `session.ts`)
- [x] 5. `reclutablePct` enganchado a la tirada de persuasión (decidido: SÍ hace falta) — commit `a59f4e3`, aplicado también a `domesticablePct` (fauna, mismo bug simétrico)

## Bloque 2 — guards de honestidad narración-vs-mecánica

- [x] 6. Ampliar vocabulario: `hasFalseCombatHit`, `hasFalseDeathClaim`, `hasResurrectedDeadNpc`, `hasFalseUnconsciousNarration` — commit `ae32111`
- [x] 7. Guard nuevo: curación por descanso libre no puede prometer más de lo que da `healCeilingFor` — commit `fcd8246`
- [x] 8. Guard nuevo: entrega de objeto (`newItem`) narrada sin materializarse — commit `fcd8246`
- [x] 9. Guard nuevo: construcción rechazada — corregir también la prosa visible, no solo el estado — commit `fcd8246`

## Bloque 3 — deuda técnica backend

- [x] 10. Extraer helper `requireActiveSave` (guard de `endedAt` duplicado en 8+ archivos) + arreglar `session.ts` (falta `endedAt` en su respuesta 409) — commit `7104420` (helper llamado `rejectIfEnded`; la parte de `session.ts` ya se arregló en el commit `475ef52`, item 4)
- [x] 11. `companionCountsAgainstBuildingSlots`: conectar de verdad en `questResolution.ts`/`turnResolution.ts` o borrarla — commit `373747d` (borrada, ambos callers ya usan el filtro Prisma directo, correcto para esta regla)
- [x] 12. `ENERGY_RECOVER_*`: conectar a `classAbilities.ts` o borrar — commit `a7997b7` (borradas, los valores reales no siguen esa escala)
- [x] 13. `inventario.ts`/`habilidades.ts`: reducir los `findUnique` de `Save` redundantes — commit `92d9763` (inventario.ts 3→1; habilidades.ts revisado, sin redundancia real que consolidar)
- [x] 14. Tests: `advanceCompanionSurvival`/`advancePlayerSurvival`/`autoEquiparDesdeAlmacen` — commit `0a9d970`
- [x] 15. Tests de ruta para `companeros.ts` (11 endpoints, hoy sin ninguno) — commit `ca71d4f`

## Bloque 4 — deuda técnica frontend

- [x] 16. `GameView.tsx`: extraer estado de Reino (`useKingdomState`) y estado de modales de acción — commit `6303635`
- [x] 17. Tests para `useCombatFlow.ts` (585 líneas, el hook con más lógica de decisión, hoy sin ninguno) — commit `2da4bdd` (decisión de la usuaria: añadir @testing-library/react + jsdom de verdad, no solo extraer helpers)
- [x] 18. Unificar manejo de error de envío en los 6 modales de acción duplicados — commit `32b95a0` (cierra el Bloque 4, deuda técnica frontend)

## Bloque 5 — lore (actualizar prosa, bajo riesgo)

- [x] 19. `combate-multiple.md`: quitar banner "nada implementado" + corregir lo de `NpcState.groupSize` (se mantiene a propósito, no se retira) — commit `57d7042`
- [x] 20. `companeros-y-supervivencia.md`: quitar banner "nada implementado" + nota de excepción de inanición (tope en CONVALECIENTE, a propósito) — commit `5a38692`, incluyó también corregir reclutablePct/domesticablePct y el hueco de plantillas básicas
- [x] 21. `clases.md`: corregir tabla-resumen final (Guerrero/Cazador) + Rúnico/Convocador/Opresor — commit `f1bf8bb` (cierra el checklist entero, 22/22)
- [x] 22. Plantillas de equipo "básicas, no editables": implementar el seed real, o marcar explícitamente como diseño futuro no entregado en `companeros-y-supervivencia.md` — commit `5a38692` marcó el hueco; implementado de verdad el 2026-08-26 (seed en `reino/fundar` + guard de no-editable backend/frontend, ver commit siguiente)

**Ya resuelto, sin acción**: `Faction.description` de Helsig/Goshg se queda estática a propósito
(decisión de diseño confirmada 2026-08-25, ver `lore-hallazgos.md`).
