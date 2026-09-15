import { describe, it, expect } from 'vitest';
import { nombrePorIdiomaFor, type NombrePorIdioma } from './loreLanguages.js';

const KAROT_VEKU: NombrePorIdioma = {
  comun: 'el Salón de los Ancianos',
  orcos: 'Ketg\'lukar',
};

describe('nombrePorIdiomaFor', () => {
  it('devuelve el nombre propio del idioma de la raza cuando existe', () => {
    expect(nombrePorIdiomaFor(KAROT_VEKU, 'orcos')).toBe('Ketg\'lukar');
  });

  it('cae a la lengua común si la raza no tiene nombre propio para esta entrada', () => {
    expect(nombrePorIdiomaFor(KAROT_VEKU, 'goirntes')).toBe('el Salón de los Ancianos');
    expect(nombrePorIdiomaFor(KAROT_VEKU, 'nabieus')).toBe('el Salón de los Ancianos');
    expect(nombrePorIdiomaFor(KAROT_VEKU, 'faerus')).toBe('el Salón de los Ancianos');
  });

  it('cae a la lengua común con raza null/undefined (personaje fuera de Berig, o sin raza asignada)', () => {
    expect(nombrePorIdiomaFor(KAROT_VEKU, null)).toBe('el Salón de los Ancianos');
    expect(nombrePorIdiomaFor(KAROT_VEKU, undefined)).toBe('el Salón de los Ancianos');
  });

  it('cae a la lengua común con un string de raza desconocido (dato corrupto/futuro no soportado)', () => {
    expect(nombrePorIdiomaFor(KAROT_VEKU, 'humanos')).toBe('el Salón de los Ancianos');
  });

  it('cada raza puede tener su propio nombre, sin depender de que las demás lo tengan', () => {
    const entry: NombrePorIdioma = { comun: 'genérico', goirntes: 'Goirnte only' };
    expect(nombrePorIdiomaFor(entry, 'goirntes')).toBe('Goirnte only');
    expect(nombrePorIdiomaFor(entry, 'orcos')).toBe('genérico');
  });
});
