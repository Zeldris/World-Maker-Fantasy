import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { MINUTOS_POR_ANIO } from './edades.js';
import { crearSubdito } from './subditos.js';
import { posiblesParejas } from './familias.js';
import { celdasDeEntrada, enRadioSeguro } from '../entradasZona.js';
import { celdaDePixel } from '../zonaPosicion.js';
import { sacarAJugadora } from './prepararFuera.js';
import { emparejarDeADos } from './prepararPareja.js';

// P427 (`fuera:<lugar>`) y P433 (`sexo=pareja`) de `prepararReino.ts`.
describe('pasos fuera:<lugar> y sexo=pareja de preparar (P427, P433)', () => {
  const saveIds: string[] = [];

  async function partida(nombre: string, opciones: { endedAt?: Date } = {}) {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const lugares = await prisma.location.findMany({ where: { worldId: world.id, kind: { not: 'interior' }, x: { not: null }, y: { not: null } }, orderBy: { slug: 'asc' }, take: 2 });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: nombre, characterArchetype: 'cazador', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        currentLocationId: lugares[0]!.id, zonaPosX: 400, zonaPosY: 300, zonaPosEntradaX: 400, zonaPosEntradaY: 300, endedAt: opciones.endedAt ?? null,
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return { saveId: save.id, worldId: world.id, aqui: lugares[0]!, otro: lugares[1]! };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('fuera: mueve a la jugadora al lugar con su punto de entrada y es idempotente', async () => {
    const { saveId, otro, aqui } = await partida('Fuera (P427)');
    const r = await sacarAJugadora(prisma, { saveId, lugarSlug: otro.slug });
    expect(r).toMatchObject({ lugar: otro.name, desde: aqui.name, yaEstaba: false });
    const s = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(s).toMatchObject({ currentLocationId: otro.id });
    // Entra por una salida de la zona (donde el viaje deja a quien llega): dentro del radio seguro de las entradas, y guardada como entrada.
    expect(s.zonaPosEntradaX).toBe(s.zonaPosX);
    expect(s.zonaPosEntradaY).toBe(s.zonaPosY);
    const entradas = await celdasDeEntrada(prisma, saveId, otro.id);
    if (entradas.length > 0) expect(enRadioSeguro(celdaDePixel({ x: s.zonaPosX!, y: s.zonaPosY! }), entradas)).toBe(true);
    else expect([s.zonaPosX, s.zonaPosY]).toEqual([400, 300]);
    // Como el viaje real, el lugar queda visitado.
    expect(await prisma.locationVisit.count({ where: { saveId, locationId: otro.id } })).toBe(1);
    expect(await sacarAJugadora(prisma, { saveId, lugarSlug: otro.slug })).toMatchObject({ yaEstaba: true });
  });

  it('fuera: un lugar que no existe se rechaza con el motivo y sin tocar la partida; también la partida terminada', async () => {
    const { saveId, aqui } = await partida('Fuera mal (P427)');
    const r = await sacarAJugadora(prisma, { saveId, lugarSlug: 'no-existe-este-lugar' });
    expect('error' in r && r.error).toMatch(/no hay lugar «no-existe-este-lugar».*lugares: /);
    expect(await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true, zonaPosX: true } })).toEqual({ currentLocationId: aqui.id, zonaPosX: 400 });
    const fin = await partida('Fuera terminada (P427)', { endedAt: new Date() });
    const r2 = await sacarAJugadora(prisma, { saveId: fin.saveId, lugarSlug: fin.otro.slug });
    expect('error' in r2 && r2.error).toMatch(/ha terminado/);
    expect(await sacarAJugadora(prisma, { saveId: 'no-hay', lugarSlug: 'x' })).toEqual({ error: 'fuera: no hay partida no-hay.' });
  });

  it('fuera: limpia lo pendiente (ofertas, encuentro, camino) y rechaza con un combate abierto o una zona interior (P427)', async () => {
    const { saveId, otro, aqui } = await partida('Fuera pendientes (P427)');
    await prisma.save.update({ where: { id: saveId }, data: { pendingDynamicMode: { x: 1 }, pendingNpcAttack: { y: 1 }, zonaUltimoEncuentro: { targetSlug: 'a', locationId: aqui.id }, zonaCaminoPendiente: [{ x: 1, y: 1 }] } });
    await sacarAJugadora(prisma, { saveId, lugarSlug: otro.slug });
    const s = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect([s.pendingDynamicMode, s.pendingNpcAttack, s.zonaUltimoEncuentro, s.zonaCaminoPendiente]).toEqual([null, null, null, null]);

    const c = await partida('Fuera con combate (P427)');
    await prisma.save.update({ where: { id: c.saveId }, data: { pendingCombatNpcSlugs: ['x'] } });
    const r = await sacarAJugadora(prisma, { saveId: c.saveId, lugarSlug: c.otro.slug });
    expect('error' in r && r.error).toBe('fuera: hay un combate en curso; usa fuera antes de combate:<npc>.');
    expect((await prisma.save.findUniqueOrThrow({ where: { id: c.saveId } })).currentLocationId).toBe(c.aqui.id);

    const interior = await prisma.location.findFirstOrThrow({ where: { worldId: c.worldId, kind: 'interior' } });
    const r2 = await sacarAJugadora(prisma, { saveId, lugarSlug: interior.slug });
    expect('error' in r2 && r2.error).toMatch(/interior/);
  });

  it('pareja: empareja de dos en dos con parejaId en los dos sentidos, y la revisión de familias ya no los ve libres (P433)', async () => {
    const { saveId, worldId } = await partida('Pareja (P433)');
    const ahora = 480;
    const ids: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 3; i++) ids.push((await crearSubdito(tx, { saveId, worldId, pueblo: 'orcos', nacidoEn: ahora - 30 * MINUTOS_POR_ANIO, origen: 'LLEGADA', ahora, genero: i % 2 === 0 ? 'M' : 'F', random: Math.random })).id);
      expect(await emparejarDeADos(tx, ids)).toBe(1);
    });
    const filas = await prisma.subject.findMany({ where: { id: { in: ids } }, select: { id: true, genero: true, parejaId: true } });
    const por = new Map(filas.map((f) => [f.id, f]));
    expect(por.get(ids[0]!)!.parejaId).toBe(ids[1]);
    expect(por.get(ids[1]!)!.parejaId).toBe(ids[0]);
    expect(por.get(ids[2]!)!.parejaId).toBeNull();
    expect([por.get(ids[0]!)!.genero, por.get(ids[1]!)!.genero].sort()).toEqual(['F', 'M']);
    // Lo mismo que el juego: quien ya tiene pareja no entra en las posibles parejas nuevas.
    const libres = filas.map((f) => ({ id: f.id, pueblo: 'orcos', genero: f.genero, nacidoEn: null, felicidad: 100, parejaId: f.parejaId }));
    expect(posiblesParejas(libres, ahora)).toEqual([]);
  });
});
