import { describe, it, expect } from 'vitest';
import { primerosAuxiliosProfessionFor, startingProfessionsFor } from './startingProfessions.js';

/// Cobertura nueva (2026-08-12) — `primerosAuxiliosProfessionFor` no tenía ningún test pese a
/// depender de dos mapas (raza→token, región→token) MÁS una lista blanca de combos válidos
/// (`VALID_PRIMEROS_AUXILIOS_COMBOS`): un desliz en cualquiera de los tres deja a un personaje
/// jugable sin su oficio básico sin que nada lo avise. Los 9 combos de abajo son exactamente los
/// que documenta el comentario de cabecera de startingProfessions.ts.
const VALID_COMBOS: [string, string, string][] = [
  ['orcos', 'Las Llanuras del Viento Rojo', 'primeros-auxilios-orcos-llanuras'],
  ['orcos', 'Cristal Helado', 'primeros-auxilios-orcos-cristal'],
  ['orcos', 'Ciénaga Troncal', 'primeros-auxilios-orcos-cienaga'],
  ['nabieus', 'Ciénaga Troncal', 'primeros-auxilios-nabieus-cienaga'],
  ['nabieus', 'El Margen Silencioso', 'primeros-auxilios-nabieus-margen'],
  ['faerus', 'Las Llanuras del Viento Rojo', 'primeros-auxilios-faerus-llanuras'],
  ['faerus', 'El Margen Silencioso', 'primeros-auxilios-faerus-margen'],
  ['goirntes', 'El Margen Silencioso', 'primeros-auxilios-goirntes-margen'],
  ['goirntes', 'La Meseta del Orden', 'primeros-auxilios-goirntes-meseta'],
];

describe('primerosAuxiliosProfessionFor — combos raza+región válidos', () => {
  it.each(VALID_COMBOS)('%s + %s -> %s', (raza, region, expected) => {
    expect(primerosAuxiliosProfessionFor(raza, region)).toBe(expected);
  });
});

describe('primerosAuxiliosProfessionFor — casos sin oficio (null)', () => {
  it('raza sin ubicación conocida', () => {
    expect(primerosAuxiliosProfessionFor(null, 'Las Llanuras del Viento Rojo')).toBeNull();
  });

  it('región sin raza conocida', () => {
    expect(primerosAuxiliosProfessionFor('orcos', null)).toBeNull();
  });

  it('raza no mapeada (no implementada todavía)', () => {
    expect(primerosAuxiliosProfessionFor('humano', 'Las Llanuras del Viento Rojo')).toBeNull();
  });

  it('región no mapeada', () => {
    expect(primerosAuxiliosProfessionFor('orcos', 'Región Desconocida')).toBeNull();
  });

  it('combo raza+región conocido pero fuera de la lista blanca (orcos nunca vive en El Margen Silencioso)', () => {
    expect(primerosAuxiliosProfessionFor('orcos', 'El Margen Silencioso')).toBeNull();
  });
});

describe('startingProfessionsFor', () => {
  it('Gorhorn recibe su kit de superviviente del Clan Maktor más primeros auxilios', () => {
    const result = startingProfessionsFor('Gorhorn', 'orcos', 'Las Llanuras del Viento Rojo');
    expect(result).toContain('herrero-orcos-llanuras');
    expect(result).toContain('primeros-auxilios-orcos-llanuras');
  });

  it('otros personajes solo reciben primeros auxilios si su combo raza+región es válido', () => {
    expect(startingProfessionsFor('Otro Personaje', 'orcos', 'Las Llanuras del Viento Rojo')).toEqual(['primeros-auxilios-orcos-llanuras']);
  });

  it('otros personajes sin raza/región resuelta no reciben ningún oficio de serie', () => {
    expect(startingProfessionsFor('Otro Personaje', null, null)).toEqual([]);
  });
});
