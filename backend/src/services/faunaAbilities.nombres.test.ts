import { describe, it, expect } from 'vitest';
import { faunaCategoriaAbilitiesForLevel } from './faunaAbilities.js';

/// P12 (QA-27): las habilidades de la familia Escamados (reptiles y anfibios) las usa también un
/// sapo, y una defensa que solo aguanta el golpe (AGUANTE) no puede llamarse «huida».
describe('P12 — nombres de las habilidades de Escamados', () => {
  const habilidades = faunaCategoriaAbilitiesForLevel('ESCAMADOS', 40);

  it('ninguna promete escamas a un anfibio', () => {
    for (const h of habilidades) expect(h.name).not.toMatch(/escama/i);
  });

  it('ninguna que solo aguanta el golpe promete una huida', () => {
    for (const h of habilidades.filter((x) => x.effects?.length === 1 && x.effects[0] === 'AGUANTE')) {
      expect(h.name).not.toMatch(/huida|huye|escapa/i);
    }
  });
});
