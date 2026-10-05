import { describe, it, expect } from 'vitest';
import { items, harvestYields, harvestSourceAliases, npcs, fauna } from './worldCatalog.js';
import { levenshtein, normalizeText } from '../services/travel.js';
import { matchNpcAliases } from '../services/npcScene.js';

/// Renombrado del árbol "Bolco" a "Holdo" (decisión de Álvaro, 2026-09-29). Bolco chocaba con el
/// caracol "Bulco de Arena" (Levenshtein 1), por eso estaba en NPC_ALIAS_FUZZY_EXCLUSIONS; "holdo"
/// no choca con ningún alias/nombre del catálogo y la exclusión se retiró.
describe('Holdo (antes Bolco)', () => {
  it('el catálogo ya no menciona "bolco" y el árbol/resina usan "holdo"', () => {
    expect(JSON.stringify({ items, harvestYields, harvestSourceAliases })).not.toMatch(/bolco/i);
    expect(items.some((i) => i.slug === 'resina-holdo' && i.name === 'Resina de Holdo')).toBe(true);
    expect(harvestYields.some((y) => y.sourceSlug === 'holdo' && y.itemSlug === 'resina-holdo')).toBe(true);
  });

  it('CR-43: el caracol Bulco de Arena pasa a llamarse Rugoconcha', () => {
    expect(JSON.stringify({ items, harvestYields, fauna })).not.toMatch(/bulco/i);
    expect(items.some((i) => i.slug === 'rugoconcha-marisco')).toBe(true);
    expect(fauna.some((f) => f.slug === 'rugoconcha' && f.aliases.includes('rugoconcha'))).toBe(true);
  });

  it('ninguna palabra del catálogo con la misma inicial está a Levenshtein ≤2 de "rugoconcha"', () => {
    const textos: string[] = [];
    for (const n of [...npcs, ...fauna]) textos.push(n.name, ...(n.aliases ?? []));
    for (const i of items) textos.push(i.name, ...(i.aliases ?? []));
    const palabras = new Set(textos.flatMap((t) => normalizeText(t).split(/[^\p{L}]+/u)).filter((w) => w.startsWith('r')));
    palabras.delete('rugoconcha');
    expect([...palabras].filter((w) => levenshtein('rugoconcha', w) <= 2)).toEqual([]);
  });

  it('ninguna palabra de alias/nombre del catálogo está a Levenshtein ≤1 de "holdo"', () => {
    const textos: string[] = [];
    for (const n of [...npcs, ...fauna]) textos.push(n.name, ...(n.aliases ?? []));
    for (const i of items) textos.push(i.name, ...(i.aliases ?? []));
    for (const lista of Object.values(harvestSourceAliases)) textos.push(...lista);
    const palabras = new Set(textos.flatMap((t) => normalizeText(t).split(/[^\p{L}]+/u)).filter((w) => w.length >= 4));
    palabras.delete('holdo');
    const choques = [...palabras].filter((w) => levenshtein('holdo', w) <= 1);
    expect(choques).toEqual([]);
  });

  it('sin exclusiones, ni "busco" ni la resina de holdo cuelan a la Rugoconcha', () => {
    const NPCS = [{ id: 'rugoconcha', aliases: ['rugoconcha', 'caracol de mar'] }];
    expect(matchNpcAliases('Busco presas para comer', NPCS)).toEqual([]);
    expect(matchNpcAliases('Busco una rugoconcha en la arena', NPCS)).toEqual(['rugoconcha']);
    expect(matchNpcAliases('Recojo resina de holdo en la marisma', NPCS)).toEqual([]);
  });
});
