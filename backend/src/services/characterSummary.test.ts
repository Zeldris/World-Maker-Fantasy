import { describe, it, expect } from 'vitest';
import { characterSummaryFor } from './characterSummary.js';
import type { AttributeBlock } from './dice.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — el resumen que
// recibe el Narrador en CADA turno (síncrono y diferido vía worldTick.ts), sin ningún test hasta
// ahora.

const SAVE = {
  characterName: 'Gorhorn',
  characterArchetype: 'Guerrero orco',
  characterOrigin: 'Llanuras del Viento Rojo.',
  characterMotivation: 'Restaurar el nombre del Clan Maktor.',
};

const ATTRS: AttributeBlock = { fuerza: 18, destreza: 9, constitucion: 14, inteligencia: 10, voluntad: 12, carisma: 8, magia: 8 };

describe('characterSummaryFor', () => {
  it('sin estadoPartida, devuelve solo el resumen base del personaje', () => {
    const result = characterSummaryFor(SAVE);
    expect(result).toBe('Gorhorn, Guerrero orco. Llanuras del Viento Rojo. Restaurar el nombre del Clan Maktor.');
  });

  it('con estadoPartida, añade la línea de estado mecánico con hora/ubicación/nivel/atributos/condición', () => {
    const result = characterSummaryFor(SAVE, {
      timeLabel: 'Día 1, 08:00',
      locationName: 'La Hondonada del Eco',
      region: 'Las Llanuras del Viento Rojo',
      level: 3,
      attributes: ATTRS,
      condicionFisica: 'ILESO',
    });
    expect(result).toContain('Día 1, 08:00');
    expect(result).toContain('Ubicación: La Hondonada del Eco (Las Llanuras del Viento Rojo)');
    expect(result).toContain('Nivel 3');
    expect(result).toContain('fuerza 18');
    expect(result).toContain('destreza 9');
    expect(result).toContain('ileso');
  });

  it('sin ubicación resuelta todavía, lo dice explícitamente en vez de dejarlo vacío', () => {
    const result = characterSummaryFor(SAVE, {
      timeLabel: 'Día 1, 08:00',
      locationName: null,
      region: null,
      level: 1,
      attributes: ATTRS,
      condicionFisica: 'ILESO',
    });
    expect(result).toContain('Ubicación: sin resolver todavía');
  });

  it('sin región, no añade el paréntesis de región vacío', () => {
    const result = characterSummaryFor(SAVE, {
      timeLabel: 'Día 1, 08:00',
      locationName: 'La Hondonada del Eco',
      region: null,
      level: 1,
      attributes: ATTRS,
      condicionFisica: 'ILESO',
    });
    expect(result).toContain('Ubicación: La Hondonada del Eco.');
    expect(result).not.toContain('()');
  });

  // Clima/estación al narrador (2026-08-27, dinamismo del mundo § Pieza 1) — "ni siquiera llegan a
  // la narración" era el hueco real, ver auditoría.
  it('sin entorno, no añade ninguna frase de estación/clima', () => {
    const result = characterSummaryFor(SAVE, {
      timeLabel: 'Día 1, 08:00',
      locationName: 'La Hondonada del Eco',
      region: 'Las Llanuras del Viento Rojo',
      level: 3,
      attributes: ATTRS,
      condicionFisica: 'ILESO',
    });
    expect(result).not.toContain('Estación:');
    expect(result).not.toContain('Clima:');
  });

  it('con entorno y clima real, añade ambas frases', () => {
    const result = characterSummaryFor(SAVE, {
      timeLabel: 'Día 1, 08:00',
      locationName: 'La Hondonada del Eco',
      region: 'Las Llanuras del Viento Rojo',
      level: 3,
      attributes: ATTRS,
      condicionFisica: 'ILESO',
      entorno: { estacion: { key: 'PRIMAVERA', nombre: 'la estación de las crecidas' }, clima: { key: 'TORMENTA_GRANDE', nombre: 'la gran tormenta' } },
    });
    expect(result).toContain('Estación: la estación de las crecidas');
    expect(result).toContain('Clima: la gran tormenta');
  });

  it('con entorno pero sin clima real para la región, añade solo la estación', () => {
    const result = characterSummaryFor(SAVE, {
      timeLabel: 'Día 1, 08:00',
      locationName: 'La Hondonada del Eco',
      region: 'Las Llanuras del Viento Rojo',
      level: 3,
      attributes: ATTRS,
      condicionFisica: 'ILESO',
      entorno: { estacion: { key: 'PRIMAVERA', nombre: 'la estación de las crecidas' }, clima: null },
    });
    expect(result).toContain('Estación: la estación de las crecidas');
    expect(result).not.toContain('Clima:');
  });
});
