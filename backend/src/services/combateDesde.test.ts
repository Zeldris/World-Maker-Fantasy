import { describe, expect, it } from 'vitest';
import { combateDesdeTras } from './combateDesde.js';

// P233: frontera del combate en curso.
describe('combateDesdeTras', () => {
  const antes = new Date('2026-10-20T10:00:00Z');
  const ahora = new Date('2026-10-20T11:00:00Z');
  it('se borra al vaciarse la lista', () => expect(combateDesdeTras(['orco'], [], antes, ahora)).toBeNull());
  it('empieza al pasar de vacía a llena', () => expect(combateDesdeTras([], ['orco'], null, ahora)).toBe(ahora));
  it('sigue igual si se suma un rival al mismo combate', () => expect(combateDesdeTras(['orco'], ['orco', 'lobo'], antes, ahora)).toBe(antes));
  it('empieza otra vez si cambian todos los rivales (emboscada tras otro combate)', () =>
    expect(combateDesdeTras(['orco'], ['bandido'], antes, ahora)).toBe(ahora));
  it('empieza si había rivales sin fecha (partida de antes de la migración)', () =>
    expect(combateDesdeTras(['orco'], ['orco'], null, ahora)).toBe(ahora));
});
