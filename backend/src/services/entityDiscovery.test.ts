import { describe, it, expect, vi } from 'vitest';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-03): motor real de la Enciclopedia
/// progresiva (petición explícita, "solo se verá una vez la AI lo mencione... o sean objetos que
/// ya tenemos") — matching por alias + posesión de inventario, con dedup contra fauna. Sin ningún
/// test pese a no ser trivial.
///
/// Rediseño de 3 fases (2026-09-08, petición explícita de Álvaro: "no descubierto, citado o
/// avistado") — `createMany`/`skipDuplicates` sustituido por `findUnique` + `create`/`update` (una
/// fila ya DESCUBIERTO nunca puede "bajar" a CITADO). `fakeClient` simula una tabla en memoria en
/// vez de un simple spy, para poder verificar tanto la CREACIÓN inicial como la subida de fase.
vi.mock('../scripts/worldCatalog.js', () => ({
  harvestYields: [],
  harvestSourceAliases: { 'jabali-de-espinas': ['jabalí espinoso'] },
  // Stub fiel al real (worldCatalog.ts): nombre del Npc si lo hay, si no el slug tal cual — ninguno
  // de estos tests depende de `harvestSourceDisplayName` (el diccionario de fallback real).
  sourceDisplayNameFor: (slug: string, npcName?: string | null) => npcName ?? slug,
  // Auditoría "revisar partida" (2026-08-30, "fauna y flora en carpetas separadas") — vacío a
  // propósito: ninguno de estos tests simula uno de los 3 animales sin Npc propio (Espina del
  // Viento/Cornante/Sombra de Kroj), así que el mock real basta sin necesitar contenido.
  harvestSourcesThatAreFaunaWithoutNpc: new Set<string>(),
}));

const { recordEntityDiscoveries } = await import('./entityDiscovery.js');

interface FakeRow {
  saveId: string;
  entityType: string;
  entitySlug: string;
  fase: 'CITADO' | 'DESCUBIERTO';
}

/// Tabla en memoria (2026-09-08) — reemplaza el spy plano de `createMany`: necesario para
/// verificar de verdad el criterio "nunca baja de fase" (`findUnique` antes de `create`/`update`).
function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  const rows = new Map<string, FakeRow>();
  const key = (saveId: string, entityType: string, entitySlug: string) => `${saveId}:${entityType}:${entitySlug}`;
  return {
    __rows: rows,
    npc: { findMany: vi.fn(() => Promise.resolve([])) },
    harvestYield: { findMany: vi.fn(() => Promise.resolve([])) },
    itemCatalog: { findMany: vi.fn(() => Promise.resolve([])) },
    inventoryItem: { findMany: vi.fn(() => Promise.resolve([])) },
    faction: { findMany: vi.fn(() => Promise.resolve([])) },
    historiaEntry: { findMany: vi.fn(() => Promise.resolve([])) },
    discoveredEntity: {
      findUnique: vi.fn(({ where: { saveId_entityType_entitySlug: k } }: { where: { saveId_entityType_entitySlug: { saveId: string; entityType: string; entitySlug: string } } }) =>
        Promise.resolve(rows.get(key(k.saveId, k.entityType, k.entitySlug)) ?? null),
      ),
      create: vi.fn(({ data }: { data: FakeRow }) => {
        rows.set(key(data.saveId, data.entityType, data.entitySlug), data);
        return Promise.resolve(data);
      }),
      update: vi.fn(({ where: { saveId_entityType_entitySlug: k }, data }: { where: { saveId_entityType_entitySlug: { saveId: string; entityType: string; entitySlug: string } }; data: { fase: 'DESCUBIERTO' } }) => {
        const existing = rows.get(key(k.saveId, k.entityType, k.entitySlug));
        if (existing) rows.set(key(k.saveId, k.entityType, k.entitySlug), { ...existing, ...data });
        return Promise.resolve(existing);
      }),
    },
    ...overrides,
  };
}

function rowsOf(client: ReturnType<typeof fakeClient>): FakeRow[] {
  return [...client.__rows.values()];
}

