import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { dejarPuntoRetirado } from './prepararPuntoRetirado.js';
import { FAUNA_AMBIENTAL } from '../../scripts/worldCatalog.js';

// QA-266 (P313): el paso `punto-retirado:<especie>[:<n>]` de `prepararReino.ts` deja un punto de fauna retirado con presas
// (`activo` false y `cantidad` > 0), que es el que Reino › Partidas no tiene que listar.
describe('dejarPuntoRetirado (QA-266, P313)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, opciones: { endedAt?: Date; sinLugar?: boolean } = {}) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: opciones.sinLugar ? null : lugar.id, endedAt: opciones.endedAt ?? null,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return { saveId: save.id, lugarId: lugar.id };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('deja un punto de fauna retirado con las presas pedidas, en el lugar actual', async () => {
    const { saveId, lugarId } = await partida('Punto retirado (QA-266)');
    const r = await dejarPuntoRetirado(prisma, { saveId, especie: 'kirelon-arenoso', cantidad: 4 });
    expect(r).toMatchObject({ cantidad: 4, yaEstaba: false });
    const puntos = await prisma.zonePoint.findMany({ where: { saveId, locationId: lugarId, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', cantidad: 4 } });
    expect(puntos).toHaveLength(1);
    expect(puntos[0]!.activo).toBe(false);
  });

  it('es idempotente: la segunda vez no crea otro punto', async () => {
    const { saveId, lugarId } = await partida('Punto retirado repetido (QA-266)');
    await dejarPuntoRetirado(prisma, { saveId, especie: 'kirelon-arenoso' });
    const segunda = await dejarPuntoRetirado(prisma, { saveId, especie: 'kirelon-arenoso', cantidad: 9 });
    expect(segunda).toMatchObject({ cantidad: 3, yaEstaba: true });
    expect(await prisma.zonePoint.count({ where: { saveId, locationId: lugarId, targetSlug: 'kirelon-arenoso', activo: false, cantidad: { gt: 0 } } })).toBe(1);
  });

  it('rechaza con un motivo claro: partida inexistente o terminada, sin lugar, especie inexistente, no fauna, ambiental y presas fuera de rango', async () => {
    expect(await dejarPuntoRetirado(prisma, { saveId: 'no-existe', especie: 'kirelon-arenoso' })).toEqual({ error: 'punto-retirado: no hay partida no-existe.' });
    const terminada = await partida('Terminada (QA-266)', { endedAt: new Date() });
    expect(await dejarPuntoRetirado(prisma, { saveId: terminada.saveId, especie: 'kirelon-arenoso' })).toEqual({ error: 'punto-retirado: la partida ha terminado.' });
    const sinLugar = await partida('Sin lugar (QA-266)', { sinLugar: true });
    expect(await dejarPuntoRetirado(prisma, { saveId: sinLugar.saveId, especie: 'kirelon-arenoso' })).toEqual({ error: 'punto-retirado: la partida no está en ningún lugar.' });
    const { saveId } = await partida('Rechazos (QA-266)');
    expect(await dejarPuntoRetirado(prisma, { saveId, especie: 'no-existe' })).toEqual({ error: 'punto-retirado: no hay fauna no-existe.' });
    const persona = await prisma.npc.findFirstOrThrow({ where: { saveId: null, faunaCategoria: null } });
    expect(await dejarPuntoRetirado(prisma, { saveId, especie: persona.slug })).toEqual({ error: `punto-retirado: ${persona.slug} no es fauna.` });
    const ambiental = [...FAUNA_AMBIENTAL][0]!;
    expect(await dejarPuntoRetirado(prisma, { saveId, especie: ambiental })).toEqual({ error: `punto-retirado: ${ambiental} es fauna ambiental, no tiene puntos en el mapa.` });
    expect(await dejarPuntoRetirado(prisma, { saveId, especie: 'kirelon-arenoso', cantidad: 0 })).toMatchObject({ error: expect.stringContaining('de 1 a 20') });
    expect(await prisma.zonePoint.count({ where: { saveId, activo: false, cantidad: { gt: 0 } } })).toBe(0);
  });
});
