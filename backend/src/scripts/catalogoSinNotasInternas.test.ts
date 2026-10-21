import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// P35 (QA-27): las bios y condiciones del catálogo se ven tal cual en la Enciclopedia y en las
/// fichas de recurso. Las notas de diseño («fuera del núcleo jugable actual», «grafo v1»,
/// «pendiente: el motor…») van en comentarios, nunca dentro del texto.
const CAMPOS_VISIBLES = /^\s*(bio|description|condicion|personality|role):\s/;
const NOTAS_INTERNAS = /núcleo jugable|grafo v1|improvisársele números|pendiente:|\bel motor\b|sourceSlug/i;

describe('catálogo sin notas internas a la vista (P35)', () => {
  it('ningún campo visible de worldCatalog.ts lleva notas de diseño', () => {
    const texto = readFileSync(fileURLToPath(new URL('./worldCatalog.ts', import.meta.url)), 'utf8');
    const conNota = texto
      .split('\n')
      .map((linea, i) => ({ linea, n: i + 1 }))
      .filter(({ linea }) => CAMPOS_VISIBLES.test(linea) && NOTAS_INTERNAS.test(linea))
      .map(({ linea, n }) => `${n}: ${linea.trim().slice(0, 120)}`);
    expect(conNota).toEqual([]);
  });
});

/// P260: la ficha del orco enfurecido se ve en la Enciclopedia y en el tooltip de su chip desde el primer
/// turno; el encargo Goirnte y la muerte de Uhuld Koh son trama que la jugadora no sabe todavía.
describe('el catálogo no destripa secretos de trama (P260)', () => {
  it('ni el rol ni la bio del orco enfurecido cuentan lo de Uhuld Koh', async () => {
    const { npcs } = await import('./worldCatalog.js');
    const orco = npcs.find((n) => n.slug === 'orco-enfurecido-hondonada');
    expect(orco).toBeDefined();
    expect(`${orco!.role} ${orco!.bio}`).not.toMatch(/Uhuld|Goirnte|encargo/i);
  });
});
