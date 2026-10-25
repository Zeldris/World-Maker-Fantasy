import { describe, it, expect } from 'vitest';

/// P35 (QA-27): las bios y condiciones del catálogo se ven tal cual en la Enciclopedia y en las
/// fichas de recurso. Las notas de diseño («fuera del núcleo jugable actual», «grafo v1»,
/// «pendiente: el motor…») van en comentarios, nunca dentro del texto.
/// QA-243: se recorren los datos exportados, no las líneas del archivo — el texto de casi todas las
/// descripciones empieza en la línea siguiente a `description:` y así se colaban.
const CAMPOS_VISIBLES = new Set(['bio', 'description', 'condicion', 'personality', 'role']);
const NOTAS_INTERNAS = /núcleo jugable|grafo v1|improvisársele números|pendiente:|\bel motor\b|sourceSlug/i;

function camposConNota(valor: unknown, ruta: string, vistos: Set<unknown>, salida: string[]): void {
  if (!valor || typeof valor !== 'object' || vistos.has(valor)) return;
  vistos.add(valor);
  for (const [clave, v] of Object.entries(valor)) {
    if (typeof v === 'string') {
      if (CAMPOS_VISIBLES.has(clave) && NOTAS_INTERNAS.test(v)) salida.push(`${ruta}.${clave}: ${v.slice(0, 120)}`);
    } else {
      camposConNota(v, `${ruta}.${clave}`, vistos, salida);
    }
  }
}

describe('catálogo sin notas internas a la vista (P35)', () => {
  it('ningún campo visible de worldCatalog.ts lleva notas de diseño', async () => {
    const catalogo = await import('./worldCatalog.js');
    const conNota: string[] = [];
    camposConNota(catalogo, 'worldCatalog', new Set(), conNota);
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
