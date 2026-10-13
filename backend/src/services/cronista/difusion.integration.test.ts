import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso } from './sucesos.js';
import { conocer, difundir, leerBandos, preguntarNoticias, VENTANA_DIAS_LLEGA_SOLA } from './difusion.js';
import { asegurarTablonesDePartida, TABLON_RECIPE_KEY } from './tablones.js';
import type { MetaNoticia } from './noticias.js';

// CR-18 (18b, hito 0.2) — lo visto y lo que llega solo: la importancia dice hasta dónde, la distancia
// cuándo, y solo llega solo lo de importancia ≥ 7 (Q10).
describe('difusión de sucesos al personaje (CR-18 18b)', () => {
  const DIA = 20;
  let saveId: string;
  let lugarId: string;

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, region: 'Las Llanuras del Viento Rojo' }, select: { id: true } });
    lugarId = lugar.id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Difusión CR-18', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'D',
        currentLocationId: lugarId,
        worldState: { create: { fictionalMinutes: DIA * 1440 + 600 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  const ahora = async () => (await prisma.worldState.findUniqueOrThrow({ where: { saveId } })).fictionalMinutes;
  const pasarDias = async (dias: number) => prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: (await ahora()) + dias * 1440 } });
  const alianza = async (region: string, minutos?: number) =>
    registrarSuceso(prisma, {
      saveId, tipo: 'ALIANZA', fictionalMinutes: minutos ?? (await ahora()), regionSlug: region, origen: 'MUNDO', actores: [],
      datos: { faccionA: 'Los de prueba', faccionB: 'Los otros' },
    });

  it('lo de importancia ≥ 7 de una región vecina llega al día siguiente, como rumor y enlazado a su suceso', async () => {
    const id = await alianza('cienaga-troncal');
    expect(await difundir(prisma, saveId)).toBe(0);
    await pasarDias(1);
    expect(await difundir(prisma, saveId)).toBe(1);
    const entrada = await prisma.logEntry.findFirstOrThrow({ where: { saveId, channel: 'WORLD', text: { contains: 'sellan una alianza' } } });
    expect(entrada.text).toBe('Se dice que Los de prueba y Los otros sellan una alianza.');
    const meta = entrada.noticia as MetaNoticia;
    expect(meta.sucesoId).toBe(id);
    expect(meta.rumor?.region).toBe('Ciénaga Troncal');
    // CFG-35: la noticia lleva el nivel del suceso (alianza, importancia 7).
    expect(meta.nivel).toBe('DESTACADO');
    const c = await prisma.conocimiento.findUniqueOrThrow({ where: { saveId_sucesoId: { saveId, sucesoId: id } } });
    expect(c).toMatchObject({ via: 'OIDAS', confirmado: false, logEntryId: entrada.id });
    // No se repite.
    expect(await difundir(prisma, saveId)).toBe(0);
  });

  it('en su región llega al momento y como hecho; más allá de su alcance, nunca', async () => {
    const aqui = await alianza('las-llanuras-del-viento-rojo');
    const lejos = await alianza('la-meseta-del-orden');
    expect(await difundir(prisma, saveId)).toBe(1);
    expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: aqui } } })).toMatchObject({ confirmado: true });
    await pasarDias(3);
    await difundir(prisma, saveId);
    expect(await prisma.conocimiento.count({ where: { saveId, sucesoId: lejos } })).toBe(0);
  });

  it('lo menor no llega solo; lo que pasa donde está el personaje lo sabe por haberlo visto, sin noticia', async () => {
    const menor = await registrarSuceso(prisma, {
      saveId, tipo: 'TREGUA', fictionalMinutes: await ahora(), regionSlug: 'las-llanuras-del-viento-rojo', origen: 'MUNDO', actores: [],
      datos: { faccionA: 'Unos', faccionB: 'Otros' },
    });
    await difundir(prisma, saveId);
    expect(await prisma.conocimiento.count({ where: { saveId, sucesoId: menor } })).toBe(0);

    const visto = await registrarSuceso(prisma, {
      saveId, tipo: 'TREGUA', fictionalMinutes: await ahora(), locationId: lugarId, origen: 'MUNDO', actores: [],
      datos: { faccionA: 'Estos', faccionB: 'Aquellos' },
    });
    expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: visto } } })).toMatchObject({ via: 'TESTIGO', confirmado: true, logEntryId: null });
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'Estos y Aquellos' } } })).toBe(0);
  });

  it('pasada la ventana de días ya no es novedad y no llega', async () => {
    const viejo = await alianza('las-llanuras-del-viento-rojo', (await ahora()) - (VENTANA_DIAS_LLEGA_SOLA + 1) * 1440);
    await difundir(prisma, saveId);
    expect(await prisma.conocimiento.count({ where: { saveId, sucesoId: viejo } })).toBe(0);
  });

  // 18c (Q9): «¿Qué se cuenta?».
  describe('«¿Qué se cuenta?»', () => {
    const NPC = 'maestro-cocinero-serhu';

    it('cuenta como hecho lo menor de su región que no llega solo, una vez al día', async () => {
      await pasarDias(1);
      const tregua = await registrarSuceso(prisma, {
        saveId, tipo: 'TREGUA', fictionalMinutes: await ahora(), regionSlug: 'las-llanuras-del-viento-rojo', origen: 'MUNDO', actores: [],
        datos: { faccionA: 'Los del vado', faccionB: 'Los del puente' },
      });
      const r = await preguntarNoticias(prisma, saveId, NPC);
      expect(r!.contadas).toBeGreaterThanOrEqual(1);
      expect(r!.frase).toContain('«Los del vado y Los del puente pactan una tregua.»');
      expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: tregua } } })).toMatchObject({ via: 'NPC', confirmado: true, fuente: NPC });
      expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: 'Los del vado y Los del puente pactan una tregua.' } })).toBe(1);
      expect((await preguntarNoticias(prisma, saveId, NPC))!.frase).toContain('Ya te he contado todo lo que sé');
    });

    it('confirma un rumor de su facción; sin nada nuevo, habla del tiempo', async () => {
      await pasarDias(1);
      const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' }, select: { slug: true } });
      const lejana = await registrarSuceso(prisma, {
        saveId, tipo: 'ALIANZA', fictionalMinutes: await ahora(), regionSlug: 'cienaga-troncal', origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: serhu.slug, papel: 'AUTOR' }], datos: { faccionA: 'Clan Serhu', faccionB: 'Los de lejos' },
      });
      await pasarDias(1);
      await difundir(prisma, saveId);
      expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: lejana } } })).toMatchObject({ confirmado: false });
      const r = await preguntarNoticias(prisma, saveId, NPC);
      expect(r!.frase).toContain('Clan Serhu y Los de lejos sellan una alianza.');
      expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: lejana } } })).toMatchObject({ confirmado: true });
      expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: 'Se confirma: Clan Serhu y Los de lejos sellan una alianza.' } })).toBe(1);
      await pasarDias(1);
      const nada = await preguntarNoticias(prisma, saveId, NPC);
      expect(nada!.contadas).toBe(0);
      expect(nada!.frase).toContain('del tiempo');
    });
  });

  // 18d (Q9): bandos del tablón.
  it('los bandos de un tablón anuncian lo importante de su región; leerlos lo da por sabido', async () => {
    await prisma.$transaction((tx) => asegurarTablonesDePartida(tx, saveId));
    const tablon = await prisma.building.findFirstOrThrow({
      where: { recipeKey: TABLON_RECIPE_KEY, faction: { saveId }, location: { region: 'Las Llanuras del Viento Rojo' } },
      select: { id: true },
    });
    await pasarDias(1);
    const importante = await registrarSuceso(prisma, {
      saveId, tipo: 'TREGUA', fictionalMinutes: await ahora(), regionSlug: 'las-llanuras-del-viento-rojo', origen: 'MUNDO', actores: [],
      datos: { faccionA: 'Los del bando', faccionB: 'Los del pregón' },
    });
    const menor = await registrarSuceso(prisma, {
      saveId, tipo: 'CAMBIO_RELACION', fictionalMinutes: await ahora(), regionSlug: 'las-llanuras-del-viento-rojo', origen: 'MUNDO', actores: [],
      datos: { faccionA: 'Unos menores', faccionB: 'Otros menores', antes: 'neutral', despues: 'tensa' },
    });
    const bandos = (await leerBandos(prisma, saveId, tablon.id))!;
    expect(bandos.map((b) => b.sucesoId)).toContain(importante);
    expect(bandos.map((b) => b.sucesoId)).not.toContain(menor);
    expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: importante } } })).toMatchObject({ via: 'BANDO', confirmado: true, fuente: tablon.id });
    // Releerlo no repite la noticia.
    await leerBandos(prisma, saveId, tablon.id);
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: { contains: 'Los del bando' } } })).toBe(1);
    expect(await leerBandos(prisma, saveId, 'no-existe')).toBeNull();
  });

  // P137 (QA-27): las muertes y despertares de la jugadora no salen en los bandos ni llegan como noticia.
  it('la muerte y el despertar de la jugadora quedan en sus Leyendas: ni bando ni noticia', async () => {
    await prisma.$transaction((tx) => asegurarTablonesDePartida(tx, saveId));
    const tablon = await prisma.building.findFirstOrThrow({
      where: { recipeKey: TABLON_RECIPE_KEY, faction: { saveId }, location: { region: 'Las Llanuras del Viento Rojo' } },
      select: { id: true },
    });
    await pasarDias(1);
    const comun = { saveId, fictionalMinutes: await ahora(), regionSlug: 'las-llanuras-del-viento-rojo', origen: 'JUGADOR' as const, actores: [] };
    const muerte = await registrarSuceso(prisma, { ...comun, tipo: 'MUERTE_JUGADOR', datos: { personaje: 'Gorhorn', causa: 'un Guchapo' } });
    const despertar = await registrarSuceso(prisma, { ...comun, tipo: 'RENACER', datos: { personaje: 'Gorhorn', lugar: 'La Hondonada del Eco' } });
    const bandos = (await leerBandos(prisma, saveId, tablon.id))!.map((b) => b.sucesoId);
    expect(bandos).not.toContain(muerte);
    expect(bandos).not.toContain(despertar);
    await difundir(prisma, saveId);
    expect(await prisma.conocimiento.count({ where: { saveId, sucesoId: { in: [muerte, despertar] } } })).toBe(0);
    // Cualquier otro camino (el rumor de los viajeros, uno nuevo) choca con `conocer`.
    expect(await prisma.$transaction((tx) => conocer(tx, { saveId, sucesoId: muerte, via: 'NPC', confirmado: false, minutos: 0, escribirNoticia: true }))).toBeNull();
  });

  // 18e (Q4): ir donde pasó confirma el rumor.
  it('un rumor se confirma al llegar a la región donde pasó', async () => {
    await pasarDias(1);
    const lejana = await alianza('cienaga-troncal');
    await pasarDias(1);
    await difundir(prisma, saveId);
    expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: lejana } } })).toMatchObject({ confirmado: false });
    const worldId = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId;
    const cienaga = await prisma.location.findFirstOrThrow({ where: { worldId, region: 'Ciénaga Troncal' }, select: { id: true } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: cienaga.id } });
    try {
      await difundir(prisma, saveId);
      expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: lejana } } })).toMatchObject({ confirmado: true });
      expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: 'Se confirma: Los de prueba y Los otros sellan una alianza.' } })).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: lugarId } });
    }
  });

  // /code-review: un NPC que solo confirma rumores también cuenta para «una vez al día»; dos
  // pasadas a la vez no chocan en la clave única.
  it('un NPC que solo confirma rumores no vuelve a contar el mismo día', async () => {
    await pasarDias(1);
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' }, select: { slug: true } });
    const rumorDeSerhu = await registrarSuceso(prisma, {
      saveId, tipo: 'ALIANZA', fictionalMinutes: await ahora(), regionSlug: 'cienaga-troncal', origen: 'MUNDO',
      actores: [{ entidadTipo: 'FACCION', entidadId: serhu.slug, papel: 'AUTOR' }], datos: { faccionA: 'Clan Serhu', faccionB: 'Los del límite' },
    });
    await prisma.conocimiento.create({ data: { saveId, sucesoId: rumorDeSerhu, desde: await ahora(), via: 'OIDAS', confirmado: false } });
    await pasarDias(1);
    const r = await preguntarNoticias(prisma, saveId, 'curtidor-serhu');
    expect(r!.frase).toContain('Los del límite');
    expect(await prisma.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId, sucesoId: rumorDeSerhu } } })).toMatchObject({ confirmado: true, via: 'NPC', fuente: 'curtidor-serhu' });
    expect((await preguntarNoticias(prisma, saveId, 'curtidor-serhu'))!.frase).toContain('Ya te he contado todo lo que sé');
  });

  it('dos «conocer» a la vez del mismo suceso: uno lo apunta y el otro no falla', async () => {
    const id = await alianza('las-llanuras-del-viento-rojo');
    await prisma.conocimiento.deleteMany({ where: { saveId, sucesoId: id } });
    const minutos = await ahora();
    const una = () => prisma.$transaction((tx) => conocer(tx, { saveId, sucesoId: id, via: 'OIDAS', confirmado: true, minutos, escribirNoticia: true }));
    const resultados = await Promise.all([una(), una()]);
    expect(resultados.filter((r) => r === 'NUEVO')).toHaveLength(1);
    expect(await prisma.conocimiento.count({ where: { saveId, sucesoId: id } })).toBe(1);
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'WORLD', text: { contains: 'Los de prueba y Los otros' }, noticia: { path: ['sucesoId'], equals: id } } })).toBe(1);
  });
});

