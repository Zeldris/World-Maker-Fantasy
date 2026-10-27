import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ganadoRoutes } from '../routes/saves/ganado.js';
import { edificiosParaCliente } from './edificiosParaCliente.js';
import { aplicarEfecto, type CtxEfecto } from './cronista/efectos.js';

/// P346: el atado de la Jaula grande (`NpcState.capturaJaulaBuildingId`) tiene que llegar a la tarjeta de la Jaula
/// (Reino › Edificios) y a Reino › Corrales. P219-style: el mismo constructor sirve a GET /saves/:id y a un turno.
describe('P346 — el atado de la Jaula llega al cliente', () => {
  let saveId: string;
  let jaulaGrandeId: string;
  let jaulaVaciaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas', saveId: null } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Atadora de prueba (P346)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Serhu',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'A',
        worldState: { create: { fictionalMinutes: 10 * 1440, fictionalDateLabel: 'día 10' } },
      },
    });
    saveId = save.id;
    jaulaGrandeId = (await prisma.building.create({ data: { saveId, recipeKey: 'jaula-grande', name: 'Jaula grande', kind: 'jaula-grande', status: 'ACTIVO', description: 'x' } })).id;
    jaulaVaciaId = (await prisma.building.create({ data: { saveId, recipeKey: 'jaula-pequena', name: 'Jaula pequeña', kind: 'jaula-pequena', status: 'ACTIVO', description: 'x' } })).id;
    await prisma.npcState.create({ data: { saveId, npcId: corretolvas.id, scope: '', condicionFisica: 'ILESO', capturado: true, capturaFelicidad: 15, capturaJaulaBuildingId: jaulaGrandeId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la ficha del edificio trae el ocupante de la Jaula ocupada y null en la vacía', async () => {
    const filas = await prisma.building.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    const fichas = await edificiosParaCliente(prisma, saveId, filas);
    expect(fichas.find((f) => f.id === jaulaGrandeId)?.ocupante).toEqual({ npcSlug: 'corretolvas', name: expect.any(String), tipo: 'FAUNA', felicidad: 15 });
    expect(fichas.find((f) => f.id === jaulaVaciaId)?.ocupante).toBeNull();
  });

  it('GET /corrales lista las Jaulas con su atado', async () => {
    const app = Fastify();
    await app.register(ganadoRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/corrales` });
    expect(res.statusCode).toBe(200);
    const jaulas = res.json().jaulas as { id: string; tamano: string; ocupante: { npcSlug: string; felicidad: number } | null }[];
    expect(jaulas).toHaveLength(2);
    expect(jaulas.find((j) => j.id === jaulaGrandeId)).toMatchObject({ tamano: 'GRANDE', ocupante: { npcSlug: 'corretolvas', felicidad: 15 } });
    expect(jaulas.find((j) => j.id === jaulaVaciaId)?.ocupante).toBeNull();
  });
});

/// P350: Reino › Edificios dice por qué y cuándo se dañó un edificio. El motivo no se guarda en `Building`
/// (sin migración): sale del suceso EDIFICIO_DANADO que escribe el efecto `danarEdificio`.
describe('P350 — el daño de un edificio llega al cliente con su causa y su día', () => {
  let saveId: string;
  let worldId: string;
  let conCausaId: string;
  let sinCausaId: string;
  let antiguoId: string;
  let enPieId: string;

  const danar = (buildingId: string, causa: string | undefined, minutos: number) =>
    prisma.$transaction((tx) => {
      const ctx: CtxEfecto = { tx, saveId, worldId, fictionalMinutes: minutos, origen: 'MOTOR' };
      return aplicarEfecto(ctx, { tipo: 'danarEdificio', buildingId, ...(causa ? { causa } : {}) });
    });

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Dañada de prueba (P350)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Serhu',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'D',
        worldState: { create: { fictionalMinutes: 1600 * 1440, fictionalDateLabel: 'día 1601' } },
      },
    });
    saveId = save.id;
    const crear = async (recipeKey: string, name: string) => (await prisma.building.create({ data: { saveId, recipeKey, name, kind: recipeKey, status: 'ACTIVO', description: 'x' } })).id;
    conCausaId = await crear('pozo', 'un pozo');
    sinCausaId = await crear('granero', 'un granero');
    enPieId = await crear('lenera', 'una leñera');
    // Un daño anterior al Libro de Sucesos: DANADO sin suceso.
    antiguoId = (await prisma.building.create({ data: { saveId, recipeKey: 'cisterna', name: 'una cisterna', kind: 'cisterna', status: 'DANADO', description: 'x' } })).id;
    await danar(conCausaId, 'una tormenta', 1521 * 1440 + 600);
    await danar(sinCausaId, undefined, 1530 * 1440);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el dañado trae causa y día (el primero de la partida es el 1); el sano, nada', async () => {
    const filas = await prisma.building.findMany({ where: { saveId } });
    const fichas = await edificiosParaCliente(prisma, saveId, filas);
    expect(fichas.find((f) => f.id === conCausaId)).toMatchObject({ status: 'DANADO', danio: { causa: 'una tormenta', dia: 1522 } });
    expect(fichas.find((f) => f.id === sinCausaId)?.danio).toEqual({ causa: null, dia: 1531 });
    expect(fichas.find((f) => f.id === antiguoId)?.danio).toBeNull();
    expect(fichas.find((f) => f.id === enPieId)?.danio).toBeNull();
  });

  it('reparado y dañado otra vez, cuenta el último daño', async () => {
    await prisma.building.update({ where: { id: conCausaId }, data: { status: 'ACTIVO' } });
    await danar(conCausaId, 'un asalto', 1540 * 1440);
    const fichas = await edificiosParaCliente(prisma, saveId, await prisma.building.findMany({ where: { saveId } }));
    expect(fichas.find((f) => f.id === conCausaId)?.danio).toEqual({ causa: 'un asalto', dia: 1541 });
  });
});
