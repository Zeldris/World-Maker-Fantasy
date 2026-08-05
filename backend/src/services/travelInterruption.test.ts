import { describe, it, expect, vi } from 'vitest';
import type { AttributeBlock } from './dice.js';
import type { TravelResolution } from './travel.js';

// Mismo patrón que npcScene.test.ts/travel.test.ts: `vi.fn()` a nivel de módulo + `vi.mock` +
// import dinámico DESPUÉS del mock, para las funciones que tocan prisma.
const npcFindMany = vi.fn();
const worldPopulationFindMany = vi.fn();
const locationFindMany = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    npc: { findMany: (...args: unknown[]) => npcFindMany(...args) },
    worldPopulation: { findMany: (...args: unknown[]) => worldPopulationFindMany(...args) },
    location: { findMany: (...args: unknown[]) => locationFindMany(...args) },
  },
}));

const { truncateTravelResolution, pickTravelInterruption } = await import('./travelInterruption.js');

const ATTRS: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

// Ruta de 4 nodos / 3 tramos, mismo shape que devuelve resolveTravelPath (travel.ts) — A es el
// origen, D el destino final, B y C los dos nodos intermedios.
const TRAVEL: TravelResolution = {
  toLocationId: 'loc-d',
  toLocationName: 'Zona D',
  pathIds: ['loc-a', 'loc-b', 'loc-c', 'loc-d'],
  path: ['zona-a', 'zona-b', 'zona-c', 'zona-d'],
  pathNames: ['Zona A', 'Zona B', 'Zona C', 'Zona D'],
  segments: [
    { fromName: 'Zona A', toName: 'Zona B', terreno: 'llano', minutosBase: 100 },
    { fromName: 'Zona B', toName: 'Zona C', terreno: 'llano', minutosBase: 200 },
    { fromName: 'Zona C', toName: 'Zona D', terreno: 'llano', minutosBase: 300 },
  ],
  baseMinutos: 600,
  minutos: 600,
  banda: 'larga',
};

describe('truncateTravelResolution', () => {
  it('recorta hasta el nodo intermedio indicado, recalculando minutos sobre lo acumulado hasta ahí', () => {
    const truncated = truncateTravelResolution(TRAVEL, 2, ATTRS);
    expect(truncated.toLocationId).toBe('loc-c');
    expect(truncated.toLocationName).toBe('Zona C');
    expect(truncated.pathIds).toEqual(['loc-a', 'loc-b', 'loc-c']);
    expect(truncated.path).toEqual(['zona-a', 'zona-b', 'zona-c']);
    expect(truncated.pathNames).toEqual(['Zona A', 'Zona B', 'Zona C']);
    expect(truncated.segments).toHaveLength(2);
    expect(truncated.baseMinutos).toBe(300); // 100 + 200, NO los 600 del viaje completo
    expect(truncated.minutos).toBe(200); // minutosConDestreza(300, destreza 10) = 300/(1+10/20) = 200
    expect(truncated.banda).toBe('extendida'); // 200 min < 1440
  });

  it('recorta en el primer nodo intermedio (índice 1) sin arrastrar ningún tramo', () => {
    const truncated = truncateTravelResolution(TRAVEL, 1, ATTRS);
    expect(truncated.toLocationId).toBe('loc-b');
    expect(truncated.segments).toHaveLength(1);
    expect(truncated.baseMinutos).toBe(100);
  });
});

