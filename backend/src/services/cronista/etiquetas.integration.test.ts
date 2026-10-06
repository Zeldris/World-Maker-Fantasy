import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { etiquetasActivas, etiquetasDeReputacion, muertesDeRendidos, revisarEtiquetasDeReputacion, REP_AMIGO, REP_ENEMIGO, UMBRAL_CLEMENTE } from './etiquetas.js';

describe('etiquetas (CR-14) — reglas puras', () => {
  it('cuenta como rendido al que ya dejaste convaleciente en el último día', () => {
    const s = [
      { tipo: 'COMBATE_GANADO', minuto: 100, victima: 'a' },
      { tipo: 'MUERTE_CAUSADA', minuto: 110, victima: 'a' },
      { tipo: 'MUERTE_CAUSADA', minuto: 120, victima: 'b' },
      { tipo: 'COMBATE_GANADO', minuto: 200, victima: 'c' },
      { tipo: 'MUERTE_CAUSADA', minuto: 200 + 2000, victima: 'c' },
    ];
    expect(muertesDeRendidos(s)).toBe(1);
  });

  it('amigo con reputación alta, enemigo con reputación muy baja, nada en medio', () => {
    expect(etiquetasDeReputacion({ 'Clan Helsig': REP_AMIGO, 'Clan Serhu': REP_ENEMIGO - 1, Otros: 2500 })).toEqual([
      { clave: 'AMIGO_DE:clan-helsig', texto: 'Amigo de Clan Helsig' },
      { clave: 'ENEMIGO_DE:clan-serhu', texto: 'Enemigo de Clan Serhu' },
    ]);
  });
});

describe('etiquetas (CR-14) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 2 * 1440;
  const yo: ActorSuceso = { entidadTipo: 'PERSONAJE', entidadId: '', papel: 'AUTOR' };
  const registrar = (tipo: 'MUERTE_CAUSADA' | 'PERDON_CONCEDIDO' | 'REINO_FUNDADO', actores: ActorSuceso[], datos: object) =>
    prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo, fictionalMinutes: MIN, origen: 'JUGADOR', actores, datos: datos as never }));

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Etiquetas (CR-14)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
        worldState: { create: { fictionalMinutes: MIN } },
      },
    })).id;
    yo.entidadId = saveId;
    await asegurarMundoDePartida(prisma, saveId);
    await procesarReacciones(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('Clemente llega al tercer perdón, una sola vez, con su suceso', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL' } });
    for (let i = 0; i < UMBRAL_CLEMENTE; i++) {
      expect((await etiquetasActivas(prisma, saveId)).has('CLEMENTE')).toBe(false);
      await registrar('PERDON_CONCEDIDO', [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], { personaje: 'x', perdonado: npc.name });
      await procesarReacciones(prisma, saveId);
    }
    expect((await etiquetasActivas(prisma, saveId)).has('CLEMENTE')).toBe(true);
    await registrar('PERDON_CONCEDIDO', [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], { personaje: 'x', perdonado: npc.name });
    await procesarReacciones(prisma, saveId);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'ETIQUETA_GANADA' } })).toBe(1);
  });

  it('matar a un NPC con nombre da «Verdugo de…»', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', saveId: null }, orderBy: { slug: 'asc' } });
    await registrar('MUERTE_CAUSADA', [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'VICTIMA' }], { personaje: 'x', victima: npc.name });
    await procesarReacciones(prisma, saveId);
    const e = await prisma.etiqueta.findFirstOrThrow({ where: { saveId, clave: `VERDUGO_DE:${npc.slug}` } });
    expect(e.texto).toBe(`Verdugo de ${npc.name}`);
  });

  it('fundar el Reino da «Fundador»', async () => {
    await registrar('REINO_FUNDADO', [yo], { reino: 'x', fundador: 'x', region: 'x' });
    await procesarReacciones(prisma, saveId);
    expect((await etiquetasActivas(prisma, saveId)).has('FUNDADOR')).toBe(true);
  });

  it('las de relación siguen a la reputación: se ponen y se apagan', async () => {
    await prisma.worldState.update({ where: { saveId }, data: { factionsStatus: { 'Clan Helsig': REP_AMIGO } } });
    await prisma.$transaction((tx) => revisarEtiquetasDeReputacion(tx, { saveId, worldId, fictionalMinutes: MIN }));
    expect((await etiquetasActivas(prisma, saveId)).has('AMIGO_DE:clan-helsig')).toBe(true);
    await prisma.worldState.update({ where: { saveId }, data: { factionsStatus: { 'Clan Helsig': 2500 } } });
    await prisma.$transaction((tx) => revisarEtiquetasDeReputacion(tx, { saveId, worldId, fictionalMinutes: MIN }));
    expect((await etiquetasActivas(prisma, saveId)).has('AMIGO_DE:clan-helsig')).toBe(false);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'ETIQUETA_PERDIDA' } })).toBe(1);
  });
});
