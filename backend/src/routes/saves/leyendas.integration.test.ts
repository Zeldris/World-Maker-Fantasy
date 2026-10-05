import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../../services/mundoPartida.js';
import { registrarSuceso } from '../../services/cronista/sucesos.js';
import { nivelDeImportancia, type EntradaLeyenda } from '../../services/cronista/leyendas.js';
import { leyendasRoutes } from './leyendas.js';

// CR-19 (hito 0.2) — Leyendas: solo lo que sabe el personaje; un rumor, sin detalles.
describe('GET /saves/:id/leyendas (CR-19)', () => {
  const DIA = 30;
  let saveId: string;
  let serhuSlug: string;
  const ids: Record<string, string> = {};

  async function app() {
    const a = Fastify();
    await a.register(leyendasRoutes);
    return a;
  }
  const leer = async (url: string) => {
    const res = await (await app()).inject({ method: 'GET', url });
    return { status: res.statusCode, body: JSON.parse(res.body) as { entradas: EntradaLeyenda[]; hayMas: boolean } };
  };

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Cronista de prueba', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'C',
        worldState: { create: { fictionalMinutes: DIA * 1440 + 600 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
    serhuSlug = (await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' }, select: { slug: true } })).slug;
    const m = DIA * 1440;
    const alianza = (min: number, a: string, b: string, causas: string[] = []) =>
      registrarSuceso(prisma, {
        saveId, tipo: 'ALIANZA', fictionalMinutes: min, regionSlug: 'cienaga-troncal', origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: serhuSlug, papel: 'AUTOR' }], datos: { faccionA: a, faccionB: b }, causas,
      });
    ids.oculta = await alianza(m, 'Los ocultos', 'Nadie');
    ids.causaSabida = await alianza(m + 10, 'Causa', 'Sabida');
    ids.hecho = await alianza(m + 20, 'Clan Serhu', 'Los del hecho', [ids.oculta, ids.causaSabida]);
    ids.rumor = await alianza(m + 30, 'Clan Serhu', 'Los del rumor');
    // Mismo minuto que `hecho`: el cursor no debe saltárselo.
    ids.gemelo = await alianza(m + 20, 'Clan Serhu', 'Los gemelos');
    const saber = (sucesoId: string, confirmado: boolean) =>
      prisma.conocimiento.create({ data: { saveId, sucesoId, desde: m + 40, via: confirmado ? 'NPC' : 'OIDAS', confirmado } });
    await saber(ids.causaSabida, true);
    await saber(ids.hecho, true);
    await saber(ids.rumor, false);
    await saber(ids.gemelo, true);
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('solo sale lo que sabe, lo más reciente primero (también el comienzo de la historia, que vivió)', async () => {
    const { status, body } = await leer(`/saves/${saveId}/leyendas`);
    expect(status).toBe(200);
    expect(body.entradas.filter((e) => e.tipo === 'ALIANZA').map((e) => e.sucesoId).sort()).toEqual([ids.rumor, ids.hecho, ids.gemelo, ids.causaSabida].sort());
    expect(body.entradas.filter((e) => e.tipo === 'ALIANZA')[0]!.sucesoId).toBe(ids.rumor);
    expect(body.entradas.map((e) => e.sucesoId)).not.toContain(ids.oculta);
    expect(body.entradas.find((e) => e.tipo === 'SISTEMA_MUNDO_INICIADO')).toMatchObject({ via: 'TESTIGO', rumor: false });
  });

  it('un hecho lleva actores con nombre, fecha y solo las causas sabidas; la importancia, como nivel', async () => {
    const { body } = await leer(`/saves/${saveId}/leyendas`);
    const hecho = body.entradas.find((e) => e.sucesoId === ids.hecho)!;
    expect(hecho).toMatchObject({ rumor: false, nivel: 'DESTACADO', region: 'Ciénaga Troncal', texto: 'Clan Serhu y Los del hecho sellan una alianza.' });
    expect(hecho.actores).toEqual([{ tipo: 'FACCION', id: serhuSlug, nombre: 'Clan Serhu', papel: 'AUTOR' }]);
    expect(hecho.causas).toEqual([ids.causaSabida]);
    expect(hecho.fecha).toBeTruthy();
    expect(hecho).not.toHaveProperty('importancia');
  });

  it('un rumor sale sin detalles', async () => {
    const { body } = await leer(`/saves/${saveId}/leyendas`);
    expect(body.entradas.find((e) => e.sucesoId === ids.rumor)).toMatchObject({
      rumor: true, texto: 'Se dice que Clan Serhu y Los del rumor sellan una alianza.', actores: [], causas: [], cuando: null, fecha: null, lugar: null,
    });
  });

  it('filtra por familia y pagina con cursor sin saltarse nada; valida lo que recibe', async () => {
    expect((await leer(`/saves/${saveId}/leyendas?familia=CLIMA`)).body.entradas).toEqual([]);
    const todas = (await leer(`/saves/${saveId}/leyendas`)).body.entradas.map((e) => e.sucesoId);
    const vistas: string[] = [];
    let cursor: string | null = null;
    do {
      const pagina = (await leer(`/saves/${saveId}/leyendas?limite=1${cursor ? `&cursor=${cursor}` : ''}`)).body as { entradas: EntradaLeyenda[]; hayMas: boolean; siguiente: string | null };
      expect(pagina.entradas).toHaveLength(1);
      vistas.push(...pagina.entradas.map((e) => e.sucesoId));
      cursor = pagina.siguiente;
    } while (cursor);
    expect(vistas).toEqual(todas);
    expect((await leer(`/saves/${saveId}/leyendas?familia=INVENTADA`)).status).toBe(400);
    expect((await leer('/saves/no-existe/leyendas')).status).toBe(404);
  });

  it('ficha de una entidad: lo sabido donde aparece; un rumor no, porque revelaría a quién implica', async () => {
    const { status, body } = await leer(`/saves/${saveId}/leyendas/entidad/faccion/${serhuSlug}`);
    expect(status).toBe(200);
    expect(body.entradas.map((e) => e.sucesoId).sort()).toEqual([ids.hecho, ids.gemelo, ids.causaSabida].sort());
    // En la ficha de su región sí sale el rumor (la región ya la dice).
    expect((await leer(`/saves/${saveId}/leyendas/entidad/region/cienaga-troncal`)).body.entradas.map((e) => e.sucesoId)).toContain(ids.rumor);
    expect((await leer(`/saves/${saveId}/leyendas/entidad/dragon/x`)).status).toBe(400);
  });

  it('niveles de importancia (INT-2)', () => {
    expect([1, 4, 5, 7, 8, 10].map(nivelDeImportancia)).toEqual(['NORMAL', 'NORMAL', 'DESTACADO', 'DESTACADO', 'GRAVE', 'GRAVE']);
  });

  // 20b: la ficha de la Enciclopedia pregunta por slug.
  it('ficha de la Enciclopedia por slug (facción; un NPC o un lugar sin nada sabido salen vacíos)', async () => {
    const { status, body } = await leer(`/saves/${saveId}/leyendas/ficha/faction/${serhuSlug}`);
    expect(status).toBe(200);
    expect(body.entradas.map((e) => e.sucesoId).sort()).toEqual([ids.hecho, ids.gemelo, ids.causaSabida].sort());
    expect((await leer(`/saves/${saveId}/leyendas/ficha/npc/maestro-cocinero-serhu`)).body.entradas).toEqual([]);
    expect((await leer(`/saves/${saveId}/leyendas/ficha/item/espada`)).status).toBe(400);
  });
});

