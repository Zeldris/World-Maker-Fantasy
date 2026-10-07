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
