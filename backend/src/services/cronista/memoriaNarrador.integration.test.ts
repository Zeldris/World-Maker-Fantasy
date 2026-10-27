import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { bloqueMemoria, componer, lineaDeEtiquetas, palabrasClave, puntuar, sinTextosRepetidos, TOPE_TOTAL, TOPE_VERDAD } from './memoriaNarrador.js';

describe('memoria del narrador (CR-21…23) — reglas puras', () => {
  it('palabras clave sin acentos, cortas ni vacías', () => {
    expect([...palabrasClave('Busco a Torgash por la caravana del río')]).toEqual(['busco', 'torgash', 'caravana']);
  });

  it('lo reciente, lo importante y lo que toca a la escena puntúa más', () => {
    const ctx = { ahora: 10 * 1440, palabras: palabrasClave('hablo con Torgash'), actoresEscena: new Set(['t']) };
    const deEscena = puntuar({ importancia: 3, fictionalMinutes: 9 * 1440, texto: 'algo', actorIds: ['t'] }, ctx);
    const ajeno = puntuar({ importancia: 3, fictionalMinutes: 9 * 1440, texto: 'algo', actorIds: ['x'] }, ctx);
    const viejo = puntuar({ importancia: 3, fictionalMinutes: 0, texto: 'algo', actorIds: ['t'] }, ctx);
    expect(deEscena).toBeGreaterThan(ajeno);
    expect(deEscena).toBeGreaterThan(viejo);
  });

  it('un texto repetido ocupa un solo hueco de la memoria (P247)', () => {
    const renacer = 'Gorhorn despierta de nuevo en Campamento.';
    expect(sinTextosRepetidos([renacer, 'otra cosa', renacer, renacer])).toEqual([renacer, 'otra cosa']);
  });

  it('P271: las etiquetas de la jugadora van como rasgos en minúscula, nunca como un nombre con el que llamarla', () => {
    const linea = lineaDeEtiquetas(['Clemente', 'Carnicero'])!;
    expect(linea).toContain('clemente, carnicero');
    expect(linea).not.toContain('Clemente');
    expect(linea).not.toMatch(/conocen como/);
    expect(linea).toContain('no su nombre ni un apodo');
    expect(lineaDeEtiquetas([])).toBeNull();
  });

  it('P271: al bajar la etiqueta a minúscula, el nombre propio de dentro guarda su mayúscula', () => {
    const linea = lineaDeEtiquetas(['Amigo de los Maktor', 'Salvador de Llanos Altos'])!;
    expect(linea).toContain('amigo de los Maktor, salvador de Llanos Altos');
  });

  it('recorta por el final sin pasarse del presupuesto; la verdad nunca pasa de su tope', () => {
    const largo = 'x'.repeat(200);
    const texto = componer([
      { titulo: 'VERDAD', lineas: Array(10).fill(largo) },
      { titulo: 'CALLBACKS', lineas: Array(20).fill(largo) },
      { titulo: 'MEMORIA', lineas: Array(20).fill(largo) },
    ]);
    expect(texto.length).toBeLessThanOrEqual(TOPE_TOTAL);
    expect(texto.split('\n\n')[0]!.length).toBeLessThanOrEqual(TOPE_VERDAD);
    expect(texto.startsWith('VERDAD:')).toBe(true);
  });
});

describe('memoria del narrador (CR-21…23) — escenas preparadas', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 4 * 1440;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: MIN } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    await procesarReacciones(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un muerto de la escena va en la verdad y no puede aparecer vivo; lo que se sabe de un NPC y su rencor también', async () => {
    const [muerto, vivo] = await prisma.npc.findMany({ where: { worldId, saveId: null, kind: 'PRINCIPAL' }, orderBy: { slug: 'asc' }, take: 2 });
    const yo = { entidadTipo: 'PERSONAJE' as const, entidadId: saveId, papel: 'AUTOR' as const };
    for (let i = 0; i < 2; i++) {
      await prisma.$transaction((tx) => registrarSuceso(tx, {
        saveId, tipo: 'MUERTE_CAUSADA', fictionalMinutes: MIN - 10, origen: 'JUGADOR',
        actores: [yo, { entidadTipo: 'NPC', entidadId: muerto!.id, papel: 'VICTIMA' }, { entidadTipo: 'NPC', entidadId: vivo!.id, papel: 'TESTIGO' }],
        datos: { personaje: 'Gorhorn', victima: muerto!.name },
      }));
    }
    await procesarReacciones(prisma, saveId);
    const bloque = await bloqueMemoria(prisma, {
      saveId, accion: `Hablo con ${vivo!.name}`, ahora: MIN, locationId: null, region: null,
      npcs: [{ id: muerto!.id, name: muerto!.name, faction: muerto!.faction, muerto: true }, { id: vivo!.id, name: vivo!.name, faction: vivo!.faction, muerto: false }],
    });
    expect(bloque).toContain(`Muertos: ${muerto!.name}. No pueden hablar, actuar ni aparecer vivos.`);
    expect(bloque).toContain(`${vivo!.name} le guarda rencor`);
    expect(bloque).toContain(`Gorhorn da muerte a ${muerto!.name}.`);
    expect(bloque.length).toBeLessThanOrEqual(TOPE_TOTAL);
  });

  it('un rumor sin confirmar no llega al narrador como algo sabido', async () => {
    const [, , npc] = await prisma.npc.findMany({ where: { worldId, saveId: null, kind: 'PRINCIPAL' }, orderBy: { slug: 'asc' }, take: 3 });
    const id = await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId, tipo: 'MUERTE_NPC', fictionalMinutes: MIN - 5, origen: 'MUNDO',
      actores: [{ entidadTipo: 'NPC', entidadId: npc!.id, papel: 'VICTIMA' }], datos: { npc: npc!.name },
    }));
    await prisma.conocimiento.deleteMany({ where: { saveId, sucesoId: id } });
    await prisma.conocimiento.create({ data: { saveId, sucesoId: id, desde: MIN - 5, via: 'OIDAS', confirmado: false } });
    const bloque = await bloqueMemoria(prisma, {
      saveId, accion: `Busco a ${npc!.name}`, ahora: MIN, locationId: null, region: null, npcs: [{ id: npc!.id, name: npc!.name, faction: npc!.faction, muerto: false }],
    });
    expect(bloque).not.toContain(`Muere ${npc!.name}`);
  });

  it('sin nada que contar, el bloque queda vacío', async () => {
    const otro = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Nadie', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'N',
        worldState: { create: { fictionalMinutes: 0 } },
      },
    });
    expect(await bloqueMemoria(prisma, { saveId: otro.id, accion: 'miro', ahora: 0, locationId: null, region: null, npcs: [] })).toBe('');
    await prisma.save.delete({ where: { id: otro.id } });
  });
});
