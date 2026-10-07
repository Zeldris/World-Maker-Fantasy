import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { asentamientosDelReino, asignarGuarnicion, comprarEquiposMilicia } from './defensaReino.js';

/// CR-65 (65b): asentamientos con sus módulos, guarnición y equipos de milicia.
describe('defensa de los asentamientos (CR-65 65b)', () => {
  let saveId: string;
  let capitalId: string;
  let cuartelId: string;
  let armeriaId: string;
  const soldados: string[] = [];

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const llanuras = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } })).id;
    const cristal = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-helsig' } })).id;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn (CR-65b)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G' },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), riqueza: 1000 } });
    const b = (recipeKey: string, locationId: string, tier: number | null = null) => prisma.building.create({ data: { saveId, locationId, recipeKey, name: recipeKey, kind: recipeKey, description: 'x', status: 'ACTIVO', tier } });
    capitalId = (await b('ayuntamiento', llanuras, 1)).id;
    cuartelId = (await b('cuartel-avanzado', cristal)).id;
    await b('empalizada', llanuras, 3);
    armeriaId = (await b('armeria', llanuras, 1)).id;
    await b('torre-vigia', cristal, 2);
    for (let i = 0; i < 5; i++) soldados.push((await prisma.subject.create({ data: { saveId, name: `Soldado ${i}`, role: i === 0 ? 'vigia' : 'soldado', notes: '' } })).id);
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cada asentamiento suma sus módulos; los soldados sin asentamiento son de la Capital', async () => {
    const [capital, cuartel] = await prisma.$transaction((tx) => asentamientosDelReino(tx, saveId));
    expect(capital).toMatchObject({ id: capitalId, capital: true });
    expect(capital!.efecto).toMatchObject({ cobertura: 5, aguante: 3, equiposMilicia: 5, plazasGuarnicion: 3, radioTramos: 0 });
    expect(capital!.guarnicion).toHaveLength(5);
    // Torre de escalón 2 sin vigía: 1 tramo.
    expect(cuartel).toMatchObject({ id: cuartelId, capital: false });
    expect(cuartel!.efecto).toMatchObject({ radioTramos: 1, bonoAltura: 2, cobertura: 0 });
  });

  it('asignar guarnición respeta las plazas; con vigía, la Torre alcanza su radio', async () => {
    for (const id of soldados.slice(0, 3)) expect((await prisma.$transaction((tx) => asignarGuarnicion(tx, saveId, id, cuartelId))).ok).toBe(true);
    const r = await prisma.$transaction((tx) => asignarGuarnicion(tx, saveId, soldados[3]!, cuartelId));
    expect(r).toMatchObject({ ok: false });
    const cuartel = (await prisma.$transaction((tx) => asentamientosDelReino(tx, saveId)))[1]!;
    expect(cuartel.guarnicion).toHaveLength(3);
    expect(cuartel.efecto.radioTramos).toBe(2);
    // De vuelta a la Capital.
    expect((await prisma.$transaction((tx) => asignarGuarnicion(tx, saveId, soldados[0]!, capitalId))).ok).toBe(true);
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: soldados[0]! } })).asentamientoId).toBeNull();
  });

  it('equipos de milicia hasta lo que cabe en la Armería, pagando su arma', async () => {
    const antes = (await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).riqueza;
    const r = await prisma.$transaction((tx) => comprarEquiposMilicia(tx, saveId, armeriaId, 8));
    expect(r).toEqual({ ok: true, comprados: 5 });
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).riqueza).toBeLessThan(antes);
    expect((await prisma.building.findUniqueOrThrow({ where: { id: armeriaId } })).equiposMilicia).toBe(5);
    expect(await prisma.$transaction((tx) => comprarEquiposMilicia(tx, saveId, armeriaId, 1))).toMatchObject({ ok: false });
  });
});

/// CR-65 (65c): radar de la Torre, aviso al entrar un asalto en su radio y milicia.
describe('radar de la Torre y milicia (CR-65 65c)', () => {
  let saveId: string;
  let capitalId: string;
  let lejos: string;
  let cerca: string;
  let casa: string;

  beforeAll(async () => {
    const { enlacesDelMundo, lugaresATramos } = await import('./viajeros.js');
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    casa = enlaces[0]!.fromId;
    const a = lugaresATramos(enlaces, casa, 3);
    cerca = [...a].find(([, t]) => t === 1)![0];
    lejos = [...a].find(([, t]) => t === 3)?.[0] ?? [...a].find(([, t]) => t === 2)![0];
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn (CR-65c)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G', currentLocationId: lejos },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }) } });
    const b = (recipeKey: string, tier: number | null, extra: Record<string, unknown> = {}) => prisma.building.create({ data: { saveId, locationId: casa, recipeKey, name: recipeKey, kind: recipeKey, description: 'x', status: 'ACTIVO', tier, ...extra } });
    capitalId = (await b('ayuntamiento', 1)).id;
    await b('torre-vigia', 1);
    await b('armeria', 1, { equiposMilicia: 2 });
    for (let i = 0; i < 3; i++) await prisma.subject.create({ data: { saveId, name: `Trabajador ${i}`, role: 'trabajador', notes: '' } });
    await prisma.subject.create({ data: { saveId, name: 'Vigía', role: 'vigia', notes: '' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la Torre de escalón 1 con vigía ve 1 tramo; avisa una vez y arma la milicia si estás fuera', async () => {
    const { vigilarDelReino, radarDelReino, TIPO_ASALTO } = await import('./defensaReino.js');
    const asalto = await prisma.viajero.create({ data: { saveId, tipo: TIPO_ASALTO, origenLocationId: lejos, destinoLocationId: casa, ubicacionLocationId: lejos, ruta: [], diaSalida: 1, ultimoDia: 1, miembros: { create: [{ genericos: 6, rol: 'bandido' }] } } });
    expect(await prisma.$transaction((tx) => radarDelReino(tx, saveId))).toHaveLength(0);
    await prisma.viajero.update({ where: { id: asalto.id }, data: { ubicacionLocationId: cerca } });
    const [visto] = await prisma.$transaction((tx) => radarDelReino(tx, saveId));
    expect(visto).toMatchObject({ asentamientoId: capitalId, viajeroId: asalto.id, gente: 6, tramos: 1, quien: 'Bandidos' });
    expect(await vigilarDelReino(prisma, saveId, 2)).toBe(1);
    expect(await vigilarDelReino(prisma, saveId, 3)).toBe(0);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'se ve venir a Bandidos' } } })).toBe(1);
    // Fuera de casa: 2 equipos, 2 milicianos que dejan de producir.
    expect(await prisma.subject.count({ where: { saveId, enMilicia: true } })).toBe(2);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).trabajadores).toBe(1);
    // Se va el asalto: vuelven al trabajo.
    await prisma.viajero.update({ where: { id: asalto.id }, data: { estado: 'TERMINADO' } });
    await vigilarDelReino(prisma, saveId, 4);
    expect(await prisma.subject.count({ where: { saveId, enMilicia: true } })).toBe(0);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).trabajadores).toBe(3);
  });
});
