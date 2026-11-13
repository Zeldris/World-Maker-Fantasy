import { describe, it, expect, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('../lib/iaRegistro.js', () => ({ registrarLlamada: vi.fn() }));
vi.mock('../lib/embeddings.js', () => ({ embed: vi.fn(async () => [0.1, 0.2]), toVectorLiteral: (v: number[]) => `[${v.join(',')}]` }));
vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: queryRaw } }));

const { retrieveLore } = await import('./retrieval.js');

// QA-327: con dos distancias iguales, el orden no puede depender de la corrida. `retrieveLore` necesita pgvector
// real para ordenar, así que se comprueba la consulta que manda: el último ORDER BY desempata por título.
describe('orden de retrieveLore', () => {
  it('ordena por distancia y, a igual distancia, por título', async () => {
    queryRaw.mockResolvedValue([]);
    await retrieveLore('hola', 'w1', 4);
    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ');
    const ordenes = [...sql.matchAll(/ORDER BY ([^)]*?)(?: LIMIT|\)|$)/g)].map((m) => m[1].trim());
    expect(ordenes.at(-1)).toBe('distance, title');
    expect(sql).toContain('DISTINCT ON (title)');
  });
});
