import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const queryRaw = vi.fn();
const embed = vi.fn(async () => [0.1, 0.2]);
vi.mock('../lib/iaRegistro.js', () => ({ registrarLlamada: vi.fn() }));
vi.mock('../lib/embeddings.js', () => ({ embed, toVectorLiteral: (v: number[]) => `[${v.join(',')}]` }));
vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: queryRaw } }));

const { retrieveLore } = await import('./retrieval.js');
const sql = (i: number) => (queryRaw.mock.calls[i][0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ');

// QA-351: los mandos RAG_BUSQUEDA y RAG_MODELO. Sin ellos, una sola consulta por vector con bge-m3 (QA-361).
describe('retrieveLore con los mandos de QA-351', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    embed.mockClear();
  });
  afterEach(() => {
    delete process.env.RAG_BUSQUEDA;
    delete process.env.RAG_MODELO;
  });

  it('por defecto: una consulta por vector, sin texto completo, con el modelo de siempre', async () => {
    queryRaw.mockResolvedValue([]);
    await retrieveLore('hola', 'w1', 4);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(sql(0)).not.toContain('tsquery');
    expect(embed).toHaveBeenCalledWith('hola', 'bge-m3');
  });

  it('RAG_MODELO embebe la consulta con ese modelo', async () => {
    process.env.RAG_MODELO = 'bge-m3';
    queryRaw.mockResolvedValue([]);
    await retrieveLore('hola', 'w1', 4);
    expect(embed).toHaveBeenCalledWith('hola', 'bge-m3');
  });

  it('híbrida: fusiona vector y texto completo con RRF, desempata por título y corta en topK', async () => {
    process.env.RAG_BUSQUEDA = 'hibrida';
    const fila = (title: string, distance: number) => ({ title, text: `texto de ${title}`, distance });
    // Por vector: A, B, C, D. Por texto: D, C. RRF: D (1/64 + 1/61 ≈ 0,03202) > C (1/63 + 1/62 ≈ 0,03200) > A (1/61) > B.
    queryRaw.mockResolvedValueOnce([fila('A', 0.1), fila('B', 0.2), fila('C', 0.3), fila('D', 0.4)]).mockResolvedValueOnce([{ title: 'D' }, { title: 'C' }]);
    const r = await retrieveLore('dragón rojo', 'w1', 3, ['berig']);
    expect(r.map((x) => x.title)).toEqual(['D', 'C', 'A']);
    expect(r[1]).toEqual(fila('C', 0.3));
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(sql(0)).not.toContain('LIMIT');
    expect(sql(1)).toContain('plainto_tsquery');
    expect(sql(1)).toContain("' & ', ' | '");
    expect(sql(1)).toMatch(/ORDER BY rango DESC, title $/);
    // La consulta de texto lleva la pregunta tal cual y el mismo filtro de continente.
    expect(queryRaw.mock.calls[1].slice(1)).toEqual(expect.arrayContaining(['dragón rojo', ['berig'], 'w1']));
  });
});
