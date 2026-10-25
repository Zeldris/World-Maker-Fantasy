import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { advanceCorpseAndRecoveryTimeouts } from '../companionSupervivencia.js';
import { registrarSuceso } from './sucesos.js';

// CR-1 (hito 0.2, roadmap-cronista.md § 5.1): el esquema del Libro de Sucesos contra Postgres real —
// un suceso con sus actores, una cadena causa → efecto, y todo se va con la partida.
describe('Libro de Sucesos: modelos (CR-1)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (Libro de Sucesos)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('guarda un suceso con actores y una cadena causa → efecto', async () => {
    const muerte = await prisma.suceso.create({
      data: {
        saveId,
        tipo: 'MUERTE_NPC',
        familia: 'VIDA_MUERTE',
        fictionalMinutes: 600,
        regionSlug: 'llanuras-viento-rojo',
        importancia: 6,
        origen: 'JUGADOR',
        datos: { npcSlug: 'orco-enfurecido' },
        texto: 'Gorhorn mata al Orco Enfurecido.',
        semilla: 's1',
        actores: {
          create: [
            { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' },
            { entidadTipo: 'NPC', entidadId: 'orco-enfurecido', papel: 'VICTIMA' },
          ],
        },
      },
    });
    const venganza = await prisma.suceso.create({
      data: {
        saveId,
        tipo: 'JURA_VENGANZA',
        familia: 'VIDA_MUERTE',
        fictionalMinutes: 700,
        importancia: 5,
        origen: 'MOTOR',
        datos: {},
        texto: 'Su hermano jura venganza.',
        semilla: 's2',
        causas: { create: [{ causaId: muerte.id }] },
      },
    });

    const conCadena = await prisma.suceso.findUniqueOrThrow({ where: { id: muerte.id }, include: { actores: true, efectos: true } });
    expect(conCadena.actores.map((a) => a.papel).sort()).toEqual(['AUTOR', 'VICTIMA']);
    expect(conCadena.efectos.map((e) => e.efectoId)).toEqual([venganza.id]);

    // Buscar por actor (índice entidadTipo + entidadId): ¿qué le ha pasado al Orco?
    const delOrco = await prisma.sucesoActor.findMany({ where: { entidadTipo: 'NPC', entidadId: 'orco-enfurecido' } });
    expect(delOrco.map((a) => a.sucesoId)).toContain(muerte.id);
  });

  it('borrar la partida borra su Libro entero (sucesos, actores y causas)', async () => {
    const otra = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id,
        characterName: 'Gorhorn de prueba (Libro, borrado)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    const s = await prisma.suceso.create({
      data: {
        saveId: otra.id, tipo: 'CLIMA_TORMENTA', familia: 'CLIMA', fictionalMinutes: 1, importancia: 2, origen: 'MUNDO', datos: {}, texto: 'Tormenta.', semilla: 's',
        actores: { create: [{ entidadTipo: 'REGION', entidadId: 'llanuras-viento-rojo', papel: 'LUGAR' }] },
      },
    });

    await prisma.save.delete({ where: { id: otra.id } });

    expect(await prisma.suceso.findUnique({ where: { id: s.id } })).toBeNull();
    expect(await prisma.sucesoActor.count({ where: { sucesoId: s.id } })).toBe(0);
  });
});