describe('recordEntityDiscoveries', () => {
  it('no crea nada si no hay ninguna mención ni posesión', async () => {
    const client = fakeClient();

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(rowsOf(client)).toEqual([]);
  });

  it('descubre un NPC por su nombre mencionado en la narración — CITADO (sin presencia real en escena)', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gistera-koh', name: 'Gistera Koh', aliases: [] }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Gistera Koh te mira fijamente.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gistera-koh', fase: 'CITADO' }]);
  });

  it('un NPC realmente presente en npcsInScene este turno llega a DESCUBIERTO directo', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gistera-koh', name: 'Gistera Koh', aliases: [] }])) },
    });

    await recordEntityDiscoveries(
      { saveId: 's1', worldId: 'w1', mentionedText: 'Gistera Koh te mira fijamente.', npcSlugsInScene: ['gistera-koh'] },
      client as never,
    );

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gistera-koh', fase: 'DESCUBIERTO' }]);
  });

  it('una fila ya DESCUBIERTO nunca baja a CITADO en una detección posterior sin presencia real', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gistera-koh', name: 'Gistera Koh', aliases: [] }])) },
    });
    // Turno 1: presente de verdad -> DESCUBIERTO.
    await recordEntityDiscoveries(
      { saveId: 's1', worldId: 'w1', mentionedText: 'Gistera Koh te mira.', npcSlugsInScene: ['gistera-koh'] },
      client as never,
    );
    // Turno 2: solo citada de pasada, ya no está en npcsInScene — NO debe degradar la fila.
    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Recuerdas a Gistera Koh.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gistera-koh', fase: 'DESCUBIERTO' }]);
  });

  it('una fila ya CITADO sube a DESCUBIERTO en cuanto aparece la presencia real', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gistera-koh', name: 'Gistera Koh', aliases: [] }])) },
    });
    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Oyes hablar de Gistera Koh.' }, client as never);
    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gistera-koh', fase: 'CITADO' }]);

    await recordEntityDiscoveries(
      { saveId: 's1', worldId: 'w1', mentionedText: 'Gistera Koh aparece ante ti.', npcSlugsInScene: ['gistera-koh'] },
      client as never,
    );
    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gistera-koh', fase: 'DESCUBIERTO' }]);
  });

  it('descubre un NPC por alias, no solo por el nombre exacto', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gorhorn', name: 'Gorhorn Cráneo de Hierro', aliases: ['el orco cornudo'] }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'El orco cornudo levanta su hacha.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gorhorn', fase: 'CITADO' }]);
  });

  // Cobertura nueva (auditoría 2026-08-14, mismo hallazgo real que en npcScene.ts — Sella Marn,
  // NPC de una región fuera del núcleo jugable, no debería poder desbloquearse en la Enciclopedia
  // por un match de alias corto sin relación real con ella).
  it('un NPC con nucleoJugable: false nunca se descubre, aunque su alias haga match', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'sella-marn', name: 'Sella Marn', aliases: ['sella'], nucleoJugable: false }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Sella Marn te observa desde la sombra.' }, client as never);

    expect(rowsOf(client)).toEqual([]);
  });

  it('un Npc que también es fauna cazable cuenta como "fauna", nunca como "npc" (sin duplicar)', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'jabali-de-espinas', name: 'Jabalí de espinas', aliases: [] }])) },
      harvestYield: { findMany: vi.fn(() => Promise.resolve([{ sourceSlug: 'jabali-de-espinas', sourceName: 'Jabalí de espinas' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Un jabalí de espinas cruza el sendero.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'fauna', entitySlug: 'jabali-de-espinas', fase: 'CITADO' }]);
  });

  it('descubre fauna por alias de recolección (harvestSourceAliases), no solo por el sourceName', async () => {
    // Auditoría "revisar partida" (2026-08-30, "fauna y flora en carpetas separadas") — mockea el
    // Npc real (antes se omitía) porque el `entityType` ahora se decide dinámicamente según el
    // mismo criterio que `esFauna`: sin Npc real ni estar en `harvestSourcesThatAreFaunaWithoutNpc`,
    // este mock resolvería a 'flora', no 'fauna' — el test se llama "descubre FAUNA", así que debe
    // simular un caso real de fauna cazable, no uno accidentalmente ambiguo.
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'jabali-de-espinas', name: 'Jabalí de espinas', aliases: [] }])) },
      harvestYield: { findMany: vi.fn(() => Promise.resolve([{ sourceSlug: 'jabali-de-espinas', sourceName: 'Jabalí de espinas' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Ataco al jabalí espinoso.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'fauna', entitySlug: 'jabali-de-espinas', fase: 'CITADO' }]);
  });

  // Auditoría "revisar partida" (2026-08-30) — caso nuevo, complementario al de arriba: sin Npc
  // real (ni en la lista especial), el HarvestYield es flora/mineral por definición.
  it('descubre flora/mineral (sin Npc real detrás) como "flora", no como "fauna"', async () => {
    const client = fakeClient({
      harvestYield: { findMany: vi.fn(() => Promise.resolve([{ sourceSlug: 'jabali-de-espinas', sourceName: 'Jabalí de espinas' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Ataco al jabalí espinoso.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'flora', entitySlug: 'jabali-de-espinas', fase: 'CITADO' }]);
  });

  it('descubre un objeto por posesión en inventario aunque la narración de este turno no lo mencione — DESCUBIERTO directo (poseerlo es más que solo mención)', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: [] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Ración de viaje' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje', fase: 'DESCUBIERTO' }]);
  });

  it('un objeto solo MENCIONADO, sin poseerlo, se queda en CITADO', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: [] }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'El guardia lleva una ración de viaje al cinto.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje', fase: 'CITADO' }]);
  });

  it('descubre un objeto por posesión usando un alias del inventario que no coincide con el nombre exacto de catálogo', async () => {
    // Bug real (2026-07-30, "revisar partida"): "Raciones de viaje" (nombre del equipo inicial)
    // nunca enganchaba con "Ración de viaje" (catálogo) sin este alias.
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: ['Raciones de viaje'] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Raciones de viaje' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje', fase: 'DESCUBIERTO' }]);
  });

  it('descubrir un NPC de una facción también descubre esa facción (cascada, sección "Facciones") — la facción siempre CITADO', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'torgash', name: 'Torgash', aliases: [], faction: 'Clan Serhu' }])) },
      faction: { findMany: vi.fn(() => Promise.resolve([{ slug: 'clan-serhu', name: 'Clan Serhu' }])) },
    });

    await recordEntityDiscoveries(
      { saveId: 's1', worldId: 'w1', mentionedText: 'Torgash levanta su lanza.', npcSlugsInScene: ['torgash'] },
      client as never,
    );

    expect(rowsOf(client)).toEqual(
      expect.arrayContaining([
        { saveId: 's1', entityType: 'npc', entitySlug: 'torgash', fase: 'DESCUBIERTO' },
        { saveId: 's1', entityType: 'faction', entitySlug: 'clan-serhu', fase: 'CITADO' },
      ]),
    );
    expect(rowsOf(client)).toHaveLength(2);
  });

  it('la query de Faction para la cascada pide catálogo + solo la fundada de ESTA partida (2026-08-06)', async () => {
    // Regresión: sin este filtro, la cascada NPC→facción de una partida podría "descubrir por
    // casualidad" la facción fundada en OTRA partida distinta si compartieran nombre de reino.
    const client = fakeClient();

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'x' }, client as never);

    expect(client.faction.findMany).toHaveBeenCalledWith({ where: { worldId: 'w1', OR: [{ saveId: null }, { saveId: 's1', origenSlug: null }] } });
  });

  it('un NPC sin facción, o cuya facción no tiene fila en el catálogo, no dispara ninguna cascada', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gorhorn', name: 'Gorhorn', aliases: [], faction: null }])) },
      faction: { findMany: vi.fn(() => Promise.resolve([{ slug: 'clan-serhu', name: 'Clan Serhu' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Gorhorn levanta su hacha.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'npc', entitySlug: 'gorhorn', fase: 'CITADO' }]);
  });

  it('descubrir/poseer un objeto con HistoriaEntry enganchada también descubre esa entrada, heredando la MISMA fase (cascada, sección "Historia")', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'tablilla-quemada-maktor', name: 'Tablilla quemada', aliases: [] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Tablilla quemada' }])) },
      historiaEntry: { findMany: vi.fn(() => Promise.resolve([{ slug: 'la-caida-del-clan-maktor', documentoItemSlug: 'tablilla-quemada-maktor' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Encuentras una tablilla quemada entre los escombros.' }, client as never);

    expect(rowsOf(client)).toEqual(
      expect.arrayContaining([
        { saveId: 's1', entityType: 'item', entitySlug: 'tablilla-quemada-maktor', fase: 'DESCUBIERTO' },
        { saveId: 's1', entityType: 'historia', entitySlug: 'la-caida-del-clan-maktor', fase: 'DESCUBIERTO' },
      ]),
    );
    expect(rowsOf(client)).toHaveLength(2);
  });

  it('un objeto sin ninguna HistoriaEntry enganchada no dispara ninguna cascada de historia', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: [] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Ración de viaje' }])) },
      historiaEntry: { findMany: vi.fn(() => Promise.resolve([{ slug: 'la-caida-del-clan-maktor', documentoItemSlug: 'tablilla-quemada-maktor' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(rowsOf(client)).toEqual([{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje', fase: 'DESCUBIERTO' }]);
  });

  it('nunca lanza si el cliente falla — un fallo aquí no debe tirar abajo el turno ya persistido', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.reject(new Error('DB caída'))) },
    });

    await expect(recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'x' }, client as never)).resolves.toBeUndefined();
  });
});
