import { describe, it, expect, vi } from 'vitest';

const registrarLlamada = vi.fn();
const embed = vi.fn();
vi.mock('../lib/iaRegistro.js', () => ({ registrarLlamada }));
vi.mock('../lib/embeddings.js', () => ({ embed, toVectorLiteral: (v: number[]) => `[${v.join(',')}]` }));
vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: vi.fn() } }));

const { retrieveLore } = await import('./retrieval.js');

describe('registro opt-ai en retrieveLore', () => {
  it('si falla, registra la línea retrieval con el error y vuelve a lanzar', async () => {
    embed.mockRejectedValue(new Error('embeddings caído'));
    await expect(retrieveLore('hola', 'w1', 3)).rejects.toThrow('embeddings caído');
    expect(registrarLlamada).toHaveBeenCalledTimes(1);
    expect(registrarLlamada.mock.calls[0][0]).toMatchObject({
      operation: 'retrieval',
      ragQuery: 'hola',
      ragK: 3,
      error: 'embeddings caído',
    });
  });
});
