import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { preguntarCompanero } from './companeroTierra.js';

describe('«¿Qué se sabe en tu tierra?» (CR-42)', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 5 * 1440 + 600;

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

  it('un compañero de las Llanuras que te aprecia cuenta lo de su tierra, una vez al día', async () => {
    const serhu = await prisma.npc.findFirstOrThrow({ where: { worldId, saveId: null, faction: 'Clan Serhu', kind: 'PRINCIPAL' } });
    const c = await prisma.companion.create({ data: { saveId, name: 'Rakka', role: 'aliado', notes: '', tipo: 'NPC', sourceSlug: serhu.slug, aprobacion: 60 } });
    await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId, tipo: 'TORMENTA_EXTREMA', fictionalMinutes: MIN - 60, origen: 'MUNDO', regionSlug: 'las-llanuras-del-viento-rojo',
      actores: [], datos: { region: 'Las Llanuras del Viento Rojo' },
    }));
    const r = await preguntarCompanero(prisma, saveId, c.id);
    expect('frase' in r && r.contadas).toBeGreaterThan(0);
    const otra = await preguntarCompanero(prisma, saveId, c.id);
    expect('frase' in otra && otra.frase).toBe('Rakka: «Ya te he contado todo lo que sé.»');
  });

  it('P291: no repite la misma noticia ni cuenta lo de otra tierra', async () => {
    const serhu = await prisma.npc.findFirstOrThrow({ where: { worldId, saveId: null, faction: 'Clan Serhu', kind: 'PRINCIPAL' } });
    const c = await prisma.companion.create({ data: { saveId, name: 'Orrek', role: 'aliado', notes: '', tipo: 'NPC', sourceSlug: serhu.slug, aprobacion: 60 } });
    for (const m of [MIN - 30, MIN - 20]) {
      await prisma.$transaction((tx) => registrarSuceso(tx, {
        saveId, tipo: 'TORMENTA_EXTREMA', fictionalMinutes: m, origen: 'MUNDO', regionSlug: 'las-llanuras-del-viento-rojo',
        actores: [], datos: { region: 'Las Llanuras del Viento Rojo' },
      }));
    }
    const r = await preguntarCompanero(prisma, saveId, c.id);
    if (!('frase' in r)) throw new Error(r.error);
    const trozos = r.frase.split('«').slice(1);
    expect(new Set(trozos).size).toBe(trozos.length);
  });

  it('con poca aprobación no cuenta nada; un animal no tiene nada que contar', async () => {
    const distante = await prisma.companion.create({ data: { saveId, name: 'Seco', role: 'aliado', notes: '', tipo: 'NPC', aprobacion: 30 } });
    const r = await preguntarCompanero(prisma, saveId, distante.id);
    expect('frase' in r && r.frase).toContain('no tiene ganas de hablar');
    const perro = await prisma.companion.create({ data: { saveId, name: 'Canizor', role: 'mascota', notes: '', tipo: 'FAUNA' } });
    expect(await preguntarCompanero(prisma, saveId, perro.id)).toEqual({ error: 'Canizor no tiene nada que contarte.' });
  });
});
