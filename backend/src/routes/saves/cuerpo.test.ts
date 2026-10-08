import { describe, it, expect } from 'vitest';
import { idsDelCuerpo } from './cuerpo.js';

/// QA-22: listas de ids del cuerpo de una petición.
describe('idsDelCuerpo (QA-22)', () => {
  it('solo cadenas, sin repetidos; lo que no es lista, vacío', () => {
    expect(idsDelCuerpo(['a', 'a', 3, 'b'])).toEqual(['a', 'b']);
    expect(idsDelCuerpo('a')).toEqual([]);
    expect(idsDelCuerpo(undefined)).toEqual([]);
  });
});