describe('pickTravelInterruption', () => {
  it('sin nodos intermedios (viaje de un solo tramo), nunca interrumpe — ni siquiera consulta la DB', async () => {
    const oneHop: TravelResolution = { ...TRAVEL, pathIds: ['loc-a', 'loc-d'], segments: [TRAVEL.segments[0]] };
    const result = await pickTravelInterruption('world-1', oneHop, 1, ATTRS);
    expect(result).toBeNull();
    expect(npcFindMany).not.toHaveBeenCalled();
  });

  it('probabilidad 0, nunca interrumpe aunque haya candidatos válidos', async () => {
    npcFindMany.mockResolvedValue([{ id: 'npc-1', slug: 'guerrero-orco-rezagado', name: 'Guerrero orco rezagado', role: 'Guerrero' }]);
    worldPopulationFindMany.mockResolvedValue([]);
    locationFindMany.mockResolvedValue([
      { id: 'loc-b', region: 'Las Llanuras del Viento Rojo' },
      { id: 'loc-c', region: 'Las Llanuras del Viento Rojo' },
    ]);
    const result = await pickTravelInterruption('world-1', TRAVEL, 0, ATTRS);
    expect(result).toBeNull();
  });

  it('probabilidad 1 con candidato válido en el primer nodo intermedio, corta ahí sin mirar el resto', async () => {
    npcFindMany.mockResolvedValue([{ id: 'npc-1', slug: 'guerrero-orco-rezagado', name: 'Guerrero orco rezagado', role: 'Guerrero' }]);
    worldPopulationFindMany.mockResolvedValue([
      {
        targetSlug: 'guerrero-orco-rezagado',
        poblacion: 50,
        distribucion: { 'Las Llanuras del Viento Rojo': 1 },
      },
    ]);
    locationFindMany.mockResolvedValue([
      { id: 'loc-b', region: 'Las Llanuras del Viento Rojo' },
      { id: 'loc-c', region: 'Las Llanuras del Viento Rojo' },
    ]);

    const result = await pickTravelInterruption('world-1', TRAVEL, 1, ATTRS);
    expect(result).not.toBeNull();
    expect(result?.npcId).toBe('npc-1');
    expect(result?.npcSlug).toBe('guerrero-orco-rezagado');
    // Cortó en el primer nodo intermedio (loc-b, índice 1) — el destino truncado NO es el destino
    // original (loc-d), y el viaje solo lleva el primer tramo.
    expect(result?.travel.toLocationId).toBe('loc-b');
    expect(result?.travel.segments).toHaveLength(1);
  });

  it('un candidato SIN fila de WorldPopulation (mercader, peregrino...) puede salir elegido con peso 1 por defecto', async () => {
    npcFindMany.mockResolvedValue([{ id: 'npc-mercader', slug: 'mercader-de-paso', name: 'Mercader de paso', role: 'Comerciante itinerante' }]);
    worldPopulationFindMany.mockResolvedValue([]); // sin ninguna fila de población para nadie
    locationFindMany.mockResolvedValue([
      { id: 'loc-b', region: 'Las Llanuras del Viento Rojo' },
      { id: 'loc-c', region: 'Las Llanuras del Viento Rojo' },
    ]);

    const result = await pickTravelInterruption('world-1', TRAVEL, 1, ATTRS);
    expect(result?.npcSlug).toBe('mercader-de-paso');
  });

  it('región sin ningún candidato válido sigue probando el siguiente nodo intermedio', async () => {
    npcFindMany.mockResolvedValue([{ id: 'npc-1', slug: 'guerrero-orco-rezagado', name: 'Guerrero orco rezagado', role: 'Guerrero' }]);
    // Sin peso de región para "loc-b" (Cristal Helado, no Llanuras) — el primer nodo no ofrece
    // nada; el segundo (loc-c, Llanuras) sí.
    worldPopulationFindMany.mockResolvedValue([
      {
        targetSlug: 'guerrero-orco-rezagado',
        poblacion: 50,
        distribucion: { 'Las Llanuras del Viento Rojo': 1 },
      },
    ]);
    locationFindMany.mockResolvedValue([
      { id: 'loc-b', region: 'Cristal Helado' },
      { id: 'loc-c', region: 'Las Llanuras del Viento Rojo' },
    ]);

    const result = await pickTravelInterruption('world-1', TRAVEL, 1, ATTRS);
    expect(result?.travel.toLocationId).toBe('loc-c');
  });

  it('sin ningún candidato itinerante en el mundo, nunca interrumpe', async () => {
    npcFindMany.mockResolvedValue([]);
    const result = await pickTravelInterruption('world-1', TRAVEL, 1, ATTRS);
    expect(result).toBeNull();
  });
});
