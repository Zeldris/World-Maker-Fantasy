import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { slugify } from '../../lib/slugify.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { aplicarEfecto, CUALQUIERA_SALVO_ORIGEN, type Disparo } from './efectos.js';
import { evaluarConsecuencias, registrarRegla } from './consecuencias.js';
import { procesarReacciones } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';

// CR-11 (hito 0.2, roadmap-cronista.md § 7.2) — programar, disparar por días, región o suceso,
// caducar y anular, contra Postgres real. Regla de prueba: baja la cohesión de una facción.
describe('consecuencias aplazadas (CR-11)', () => {
  let saveId: string;
  let worldId: string;
  let hondonadaId: string;
  const DIA = 1440;

  registrarRegla({ id: 'PRUEBA_COHESION', alDisparar: async () => [{ tipo: 'cambiarCohesion', faccionSlug: 'clan-helsig', delta: -5 }] });
  registrarRegla({ id: 'PRUEBA_PERDIDA', alDisparar: async () => null });

  const cohesion = async () => (await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'clan-helsig' } })).cohesion;
  const irA = (minutos: number, locationId?: string) =>
    prisma.save.update({ where: { id: saveId }, data: { worldState: { update: { fictionalMinutes: minutos } }, ...(locationId ? { currentLocationId: locationId } : {}) } });
  const programar = (regla: string, disparo: Disparo, extra: { caducaDias?: number; aviso?: string; npcId?: string } = {}) =>
    prisma.$transaction(async (tx) => {
      const ws = await tx.worldState.findUniqueOrThrow({ where: { saveId } });
      return aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: ws.fictionalMinutes, origen: 'MOTOR', random: () => 0 }, { tipo: 'programarConsecuencia', regla, disparo, datos: {}, ...extra });
    });
  const estado = async (regla: string) => (await prisma.consecuencia.findFirstOrThrow({ where: { saveId, regla }, orderBy: { createdAt: 'desc' } })).estado;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    hondonadaId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Consecuencias (CR-11)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'C',
        currentLocationId: hondonadaId,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('DIAS: no se dispara antes de su día; el día que toca aplica la regla una sola vez; el aviso queda en el canal del personaje', async () => {
    await programar('PRUEBA_COHESION', { tipo: 'DIAS', min: 2, max: 4 }, { aviso: 'Algo te dice que esto no ha terminado.' });
    expect((await prisma.logEntry.findFirst({ where: { saveId, text: 'Algo te dice que esto no ha terminado.' } }))?.channel).toBe('CHARACTER');
    const antes = await cohesion();
    await irA(480 + DIA);
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(0);
    // random 0 → el mínimo: día 2.
    await irA(480 + 2 * DIA);
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(1);
    expect(await cohesion()).toBe(antes - 5);
    expect(await estado('PRUEBA_COHESION')).toBe('DISPARADA');
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(0);
  });

  it('LLEGAR_REGION cualquiera salvo el origen: no se dispara en la región de origen, sí al llegar a otra', async () => {
    const hondonada = await prisma.location.findUniqueOrThrow({ where: { id: hondonadaId } });
    const otra = await prisma.location.findFirstOrThrow({ where: { worldId, region: { not: hondonada.region } } });
    await programar('PRUEBA_COHESION', { tipo: 'LLEGAR_REGION', regionSlug: CUALQUIERA_SALVO_ORIGEN, origenSlug: slugify(hondonada.region) });
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(0);
    await irA(480 + 2 * DIA, otra.id);
    expect((await evaluarConsecuencias(prisma, saveId)).disparadas).toBe(1);
    await irA(480 + 2 * DIA, hondonadaId);
  });

  it('caduca sin dispararse (CONSECUENCIA_PERDIDA) y se puede anular', async () => {
    await programar('PRUEBA_COHESION', { tipo: 'ENCUENTRO_NPC', npcId: 'npc-que-no-aparece' }, { caducaDias: 1 });
    await irA(480 + 4 * DIA);
    expect((await evaluarConsecuencias(prisma, saveId)).caducadas).toBe(1);
    expect(await estado('PRUEBA_COHESION')).toBe('CADUCADA');
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CONSECUENCIA_PERDIDA' } })).toBe(1);

    await programar('PRUEBA_PERDIDA', { tipo: 'DIAS', min: 5, max: 5 }, { npcId: 'npc-x' });
    const r = await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: 480 + 4 * DIA, origen: 'MOTOR' }, { tipo: 'anularConsecuencia', regla: 'PRUEBA_PERDIDA', npcId: 'npc-x' }));
    expect(r.aplicado).toBe(true);
    expect(await estado('PRUEBA_PERDIDA')).toBe('ANULADA');
  });

  it('una regla que ya no tiene sentido al dispararse se pierde; ENCUENTRO_NPC se dispara al cruzarse', async () => {
    await programar('PRUEBA_PERDIDA', { tipo: 'ENCUENTRO_NPC', npcId: 'npc-y' });
    expect((await evaluarConsecuencias(prisma, saveId, { npcIds: ['otro'] })).disparadas).toBe(0);
    await evaluarConsecuencias(prisma, saveId, { npcIds: ['npc-y'] });
    expect(await estado('PRUEBA_PERDIDA')).toBe('DISPARADA');
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CONSECUENCIA_PERDIDA' } })).toBe(2);
  });

  it('SUCESO: se dispara cuando la cola de reacciones procesa un suceso de ese tipo', async () => {
    await procesarReacciones(prisma, saveId);
    await programar('PRUEBA_COHESION', { tipo: 'SUCESO', tipos: ['TORMENTA'] });
    const antes = await cohesion();
    await prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo: 'TORMENTA', fictionalMinutes: 480 + 4 * DIA, origen: 'MOTOR', actores: [], datos: { region: 'x' } }));
    await procesarReacciones(prisma, saveId);
    expect(await cohesion()).toBe(antes - 5);
  });
});
