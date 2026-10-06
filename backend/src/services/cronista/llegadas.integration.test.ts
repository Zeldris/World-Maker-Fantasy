import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { candidatosDeLlegada, elegirPorPeso, motivoSinLlegada, puebloDeFila, responderLlegada, revisarLlegadas } from './llegadas.js';

describe('llegadas (REI-119) — reglas puras', () => {
  const base = { camasLibres: 1, comida: 5, bebida: 5, felicidad: 50, candidatoEsperando: false };
  it('llega alguien con cama, comida, agua y felicidad ≥ 40, y nadie esperando', () => {
    expect(motivoSinLlegada(base)).toBeNull();
    expect(motivoSinLlegada({ ...base, camasLibres: 0 })).toMatch(/cama/);
    expect(motivoSinLlegada({ ...base, comida: 0 })).toMatch(/comida/);
    expect(motivoSinLlegada({ ...base, bebida: 0 })).toMatch(/agua/);
    expect(motivoSinLlegada({ ...base, felicidad: 39 })).toMatch(/40/);
    expect(motivoSinLlegada({ ...base, candidatoEsperando: true })).toMatch(/esperando/);
  });

  it('el pueblo sale al azar según cuántos son', () => {
    const filas = [{ id: 'a', poblacion: 100 }, { id: 'b', poblacion: 300 }, { id: 'c', poblacion: 0 }];
    expect(elegirPorPeso(filas, () => 0.1)?.id).toBe('a');
    expect(elegirPorPeso(filas, () => 0.5)?.id).toBe('b');
    expect(elegirPorPeso([{ poblacion: 0 }], () => 0.5)).toBeNull();
    expect(puebloDeFila('orcos-llanuras')).toBe('orcos');
    expect(puebloDeFila('nabieus')).toBe('nabieus');
  });
});

describe('llegadas (REI-119) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const DIA = 1440;
  const AHORA = 480 + 30 * DIA;
  const ownerKey = () => `save:${saveId}`;
  const poblacionSerhu = async () => (await prisma.worldPopulation.findFirstOrThrow({ where: { saveId, targetSlug: 'orcos-llanuras' } })).poblacion;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: AHORA } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-de-gorhorn', name: 'Reino de Gorhorn', raza: 'orcos', description: 'x' } });
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKey(), felicidad: 60, comida: 50, bebida: 50 } });
    await prisma.territory.create({ data: { saveId, name: 'Hondonada', description: 'x', region: 'Las Llanuras del Viento Rojo' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId } });
    await prisma.building.create({ data: { saveId, locationId: location.id, recipeKey: 'choza', name: 'Choza', kind: 'choza', description: 'x', status: 'ACTIVO' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const revisar = (ahora: number) => prisma.$transaction((tx) => revisarLlegadas(tx, saveId, ahora, () => 0.3));

  it('llega un orco de la región (se descuenta del Clan Serhu); aceptado, es súbdito y queda en el Libro', async () => {
    const antes = await poblacionSerhu();
    const r = await revisar(AHORA);
    expect(r.llegado).not.toBeNull();
    expect(await poblacionSerhu()).toBe(antes - 1);
    const [c] = await candidatosDeLlegada(prisma, saveId);
    expect(c).toMatchObject({ id: r.llegado, deDonde: 'Orcos del Clan Serhu (Llanuras del Viento Rojo)', hastaMinutes: AHORA + 2 * DIA });
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKey() } })).poblacion).toBe(0);
    // Al día siguiente no llega otro: ya hay alguien esperando y no ha pasado una semana.
    expect((await revisar(AHORA + DIA)).llegado).toBeNull();
    const ok = await prisma.$transaction((tx) => responderLlegada(tx, saveId, r.llegado!, true, AHORA + DIA));
    expect(ok.ok).toBe(true);
    const s = await prisma.subject.findUniqueOrThrow({ where: { id: r.llegado! } });
    expect(s).toMatchObject({ estado: 'ACTIVO', pueblo: 'orcos', origen: 'LLEGADA', notes: 'Llegó de Orcos del Clan Serhu (Llanuras del Viento Rojo).' });
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKey() } })).poblacion).toBe(1);
    const suceso = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'LLEGADA_POBLADORES' }, include: { actores: true } });
    expect(suceso.texto).toBe('Llega un poblador a Reino de Gorhorn.');
    expect(suceso.actores.some((a) => a.entidadTipo === 'SUBDITO' && a.entidadId === s.id)).toBe(true);
  });

  it('una semana después llega otro; si no se responde en 2 días, se va y vuelve a su pueblo', async () => {
    expect((await revisar(AHORA + 6 * DIA)).llegado).toBeNull();
    const antes = await poblacionSerhu();
    const r = await revisar(AHORA + 7 * DIA);
    expect(r.llegado).not.toBeNull();
    expect(await poblacionSerhu()).toBe(antes - 1);
    const fuera = await revisar(AHORA + 9 * DIA);
    expect(fuera.marchados).toBe(1);
    expect(await prisma.subject.count({ where: { id: r.llegado! } })).toBe(0);
    expect(await poblacionSerhu()).toBe(antes);
    expect(await prisma.linajeMiembro.count({ where: { entidadTipo: 'SUBDITO', entidadId: r.llegado! } })).toBe(0);
  });

  it('rechazar lo devuelve a su pueblo; sin cama, sin comida o con el Reino triste no llega nadie', async () => {
    const r = await revisar(AHORA + 14 * DIA);
    expect((await prisma.$transaction((tx) => responderLlegada(tx, saveId, r.llegado!, false, AHORA + 14 * DIA))).ok).toBe(true);
    expect(await prisma.subject.count({ where: { id: r.llegado! } })).toBe(0);
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { felicidad: 30 } });
    expect((await revisar(AHORA + 21 * DIA)).llegado).toBeNull();
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { felicidad: 60, comida: 0 } });
    expect((await revisar(AHORA + 21 * DIA)).llegado).toBeNull();
    await prisma.kingdomStats.update({ where: { ownerKey: ownerKey() }, data: { comida: 50 } });
    await prisma.companion.create({ data: { saveId, name: 'Ana', role: 'x', notes: 'x' } });
    expect((await revisar(AHORA + 21 * DIA)).llegado).toBeNull();
  });
});
