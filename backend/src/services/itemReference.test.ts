import { describe, it, expect } from 'vitest';
import { detectItemReference } from './itemReference.js';

describe('detectItemReference', () => {
  it('detecta un objeto de la lista curada que el personaje NO tiene', () => {
    const result = detectItemReference('Mirar el mapa', ['Hacha de guerra rota', 'Raciones de viaje (5 días)']);
    expect(result).toEqual({ noun: 'mapa', posee: false });
  });

  it('detecta que SÍ lo tiene si hay un InventoryItem con ese nombre', () => {
    const result = detectItemReference('Reviso mi cuchillo', ['Cuchillo de hielo sílice']);
    expect(result).toEqual({ noun: 'cuchillo', posee: true });
  });

  it('no dispara si no hay verbo de comprobación', () => {
    expect(detectItemReference('Camino hacia el mapa de las estrellas', [])).toBeNull();
  });

  it('no dispara con "busco" (reservado a harvest/npc/lugares, demasiado genérico)', () => {
    expect(detectItemReference('Busco un mapa entre mis cosas', [])).toBeNull();
  });

  it('no dispara con sustantivos fuera de la lista curada (evita falsos positivos tipo "mi pasado")', () => {
    expect(detectItemReference('Miro mi pasado con nostalgia', [])).toBeNull();
  });

  it('tolera una errata en un sustantivo de 5+ letras (roadmap 2026-07-20)', () => {
    // "cuchilo" en vez de "cuchillo" — ningún sustantivo curado matchea exacto con esta errata.
    const result = detectItemReference('Reviso mi cuchilo', []);
    expect(result).toEqual({ noun: 'cuchillo', posee: false });
  });
});
