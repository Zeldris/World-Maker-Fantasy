import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { danarEdificioDeReceta, repararDanados } from './prepararEdificios.js';

// P369/P301: `reparar` y `danar:<receta>` de `prepararReino.ts` (y `avanzar --reparar`) usan `repararEdificio` (el botón
// «Reparar») y el efecto `danarEdificio` (el de las tormentas), no UPDATE a mano.
describe('prepararEdificios (P369, P301)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id }, orderBy: { slug: 'asc' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    const edificio = (recipeKey: string, status: 'ACTIVO' | 'DANADO' = 'ACTIVO') =>
      prisma.building.create({ data: { saveId: save.id, locationId: lugar.id, recipeKey, name: recipeKey, kind: recipeKey, description: '', status } });
    return { saveId: save.id, worldId: world.id, edificio };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('danar deja DANADO el edificio activo de la receta, con su suceso y su aviso', async () => {
    const { saveId, edificio } = await partida('Dañar (P301)');
    const b = await edificio('cocina');
    expect(await danarEdificioDeReceta(prisma, { saveId, receta: 'cocina' })).toEqual({ nombre: 'cocina' });
    expect((await prisma.building.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('DANADO');
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: { contains: 'sufre daños' } } })).toBe(1);
    // ya dañado: no hay ninguno activo
    expect(await danarEdificioDeReceta(prisma, { saveId, receta: 'cocina' })).toHaveProperty('error');
    expect(await danarEdificioDeReceta(prisma, { saveId, receta: 'no-hay' })).toHaveProperty('error');
  });

  it('reparar arregla lo que cabe en los materiales y avisa del resto sin deshacer lo hecho', async () => {
    const { saveId, worldId, edificio } = await partida('Reparar (P369)');
    const a = await edificio('pozo', 'DANADO');
    const c = await edificio('cocina', 'DANADO');
    const sano = await edificio('granero');
    // Sin materiales: no repara nada y lo dice.
    const sin = await repararDanados(prisma, saveId);
    expect(sin.reparados).toEqual([]);
    expect(sin.sinReparar.map((x) => x.nombre).sort()).toEqual(['cocina', 'pozo']);
    expect(sin.sinReparar[0]!.motivo).toMatch(/materiales/);
    // Materiales justos para uno (el primero: el pozo, el más antiguo).
    const recurso = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: 'RECURSO' } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 6 }, () => ({ saveId, name: recurso.name, description: '', catalogSlug: recurso.slug })) });
    const r = await repararDanados(prisma, saveId);
    expect(r.reparados.map((x) => x.nombre)).toEqual(['pozo']);
    expect(r.sinReparar.map((x) => x.nombre)).toEqual(['cocina']);
    expect((await prisma.building.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('ACTIVO');
    expect((await prisma.building.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('DANADO');
    expect((await prisma.building.findUniqueOrThrow({ where: { id: sano.id } })).status).toBe('ACTIVO');
  });
});
