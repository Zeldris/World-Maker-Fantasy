import { describe, it, expect } from 'vitest';
import { whisperText } from './death.js';
import { questRewardNarrationFor } from './questResolution.js';

/// P57 (QA-27): los textos fijos que lee la jugadora usan « », no comillas rectas.
describe('P57 — comillas del diario', () => {
  it('el susurro de la Entidad', () => {
    const t = whisperText('Gorhorn', false);
    expect(t).toContain('«Aún no ha llegado tu momento…»');
    expect(t).not.toContain('"');
  });

  it('la misión completada', () => {
    const t = questRewardNarrationFor('Acabar con el Orco Enfurecido', [], 100);
    expect(t).toMatch(/^Misión completada: «Acabar con el Orco Enfurecido»/);
    expect(t).not.toContain('"');
  });
});
