import { describe, expect, it } from 'vitest';
import { FAUNA_SEXO_VARIANTES } from './sexDimorphism.js';

describe('sexDimorphism (P70)', () => {
  it('el Escorante macho dice «rojo arcilla», como su bio, no «arcillosos y rojos»', () => {
    const t = FAUNA_SEXO_VARIANTES.escorante.macho.rasgoFisico;
    expect(t).toContain('detalles rojo arcilla');
    expect(t).not.toContain('arcillosos');
  });
});
