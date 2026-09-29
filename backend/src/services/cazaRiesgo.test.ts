import { describe, it, expect } from 'vitest';
import { riesgoDeCaza } from './cazaRiesgo.js';

const base = { nivelJugador: 1, destrezaJugador: 10, nombreGrupo: 'Gesgurio', nivelNpc: 1, destrezaNpc: 10, cantidad: 1 };

describe('riesgoDeCaza (F9-1, decisión de Álvaro, 2026-09-29)', () => {
  it('una presa sola de tu nivel y no más rápida: riesgo bajo, sin motivo', () => {
    expect(riesgoDeCaza(base)).toEqual({ riesgo: 'bajo', motivo: '' });
  });

  it('presa débil (mucho menor nivel) en grupo pequeño: bajo', () => {
    expect(riesgoDeCaza({ ...base, nivelJugador: 5, cantidad: 2 }).riesgo).toBe('bajo');
  });

  it('el caso real: 3 Gesgurio de nivel 2 más rápidos contra un nivel 1: mortal', () => {
    const r = riesgoDeCaza({ ...base, nivelNpc: 2, destrezaNpc: 14, cantidad: 3 });
    expect(r.riesgo).toBe('mortal');
    expect(r.motivo).toContain('3 Gesgurio');
    expect(r.motivo).toContain('más rápidos');
  });

  it('un enemigo del doble de nivel: alto si no es más rápido, mortal si lo es', () => {
    expect(riesgoDeCaza({ ...base, nivelNpc: 2 }).riesgo).toBe('alto');
    expect(riesgoDeCaza({ ...base, nivelNpc: 2, destrezaNpc: 12 }).riesgo).toBe('mortal');
  });

  it('dos enemigos más rápidos ya son al menos alto aunque no superen tu nivel', () => {
    expect(riesgoDeCaza({ ...base, nivelJugador: 5, nivelNpc: 3, destrezaNpc: 11, cantidad: 2 }).riesgo).toBe('alto');
  });

  it('crece con el tamaño del grupo y baja al subir de nivel', () => {
    expect(riesgoDeCaza({ ...base, nivelJugador: 3, nivelNpc: 2, cantidad: 3 }).riesgo).toBe('alto');
    expect(riesgoDeCaza({ ...base, nivelJugador: 3, nivelNpc: 2, cantidad: 5 }).riesgo).toBe('mortal');
    expect(riesgoDeCaza({ ...base, nivelJugador: 12, nivelNpc: 2, cantidad: 3 }).riesgo).toBe('bajo');
  });

  it('entradas degeneradas (cantidad 0, nivel 0) no rompen', () => {
    expect(riesgoDeCaza({ ...base, cantidad: 0, nivelNpc: 0, nivelJugador: 0 }).riesgo).toBe('bajo');
  });
});
