import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { decrementPopulationOnDeath } from '../population.js';
import { abandonarMision, aceptarMision, entregarMision, ErrorMision, revisarMisiones } from './misionesJugadora.js';
import { recompensaDe, textoDeMision, PLAZO_DIAS, type HuecosMision } from './misiones.js';
import Fastify from 'fastify';
import { misionesRoutes } from '../../routes/saves/misiones.js';

/// CR-40 40e contra Postgres real: aceptar un aviso (con sus límites), avanzar y cumplir cada tipo
/// (cazar por las muertes de fauna, entregar donde se aceptó, explorar al visitar, combatir al derrotar
/// al grupo situado), fallar por plazo y abandonar, con XP, Goirnos y reputación.
describe('misiones secundarias de la jugadora (CR-40 40e)', () => {
  let saveId: string;
  let worldId: string;
  const facciones: Record<string, { id: string; name: string }> = {};
  let tablonHelsig: { id: string; locationId: string };

  const rep = async (faccion: string) => ((await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).factionsStatus as Record<string, number>)[faccion] ?? 2500;

  async function aviso(slug: string, h: Partial<HuecosMision> & Pick<HuecosMision, 'tipo'>, buildingId: string | null = null) {
    const f = facciones[slug]!;
    const huecos: HuecosMision = { motivo: 'CONFLICTO', faccion: { slug, nombre: f.name, pueblo: 'orcos' }, region: 'Las Llanuras del Viento Rojo', cantidad: 1, plazoDias: PLAZO_DIAS[h.tipo], ...h };
    const { titulo, descripcion } = textoDeMision(huecos, 0);
    return prisma.misionOfrecida.create({
      data: {
        saveId, buildingId, factionId: f.id, tipo: huecos.tipo, motivo: huecos.motivo, huecos: huecos as unknown as Prisma.InputJsonValue, titulo, descripcion,
        recompensa: recompensaDe(huecos) as unknown as Prisma.InputJsonValue, creadaEn: 0, retiraEn: 99_999,
      },
    });
  }

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Misiones', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'M',
        worldState: { create: { fictionalMinutes: 10 * 1440, factionsStatus: {} } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    for (const slug of ['clan-serhu', 'clan-helsig', 'clan-goshg', 'feg-ger']) {
      facciones[slug] = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: slug }, select: { id: true, name: true } });
    }
    const t = await prisma.building.findFirstOrThrow({ where: { factionId: facciones['clan-helsig']!.id, recipeKey: 'tablon-avisos' }, select: { id: true, locationId: true } });
    tablonHelsig = { id: t.id, locationId: t.locationId! };
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('cazar: aceptar, una por facción, y se cumple con las piezas abatidas (XP, Goirnos, reputación, Libro)', async () => {
    const a = await aviso('clan-serhu', { tipo: 'CAZAR', motivo: 'EXCESO_FAUNA', especie: { slug: 'canizor', nombre: 'canizores' }, cantidad: 3 });
    const quest = await aceptarMision(prisma, saveId, a.id);
    expect(quest).toMatchObject({ status: 'ACTIVA', tipoMision: 'CAZAR', cantidad: 3, progreso: 0, venceEn: 10 * 1440 + PLAZO_DIAS.CAZAR * 1440 });
    await expect(aceptarMision(prisma, saveId, a.id)).rejects.toBeInstanceOf(ErrorMision);
    const otra = await aviso('clan-serhu', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar: { id: 'x', nombre: 'X' } });
    await expect(aceptarMision(prisma, saveId, otra.id)).rejects.toThrow('Ya tienes una misión abierta para esta facción');

    const antes = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { xp: true, goirnos: true } });
    const repAntes = await rep('Clan Serhu');
    for (let i = 0; i < 3; i++) await decrementPopulationOnDeath(prisma, saveId, null, 'canizor', 'Las Llanuras del Viento Rojo');
    const fin = await prisma.quest.findUniqueOrThrow({ where: { id: quest.id } });
    expect(fin).toMatchObject({ status: 'COMPLETADA', progreso: 3 });
    const r = recompensaDe({ tipo: 'CAZAR', cantidad: 3 });
    const despues = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { xp: true, goirnos: true } });
    expect(despues.xp - antes.xp).toBe(r.xp);
    expect(despues.goirnos - antes.goirnos).toBe(r.goirnos);
    expect(await rep('Clan Serhu')).toBe(repAntes + r.reputacion);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MISION_COMPLETADA' } })).toBe(1);
  }, 60_000);

  it('entregar: solo donde se aceptó, cuenta lo entregado y se cumple al completar', async () => {
    const objeto = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, slug: 'piedra' } });
    const a = await aviso('clan-helsig', { tipo: 'ENTREGAR', motivo: 'EXCESO_FLORA', objeto: { slug: objeto.slug, nombre: objeto.name }, cantidad: 3 }, tablonHelsig.id);
    const quest = await aceptarMision(prisma, saveId, a.id);
    await prisma.inventoryItem.createMany({ data: [1, 2].map(() => ({ saveId, name: objeto.name, description: objeto.description, catalogSlug: objeto.slug })) });
    await expect(entregarMision(prisma, saveId, quest.id)).rejects.toThrow('Tienes que entregarlo donde aceptaste el encargo');
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: tablonHelsig.locationId } });
    await entregarMision(prisma, saveId, quest.id);
    expect(await prisma.quest.findUniqueOrThrow({ where: { id: quest.id } })).toMatchObject({ status: 'ACTIVA', progreso: 2 });
    await prisma.inventoryItem.create({ data: { saveId, name: objeto.name, description: objeto.description, catalogSlug: objeto.slug } });
    await entregarMision(prisma, saveId, quest.id);
    expect(await prisma.quest.findUniqueOrThrow({ where: { id: quest.id } })).toMatchObject({ status: 'COMPLETADA', progreso: 3 });
    expect(await prisma.inventoryItem.count({ where: { saveId, catalogSlug: objeto.slug } })).toBe(0);
  }, 60_000);

  it('explorar se cumple al visitar el lugar; combatir sitúa al grupo y se cumple al derrotarlo (y resta con la enemiga)', async () => {
    const ruinas = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'dunas-ahogadas' } });
    const explorar = await aceptarMision(prisma, saveId, (await aviso('clan-goshg', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar: { id: ruinas.id, nombre: ruinas.name } })).id);
    expect((await revisarMisiones(prisma, saveId)).cumplidas).toBe(0);
    await prisma.locationVisit.create({ data: { saveId, locationId: ruinas.id } });
    expect((await revisarMisiones(prisma, saveId)).cumplidas).toBe(1);
    expect((await prisma.quest.findUniqueOrThrow({ where: { id: explorar.id } })).status).toBe('COMPLETADA');

    const campo = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campo-yermo' } });
    const combatir = await aceptarMision(prisma, saveId, (await aviso('feg-ger', { tipo: 'COMBATIR', motivo: 'CONFLICTO', enemiga: { slug: 'clan-serhu', nombre: 'Clan Serhu' }, lugar: { id: campo.id, nombre: campo.name } })).id);
    const grupo = (combatir.huecos as { grupo: string[] }).grupo;
    expect(grupo.length).toBeGreaterThan(0);
    expect(await prisma.zonePoint.count({ where: { saveId, locationId: campo.id, label: 'Partida de Clan Serhu' } })).toBe(grupo.length);
    const repSerhu = await rep('Clan Serhu');
    await prisma.npcState.updateMany({ where: { saveId, npcId: { in: grupo }, scope: campo.id }, data: { condicionFisica: 'MUERTO' } });
    await revisarMisiones(prisma, saveId);
    expect((await prisma.quest.findUniqueOrThrow({ where: { id: combatir.id } })).status).toBe('COMPLETADA');
    expect(await rep('Clan Serhu')).toBe(repSerhu + recompensaDe({ tipo: 'COMBATIR', cantidad: 1 }).reputacionConEnemiga);
  }, 60_000);

  it('el plazo vencido la falla y abandonar la cierra; las dos restan reputación; como mucho 3 activas', async () => {
    const lugar = { id: 'nunca', nombre: 'Ningún sitio' };
    const q1 = await aceptarMision(prisma, saveId, (await aviso('clan-serhu', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar })).id);
    const q2 = await aceptarMision(prisma, saveId, (await aviso('clan-helsig', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar })).id);
    const q3 = await aceptarMision(prisma, saveId, (await aviso('clan-goshg', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar })).id);
    await expect(aceptarMision(prisma, saveId, (await aviso('feg-ger', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar })).id)).rejects.toThrow('Ya llevas 3 misiones secundarias');

    const repHelsig = await rep('Clan Helsig');
    await abandonarMision(prisma, saveId, q2.id);
    expect((await prisma.quest.findUniqueOrThrow({ where: { id: q2.id } })).status).toBe('ABANDONADA');
    expect(await rep('Clan Helsig')).toBeLessThan(repHelsig);

    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: q1.venceEn! + 1 } });
    expect((await revisarMisiones(prisma, saveId)).fallidas).toBe(2);
    expect((await prisma.quest.findMany({ where: { id: { in: [q1.id, q3.id] } } })).map((q) => q.status)).toEqual(['FALLIDA', 'FALLIDA']);
  }, 60_000);

  it('rutas: 404 si el aviso no existe, 409 si ya no se puede aceptar', async () => {
    const app = Fastify();
    await app.register(misionesRoutes);
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/misiones/avisos/no-existe/aceptar` })).statusCode).toBe(404);
    const a = await aviso('feg-ger', { tipo: 'EXPLORAR', motivo: 'RUMOR', lugar: { id: 'y', nombre: 'Y' } });
    await prisma.misionOfrecida.update({ where: { id: a.id }, data: { estado: 'RETIRADA' } });
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/misiones/avisos/${a.id}/aceptar` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('Ese aviso ya no está disponible');
    await app.close();
  });
});
