import { describe, it, expect } from 'vitest';
import { detectsPostCombatInteraction } from './postCombatInteraction.js';

const npcsInScene = [
  { slug: 'orco-enfurecido-hondonada', name: 'Orco enfurecido', condicionFisica: 'CONVALECIENTE', saqueado: false },
  { slug: 'gistera-koh', name: 'Gistera Koh', condicionFisica: 'ILESO', saqueado: false },
];

describe('detectsPostCombatInteraction', () => {
  // Restringido a MUERTO (2026-08-30, rediseño de "Matar") — antes también disparaba para
  // CONVALECIENTE (cualquier verbo que lo nombrara). Con "Matar" convertido en un intercambio real
  // (turnResolution.ts § explicitTargetVivo), dejar que este atajo siga cortando el turno para un
  // CONVALECIENTE le robaría ese intercambio — solo un cadáver de verdad sigue siendo terminal.
  it('NO dispara para un NPC convaleciente en escena — ya no es un desenlace terminal', () => {
    expect(detectsPostCombatInteraction('Reviso al Orco enfurecido de cerca.', npcsInScene)).toBeNull();
  });

  it('no dispara para un NPC en escena pero sano (ILESO)', () => {
    expect(detectsPostCombatInteraction('Hablo con Gistera Koh.', npcsInScene)).toBeNull();
  });

  it('no dispara si el texto no nombra a nadie de la lista', () => {
    expect(detectsPostCombatInteraction('Exploro la zona con cuidado.', npcsInScene)).toBeNull();
  });

  it('detecta también un cadáver (MUERTO)', () => {
    const muerto = [{ slug: 'orco-enfurecido-hondonada', name: 'Orco enfurecido', condicionFisica: 'MUERTO', saqueado: true }];
    expect(detectsPostCombatInteraction('Examino el cuerpo del Orco enfurecido.', muerto)).toEqual({
      slug: 'orco-enfurecido-hondonada',
      name: 'Orco enfurecido',
      condicionFisica: 'MUERTO',
      saqueado: true,
    });
  });
});