// CR-2 (hito 0.2, roadmap-cronista.md § 6.2): la única puerta de entrada al Libro.
describe('registrarSuceso (CR-2)', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: world.id,
        characterName: 'Gorhorn de prueba (registrarSuceso)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('calcula familia, texto e importancia (jugador autor + NPC del núcleo) y guarda actores y causas', async () => {
    const gistera = await prisma.npc.findFirstOrThrow({ where: { slug: 'gistera-koh' } });
    const previo = await registrarSuceso(prisma, {
      saveId, tipo: 'PROMESA', fictionalMinutes: 500, origen: 'JUGADOR',
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }],
      datos: { personaje: 'Gorhorn', a: 'Gistera Koh', promesa: 'acabar con su perseguidor' },
    });
    const id = await registrarSuceso(prisma, {
      saveId, tipo: 'PERDON_CONCEDIDO', fictionalMinutes: 600, regionSlug: 'llanuras-viento-rojo', origen: 'JUGADOR',
      actores: [
        { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' },
        { entidadTipo: 'NPC', entidadId: gistera.id, papel: 'BENEFICIARIO' },
        { entidadTipo: 'NPC', entidadId: gistera.id, papel: 'BENEFICIARIO' },
      ],
      datos: { personaje: 'Gorhorn', perdonado: 'Gistera Koh' },
      causas: [previo, previo],
    });

    const suceso = await prisma.suceso.findUniqueOrThrow({ where: { id }, include: { actores: true, causas: true } });
    expect(suceso.familia).toBe('JUGADOR');
    expect(suceso.texto).toBe('Gorhorn perdona la vida a Gistera Koh.');
    expect(suceso.importancia).toBe(4 + 1 + 1); // base 4, jugador autor, Gistera es del núcleo jugable
    expect(suceso.actores).toHaveLength(2); // el actor repetido cuenta una vez
    expect(suceso.causas.map((c) => c.causaId)).toEqual([previo]);
    expect(suceso.semilla).toBeTruthy();
  });

  it('dentro de una transacción que falla, el suceso no queda en el Libro', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await registrarSuceso(tx, {
          saveId, tipo: 'TORMENTA', fictionalMinutes: 700, origen: 'MUNDO',
          actores: [{ entidadTipo: 'REGION', entidadId: 'llanuras-viento-rojo', papel: 'LUGAR' }],
          datos: { region: 'las Llanuras del Viento Rojo' },
        });
        throw new Error('el turno falla');
      }),
    ).rejects.toThrow('el turno falla');
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'TORMENTA' } })).toBe(0);
  });

  // P247: la cadena de Serhu y el cambio de banda de la relación emitían la misma alianza con minutos de diferencia
  it('una alianza entre las mismas facciones en la misma semana se cuenta una sola vez (P247)', async () => {
    const alianza = (min: number, a: string, b: string) => registrarSuceso(prisma, {
      saveId, tipo: 'ALIANZA', fictionalMinutes: min, origen: 'MUNDO',
      actores: [{ entidadTipo: 'FACCION', entidadId: a, papel: 'AFECTADO' }, { entidadTipo: 'FACCION', entidadId: b, papel: 'AFECTADO' }],
      datos: { faccionA: 'A', faccionB: 'B' },
    });
    const primera = await alianza(10 * 1440, 'faccion-a', 'faccion-b');
    expect(await alianza(10 * 1440 + 30, 'faccion-b', 'faccion-a')).toBe(primera); // mismo pacto, orden distinto
    expect(await alianza(14 * 1440, 'faccion-a', 'faccion-b')).toBe(primera); // dentro de la ventana
    expect(await alianza(10 * 1440, 'faccion-a', 'faccion-c')).not.toBe(primera); // otra pareja
    expect(await alianza(40 * 1440, 'faccion-a', 'faccion-b')).not.toBe(primera); // un pacto nuevo, un mes después
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'ALIANZA' } })).toBe(3);
  });

  // Revisión P247: si entre las dos alianzas se rompieron, la segunda es un pacto nuevo y se cuenta.
  it('alianza, ruptura y alianza nueva en la misma semana son dos pactos', async () => {
    const actores = [{ entidadTipo: 'FACCION' as const, entidadId: 'faccion-x', papel: 'AFECTADO' as const }, { entidadTipo: 'FACCION' as const, entidadId: 'faccion-y', papel: 'AFECTADO' as const }];
    const alianza = (min: number) => registrarSuceso(prisma, { saveId, tipo: 'ALIANZA', fictionalMinutes: min, origen: 'MUNDO', actores, datos: { faccionA: 'X', faccionB: 'Y' } });
    const primera = await alianza(60 * 1440);
    await registrarSuceso(prisma, { saveId, tipo: 'RUPTURA', fictionalMinutes: 62 * 1440, origen: 'MUNDO', actores, datos: { faccionA: 'X', faccionB: 'Y' } });
    const segunda = await alianza(64 * 1440);
    expect(segunda).not.toBe(primera);
    expect(await alianza(64 * 1440 + 30)).toBe(segunda); // el mismo pacto nuevo, visto otra vez, sí se junta
  });
});

// CR-3 (hito 0.2): con el tiempo, un NPC convaleciente se recupera y un cadáver desaparece — los dos
// quedan en el Libro (barrido del mundo, `advanceCorpseAndRecoveryTimeouts`).
describe('emisores de recuperación y cadáveres (CR-3)', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn de prueba (timeouts del Libro)', characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor', characterMotivation: 'x', portraitInitial: 'G',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 10 * 1440 } });
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('la recuperación y el cadáver que desaparece dejan RECUPERACION_NPC y CADAVER_DESAPARECE', async () => {
    const [herido, muerto] = await Promise.all([
      prisma.npc.findFirstOrThrow({ where: { slug: 'gistera-koh' } }),
      prisma.npc.findFirstOrThrow({ where: { slug: 'aullador-rojo' } }),
    ]);
    await prisma.npcState.createMany({
      data: [
        { saveId, npcId: herido.id, scope: 'libro-timeouts', condicionFisica: 'CONVALECIENTE', condicionFisicaSinceMinutes: 0 },
        { saveId, npcId: muerto.id, scope: 'libro-timeouts', condicionFisica: 'MUERTO', condicionFisicaSinceMinutes: 0 },
      ],
    });

    await advanceCorpseAndRecoveryTimeouts(prisma);

    const recuperacion = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'RECUPERACION_NPC' } });
    expect(recuperacion.texto).toBe(`${herido.name} se recupera de sus heridas.`);
    const cadaver = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'CADAVER_DESAPARECE' } });
    expect(cadaver.texto).toBe(`Del cuerpo de ${muerto.name} ya no queda nada.`);
  });
});
