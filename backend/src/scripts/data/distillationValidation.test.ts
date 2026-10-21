import { describe, it, expect } from 'vitest';
import { validateSchema } from './distillationValidation.js';
import type { NarrationResult } from '../../services/narrador.js';

const base = { narration: 'Algo pasa.', newFacts: [] } as unknown as NarrationResult;

describe('validateSchema: questProgress (P240)', () => {
  it('admite COMPLETADA', () => {
    expect(validateSchema({ ...base, questProgress: { title: 'x', status: 'COMPLETADA' } }, {} as never)).toBeNull();
  });
  it('rechaza FALLIDA: el narrador solo completa', () => {
    const r = validateSchema({ ...base, questProgress: { title: 'x', status: 'FALLIDA' as 'COMPLETADA' } }, {} as never);
    expect(r).toMatch(/questProgress\.status/);
  });
});
