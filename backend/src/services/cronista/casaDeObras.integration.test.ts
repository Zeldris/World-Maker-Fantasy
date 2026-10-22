import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { CONSTRUCTION_RECIPES, computeBuildBlockedReason, TIER_MAXIMO_PERSONAJE } from '../construction.js';
import { esDelPanelReino } from '../../routes/saves/recipesStatus.js';
import {
  avanzarCasaDeObras,
  encargarObra,
  encargarReparacion,
  materialesDelDia,
  quitarObra,
  reordenarCola,
  repartirObras,
  verCasaDeObras,
} from './casaDeObras.js';

const BASE = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
const receta = (key: string) => CONSTRUCTION_RECIPES.find((r) => r.key === key)!;

/// Construcción por oficio y Casa de obras (P277, P282, P284).
describe('construcción por oficio: tiers y Casa de obras', () => {
  it('todas las obras tienen tier 1-9 y ninguna pide atributos', () => {
    for (const r of CONSTRUCTION_RECIPES) {
      expect(r.tier).toBeGreaterThanOrEqual(1);
      expect(r.tier).toBeLessThanOrEqual(9);
      expect((r as { requisitos?: unknown }).requisitos).toBeUndefined();
    }
  });

  it('P282: la Jaula pequeña es tier 1 y sale en Reino › Edificios', () => {
    expect(receta('jaula-pequena').tier).toBe(1);
    expect(esDelPanelReino(receta('jaula-pequena'))).toBe(true);
  });

  describe('repartirObras (puro)', () => {
    const obras = [{ id: 'a', tier: 2 }, { id: 'b', tier: 1 }, { id: 'c', tier: 5 }];
    it('el de menor nivel que llega, una obra por constructor', () => {
      const r = repartirObras(obras.slice(0, 2), [{ id: 'x', nivelConstructor: 3 }, { id: 'y', nivelConstructor: 2 }], 1);
      expect(r.get('a')).toEqual({ constructorId: 'y' });
      expect(r.get('b')).toEqual({ constructorId: 'x' });
    });
    it('🔒 por nivel de Casa, por nivel de constructor y sin constructores', () => {
      expect(repartirObras(obras, [{ id: 'x', nivelConstructor: 9 }], 1).get('c')).toEqual({ aviso: expect.stringMatching(/^🔒5: la Casa de obras de nivel 1/) });
      expect(repartirObras(obras, [{ id: 'x', nivelConstructor: 1 }], 1).get('a')).toEqual({ aviso: expect.stringMatching(/^🔒2: ningún constructor/) });
      expect(repartirObras(obras, [], 1).get('b')).toEqual({ aviso: expect.stringMatching(/Sin constructores/) });
      const uno = repartirObras(obras.slice(0, 2), [{ id: 'x', nivelConstructor: 3 }], 1);
      expect(uno.get('b')).toEqual({ aviso: expect.stringMatching(/Esperando turno/) });
    });
    it('los materiales se reparten por los días que quedan', () => {
      expect(materialesDelDia(12, 0, 3, 0)).toBe(4);
      expect(materialesDelDia(13, 4, 3, 1)).toBe(5);
      expect(materialesDelDia(5, 5, 2, 2)).toBe(0);
    });
  });

  describe('en una partida', () => {
    let saveId: string;
    let worldId: string;
    let casaLoc: string;
    let ayuntamientoId: string;
    let casaId: string;
    let constructorId: string;
    let recursoSlug: string;
    const ahora = 0;

    const llenarAlmacen = (n: number) => prisma.almacenItem.createMany({ data: Array.from({ length: n }, (_, i) => ({ saveId, name: `Material ${i}`, description: 'x', catalogSlug: recursoSlug })) });
    const jornada = () => prisma.$transaction((tx) => avanzarCasaDeObras(tx, saveId, ahora));
    const bloqueo = (key: string, quien?: 'personaje' | 'casa-de-obras') =>
      computeBuildBlockedReason({ db: prisma, saveId, worldId, buildRecipe: receta(key), activeRegion: null, currentLocationRecord: { id: casaLoc }, quien });

    beforeAll(async () => {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      worldId = world.id;
      const loc = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
      casaLoc = loc.id;
      recursoSlug = (await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: 'RECURSO' } })).slug;
      saveId = (await prisma.save.create({
        data: { userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (Casa de obras)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: BASE, portraitInitial: 'G' },
      })).id;
      ayuntamientoId = (await prisma.building.create({ data: { saveId, locationId: casaLoc, recipeKey: 'ayuntamiento', name: 'Karot', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
      casaId = (await prisma.building.create({ data: { saveId, locationId: casaLoc, recipeKey: 'casa-de-obras', name: 'una casa de obras', kind: 'casa-de-obras', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
      constructorId = (await prisma.subject.create({ data: { saveId, name: 'Druk', role: 'trabajador', notes: '', pueblo: 'orcos', tarea: 'constructor' } })).id;
    });
    afterAll(async () => {
      await prisma.save.delete({ where: { id: saveId } });
    });
    beforeEach(async () => {
      await prisma.obraCola.deleteMany({ where: { saveId } });
      await prisma.almacenItem.deleteMany({ where: { saveId } });
    });

    it(`el personaje solo levanta hasta tier ${TIER_MAXIMO_PERSONAJE}; la Casa de obras no tiene ese tope`, async () => {
      expect(await bloqueo('ayuntamiento-mediano')).toMatch(/solo levanta hasta tier 3/);
      expect(await bloqueo('ayuntamiento-mediano', 'casa-de-obras') ?? '').not.toMatch(/solo levanta hasta tier/);
    });

    it('P282: el personaje puede levantar la Jaula pequeña (T1)', async () => {
      expect(await bloqueo('jaula-pequena')).toBeNull();
    });

    it('construye un pozo (T1) desde la cola: gasta del Almacén, lo levanta y el constructor gana XP', async () => {
      await llenarAlmacen(15);
      const r = await prisma.$transaction((tx) => encargarObra(tx, saveId, 'pozo'));
      expect(r.ok).toBe(true);
      expect(await jornada()).toEqual({ avanzadas: 1, terminadas: 1 });
      expect(await prisma.building.count({ where: { saveId, recipeKey: 'pozo', status: 'ACTIVO', locationId: casaLoc } })).toBe(1);
      expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(3);
      expect(await prisma.obraCola.count({ where: { saveId } })).toBe(0);
      expect((await prisma.subject.findUniqueOrThrow({ where: { id: constructorId } })).xpConstructor).toBe(10);
      expect(await prisma.suceso.count({ where: { saveId, tipo: 'EDIFICIO_CONSTRUIDO' } })).toBe(1);
    });

    it('sin materiales no avanza y lo avisa', async () => {
      await prisma.$transaction((tx) => encargarObra(tx, saveId, 'jaula-pequena'));
      expect(await jornada()).toEqual({ avanzadas: 0, terminadas: 0 });
      expect((await prisma.obraCola.findFirstOrThrow({ where: { saveId } })).aviso).toMatch(/Faltan materiales/);
    });

    it('repara un edificio dañado desde la cola', async () => {
      const pozo = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'pozo' } });
      await prisma.building.update({ where: { id: pozo.id }, data: { status: 'DANADO' } });
      await llenarAlmacen(10);
      expect((await prisma.$transaction((tx) => encargarReparacion(tx, saveId, pozo.id))).ok).toBe(true);
      expect((await prisma.$transaction((tx) => encargarReparacion(tx, saveId, ayuntamientoId)))).toMatchObject({ ok: false, motivo: expect.stringMatching(/está en pie/) });
      expect(await jornada()).toEqual({ avanzadas: 0, terminadas: 1 });
      expect((await prisma.building.findUniqueOrThrow({ where: { id: pozo.id } })).status).toBe('ACTIVO');
      expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(4);
    });

    it('la cola se reordena y se quitan obras', async () => {
      const a = await prisma.$transaction((tx) => encargarObra(tx, saveId, 'granero'));
      const b = await prisma.$transaction((tx) => encargarObra(tx, saveId, 'jaula-pequena'));
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect((await prisma.$transaction((tx) => encargarObra(tx, saveId, 'granero'))).ok).toBe(false);
      await prisma.$transaction((tx) => reordenarCola(tx, saveId, [b.id, a.id]));
      let vista = await prisma.$transaction((tx) => verCasaDeObras(tx, saveId, ahora));
      expect(vista.casa).toEqual({ nivel: 1, tierMaximo: 3, plazas: 1 });
      expect(vista.cola.map((o) => o.id)).toEqual([b.id, a.id]);
      expect(await prisma.$transaction((tx) => quitarObra(tx, saveId, b.id))).toBe(true);
      vista = await prisma.$transaction((tx) => verCasaDeObras(tx, saveId, ahora));
      expect(vista.cola.map((o) => o.id)).toEqual([a.id]);
    });

    it('🔒: una mejora de tier 6 espera a una Casa de nivel 2 y a un constructor de nivel 6, y luego mejora en el sitio', async () => {
      await llenarAlmacen(60);
      const r = await prisma.$transaction((tx) => encargarObra(tx, saveId, 'ayuntamiento-mediano'));
      expect(r.ok).toBe(true);
      await jornada();
      expect((await prisma.obraCola.findFirstOrThrow({ where: { saveId } })).aviso).toMatch(/^🔒6: la Casa de obras de nivel 1/);
      await prisma.building.update({ where: { id: casaId }, data: { tier: 2 } });
      await jornada();
      expect((await prisma.obraCola.findFirstOrThrow({ where: { saveId } })).aviso).toMatch(/^🔒6: ningún constructor llega a tier 6/);
      await prisma.subject.update({ where: { id: constructorId }, data: { nivelConstructor: 6 } });
      for (let d = 0; d < 6; d++) await jornada();
      expect(await prisma.obraCola.count({ where: { saveId } })).toBe(0);
      const ayto = await prisma.building.findUniqueOrThrow({ where: { id: ayuntamientoId } });
      expect(ayto).toMatchObject({ tier: 2, recipeKey: 'ayuntamiento', name: 'un ayuntamiento mediano' });
      expect(await prisma.building.count({ where: { saveId, recipeKey: 'ayuntamiento' } })).toBe(1);
    });

    it('sin Casa de obras no se encarga nada', async () => {
      await prisma.building.update({ where: { id: casaId }, data: { status: 'DANADO' } });
      expect(await prisma.$transaction((tx) => encargarObra(tx, saveId, 'granero'))).toMatchObject({ ok: false, motivo: expect.stringMatching(/Casa de obras/) });
      await prisma.building.update({ where: { id: casaId }, data: { status: 'ACTIVO' } });
    });
  });
});
