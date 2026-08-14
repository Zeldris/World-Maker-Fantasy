import { describe, it, expect, vi, beforeEach } from 'vitest';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-03): motor real de la Enciclopedia
/// progresiva (petición explícita, "solo se verá una vez la AI lo mencione... o sean objetos que
/// ya tenemos") — matching por alias + posesión de inventario, con dedup contra fauna. Sin ningún
/// test pese a no ser trivial.
vi.mock('../scripts/worldCatalog.js', () => ({
  harvestSourceAliases: { 'jabali-de-espinas': ['jabalí espinoso'] },
}));

const { recordEntityDiscoveries } = await import('./entityDiscovery.js');

function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    npc: { findMany: vi.fn(() => Promise.resolve([])) },
    harvestYield: { findMany: vi.fn(() => Promise.resolve([])) },
    itemCatalog: { findMany: vi.fn(() => Promise.resolve([])) },
    inventoryItem: { findMany: vi.fn(() => Promise.resolve([])) },
    faction: { findMany: vi.fn(() => Promise.resolve([])) },
    historiaEntry: { findMany: vi.fn(() => Promise.resolve([])) },
    discoveredEntity: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    ...overrides,
  };
}

describe('recordEntityDiscoveries', () => {
  it('no crea nada si no hay ninguna mención ni posesión', async () => {
    const client = fakeClient();

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(client.discoveredEntity.createMany).not.toHaveBeenCalled();
  });

  it('descubre un NPC por su nombre mencionado en la narración', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gistera-koh', name: 'Gistera Koh', aliases: [] }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Gistera Koh te mira fijamente.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'npc', entitySlug: 'gistera-koh' }],
      skipDuplicates: true,
    });
  });

  it('descubre un NPC por alias, no solo por el nombre exacto', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gorhorn', name: 'Gorhorn Cráneo de Hierro', aliases: ['el orco cornudo'] }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'El orco cornudo levanta su hacha.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'npc', entitySlug: 'gorhorn' }],
      skipDuplicates: true,
    });
  });

  // Cobertura nueva (auditoría 2026-08-14, mismo hallazgo real que en npcScene.ts — Sella Marn,
  // NPC de una región fuera del núcleo jugable, no debería poder desbloquearse en la Enciclopedia
  // por un match de alias corto sin relación real con ella).
  it('un NPC con nucleoJugable: false nunca se descubre, aunque su alias haga match', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'sella-marn', name: 'Sella Marn', aliases: ['sella'], nucleoJugable: false }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Sella Marn te observa desde la sombra.' }, client as never);

    expect(client.discoveredEntity.createMany).not.toHaveBeenCalled();
  });

  it('un Npc que también es fauna cazable cuenta como "fauna", nunca como "npc" (sin duplicar)', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'jabali-de-espinas', name: 'Jabalí de espinas', aliases: [] }])) },
      harvestYield: { findMany: vi.fn(() => Promise.resolve([{ sourceSlug: 'jabali-de-espinas', sourceName: 'Jabalí de espinas' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Un jabalí de espinas cruza el sendero.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'fauna', entitySlug: 'jabali-de-espinas' }],
      skipDuplicates: true,
    });
  });

  it('descubre fauna por alias de recolección (harvestSourceAliases), no solo por el sourceName', async () => {
    const client = fakeClient({
      harvestYield: { findMany: vi.fn(() => Promise.resolve([{ sourceSlug: 'jabali-de-espinas', sourceName: 'Jabalí de espinas' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Ataco al jabalí espinoso.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'fauna', entitySlug: 'jabali-de-espinas' }],
      skipDuplicates: true,
    });
  });

  it('descubre un objeto por posesión en inventario aunque la narración de este turno no lo mencione', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: [] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Ración de viaje' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje' }],
      skipDuplicates: true,
    });
  });

  it('descubre un objeto por posesión usando un alias del inventario que no coincide con el nombre exacto de catálogo', async () => {
    // Bug real (2026-07-30, "revisar partida"): "Raciones de viaje" (nombre del equipo inicial)
    // nunca enganchaba con "Ración de viaje" (catálogo) sin este alias.
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: ['Raciones de viaje'] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Raciones de viaje' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje' }],
      skipDuplicates: true,
    });
  });

  it('descubrir un NPC de una facción también descubre esa facción (cascada, sección "Facciones")', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'torgash', name: 'Torgash', aliases: [], faction: 'Clan Serhu' }])) },
      faction: { findMany: vi.fn(() => Promise.resolve([{ slug: 'clan-serhu', name: 'Clan Serhu' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Torgash levanta su lanza.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [
        { saveId: 's1', entityType: 'npc', entitySlug: 'torgash' },
        { saveId: 's1', entityType: 'faction', entitySlug: 'clan-serhu' },
      ],
      skipDuplicates: true,
    });
  });

  it('la query de Faction para la cascada pide catálogo + solo la fundada de ESTA partida (2026-08-06)', async () => {
    // Regresión: sin este filtro, la cascada NPC→facción de una partida podría "descubrir por
    // casualidad" la facción fundada en OTRA partida distinta si compartieran nombre de reino.
    const client = fakeClient();

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'x' }, client as never);

    expect(client.faction.findMany).toHaveBeenCalledWith({ where: { worldId: 'w1', OR: [{ saveId: null }, { saveId: 's1' }] } });
  });

  it('un NPC sin facción, o cuya facción no tiene fila en el catálogo, no dispara ninguna cascada', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.resolve([{ slug: 'gorhorn', name: 'Gorhorn', aliases: [], faction: null }])) },
      faction: { findMany: vi.fn(() => Promise.resolve([{ slug: 'clan-serhu', name: 'Clan Serhu' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Gorhorn levanta su hacha.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'npc', entitySlug: 'gorhorn' }],
      skipDuplicates: true,
    });
  });

  it('descubrir/poseer un objeto con HistoriaEntry enganchada también descubre esa entrada (cascada, sección "Historia")', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'tablilla-quemada-maktor', name: 'Tablilla quemada', aliases: [] }])) },
      historiaEntry: { findMany: vi.fn(() => Promise.resolve([{ slug: 'la-caida-del-clan-maktor', documentoItemSlug: 'tablilla-quemada-maktor' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Encuentras una tablilla quemada entre los escombros.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [
        { saveId: 's1', entityType: 'item', entitySlug: 'tablilla-quemada-maktor' },
        { saveId: 's1', entityType: 'historia', entitySlug: 'la-caida-del-clan-maktor' },
      ],
      skipDuplicates: true,
    });
  });

  it('un objeto sin ninguna HistoriaEntry enganchada no dispara ninguna cascada de historia', async () => {
    const client = fakeClient({
      itemCatalog: { findMany: vi.fn(() => Promise.resolve([{ slug: 'racion-de-viaje', name: 'Ración de viaje', aliases: [] }])) },
      inventoryItem: { findMany: vi.fn(() => Promise.resolve([{ name: 'Ración de viaje' }])) },
      historiaEntry: { findMany: vi.fn(() => Promise.resolve([{ slug: 'la-caida-del-clan-maktor', documentoItemSlug: 'tablilla-quemada-maktor' }])) },
    });

    await recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'Camino en silencio.' }, client as never);

    expect(client.discoveredEntity.createMany).toHaveBeenCalledWith({
      data: [{ saveId: 's1', entityType: 'item', entitySlug: 'racion-de-viaje' }],
      skipDuplicates: true,
    });
  });

  it('nunca lanza si el cliente falla — un fallo aquí no debe tirar abajo el turno ya persistido', async () => {
    const client = fakeClient({
      npc: { findMany: vi.fn(() => Promise.reject(new Error('DB caída'))) },
    });

    await expect(recordEntityDiscoveries({ saveId: 's1', worldId: 'w1', mentionedText: 'x' }, client as never)).resolves.toBeUndefined();
  });
});
