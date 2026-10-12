import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { applyKillSideEffects } from './turnResolution.js';
import { asegurarMundoDePartida } from './mundoPartida.js';

/// H-3 (2026-09-28) — BAJA_DE_GUERRA se dispara al MATAR a un NPC de la facción dueña de la región
/// activa cuando el jugador tiene Reino fundado (su propia Faction). Contra Postgres real.
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
const REGION = 'Las Llanuras del Viento Rojo';
const FACCION = 'Clan Serhu';

describe('BAJA_DE_GUERRA al matar NPC de la facción dueña de la región', () => {
  let saveId: string;
  let worldId: string;
  let targetFactionId: string;
  let npc: { id: string; name: string; raza: string | null; slug: string; faction: string | null };

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const npcRow = await prisma.npc.findFirstOrThrow({ where: { worldId, faction: FACCION } });
    npc = { id: npcRow.id, name: npcRow.name, raza: npcRow.raza, slug: npcRow.slug, faction: npcRow.faction };
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (baja de guerra)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.upsert({ where: { saveId }, create: { saveId }, update: {} });
    // CR-7 (hito 0.2): la baja de guerra va contra la copia de la facción en esta partida.
    await asegurarMundoDePartida(prisma, saveId);
    targetFactionId = (await prisma.faction.findFirstOrThrow({ where: { saveId, name: FACCION, origenSlug: { not: null } } })).id;
  });

  afterEach(async () => {
    // Solo el Reino del jugador (las copias del mundo de la partida se quedan).
    await prisma.faction.deleteMany({ where: { saveId, origenSlug: null } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  async function crearReino() {
    return prisma.faction.create({
      data: { worldId, saveId, slug: `reino-baja-${saveId}`, name: 'Reino de Prueba', raza: 'orcos', description: 'x' },
    });
  }

  async function matar(nuevaCondicion: 'MUERTO' | 'CONVALECIENTE', activeRegion: string | null) {
    await prisma.$transaction((tx) =>
      applyKillSideEffects({
        tx,
        npc: { ...npc, articulo: null },
        nuevaCondicion,
        saveId,
        worldId,
        nuevoFictionalMinutes: 100,
        nuevaFictionalDateLabel: 'Día 1, mañana',
        activeRegion,
        completeQuest: false,
      }),
    );
  }

  async function presion(sourceId: string): Promise<number | null> {
    const rel = await prisma.factionRelation.findUnique({ where: { sourceFactionId_targetFactionId: { sourceFactionId: sourceId, targetFactionId } } });
    return rel?.presion ?? null;
  }

  it('con Reino fundado, matar en la región de la facción sube presion +8', async () => {
    const reino = await crearReino();
    expect(await presion(reino.id)).toBeNull();
    await matar('MUERTO', REGION);
    expect(await presion(reino.id)).toBe(58);
    // Libro de Sucesos (CR-3): la muerte queda como muerte causada por el jugador.
    const muerte = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'MUERTE_CAUSADA' }, orderBy: { createdAt: 'desc' }, include: { actores: true } });
    expect(muerte.actores.some((a) => a.entidadTipo === 'NPC' && a.entidadId === npc.id && a.papel === 'VICTIMA')).toBe(true);
  });

  it('CONVALECIENTE no dispara', async () => {
    const reino = await crearReino();
    await matar('CONVALECIENTE', REGION);
    expect(await presion(reino.id)).toBeNull();
    // Libro de Sucesos (CR-3): dejarlo convaleciente es un combate ganado, no una muerte.
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'COMBATE_GANADO' } })).toBeGreaterThanOrEqual(1);
  });

  it('fuera de la región de esa facción no dispara', async () => {
    const reino = await crearReino();
    await matar('MUERTO', 'Cristal Helado');
    expect(await presion(reino.id)).toBeNull();
  });

  it('sin Reino fundado no hay source y no dispara ni falla', async () => {
    await matar('MUERTO', REGION);
    const count = await prisma.factionRelation.count({ where: { targetFactionId, sourceFaction: { saveId, origenSlug: null } } });
    expect(count).toBe(0);
  });
});
