import { describe, it, expect } from 'vitest';
import { enumerar, personajePuedeSaberlo, resumenBotin, textoAsalto, textoExpedicionDeVuelta, type NoticiaMundo } from './noticiasMundo.js';

/// Fase D del hito 0.1 — noticias del mundo deterministas y solo lo que el personaje podría saber.
describe('noticiasMundo — textos', () => {
  it('enumera en castellano', () => {
    expect(enumerar(['a'])).toBe('a');
    expect(enumerar(['a', 'b'])).toBe('a y b');
    expect(enumerar(['a', 'b', 'c'])).toBe('a, b y c');
  });

  it('agrupa el botín por nombre', () => {
    expect(resumenBotin([{ name: 'Liquen', cantidad: 2 }, { name: 'Cola de coracelo', cantidad: 1 }, { name: 'Liquen', cantidad: 1 }])).toBe('3 de Liquen y 1 de Cola de coracelo');
  });

  it('una expedición que vuelve sin botín no es noticia', () => {
    expect(textoExpedicionDeVuelta('Clan Helsig', 'Hondonada del Eco', [])).toBeNull();
    expect(textoExpedicionDeVuelta('Clan Helsig', 'Hondonada del Eco', [{ name: 'Liquen', cantidad: 2 }])).toBe('Los recolectores de Clan Helsig regresan de Hondonada del Eco con 2 de Liquen.');
  });

  it('asalto ganado por los atacantes, con bajas en los dos bandos', () => {
    expect(textoAsalto({ faccion: 'Clan Helsig', lugar: 'Paso Frío', hostil: 'Feg Ger', carga: 'perdida', muertesPropias: 2, muertesHostiles: 1 })).toBe(
      'Guerreros de Feg Ger asaltan a una expedición de Clan Helsig cerca de Paso Frío y se quedan con la carga. 2 de los guardias no vuelven. Uno de los asaltantes no vuelve.',
    );
  });

  it('asalto rechazado, sin escolta y carga abandonada', () => {
    expect(textoAsalto({ faccion: 'A', lugar: 'X', hostil: 'B', carga: 'salva', muertesPropias: 0, muertesHostiles: 0 })).toBe('Los guardias de A rechazan un asalto de B cerca de X.');
    expect(textoAsalto({ faccion: 'A', lugar: 'X', hostil: 'B', carga: 'perdida', motivo: 'sin-guardias', muertesPropias: 0, muertesHostiles: 0 })).toBe(
      'Gente de B sorprende a una expedición de A sin escolta cerca de X y se queda con su carga.',
    );
    expect(textoAsalto({ faccion: 'A', lugar: 'X', hostil: null, carga: 'perdida', motivo: 'sin-atacante', muertesPropias: 0, muertesHostiles: 0 })).toBe(
      'Una expedición de A abandona su carga cerca de X y vuelve con las manos vacías.',
    );
  });
});

describe('noticiasMundo — lo que el personaje puede saber', () => {
  const noticia: NoticiaMundo = { facciones: ['Clan Helsig', 'Feg Ger'], region: 'Cristal Helado', texto: 'x', dia: 3 };

  it('lo sabe si está en esa región', () => {
    expect(personajePuedeSaberlo({ region: 'Cristal Helado', faccionesConocidas: new Set() }, noticia)).toBe(true);
  });

  it('lo sabe si tiene reputación con alguna facción implicada', () => {
    expect(personajePuedeSaberlo({ region: 'Las Llanuras del Viento Rojo', faccionesConocidas: new Set(['Feg Ger']) }, noticia)).toBe(true);
  });

  it('no lo sabe si ni está allí ni conoce a nadie implicado', () => {
    expect(personajePuedeSaberlo({ region: 'Las Llanuras del Viento Rojo', faccionesConocidas: new Set(['Clan Serhu']) }, noticia)).toBe(false);
    expect(personajePuedeSaberlo({ region: null, faccionesConocidas: new Set() }, { ...noticia, region: null })).toBe(false);
  });
});
