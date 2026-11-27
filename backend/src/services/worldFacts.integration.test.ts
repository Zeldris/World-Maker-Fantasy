import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// QA-523: los hechos del mundo se embeben con bge-m3 (1024). Contra Postgres real: la columna admite ese tamaño, un
// hecho sin vector (los anteriores a la migración) no rompe la consulta y el re-embebido no toca su texto. El
// re-embebido va acotado a la partida de la prueba: sin acotar, escribiría vectores falsos en las de la base.
const embed = vi.fn(async () => Array.from({ length: 1024 }, () => 0.5));
vi.mock('../lib/embeddings.js', () => ({ embed, toVectorLiteral: (v: number[]) => `[${v.join(',')}]` }));

const { prisma } = await import('../lib/prisma.js');
const { getDefaultUserId } = await import('../lib/defaultUser.js');
const { loadSessionFacts, reembeberHechos, selectRelevantFacts } = await import('./worldFacts.js');

describe('hechos del mundo contra Postgres (QA-523)', () => {
  let worldId: string;
  let saveId: string;
  const textos = Array.from({ length: 12 }, (_, i) => `Hecho QA-523 número ${i}`);

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, saveId: null } });
    const userId = await getDefaultUserId();
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (QA-523)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    for (const [i, text] of textos.entries()) {
      await prisma.$executeRaw`
        INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
        VALUES (${crypto.randomUUID()}, ${saveId}, ${text}, NULL, ${new Date(Date.now() + i)})
      `;
    }
  });

  afterAll(async () => {
    if (saveId) await prisma.save.deleteMany({ where: { id: saveId } });
    await prisma.$disconnect();
  });

  const sinVector = async () =>
    Number((await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "SessionFact" WHERE "saveId" = ${saveId} AND embedding IS NULL`)[0]!.n);

  it('con los hechos sin vector, la selección responde con los recientes', async () => {
    const elegidos = await selectRelevantFacts('miro alrededor', saveId, worldId, textos);
    expect(elegidos).toContain(textos.at(-1));
    expect(elegidos.some((f) => f.startsWith('Antes en esta partida: '))).toBe(false);
  });

  it('re-embebe los pendientes con vectores de 1024, sin tocar el texto, y repetirlo no hace nada', async () => {
    expect(await reembeberHechos(saveId)).toBe(12);
    expect(await sinVector()).toBe(0);
    expect(await loadSessionFacts(saveId)).toEqual(textos);
    embed.mockClear();
    expect(await reembeberHechos(saveId)).toBe(0);
    expect(embed).not.toHaveBeenCalled();
  });
});
