import { describe, it, expect } from 'vitest';
import { fauna, harvestSourceDescriptions, harvestSourceDisplayName, harvestYields, npcs } from './worldCatalog.js';

/// QA-240: la Enciclopedia saca el nombre y la descripción de una planta o un mineral de estos dos
/// diccionarios. Sin entrada, enseñaba el slug («musgo-callado») y una ficha vacía.
describe('flora y minerales con ficha en la Enciclopedia (QA-240)', () => {
  it('toda fuente de recolección sin NPC propio tiene nombre y descripción', () => {
    const conFicha = new Set([...npcs, ...fauna].map((n) => n.slug));
    const fuentes = [...new Set(harvestYields.map((y) => y.sourceSlug))].filter((s) => !conFicha.has(s));
    const sinFicha = fuentes.filter((s) => !harvestSourceDisplayName[s] || !harvestSourceDescriptions[s]);
    expect(sinFicha).toEqual([]);
  });
});

/// QA-240: la misma presa con dos filas de lo mismo daba la pieza dos veces y enseñaba dos condiciones.
describe('rendimientos de recolección sin repetir (QA-240)', () => {
  it('ninguna fuente da el mismo objeto dos veces por el mismo método', () => {
    const claves = harvestYields.map((y) => `${y.sourceSlug}|${y.metodoObtencion}|${y.itemSlug}`);
    expect(claves.filter((c, i) => claves.indexOf(c) !== i)).toEqual([]);
  });
});
