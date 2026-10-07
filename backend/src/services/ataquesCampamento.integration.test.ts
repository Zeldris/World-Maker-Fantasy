import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { bajasDeCampamentoEnVivo, COFRE_CAMPAMENTO, disolverCampamento, lanzarAtaqueACampamento, patrullasContraCampamentos, REP_POR_CAMPAMENTO, TIPO_ATAQUE } from './ataquesCampamento.js';
import { posicionEnZona } from './viajerosCruce.js';
import { enlacesDelMundo, rutaMasCorta, TRABAJOS } from './viajeros.js';
import { REGION_OWNING_FACTIONS } from './reputation.js';

function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}
const REGION = 'Las Llanuras del Viento Rojo';

/// CR-50 (50c): acabar con los campamentos: en vivo, con una partida y con patrullas de facción.
describe('atacar campamentos (CR-50 50c)', () => {
  let saveId: string;
  let worldId: string;
  let campLoc: string;
  let casa: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const llanuras = await prisma.location.findMany({ where: { worldId, region: REGION }, select: { id: true } });
    let par: [string, string] | null = null;
    for (const a of llanuras) for (const b of llanuras) if (!par && a.id !== b.id && rutaMasCorta(enlaces, a.id, b.id)) par = [a.id, b.id];
    [campLoc, casa] = par!;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (CR-50c)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G', worldState: { create: { fictionalMinutes: 20 * 1440 } } },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), riqueza: 10, comida: 0 } });
    await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Karot', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const campamento = async (gente: number, extra: Record<string, unknown> = {}) => {
    const c = await prisma.campamento.create({ data: { saveId, locationId: campLoc, region: REGION, ocupante: 'renegados-goirntes', cabecilla: 'Cabecilla de los renegados', gente, tope: 8, creadoDia: 10, ultimoRefuerzoDia: 10, ...extra } });
    const p = await prisma.zonePoint.create({ data: { saveId, locationId: campLoc, tipo: 'NPC', targetSlug: 'goirnte-renegado', label: 'Renegados goirntes', cantidad: gente + 1, ...posicionEnZona(c.id) } });
    return prisma.campamento.update({ where: { id: c.id }, data: { zonePointId: p.id } });
  };

  it('cae a manos del Reino: botín y cofre, reputación en la región, suceso y su punto fuera', async () => {
    const c = await campamento(4, { botinComida: 20, botinGoirnos: 30 });
    await prisma.$transaction((tx) => disolverCampamento(tx, c, 15, { reino: true, quien: 'Gorhorn' }));
    expect(await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ estado: 'DESTRUIDO', caidoDia: 15, gente: 0 });
    expect(await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).toMatchObject({ riqueza: 10 + 30 + COFRE_CAMPAMENTO, comida: 20 });
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } })).activo).toBe(false);
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    const duena = REGION_OWNING_FACTIONS[REGION]![0]!;
    expect((ws.factionsStatus as Record<string, number>)[duena]).toBeGreaterThanOrEqual(REP_POR_CAMPAMENTO);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CAMPAMENTO_DESTRUIDO' } })).toBe(1);
    // Una segunda vez no hace nada.
    await prisma.$transaction((tx) => disolverCampamento(tx, c, 16, { reino: true, quien: 'Gorhorn' }));
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CAMPAMENTO_DESTRUIDO' } })).toBe(1);
  });

  it('en vivo: pierde a los caídos y cae con su cabecilla', async () => {
    const c = await campamento(8);
    expect(await prisma.$transaction((tx) => bajasDeCampamentoEnVivo(tx, saveId, campLoc, 'goirnte-renegado', 3, 16, 'Gorhorn'))).toBe(false);
    expect((await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } })).gente).toBe(5);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } })).cantidad).toBe(6);
    expect(await prisma.$transaction((tx) => bajasDeCampamentoEnVivo(tx, saveId, campLoc, 'goirnte-renegado', 6, 16, 'Gorhorn'))).toBe(true);
    expect((await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe('DESTRUIDO');
  });

  it('una partida del Reino va a por un campamento que conoce y, si gana, lo deshace', async () => {
    const c = await campamento(0);
    const soldados = await Promise.all(Array.from({ length: 6 }, (_, i) => prisma.subject.create({ data: { saveId, name: `Soldado ${i}`, role: 'soldado', notes: '', pueblo: 'orcos' } })));
    const ids = soldados.map((s) => s.id);
    expect(await prisma.$transaction((tx) => lanzarAtaqueACampamento(tx, saveId, { campamentoId: c.id, subjectIds: ids }, 20 * 1440))).toMatchObject({ ok: false });
    await prisma.campamento.update({ where: { id: c.id }, data: { conocido: true } });
    const r = await prisma.$transaction((tx) => lanzarAtaqueACampamento(tx, saveId, { campamentoId: c.id, subjectIds: ids }, 20 * 1440));
    expect(r.ok).toBe(true);
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id: (r as { id: string }).id }, include: { miembros: true } });
    expect(v).toMatchObject({ tipo: TIPO_ATAQUE, objetivo: c.id, destinoLocationId: campLoc });
    await prisma.$transaction((tx) => TRABAJOS[TIPO_ATAQUE]!.alLlegar!(tx, v, 21, semilla(3)));
    expect((await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe('DESTRUIDO');
  });

  it('las patrullas de la facción dueña de la región, cada semana', async () => {
    const duena = REGION_OWNING_FACTIONS[REGION]![0]!;
    await prisma.faction.create({ data: { worldId, saveId, slug: 'duena-50c', name: duena, raza: 'orcos', description: 'x', origenSlug: 'duena', kingdomStats: { create: { ownerKey: `duena-50c-${saveId}`, soldados: 20 } } } });
    const c = await campamento(0);
    expect(await patrullasContraCampamentos(prisma, saveId, 22, semilla(5))).toBe(0);
    expect(await patrullasContraCampamentos(prisma, saveId, 28, semilla(5))).toBe(1);
    expect((await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe('DESTRUIDO');
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'CAMPAMENTO_DESTRUIDO', origen: 'MUNDO' } })).toBe(1);
  });
});
