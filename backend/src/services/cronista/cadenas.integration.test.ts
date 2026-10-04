import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { CADENA_CONFLICTO_SERHU, CONFLICTO_ID } from '../worldAgenda.js';
import { aplicarEfecto } from './efectos.js';
import { avanzarCadena, parseAgenda, type Cadena } from './cadenas.js';

// CR-12 paso 12b (hito 0.2, roadmap-cronista.md § 7.3) — cadenas contra Postgres real: un paso que
// vence registra sus sucesos, aplica sus efectos y cuenta su texto en «El mundo»; el conflicto Serhu
// (primera cadena) se corta si cae el agresor.
describe('cadenas (CR-12)', () => {
  const saveIds: string[] = [];
  let worldId: string;
  const DIA = 1440;

  async function partida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'C',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }
  const reloj = (saveId: string, fictionalMinutes: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes } });
  const entrada = async (saveId: string, id: string) => parseAgenda((await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).agenda).find((e) => e.id === id);

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('siembra su entrada, y al vencer cada paso registra su suceso, aplica sus efectos y lo cuenta en «El mundo»', async () => {
    const saveId = await partida('Cadena (CR-12) genérica');
    const f = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: { not: null } }, orderBy: { slug: 'asc' } });
    const cadena: Cadena = {
      id: 'prueba-descontento',
      titulo: 'Crece el descontento',
      intervaloDias: 3,
      aplicaA: { id: saveId },
      pasos: [
        { texto: '', sucesos: [], efectos: [] },
        {
          texto: `Se oyen quejas dentro de ${f.name}.`,
          sucesos: [{ tipo: 'MALESTAR_INTERNO', actores: [{ entidadTipo: 'FACCION', entidadId: f.slug, papel: 'AFECTADO' }], datos: { faccion: f.name } }],
          efectos: [{ tipo: 'cambiarCohesion', faccionSlug: f.slug, delta: -10 }],
        },
      ],
    };
    expect(await avanzarCadena(prisma, saveId, cadena)).toEqual({ advanced: true, stagesCrossed: 0 });
    expect(await entrada(saveId, cadena.id)).toMatchObject({ stage: 0, maxStage: 1, nextStageAtMinutes: 480 + 3 * DIA });

    await reloj(saveId, 480 + 2 * DIA);
    expect(await avanzarCadena(prisma, saveId, cadena)).toEqual({ advanced: false, stagesCrossed: 0 });

    await reloj(saveId, 480 + 10 * DIA);
    expect(await avanzarCadena(prisma, saveId, cadena)).toEqual({ advanced: true, stagesCrossed: 1 });
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MALESTAR_INTERNO', origen: 'MUNDO' } })).toBe(1);
    expect((await prisma.faction.findUniqueOrThrow({ where: { id: f.id } })).cohesion).toBe(f.cohesion - 10);
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: `Se oyen quejas dentro de ${f.name}.` } })).toBe(1);
    // Último paso: ya no avanza.
    await reloj(saveId, 480 + 30 * DIA);
    expect(await avanzarCadena(prisma, saveId, cadena)).toEqual({ advanced: false, stagesCrossed: 0 });
  });

  it('el conflicto Serhu se corta si cae el Clan Serhu de la partida, y ya no avanza', async () => {
    const saveId = await partida('Gorhorn');
    await avanzarCadena(prisma, saveId, CADENA_CONFLICTO_SERHU);
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, name: 'Clan Serhu', origenSlug: { not: null } } });
    await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: 480 + DIA, origen: 'MOTOR' }, { tipo: 'disolverFaccion', faccionSlug: serhu.slug }));

    await reloj(saveId, 480 + 8 * DIA);
    expect(await avanzarCadena(prisma, saveId, CADENA_CONFLICTO_SERHU)).toEqual({ advanced: true, stagesCrossed: 0 });
    expect(await entrada(saveId, CONFLICTO_ID)).toMatchObject({ stage: 0, cortadaEn: 480 + 8 * DIA });
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: { contains: 'Con la caída del Clan Serhu' } } })).toBe(1);

    await reloj(saveId, 480 + 30 * DIA);
    expect(await avanzarCadena(prisma, saveId, CADENA_CONFLICTO_SERHU)).toEqual({ advanced: false, stagesCrossed: 0 });
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'GUERRA_DECLARADA' } })).toBe(0);
  });
});
