import { describe, it, expect, vi, beforeEach } from 'vitest';

// Rediseño 2026-07-30 (mejora de cohesión, ver SessionFact en schema.prisma): `mergeFacts`
// (ventana rodante de los últimos 10, recorte por pura antigüedad) se sustituye por 3 funciones
// sobre una tabla propia con embeddings — mismo patrón de mock que inventario.test.ts/turn.test.ts:
// `vi.fn()` a nivel de módulo + `vi.mock` + import dinámico DESPUÉS del mock.
const findManySessionFact = vi.fn();
const countSessionFact = vi.fn();
const deleteManySessionFact = vi.fn();
const executeRaw = vi.fn();
const queryRaw = vi.fn();
const embed = vi.fn();
const findUniqueSave = vi.fn();
const findManyNpc = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    sessionFact: {
      findMany: (...args: unknown[]) => findManySessionFact(...args),
      count: (...args: unknown[]) => countSessionFact(...args),
      deleteMany: (...args: unknown[]) => deleteManySessionFact(...args),
    },
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
    },
    npc: {
      findMany: (...args: unknown[]) => findManyNpc(...args),
    },
    $executeRaw: (...args: unknown[]) => executeRaw(...args),
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

vi.mock('../lib/embeddings.js', () => ({
  embed: (...args: unknown[]) => embed(...args),
  toVectorLiteral: (vector: number[]) => `[${vector.join(',')}]`,
}));

const { loadSessionFacts, appendSessionFacts, selectRelevantFacts } = await import('./worldFacts.js');

describe('loadSessionFacts', () => {
  beforeEach(() => findManySessionFact.mockReset());

  it('devuelve el historial en orden cronológico (más antiguo primero), aunque la consulta pida los más recientes primero', async () => {
    findManySessionFact.mockResolvedValue([{ text: 'hecho 3 (más reciente)' }, { text: 'hecho 2' }, { text: 'hecho 1 (más antiguo)' }]);
    const result = await loadSessionFacts('save1');
    expect(result).toEqual(['hecho 1 (más antiguo)', 'hecho 2', 'hecho 3 (más reciente)']);
    expect(findManySessionFact).toHaveBeenCalledWith(
      expect.objectContaining({ where: { saveId: 'save1' }, orderBy: { createdAt: 'desc' } }),
    );
  });
});

