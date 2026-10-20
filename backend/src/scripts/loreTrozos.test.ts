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
});
