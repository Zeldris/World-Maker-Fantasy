/// Slugs mecánicos de misiones especiales, en un módulo sin dependencias: `zonePoints.ts` los
/// necesita sin importar `routes/saves/quests.ts` (que arrastra `narrador.ts` y, por el ciclo
/// testigos → zonePoints → quests, rompía el `vi.mock` de narrador en los tests de integración).
export const ORCO_ENFURECIDO_QUEST_SLUG = 'orco-enfurecido-hondonada-gistera';