describe('appendSessionFacts', () => {
  beforeEach(() => {
    executeRaw.mockReset().mockResolvedValue(undefined);
    countSessionFact.mockReset().mockResolvedValue(0);
    deleteManySessionFact.mockReset();
    embed.mockReset().mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it('inserta un hecho genuinamente nuevo (embebiéndolo primero)', async () => {
    await appendSessionFacts('save1', ['Gorhorn tiene un tótem de madera'], ['El Cruce de las Cenizas tiene patrullas de la Concordia']);
    expect(embed).toHaveBeenCalledWith('El Cruce de las Cenizas tiene patrullas de la Concordia');
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('descarta un hecho casi idéntico a uno ya existente (≥65% palabras compartidas) — no lo embebe ni lo inserta', async () => {
    const existing = ['Gorhorn ve un grupo hostil de orcos cerca del pozo'];
    await appendSessionFacts('save1', existing, ['Gorhorn ve un grupo hostil de oca cerca del pozo']);
    expect(embed).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('descarta una paráfrasis casi idéntica aunque quede justo por debajo del 70% (bug real jugando: 0.69 de similitud no se descartaba)', async () => {
    const existing = ['El Orco Enfurecido ha sido derrotado y ahora está herido, ~50/100 de salud.'];
    await appendSessionFacts('save1', existing, ['El Orco Enfurecido ahora está herido, ~50/100 de salud.']);
    expect(embed).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('dos hechos nuevos casi idénticos ENTRE SÍ en el mismo turno: solo el primero se inserta', async () => {
    await appendSessionFacts('save1', [], ['El puente está destruido', 'El puente quedó destruido']);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  // Auditoría 2026-08-11 ("pruebas por API"): dos fuentes de recolección distintas descubiertas en
  // el MISMO turno ("roca" y "veta de hierro", ambas en Los Pilares Rotos) compartían 9 de 11
  // palabras — toda la plantilla fija "Gorhorn localiza ... en la zona", nada del contenido real —
  // así que la segunda se descartaba como si fuera el mismo hecho, perdiendo el descubrimiento.
  it('NO descarta dos hechos con la MISMA plantilla pero contenido real distinto (bug real: "roca" vs "veta de hierro" en el mismo sitio)', async () => {
    await appendSessionFacts('save1', [], [
      'Gorhorn localiza roca de los pilares rotos en la zona.',
      'Gorhorn localiza veta de hierro de los pilares rotos en la zona.',
    ]);
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('no hace nada si no hay hechos nuevos', async () => {
    await appendSessionFacts('save1', ['algo'], []);
    expect(embed).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(countSessionFact).not.toHaveBeenCalled();
  });

  it('poda las filas más antiguas cuando se supera el tope de almacenamiento (MAX_STORED_FACTS=50)', async () => {
    countSessionFact.mockResolvedValue(52);
    findManySessionFact.mockReset().mockResolvedValue([{ id: 'old1' }, { id: 'old2' }]);
    await appendSessionFacts('save1', [], ['hecho nuevo']);
    expect(findManySessionFact).toHaveBeenCalledWith(
      expect.objectContaining({ where: { saveId: 'save1' }, orderBy: { createdAt: 'asc' }, take: 2 }),
    );
    expect(deleteManySessionFact).toHaveBeenCalledWith({ where: { id: { in: ['old1', 'old2'] } } });
  });

  it('no poda nada si no se ha superado el tope', async () => {
    countSessionFact.mockResolvedValue(10);
    await appendSessionFacts('save1', [], ['hecho nuevo']);
    expect(deleteManySessionFact).not.toHaveBeenCalled();
  });
});

describe('selectRelevantFacts', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    embed.mockReset().mockResolvedValue([0.1, 0.2, 0.3]);
    findUniqueSave.mockReset().mockResolvedValue({ npcsRetiredForever: [] });
    findManyNpc.mockReset().mockResolvedValue([]);
  });

  it('con MAX_SENT_FACTS (10) o menos, devuelve todo tal cual — sin embeber ni consultar nada', async () => {
    const facts = Array.from({ length: 10 }, (_, i) => `hecho ${i}`);
    const result = await selectRelevantFacts('acción del jugador', 'save1', 'world1', facts);
    expect(result).toEqual(facts);
    expect(embed).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('con más de 10, garantiza los 3 más recientes y completa con los más relevantes recuperados por similitud', async () => {
    const facts = Array.from({ length: 15 }, (_, i) => `hecho ${i}`); // hecho 12/13/14 = los 3 más recientes
    queryRaw.mockResolvedValue([{ text: 'hecho 2' }, { text: 'hecho 5' }, { text: 'hecho 14' }]); // "hecho 14" ya está en recencia
    const result = await selectRelevantFacts('acción del jugador', 'save1', 'world1', facts);
    expect(embed).toHaveBeenCalledWith('acción del jugador');
    // Recencia garantizada (12,13,14) + relevantes no solapados (2,5) — sin duplicar "hecho 14".
    expect(result).toEqual(['hecho 2', 'hecho 5', 'hecho 12', 'hecho 13', 'hecho 14']);
  });

  it('devuelve el resultado final en orden cronológico (según el array original), no por score de similitud', async () => {
    const facts = Array.from({ length: 15 }, (_, i) => `hecho ${i}`);
    // La consulta "por relevancia" los devuelve en un orden distinto al cronológico.
    queryRaw.mockResolvedValue([{ text: 'hecho 8' }, { text: 'hecho 1' }]);
    const result = await selectRelevantFacts('acción del jugador', 'save1', 'world1', facts);
    const indices = result.map((f) => facts.indexOf(f));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  // Causa raíz confirmada 2026-08-31 ("sessionFacts reintroduce NPCs retirados/cruza rasgos entre
  // NPCs"): un fact de despedida seguía llegando al Narrador aunque detectNpcsInScene (fijado el
  // 2026-08-28) ya excluyera al NPC de npcsInScene — el nombre se colaba por esta vía en su lugar.
  it('excluye cualquier hecho que mencione a un NPC de npcsRetiredForever, aunque quepa sin filtrar por volumen', async () => {
    findUniqueSave.mockResolvedValue({ npcsRetiredForever: ['gistera-koh'] });
    findManyNpc.mockResolvedValue([{ id: 'npc1', aliases: ['gistera koh', 'gistera'] }]);
    const facts = ['Gistera Koh se despidió y se marchó, no volverá a aparecer.', 'El Orco Enfurecido sigue merodeando cerca.'];
    const result = await selectRelevantFacts('acción del jugador', 'save1', 'world1', facts);
    expect(result).toEqual(['El Orco Enfurecido sigue merodeando cerca.']);
    expect(findManyNpc).toHaveBeenCalledWith(expect.objectContaining({ where: { worldId: 'world1', slug: { in: ['gistera-koh'] } } }));
  });

  it('excluye un hecho de NPC retirado también cuando SÍ hay que filtrar por relevancia (no se cuela por la consulta vectorial)', async () => {
    findUniqueSave.mockResolvedValue({ npcsRetiredForever: ['gistera-koh'] });
    findManyNpc.mockResolvedValue([{ id: 'npc1', aliases: ['gistera koh'] }]);
    const facts = [
      ...Array.from({ length: 12 }, (_, i) => `hecho de relleno ${i}`),
      'Gistera Koh se despidió y se marchó, no volverá a aparecer.',
    ];
    // La consulta "por relevancia" recupera el fact de despedida igualmente (similitud semántica
    // con la acción actual) — debe seguir excluido pese a salir en la respuesta cruda de Postgres.
    queryRaw.mockResolvedValue([{ text: 'Gistera Koh se despidió y se marchó, no volverá a aparecer.' }, { text: 'hecho de relleno 2' }]);
    const result = await selectRelevantFacts('acción del jugador', 'save1', 'world1', facts);
    expect(result).not.toContain('Gistera Koh se despidió y se marchó, no volverá a aparecer.');
  });
});
