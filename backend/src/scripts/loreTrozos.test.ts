import { describe, it, expect } from 'vitest';
import { trozosParaIndexar } from './loreTrozos.js';
import { loreChunks } from './loreChunks.js';

describe('trozosParaIndexar (QA-167)', () => {
  it('un texto corto queda en un solo trozo', () => {
    expect(trozosParaIndexar('Una frase. Otra frase.')).toEqual(['Una frase. Otra frase.']);
  });

  it('corta por frases sin pasar del tamaño, salvo una frase sola más larga', () => {
    const texto = 'Primera frase con algo. Segunda frase con más cosas. Tercera.';
    expect(trozosParaIndexar(texto, 30)).toEqual(['Primera frase con algo.', 'Segunda frase con más cosas.', 'Tercera.']);
    expect(trozosParaIndexar('Una frase demasiado larga para el tope.', 10)).toEqual(['Una frase demasiado larga para el tope.']);
  });

  it('no pierde texto de ningún fragmento del lore', () => {
    for (const { text } of loreChunks) {
      expect(trozosParaIndexar(text).join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' ').trim());
    }
  });

  it('solape (QA-330): repite las últimas frases del trozo anterior que caben, nunca el trozo entero', () => {
    const texto = 'Uno uno. Dos dos. Tres tres. Cuatro cuatro.';
    expect(trozosParaIndexar(texto, 20)).toEqual(['Uno uno. Dos dos.', 'Tres tres.', 'Cuatro cuatro.']);
    expect(trozosParaIndexar(texto, 20, 10)).toEqual(['Uno uno. Dos dos.', 'Dos dos. Tres tres.', 'Tres tres. Cuatro cuatro.']);
    expect(trozosParaIndexar(texto, 20, 9)).toEqual(['Uno uno. Dos dos.', 'Dos dos. Tres tres.', 'Cuatro cuatro.']);
    expect(trozosParaIndexar('Frase larga del todo. Otra.', 10, 9)).toEqual(['Frase larga del todo.', 'Otra.']);
  });

  it('con solape, cada trozo es un tramo seguido del fragmento y el último acaba donde el fragmento', () => {
    for (const { text } of loreChunks) {
      const plano = text.replace(/\s+/g, ' ').trim();
      const trozos = trozosParaIndexar(text, 400, 120).map((t) => t.replace(/\s+/g, ' '));
      expect(trozos.every((t) => plano.includes(t))).toBe(true);
      expect(plano.endsWith(trozos.at(-1)!)).toBe(true);
      expect(plano.startsWith(trozos[0])).toBe(true);
    }
  });
});

