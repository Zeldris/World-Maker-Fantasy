import { describe, it, expect, vi } from 'vitest';

const embed = vi.fn().mockResolvedValue([0.1]);
const queryRaw = vi.fn();
vi.mock('../lib/iaRegistro.js', () => ({ registrarLlamada: vi.fn() }));
vi.mock('../lib/embeddings.js', () => ({ embed, toVectorLiteral: (v: number[]) => `[${v.join(',')}]` }));
vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: queryRaw } }));

const { retrieveLore } = await import('./retrieval.js');

describe('retrieveLore: filas directas por título (QA-289)', () => {
  it('la consulta de filas directas aplica excludeTags igual que la búsqueda semántica', async () => {
    queryRaw
      .mockResolvedValueOnce([]) // semántica
      .mockResolvedValueOnce([{ title: 'Ulkha Ketg' }]) // títulos
      .mockResolvedValueOnce([]); // directas
    await retrieveLore('hablo con Ulkha Ketg', 'w1', 4, ['secreto'], ['hablo con Ulkha Ketg']);
    expect(queryRaw).toHaveBeenCalledTimes(3);
    for (const [strings] of queryRaw.mock.calls) expect((strings as string[]).join('?')).toContain('tags &&');
  });
});
