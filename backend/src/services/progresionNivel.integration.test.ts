import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { hacerNivel } from './progresionPersonaje.js';
import { dejarMochilaLibre } from './cronista/prepararMochila.js';
import { depositarEnAlmacen } from './cronista/almacenDeposito.js';

// P370/P367: `nivel:<n>` y `mochila-libre` de `prepararReino.ts` usan las funciones del juego (subir de nivel, Depositar).
describe('hacerNivel y dejarMochilaLibre (P370, P367)', () => {
  const saveIds: string[] = [];
  async function partida(nombre: string) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 5, destreza: 10, constitucion: 5, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    return save.id;
  }
  afterAll(async () => { await prisma.save.deleteMany({ where: { id: { in: saveIds } } }); });

  it('nivel sube al nivel pedido y no baja ni pasa de 19', async () => {
    const saveId = await partida('Nivel (P370)');
    const r = await hacerNivel(prisma, { saveId, nivel: 8 });
    expect(r).toHaveProperty('hasta', 8);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).level).toBe(8);
    expect(await hacerNivel(prisma, { saveId, nivel: 5 })).toHaveProperty('error');
    expect(await hacerNivel(prisma, { saveId, nivel: 20 })).toHaveProperty('error');
  });

  it('mochila-libre deposita en el Almacén hasta dejar el hueco pedido', async () => {
    const saveId = await partida('Mochila (P367)');
    // capacidad = 20 + 5 + 5 = 30; se llena con 30 piezas
    await prisma.inventoryItem.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ saveId, name: `Trasto ${i}`, description: '' })) });
    const r = await dejarMochilaLibre(prisma, { saveId, hueco: 10 });
    expect(r).not.toHaveProperty('error');
    if ('error' in r) return;
    expect(r.antes).toBe(30);
    expect(r.despues).toBeLessThanOrEqual(20);
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBeGreaterThanOrEqual(10);
    expect(await depositarEnAlmacen(prisma, saveId, 'no-existe')).toMatchObject({ ok: false, status: 404 });
  });
});
