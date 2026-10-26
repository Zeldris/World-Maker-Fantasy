import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { detailRoutes } from '../../routes/saves/detail.js';
import { dejarConvalecienteEnCombate } from './prepararConvaleciente.js';
import { scopeFor } from '../npcScene.js';

// QA-261 (P95, P320): el paso `convaleciente:<npc>:combate` de `prepararReino.ts`, contra una partida real. Lo que se comprueba
// es lo que ve la usuaria: `GET /saves/:id` devuelve `combateIniciado` con el rival «convaleciente» (la tarjeta con Matar,
// Capturar y Clemente), y la ausencia de zona de 6 h sigue ahí (es lo previsto: el animal vencido no está en el mapa).
describe('dejarConvalecienteEnCombate (QA-261, P95/P320)', () => {
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
    return save.id;
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('deja al Guchapo convaleciente, ausente de la zona 6 h y como rival sin resolver: GET /saves/:id enseña el combate con él', async () => {
    const saveId = await partida('Convaleciente (QA-261)');
    const r = await dejarConvalecienteEnCombate(prisma, { saveId, npcSlug: 'guchapo' });
    expect(r).toMatchObject({ rivales: ['guchapo'] });

    const npc = await prisma.npc.findFirstOrThrow({ where: { slug: 'guchapo', saveId: null } });
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: npc.id } });
    expect(estado.condicionFisica).toBe('CONVALECIENTE');
    expect(estado.zonaAusenteHastaMinutes).toBe(480 + 360); // diseño: la ausencia dura lo que la convalecencia
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingCombatNpcSlugs).toEqual(['guchapo']);

    const app = Fastify();
    await app.register(detailRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().combateIniciado).toMatchObject({ npcs: [{ slug: 'guchapo', condicionFisica: 'CONVALECIENTE', saqueado: false }] });
  });

  it('es idempotente: repetirlo no duplica el rival, y conserva los que ya había', async () => {
    const saveId = await partida('Idempotente (QA-261)');
    await dejarConvalecienteEnCombate(prisma, { saveId, npcSlug: 'guchapo' });
    expect(await dejarConvalecienteEnCombate(prisma, { saveId, npcSlug: 'guchapo' })).toMatchObject({ rivales: ['guchapo'] });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: ['otro-rival'] } });
    expect(await dejarConvalecienteEnCombate(prisma, { saveId, npcSlug: 'guchapo' })).toMatchObject({ rivales: ['otro-rival', 'guchapo'] });
  });

  it('se niega, con el motivo, con una partida terminada, sin lugar, inexistente, con un NPC que no existe o con un combate en curso', async () => {
    const terminada = await partida('Terminada (QA-261)', { endedAt: new Date() });
    expect(await dejarConvalecienteEnCombate(prisma, { saveId: terminada, npcSlug: 'guchapo' })).toEqual({ error: expect.stringContaining('ha terminado') });
    const sinLugar = await partida('Sin lugar (QA-261)', { sinLugar: true });
    expect(await dejarConvalecienteEnCombate(prisma, { saveId: sinLugar, npcSlug: 'guchapo' })).toEqual({ error: expect.stringContaining('no está en ningún lugar') });
    expect(await dejarConvalecienteEnCombate(prisma, { saveId: 'no-existe', npcSlug: 'guchapo' })).toEqual({ error: expect.stringContaining('no hay partida') });
    const viva = await partida('Sin NPC (QA-261)');
    expect(await dejarConvalecienteEnCombate(prisma, { saveId: viva, npcSlug: 'no-existe-especie' })).toEqual({ error: expect.stringContaining('no hay NPC') });
    await prisma.combatEncounter.create({ data: { saveId: viva, estado: 'EN_CURSO' } });
    expect(await dejarConvalecienteEnCombate(prisma, { saveId: viva, npcSlug: 'guchapo' })).toEqual({ error: expect.stringContaining('combate en curso') });
    // Nada de lo rechazado deja rastro.
    for (const id of [terminada, sinLugar, viva]) {
      expect(await prisma.npcState.count({ where: { saveId: id, condicionFisica: 'CONVALECIENTE' } })).toBe(0);
      expect((await prisma.save.findUniqueOrThrow({ where: { id } })).pendingCombatNpcSlugs).toEqual([]);
    }
  });

  it('se niega si el NPC es de un grupo con más miembros en pie (quedaría ILESO), sin dejar el rival', async () => {
    const saveId = await partida('Grupo (QA-261)');
    const npc = await prisma.npc.findFirstOrThrow({ where: { slug: 'guchapo', saveId: null } });
    // La fauna lleva el lugar como scope (`scopeFor`): el grupo se siembra en el mismo estado que el paso va a escribir.
    const lugar = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).currentLocationId!;
    await prisma.npcState.create({ data: { saveId, npcId: npc.id, scope: scopeFor(npc.kind, lugar), groupSize: 3, groupDefeated: 0 } });
    const r = await dejarConvalecienteEnCombate(prisma, { saveId, npcSlug: 'guchapo' });
    expect(r).toEqual({ error: expect.stringContaining('grupo con más miembros') });
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingCombatNpcSlugs).toEqual([]);
    // La transacción vuelve atrás: ni la condición ni el miembro vencido que `dejarNpcConvaleciente` llegó a escribir.
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: npc.id } });
    expect(estado.condicionFisica).toBe('ILESO');
    expect(estado.groupDefeated).toBe(0);
  });
});
