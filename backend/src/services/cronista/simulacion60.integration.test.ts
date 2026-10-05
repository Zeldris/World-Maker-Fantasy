import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { avanzarMundoHasta } from '../avanceDiario.js';
import { initialAgenda } from '../worldAgenda.js';

/// CR-34 34f («Hecho cuando» de la Q18) contra Postgres real: dos partidas de Gorhorn avanzan 60 días
/// de ficción con todo el motor (economía, expediciones, narrador de fondo y decisiones de facción),
/// una con el Ritmo del mundo en Caótico y otra en Tranquilo, con el azar fijado. Las aserciones son
/// de forma (hay de todo y el ritmo se nota), no de cifras exactas. Que dos líderes de distinta
/// Inteligencia decidan distinto en la misma situación lo cubre `decisionesFaccion.test.ts`.
/// El progreso de oficio de los NPC (de catálogo, compartido) se restaura al terminar.

function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIAS = 60;
const DIPLOMACIA = ['TRATADO_COMERCIAL', 'ALIANZA', 'GUERRA_DECLARADA', 'TREGUA', 'CAMBIO_RELACION'];

describe('simulación de 60 días con decisiones de facción (CR-34 34f)', () => {
  const saves: string[] = [];
  let progresoSnapshot: Awaited<ReturnType<typeof prisma.npcProfessionProgress.findMany>> = [];
  let worldId: string;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    progresoSnapshot = await prisma.npcProfessionProgress.findMany({ where: { npc: { worldId } } });
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saves } } });
    await prisma.npcProfessionProgress.deleteMany({ where: { npc: { worldId }, id: { notIn: progresoSnapshot.map((p) => p.id) } } });
    for (const p of progresoSnapshot) await prisma.npcProfessionProgress.update({ where: { id: p.id }, data: { nivel: p.nivel, xp: p.xp } });
  });

  async function simular(estilo: 'TRANQUILO' | 'CAOTICO', semilla: number) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 480, estiloNarrador: estilo, agenda: initialAgenda(480) as object } },
      },
    });
    saves.push(save.id);
    const random = mulberry32(semilla);
    for (let d = 1; d <= DIAS; d++) {
      await prisma.worldState.update({ where: { saveId: save.id }, data: { fictionalMinutes: d * 1440 + 480 } });
      await avanzarMundoHasta(prisma, save.id, d * 1440 + 480, random);
    }
    const cuenta = async (tipos: string[]) => prisma.suceso.count({ where: { saveId: save.id, tipo: { in: tipos as never[] } } });
    return {
      saveId: save.id,
      diplomacia: await cuenta(DIPLOMACIA),
      pactos: await cuenta(['TRATADO_COMERCIAL', 'ALIANZA']),
      guerraOPaz: await cuenta(['GUERRA_DECLARADA', 'TREGUA']),
      porHambre: await prisma.expedicion.count({ where: { saveId: save.id, motivo: 'COMIDA' } }),
      revisadas: await prisma.kingdomStats.count({ where: { faction: { saveId: save.id }, ultimaRevision: { not: null } } }),
    };
  }

  it('hay expediciones por hambre, pactos, guerra o paz, y en Tranquilo claramente menos diplomacia que en Caótico', async () => {
    const [caos, calma] = await Promise.all([simular('CAOTICO', 7), simular('TRANQUILO', 7)]);
    for (const r of [caos, calma]) {
      expect(r.porHambre).toBeGreaterThan(0);
      expect(r.revisadas).toBeGreaterThan(0);
    }
    expect(caos.pactos).toBeGreaterThan(0);
    expect(caos.guerraOPaz + calma.guerraOPaz).toBeGreaterThan(0);
    expect(caos.diplomacia).toBeGreaterThan(calma.diplomacia * 1.5);
  }, 600_000);
});
