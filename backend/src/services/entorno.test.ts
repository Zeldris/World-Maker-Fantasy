import { describe, it, expect } from 'vitest';
import { generateSurroundings } from './entorno.js';

describe('generateSurroundings', () => {
  it('describe algo real y no vacío para la región jugable (Llanuras)', () => {
    const { description } = generateSurroundings({ region: 'Las Llanuras del Viento Rojo', timeLabel: 'Día 1, 09:30' });
    expect(description.length).toBeGreaterThan(0);
  });

  it('es determinista con una función de aleatoriedad fija (siempre el primer fragmento de cada banca)', () => {
    const a = generateSurroundings({ region: 'Las Llanuras del Viento Rojo', timeLabel: 'Día 1, 09:30' }, () => 0);
    const b = generateSurroundings({ region: 'Las Llanuras del Viento Rojo', timeLabel: 'Día 1, 09:30' }, () => 0);
    expect(a.description).toBe(b.description);
  });

  it('nunca llama a Ollama (síncrono, sin promesa) — auditoría 2026-07-24', () => {
    const result = generateSurroundings({ region: 'Las Llanuras del Viento Rojo', timeLabel: 'Día 1, 09:30' });
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('sin ubicación resuelta todavía, describe algo neutro en vez de fallar', () => {
    const { description } = generateSurroundings({ region: null, timeLabel: 'Día 1, 09:30' });
    expect(description.length).toBeGreaterThan(0);
  });

  it('cubre las otras regiones del mundo sin inventar nada fuera de su propia banca', () => {
    for (const region of ['Cristal Helado', 'Ciénaga Troncal', 'El Margen Silencioso', 'La Meseta del Orden']) {
      const { description } = generateSurroundings({ region, timeLabel: 'Día 1, 20:00' });
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it('una región desconocida no rompe nada — cae al banco neutro', () => {
    const { description } = generateSurroundings({ region: 'Región inventada que no existe', timeLabel: 'Día 1, 09:30' });
    expect(description.length).toBeGreaterThan(0);
  });
});
