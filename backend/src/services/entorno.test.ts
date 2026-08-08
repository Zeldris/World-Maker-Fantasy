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

  // Bug real jugando en vivo (revisión de partida 2026-08-08): con solo 2 frases por franja y sin
  // memoria de la última mostrada, repetir 3 de cada 4 veces era simplemente lo esperable
  // estadísticamente — "El sol de la mañana pega bajo y de lado..." salió así en la misma sesión.
  it('reintenta si la tirada repite literalmente la descripción anterior, y sí la deja repetir si es la única posible', () => {
    const first = generateSurroundings({ region: 'Las Llanuras del Viento Rojo', timeLabel: 'Día 1, 09:30' }, () => 0);

    let calls = 0;
    const randomQueReintenta = () => {
      calls++;
      // Primer intento: mismos valores que `first` (0), para simular que el azar "quiso" repetir
      // — el propio `generateSurroundings` debe notar la coincidencia y volver a tirar con un
      // valor distinto en el segundo intento.
      return calls <= 4 ? 0 : 0.9;
    };
    const second = generateSurroundings(
      { region: 'Las Llanuras del Viento Rojo', timeLabel: 'Día 1, 09:30' },
      randomQueReintenta,
      first.description,
    );
    expect(second.description).not.toBe(first.description);

    // Sin alternativa real (banca de una sola frase), nunca debe bucle infinito ni fallar — se
    // acepta la única frase posible aunque coincida con la anterior.
    const soloUnaFrase = generateSurroundings({ region: null, timeLabel: 'Día 1, 09:30' }, () => 0);
    const repetida = generateSurroundings({ region: null, timeLabel: 'Día 1, 09:30' }, () => 0, soloUnaFrase.description);
    expect(repetida.description).toBe(soloUnaFrase.description);
  });
});
