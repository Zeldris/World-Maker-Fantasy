import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

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
