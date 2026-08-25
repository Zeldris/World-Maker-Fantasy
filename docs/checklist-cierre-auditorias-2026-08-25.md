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

- [ ] 6. Ampliar vocabulario: `hasFalseCombatHit`, `hasFalseDeathClaim`, `hasResurrectedDeadNpc`, `hasFalseUnconsciousNarration`
- [ ] 7. Guard nuevo: curación por descanso libre no puede prometer más de lo que da `healCeilingFor`
- [ ] 8. Guard nuevo: entrega de objeto (`newItem`) narrada sin materializarse
- [ ] 9. Guard nuevo: construcción rechazada — corregir también la prosa visible, no solo el estado

## Bloque 3 — deuda técnica backend

- [ ] 10. Extraer helper `requireActiveSave` (guard de `endedAt` duplicado en 8+ archivos) + arreglar `session.ts` (falta `endedAt` en su respuesta 409)
- [ ] 11. `companionCountsAgainstBuildingSlots`: conectar de verdad en `questResolution.ts`/`turnResolution.ts` o borrarla
- [ ] 12. `ENERGY_RECOVER_*`: conectar a `classAbilities.ts` o borrar
- [ ] 13. `inventario.ts`/`habilidades.ts`: reducir los `findUnique` de `Save` redundantes
- [ ] 14. Tests: `advanceCompanionSurvival`/`advancePlayerSurvival`/`autoEquiparDesdeAlmacen`
- [ ] 15. Tests de ruta para `companeros.ts` (11 endpoints, hoy sin ninguno)

## Bloque 4 — deuda técnica frontend

- [ ] 16. `GameView.tsx`: extraer estado de Reino (`useKingdomState`) y estado de modales de acción
- [ ] 17. Tests para `useCombatFlow.ts` (585 líneas, el hook con más lógica de decisión, hoy sin ninguno)
- [ ] 18. Unificar manejo de error de envío en los 6 modales de acción duplicados

## Bloque 5 — lore (actualizar prosa, bajo riesgo)

- [ ] 19. `combate-multiple.md`: quitar banner "nada implementado" + corregir lo de `NpcState.groupSize` (se mantiene a propósito, no se retira)
- [ ] 20. `companeros-y-supervivencia.md`: quitar banner "nada implementado" + nota de excepción de inanición (tope en CONVALECIENTE, a propósito)
- [ ] 21. `clases.md`: corregir tabla-resumen final (Guerrero/Cazador) + Rúnico/Convocador/Opresor
- [ ] 22. Plantillas de equipo "básicas, no editables": implementar el seed real, o marcar explícitamente como diseño futuro no entregado en `companeros-y-supervivencia.md`

**Ya resuelto, sin acción**: `Faction.description` de Helsig/Goshg se queda estática a propósito
(decisión de diseño confirmada 2026-08-25, ver `lore-hallazgos.md`).
