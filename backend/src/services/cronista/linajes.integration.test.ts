import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { aplicarEfecto } from './efectos.js';
import { registrarSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { npcsConRencor } from './recuerdos.js';
import { apellidoDe, asegurarLinajes, linajeDe, linajeDeCria, nombreConLinaje, unirALinaje } from './linajes.js';
import { generarRastro } from './nombres.js';
import { linajesConocidos } from './leyendas.js';

describe('linajes y rastros (CR-52) — reglas puras', () => {
  it('el apellido es la última palabra propia, sin roles ni facciones; los Faerus no tienen', () => {
    expect(apellidoDe('Torgash Ketg', 'orcos', 'Clan Serhu')).toBe('Ketg');
    expect(apellidoDe('Maestro Herrero Serhu', 'orcos', 'Clan Serhu')).toBeNull();
    expect(apellidoDe('Yerin Sael', 'nabieus', 'Keseg Sael')).toBeNull();
    expect(apellidoDe('Dulgren', 'orcos', 'Clan Goshg')).toBeNull();
    expect(apellidoDe('Tasko Veyra', 'faerus', null)).toBeNull();
  });

  it('el nombre con su linaje: apellido detrás; rastro como «del rastro»', () => {
    expect(nombreConLinaje('Brakka', { nombre: 'Ketg', tipo: 'APELLIDO' })).toBe('Brakka Ketg');
    expect(nombreConLinaje('Tasko', { nombre: 'Veyra', tipo: 'RASTRO' })).toBe('Tasko, del rastro Veyra');
    expect(nombreConLinaje('Tasko', { nombre: 'Veyra', tipo: 'RASTRO' }, true)).toBe('Tasko de Veyra');
    expect(nombreConLinaje('Tasko', null)).toBe('Tasko');
  });

  it('herencia por pueblo (Q9): orcos el de más rango (a igualdad la madre); Goirntes el padre; Nabieus y Faerus la madre', () => {
    const m = (linajeId: string | null, rango = 0) => ({ linajeId, rango });
    expect(linajeDeCria('orcos', m('M'), m('P'))).toBe('M');
    expect(linajeDeCria('orcos', m('M'), m('P', 1))).toBe('P');
    expect(linajeDeCria('goirntes', m('M', 1), m('P'))).toBe('P');
    expect(linajeDeCria('nabieus', m('M'), m('P', 1))).toBe('M');
    expect(linajeDeCria('faerus', m(null), m('P'))).toBe('P');
    expect(linajeDeCria('orcos', m(null), m(null))).toBeNull();
  });

  it('los rastros son palabras suaves de una pieza', () => {
    let i = 0;
    const r = generarRastro(() => (i++ % 7) / 7);
    expect(r).toMatch(/^[A-Z][a-z]+$/);
  });
});

describe('linajes y rastros (CR-52) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const AHORA = 480 + 20 * 1440;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: AHORA } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    await prisma.$transaction((tx) => asegurarLinajes(tx, saveId, AHORA));
    await procesarReacciones(prisma, saveId);
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const npc = (name: string) => prisma.npc.findFirstOrThrow({ where: { worldId, name, saveId: null } });
  // QA-243: Ufag y Gisot son PRINCIPAL, no plantillas, y entran en el linaje Ketg.
  const KETG = ['Gisot Ketg', 'Torgash Ketg', 'Ufag Ketg', 'Ulkha Ketg'];

  it('los apellidos del canon son linajes (Ketg con Torgash, Ulkha, Ufag y Gisot) y el personaje funda el suyo; idempotente', async () => {
    const ketg = await prisma.linaje.findFirstOrThrow({ where: { saveId, nombre: 'Ketg' }, include: { miembros: true } });
    expect(ketg.origen).toBe('CATALOGO');
    expect(ketg.miembros.map((m) => m.entidadId).sort()).toEqual((await Promise.all(KETG.map(async (n) => (await npc(n)).id))).sort());
    expect((await linajeDe(prisma, saveId, 'PERSONAJE', saveId))?.nombre).toBe('Gorhorn');
    const antes = await prisma.linajeMiembro.count({ where: { saveId } });
    await prisma.$transaction((tx) => asegurarLinajes(tx, saveId, AHORA));
    expect(await prisma.linajeMiembro.count({ where: { saveId } })).toBe(antes);
  });

  it('una pareja sin apellido funda linaje al nacer su cría; la siguiente cría es del mismo; el linaje sale en el Libro', async () => {
    const nacer = () => prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: AHORA, origen: 'MUNDO', random: () => 0.3 }, { tipo: 'crearNpc', faccionSlug: 'clan-goshg', como: 'NACE' }));
    const r1 = await nacer();
    expect(r1.aplicado).toBe(true);
    const l1 = (await linajeDe(prisma, saveId, 'NPC', r1.id!))!;
    expect(l1.origen).toBe('PARTIDA');
    const bebe = await prisma.npc.findUniqueOrThrow({ where: { id: r1.id! } });
    expect(bebe.name).toBe(`${bebe.name.split(' ')[0]} ${l1.nombre}`);
    expect((await linajeDe(prisma, saveId, 'NPC', bebe.madreNpcId!))?.id).toBe(l1.id);
    expect((await linajeDe(prisma, saveId, 'NPC', bebe.padreNpcId!))?.id).toBe(l1.id);
    expect(await prisma.sucesoActor.count({ where: { sucesoId: r1.sucesoId!, entidadTipo: 'LINAJE', entidadId: l1.id } })).toBe(1);
    const r2 = await nacer();
    expect((await linajeDe(prisma, saveId, 'NPC', r2.id!))?.id).toBe(l1.id);
  });

  it('un suceso con alguien de una familia apunta también a su linaje', async () => {
    const [torgash, ulkha] = [await npc('Torgash Ketg'), await npc('Ulkha Ketg')];
    const id = await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId, tipo: 'MUERTE_NPC', fictionalMinutes: AHORA, origen: 'MUNDO', datos: { npc: torgash.name },
      actores: [{ entidadTipo: 'NPC', entidadId: ulkha.id, papel: 'TESTIGO' }],
    }));
    await procesarReacciones(prisma, saveId);
    const ketg = await prisma.linaje.findFirstOrThrow({ where: { saveId, nombre: 'Ketg' } });
    expect(await prisma.sucesoActor.count({ where: { sucesoId: id, entidadTipo: 'LINAJE', entidadId: ketg.id } })).toBe(1);

    // Leyendas › Linajes: el propio primero; Ketg aparece cuando el personaje sabe algo de ellos.
    expect((await linajesConocidos(prisma, saveId)).map((l) => l.nombre)).not.toContain('Ketg');
    await prisma.conocimiento.create({ data: { saveId, sucesoId: id, desde: AHORA, via: 'OIDAS', confirmado: true } });
    const linajes = await linajesConocidos(prisma, saveId);
    expect(linajes[0]).toMatchObject({ nombre: 'Gorhorn', propio: true, miembros: [{ tipo: 'PERSONAJE', nombre: 'Gorhorn' }] });
    const conocido = linajes.find((l) => l.nombre === 'Ketg')!;
    expect(conocido.miembros.map((m) => m.nombre).sort()).toEqual(KETG);
    expect(conocido.historia.map((h) => h.sucesoId)).toEqual([id]);
    expect(conocido.historia[0]!.actores.some((a) => a.nombre === 'los Ketg')).toBe(true);
  });

  it('el rencor fuerte de un pariente pesa como propio; el leve no', async () => {
    const [torgash, ulkha] = [await npc('Torgash Ketg'), await npc('Ulkha Ketg')];
    const base = { saveId, npcId: torgash.id, sobreTipo: 'PERSONAJE', sobreId: saveId, sucesoId: 'x', desdeMinutes: AHORA };
    await prisma.recuerdo.create({ data: { ...base, sentimiento: -9, importancia: 3 } });
    expect((await npcsConRencor(prisma, saveId, [ulkha.id], AHORA)).has(ulkha.id)).toBe(false);
    await prisma.recuerdo.create({ data: { ...base, sentimiento: -9, importancia: 7 } });
    expect((await npcsConRencor(prisma, saveId, [ulkha.id], AHORA)).has(ulkha.id)).toBe(true);
    await prisma.recuerdo.deleteMany({ where: { saveId } });
  });

  it('cuando cae quien llevaba una venganza, la toma el adulto vivo de su linaje', async () => {
    // El heredero es el primer adulto vivo por slug: Gisot va antes que Ufag y Ulkha.
    const [torgash, gisot] = [await npc('Torgash Ketg'), await npc('Gisot Ketg')];
    await prisma.hilo.create({
      data: {
        saveId, patron: 'VENGANZA', clave: `VENGANZA:${torgash.id}`, tension: 5, sucesoIds: [], abiertoEn: AHORA, resumen: 'Torgash quiere vengar a alguien.',
        actores: [{ entidadTipo: 'NPC', entidadId: torgash.id }, { entidadTipo: 'PERSONAJE', entidadId: saveId }],
      },
    });
    await prisma.$transaction((tx) => registrarSuceso(tx, {
      saveId, tipo: 'MUERTE_NPC', fictionalMinutes: AHORA, origen: 'MUNDO', datos: { npc: torgash.name },
      actores: [{ entidadTipo: 'NPC', entidadId: torgash.id, papel: 'VICTIMA' }],
    }));
    await procesarReacciones(prisma, saveId);
    const viejo = await prisma.hilo.findFirstOrThrow({ where: { saveId, clave: `VENGANZA:${torgash.id}` } });
    expect(viejo.estado).toBe('CERRADO');
    const nuevo = await prisma.hilo.findFirstOrThrow({ where: { saveId, clave: `VENGANZA:${gisot.id}` } });
    expect(nuevo.estado).toBe('ABIERTO');
    expect(nuevo.tension).toBe(6);
    expect(nuevo.resumen).toContain('linaje Ketg');
    expect(nuevo.actores).toContainEqual({ entidadTipo: 'PERSONAJE', entidadId: saveId });
  });

  it('nadie es de dos linajes', async () => {
    const torgash = await npc('Torgash Ketg');
    const otro = await prisma.linaje.create({ data: { saveId, nombre: 'Prueba', pueblo: 'orcos', tipo: 'APELLIDO', origen: 'PARTIDA', desdeMinutes: AHORA } });
    await prisma.$transaction((tx) => unirALinaje(tx, { saveId, linajeId: otro.id, entidadTipo: 'NPC', entidadId: torgash.id, desdeMinutes: AHORA }));
    expect(await prisma.linajeMiembro.count({ where: { saveId, entidadTipo: 'NPC', entidadId: torgash.id } })).toBe(1);
  });
});
