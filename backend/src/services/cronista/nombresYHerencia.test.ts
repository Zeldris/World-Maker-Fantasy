import { describe, it, expect } from 'vitest';
import { generarNombre, nombreValido } from './nombres.js';
import { atributoMasAlto, atributosSinPadres, heredarAtributos, ATRIBUTO_MAX } from './herencia.js';

/// Azar reproducible (mulberry32).
function semilla(n: number): () => number {
  let a = n;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// CR-13 paso 13a (hito 0.2) — generador de nombres por pueblo y herencia de los padres.
describe('generador de nombres (CR-13)', () => {
  it('determinista con la misma semilla; distinto con otra', () => {
    expect(generarNombre('orcos', 'F', semilla(1))).toBe(generarNombre('orcos', 'F', semilla(1)));
    const varios = new Set(Array.from({ length: 20 }, (_, i) => generarNombre('orcos', 'M', semilla(i))));
    expect(varios.size).toBeGreaterThan(15);
  });

  it('cada pueblo con su forma: faerus sin apellido; nabieus y goirntes con nombre y apellido', () => {
    for (let i = 0; i < 30; i++) {
      expect(generarNombre('faerus', 'F', semilla(i)).split(' ')).toHaveLength(1);
      expect(generarNombre('nabieus', 'M', semilla(i)).split(' ')).toHaveLength(2);
      expect(generarNombre('goirntes', 'F', semilla(i)).split(' ')).toHaveLength(2);
    }
  });

  it('las orcas acaban en vocal y los orcos en consonante (el nombre, sin apellido)', () => {
    for (let i = 0; i < 30; i++) {
      expect(generarNombre('orcos', 'F', semilla(i)).split(' ')[0]).toMatch(/a$/);
      expect(generarNombre('orcos', 'M', semilla(i)).split(' ')[0]).toMatch(/[^aeiou]$/);
    }
  });

  it('nunca repite uno usado, y cada palabra mide 3-12 letras', () => {
    const usados = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const n = generarNombre('orcos', i % 2 ? 'M' : 'F', semilla(7 + i), usados);
      expect(nombreValido(n, usados)).toBe(true);
      usados.add(n.toLowerCase());
    }
    expect(usados.size).toBe(200);
  });

  it('con un azar que siempre repite, sigue dando nombres nuevos (ordinal)', () => {
    const usados = new Set<string>();
    for (let i = 0; i < 5; i++) usados.add(generarNombre('orcos', 'M', () => 0.3, usados).toLowerCase());
    expect(usados.size).toBe(5);
  });
});

describe('herencia de los padres (CR-13)', () => {
  const doshka = { magia: 0, fuerza: 13, carisma: 16, destreza: 12, voluntad: 18, constitucion: 17, inteligencia: 15 };
  const dulgren = { magia: 0, fuerza: 18, carisma: 11, destreza: 15, voluntad: 14, constitucion: 18, inteligencia: 10 };

  it('cada atributo cerca de la media de los padres (±2, más la huella), y la magia de un pueblo sin ella sigue en 0', () => {
    for (let i = 0; i < 50; i++) {
      const { atributos } = heredarAtributos(dulgren, doshka, semilla(i));
      expect(atributos.magia).toBe(0);
      for (const k of Object.keys(doshka)) {
        if (k === 'magia') continue;
        const media = Math.round((dulgren[k as keyof typeof dulgren] + doshka[k as keyof typeof doshka]) / 2);
        expect(atributos[k]).toBeGreaterThanOrEqual(media - 2);
        expect(atributos[k]).toBeLessThanOrEqual(ATRIBUTO_MAX);
      }
    }
  });

  it('la huella: el atributo más alto de un progenitor pasa al menos como el suyo +1', () => {
    expect(atributoMasAlto(doshka)).toBe('voluntad');
    expect(atributoMasAlto(dulgren)).toBe('constitucion');
    // random() = 0: variación −2 en todo y las dos huellas pasan.
    const { atributos, huellas } = heredarAtributos(dulgren, doshka, () => 0);
    expect(huellas).toEqual([{ atributo: 'constitucion', de: 'padre' }, { atributo: 'voluntad', de: 'madre' }]);
    expect(atributos.constitucion).toBe(19);
    expect(atributos.voluntad).toBe(19);
    expect(atributos.fuerza).toBe(14); // media 16 (15,5 redondeado) − 2
    // random() casi 1: sin huellas.
    expect(heredarAtributos(dulgren, doshka, () => 0.99).huellas).toEqual([]);
  });

  it('sin padres: los de alguien de su raza ±1', () => {
    const a = atributosSinPadres(doshka, semilla(3));
    for (const k of Object.keys(doshka)) expect(Math.abs(a[k]! - doshka[k as keyof typeof doshka])).toBeLessThanOrEqual(1);
    expect(a.magia).toBe(0);
  });
});
