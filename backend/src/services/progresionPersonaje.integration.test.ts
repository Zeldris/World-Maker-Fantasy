import { describe, it, expect, afterAll } from 'vitest';
import { Clase, Especializacion } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { hacerDomador, subirDeNivel } from './progresionPersonaje.js';
import { esDomador, maxSlotsDomadorFor } from './companionSupervivencia.js';
import { levelForXp } from './progression.js';

// QA-269 (CR-56): el paso `domador:<nivel>` de `prepararReino.ts`, contra una partida real.
describe('hacerDomador (QA-269, CR-56)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, extra: { clase?: Clase | null; level?: number } = {}) {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        clase: extra.clase === undefined ? Clase.CAZADOR : extra.clase, level: extra.level ?? 3,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    return save.id;
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('un Cazador de nivel 3 queda Domador de nivel 10, con su XP, sus puntos de atributo y su rama', async () => {
    const saveId = await partida('Domadora (QA-269)');
    const r = await hacerDomador(prisma, { saveId, nivel: 10 });
    expect(r).toEqual({ nivel: 10, especializacion: Especializacion.DOMADOR, puntosDeAtributo: 4 }); // ASI en los niveles 4 y 8
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.level).toBe(10);
    expect(levelForXp(save.xp)).toBe(10); // el XP es el de la tabla, no solo el campo level
    expect(save.pendingAttributePoints).toBe(4);
    expect(esDomador(save.clase, save.especializacion)).toBe(true);
    expect(maxSlotsDomadorFor(save.clase, save.especializacion, save.level)).toBeGreaterThanOrEqual(1);
    // Las habilidades de clase por nivel (4 a 10) y la línea del diario, como al ganar XP en el juego.
    expect(await prisma.savedAction.count({ where: { saveId, category: 'combate' } })).toBeGreaterThan(0);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'sube a nivel 10' } } })).toBe(1);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'se especializa: DOMADOR' } } })).toBe(1);
  });

  it('repetido no duplica nada', async () => {
    const saveId = await partida('Domadora repetida (QA-269)');
    await hacerDomador(prisma, { saveId, nivel: 10 });
    const habilidades = await prisma.savedAction.count({ where: { saveId } });
    const r = await hacerDomador(prisma, { saveId, nivel: 10 });
    expect(r).toEqual({ nivel: 10, especializacion: Especializacion.DOMADOR, puntosDeAtributo: 0 });
    expect(await prisma.savedAction.count({ where: { saveId } })).toBe(habilidades);
  });

  it('se niega, con el motivo, bajo el nivel 10, desde el 20, sin clase, con otra clase o con otra especialización', async () => {
    const baja = await partida('Baja (QA-269)');
    expect(await hacerDomador(prisma, { saveId: baja, nivel: 9 })).toEqual({ error: expect.stringContaining('a partir del nivel 10') });
    const alta = await partida('Alta (QA-269)');
    expect(await hacerDomador(prisma, { saveId: alta, nivel: 20 })).toEqual({ error: expect.stringContaining('hasta el nivel 19') });
    const sinClase = await partida('Sin clase (QA-269)', { clase: null });
    expect(await hacerDomador(prisma, { saveId: sinClase, nivel: 10 })).toEqual({ error: expect.stringContaining('no tiene clase') });
    const guerrera = await partida('Guerrera (QA-269)', { clase: Clase.GUERRERO });
    expect(await hacerDomador(prisma, { saveId: guerrera, nivel: 10 })).toEqual({ error: expect.stringContaining('no es una especialización de GUERRERO') });
    // Y no deja nada a medias: ni nivel ni especialización.
    for (const id of [baja, alta, sinClase, guerrera]) {
      const s = await prisma.save.findUniqueOrThrow({ where: { id } });
      expect([s.level, s.especializacion]).toEqual([3, null]);
    }
  });

  it('no baja de nivel', async () => {
    const saveId = await partida('Alta ya (QA-269)', { level: 12 });
    await prisma.$transaction(async (tx) => {
      expect(await subirDeNivel(tx, saveId, 10)).toEqual({ ok: false, motivo: expect.stringContaining('ya es de nivel 12') });
    });
  });
});
