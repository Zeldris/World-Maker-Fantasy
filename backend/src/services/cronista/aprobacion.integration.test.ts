import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { deltaDeAprobacion, etiquetaDeAprobacion, fraseDeAprobacion, revisarMarchas, valoresIniciales, VECTORES } from './aprobacion.js';

describe('aprobación (CR-15) — reglas puras', () => {
  it('valores del pueblo matizados por la personalidad, con tope ±2', () => {
    expect(valoresIniciales('nabieus', 'Compasiva y desconfiada')).toEqual({ prudencia: 2, piedad: 2 });
    expect(valoresIniciales('orcos', '')).toEqual({ lealtad_clan: 2, honor: 1, piedad: -1 });
    expect(valoresIniciales(null)).toEqual({ honor: 1, piedad: 1 });
  });

  it('el delta es la suma de vector × peso y el motivo, el valor que más pesó', () => {
    expect(deltaDeAprobacion({ piedad: 2, honor: 1 }, VECTORES.PERDON_CONCEDIDO!)).toEqual({ delta: 4, motivo: 'piedad' });
    expect(deltaDeAprobacion({ piedad: 2, honor: 1 }, VECTORES.MUERTE_DE_RENDIDO!)).toEqual({ delta: -5, motivo: 'piedad' });
    expect(deltaDeAprobacion({ codicia: 2 }, VECTORES.PERDON_CONCEDIDO!)).toEqual({ delta: 0, motivo: null });
  });

  it('la barra se lee con etiquetas, sin número', () => {
    expect([5, 25, 50, 70, 90].map(etiquetaDeAprobacion)).toEqual(['Hostil', 'Distante', 'Neutral', 'Afín', 'Leal']);
    expect(fraseDeAprobacion('Kaila', 'honor', -3)).toBe('Kaila frunce el ceño.');
  });
});

describe('aprobación (CR-15) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 2 * 1440;
  const yo: ActorSuceso = { entidadTipo: 'PERSONAJE', entidadId: '', papel: 'AUTOR' };

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Aprobación (CR-15)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'A',
        worldState: { create: { fictionalMinutes: MIN, fictionalDateLabel: 'Día 3' } },
      },
    })).id;
    yo.entidadId = saveId;
    await asegurarMundoDePartida(prisma, saveId);
    await procesarReacciones(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('perdonar sube la aprobación de un compañero piadoso, con su línea en el registro; un animal no cambia', async () => {
    const kaila = await prisma.companion.create({ data: { saveId, name: 'Kaila', role: 'aliado', notes: '', tipo: 'NPC', valores: { piedad: 2 } } });
    const perro = await prisma.companion.create({ data: { saveId, name: 'Canizor', role: 'mascota', notes: '', tipo: 'FAUNA' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL' } });
    await prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo: 'PERDON_CONCEDIDO', fictionalMinutes: MIN, origen: 'JUGADOR', actores: [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], datos: { personaje: 'x', perdonado: npc.name } }));
    await procesarReacciones(prisma, saveId);
    expect((await prisma.companion.findUniqueOrThrow({ where: { id: kaila.id } })).aprobacion).toBe(54);
    expect((await prisma.companion.findUniqueOrThrow({ where: { id: perro.id } })).aprobacion).toBe(50);
    expect(await prisma.logEntry.count({ where: { saveId, text: 'Kaila asiente en silencio.' } })).toBe(1);
  });

  it('con la aprobación por debajo de 10 tres días seguidos, se va', async () => {
    const harto = await prisma.companion.create({ data: { saveId, name: 'Harto', role: 'aliado', notes: '', tipo: 'NPC', aprobacion: 5 } });
    expect(await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: MIN }))).toEqual([]);
    expect(await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: MIN + 2 * 1440 }))).toEqual([]);
    expect(await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: MIN + 3 * 1440 }))).toEqual(['Harto']);
    expect(await prisma.companion.findUnique({ where: { id: harto.id } })).toBeNull();
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'COMPANERO_SE_VA' } })).toBe(1);
  });

  it('quien se va deja sus cosas en la bolsa del personaje, sin equipar', async () => {
    const c = await prisma.companion.create({ data: { saveId, name: 'Armado', role: 'aliado', notes: '', tipo: 'NPC', aprobacion: 5, aprobacionBajaDesde: MIN } });
    const espada = await prisma.inventoryItem.create({ data: { saveId, name: 'Espada', description: 'x', origin: 'x', companionId: c.id, slot: 'ARMA_PRINCIPAL' } as never });
    await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: MIN + 3 * 1440 }));
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: espada.id } })).toMatchObject({ companionId: null, slot: null });
  });

  it('si se recupera a tiempo, se queda', async () => {
    const dudoso = await prisma.companion.create({ data: { saveId, name: 'Dudoso', role: 'aliado', notes: '', tipo: 'NPC', aprobacion: 5 } });
    await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: MIN }));
    await prisma.companion.update({ where: { id: dudoso.id }, data: { aprobacion: 30 } });
    await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: MIN + 1440 }));
    expect((await prisma.companion.findUniqueOrThrow({ where: { id: dudoso.id } })).aprobacionBajaDesde).toBeNull();
  });
});
