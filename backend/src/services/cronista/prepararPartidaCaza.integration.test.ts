import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { avanzarViajeros } from '../viajeros.js';
import { SLUG_PIEZA } from '../partidasCaza.js';
import { prepararPartidaCaza } from './prepararPartidaCaza.js';
import { descartarDeMochila } from './prepararMochila.js';
import { totalInventoryUnits } from '../inventoryCapacity.js';

// QA-298 (P338, P339): el paso `partida-caza:<presa>:<n>[:permanente]` de `prepararReino.ts`. Se comprueba lo que ve la usuaria:
// al avanzar el día la partida vuelve con n piezas por el camino normal (aviso del Reino y piezas en el Almacén) y, con orden
// permanente y el Desolladero dañado, la orden se corta diciendo que está dañado.
describe('prepararPartidaCaza (QA-298)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, o: { cazadores?: number; fauna?: boolean; visitada?: boolean } = {}) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlace = await prisma.locationLink.findFirstOrThrow({ where: { from: { worldId: world.id } } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: enlace.fromId, worldState: { create: { fictionalMinutes: 20 * 1440 } },
      },
    });
    saveIds.push(save.id);
    await prisma.kingdomStats.create({ data: { saveId: save.id, ownerKey: ownerKeyFor({ saveId: save.id }), comida: 0, poblacion: 4 } });
    await prisma.building.create({ data: { saveId: save.id, recipeKey: 'ayuntamiento', name: 'Ayuntamiento', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', locationId: enlace.fromId } });
    if (o.fauna !== false) await prisma.zonePoint.create({ data: { saveId: save.id, locationId: enlace.toId, tipo: 'FAUNA', targetSlug: 'murgol', x: 1, y: 1, cantidad: 6 } });
    if (o.visitada !== false) await prisma.locationVisit.create({ data: { saveId: save.id, locationId: enlace.toId } });
    for (let i = 0; i < (o.cazadores ?? 2); i++) await prisma.subject.create({ data: { saveId: save.id, name: `Cazador ${i}`, role: 'cazador', notes: '', pueblo: 'orcos' } });
    return save.id;
  }
  const dia = async (saveId: string, n: number) => {
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: n * 1440 } });
    await avanzarViajeros(prisma, saveId, n, Math.random);
  };
  const avisos = (saveId: string) => prisma.logEntry.findMany({ where: { saveId, channel: 'KINGDOM' }, select: { text: true } }).then((l) => l.map((x) => x.text));

  afterAll(async () => { await prisma.save.deleteMany({ where: { id: { in: saveIds } } }); });

  it('la partida vuelve al avanzar con n piezas, por el camino normal (aviso y Almacén)', async () => {
    const saveId = await partida('Caza n piezas (QA-298)');
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 3 })).toMatchObject({ nueva: true, piezas: 3, nombre: 'Múrgol' });
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: SLUG_PIEZA } })).toBe(0); // aún no ha vuelto
    await dia(saveId, 21);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: SLUG_PIEZA } })).toBe(3);
    expect(await avisos(saveId)).toContain('La partida de caza vuelve con 3 piezas de Múrgol. Se estropean en 2 días: llévalas al Desolladero.');
  });

  it('con 1 pieza dice «1 pieza» (P339)', async () => {
    const saveId = await partida('Caza 1 pieza (QA-298)');
    await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 1 });
    await dia(saveId, 21);
    expect((await avisos(saveId)).some((t) => t.startsWith('La partida de caza vuelve con 1 pieza de Múrgol.'))).toBe(true);
  });

  it('P338: con orden permanente y el Desolladero dañado, la orden se corta diciendo que está dañado', async () => {
    const saveId = await partida('Caza permanente (QA-298)');
    await prisma.building.create({ data: { saveId, recipeKey: 'desolladero', name: 'Desolladero', kind: 'desolladero', description: 'x', status: 'DANADO' } });
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 2, permanente: true })).toMatchObject({ permanente: true });
    await dia(saveId, 21);
    expect((await avisos(saveId)).some((t) => t.includes('La partida deja de repetir su orden: el Desolladero no da abasto porque está dañado'))).toBe(true);
    expect((await prisma.viajero.findFirstOrThrow({ where: { saveId } })).orden).toBeNull();
  });

  it('con una partida de esa presa ya en marcha y orden permanente, es esa y conserva la orden', async () => {
    const saveId = await partida('Caza en marcha (QA-298)');
    await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 1, permanente: true });
    const antes = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 4 })).toMatchObject({ nueva: false, permanente: true });
    expect(await prisma.viajero.count({ where: { saveId } })).toBe(1);
    const despues = await prisma.viajero.findFirstOrThrow({ where: { saveId } });
    expect(despues.id).toBe(antes.id);
    expect(despues.orden).toEqual({ repetir: true });
    expect(despues.carga).toMatchObject({ piezas: 4 });
  });

  it('se niega con el motivo: sin cazadores, presa que no existe, n 0 o negativo, sin presa conocida', async () => {
    const sin = await partida('Sin cazadores (QA-298)', { cazadores: 0 });
    expect(await prepararPartidaCaza(prisma, { saveId: sin, especie: 'murgol', piezas: 2 })).toEqual({ error: expect.stringContaining('no hay cazadores libres') });
    const ok = await partida('Rechazos (QA-298)');
    expect(await prepararPartidaCaza(prisma, { saveId: ok, especie: 'no-existe-especie', piezas: 2 })).toEqual({ error: expect.stringContaining('no hay presa') });
    expect(await prepararPartidaCaza(prisma, { saveId: ok, especie: 'murgol', piezas: 0 })).toEqual({ error: expect.stringContaining('n tiene que ser') });
    expect(await prepararPartidaCaza(prisma, { saveId: ok, especie: 'murgol', piezas: -1 })).toEqual({ error: expect.stringContaining('n tiene que ser') });
    const nada = await partida('Sin presa (QA-298)', { visitada: false });
    expect(await prepararPartidaCaza(prisma, { saveId: nada, especie: 'murgol', piezas: 2 })).toEqual({ error: expect.stringContaining('ningún lugar conocido') });
    expect(await prisma.viajero.count({ where: { saveId: { in: [sin, ok, nada] } } })).toBe(0);
  });

  // QA-299 (P439): la partida vuelve sin piezas y con h heridos; el aviso es el del juego («h de los suyos salen heridos»).
  it('heridos=1: el aviso del juego dice «1 de los suyos salen heridos», sin piezas', async () => {
    const saveId = await partida('Caza heridos (QA-299)');
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 0, heridos: 1 })).toMatchObject({ nueva: true, piezas: 0, heridos: 1 });
    expect(await avisos(saveId)).toContain('La partida de caza planta cara a Múrgol en ' + (await prisma.location.findFirstOrThrow({ where: { id: (await prisma.viajero.findFirstOrThrow({ where: { saveId } })).destinoLocationId } })).name + ' y no abate ninguno: 1 de los suyos salen heridos y se retiran.');
    await dia(saveId, 21);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: SLUG_PIEZA } })).toBe(0);
    expect(await prisma.viajero.findFirstOrThrow({ where: { saveId } })).toMatchObject({ estado: 'TERMINADO' });
  });

  it('heridos: un compañero de la partida queda HERIDO de verdad y pedir más heridos que cazadores se niega sin dejar nada', async () => {
    const saveId = await partida('Caza heridos compañero (QA-299)', { cazadores: 0 });
    const attributes = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
    const compa = await prisma.companion.create({ data: { saveId, name: 'Compa', role: 'aliado', notes: '', attributes, combatGroupSlotIndex: 1 } });
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 0, heridos: 2 })).toEqual({ error: expect.stringContaining('solo tiene 1 cazador: no pueden salir 2 heridos') });
    expect(await prisma.viajero.count({ where: { saveId } })).toBe(0);
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 0, heridos: 1 })).toMatchObject({ heridos: 1 });
    expect((await prisma.companion.findUniqueOrThrow({ where: { id: compa.id } })).condicionFisica).toBe('HERIDO');
    expect((await avisos(saveId)).some((t) => t.includes('1 de los suyos salen heridos'))).toBe(true);
  });

  it('heridos con piezas se niega', async () => {
    const saveId = await partida('Caza heridos y piezas (QA-299)');
    expect(await prepararPartidaCaza(prisma, { saveId, especie: 'murgol', piezas: 2, heridos: 1 })).toEqual({ error: expect.stringContaining('con heridos no hay piezas') });
  });

  // QA-299 (P336): tirar lo suelto hasta dejar hueco, aunque el Almacén no admita nada más.
  it('mochila-descartar deja hueco tirando lo suelto, sin tocar lo equipado, y luego cabe lo que se da', async () => {
    const saveId = await partida('Mochila descartar (QA-299)');
    const atr = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).attributes as { fuerza: number; constitucion: number };
    const capacidad = 20 + atr.fuerza + atr.constitucion;
    await prisma.inventoryItem.create({ data: { saveId, name: 'Espada equipada', description: 'x', origin: 'x', slot: 'ACCESORIO' } });
    await prisma.inventoryItem.createMany({ data: [{ saveId, name: 'Roca (' + (capacidad + 30) + ')', description: 'x', origin: 'x' }, { saveId, name: 'Cuerda (5)', description: 'x', origin: 'x' }] });
    expect(totalInventoryUnits(await prisma.inventoryItem.findMany({ where: { saveId } }))).toBeGreaterThan(capacidad);
    expect(await descartarDeMochila(prisma, { saveId, hueco: 12 })).toMatchObject({ capacidad, hueco: capacidad - 6, descartados: 1 });
    const quedan = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(quedan.map((i) => i.name).sort()).toEqual(['Cuerda (5)', 'Espada equipada']);
    expect(await descartarDeMochila(prisma, { saveId, hueco: 12 })).toMatchObject({ descartados: 0, hueco: capacidad - 6 });
    expect(await descartarDeMochila(prisma, { saveId, hueco: capacidad + 1 })).toEqual({ error: expect.stringContaining('la capacidad es') });
  });
});
