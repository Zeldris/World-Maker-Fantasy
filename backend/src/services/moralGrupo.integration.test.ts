import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { abrirCombateDePersonas, type MiembroDeGrupo } from './combatePersonas.js';
import { revisarMoralDelCombate, type CombatienteParaMoral } from './moralGrupo.js';
import { marcaDelCapitan } from './combateMultipleOrquestacion.js';

/// `random` que da esos d20, en orden.
const d20 = (...valores: number[]) => {
  let i = 0;
  return () => (valores[i++ % valores.length]! - 1) / 20;
};

/// CR-44 (44c): moral del bando enemigo en el combate de varios.
describe('CR-44 (44c) — moral en el combate de varios', () => {
  let saveId: string;
  let renegadoId: string;
  const ATR = { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (moral grupo)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: ATR, portraitInitial: 'G', currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600, fictionalDateLabel: 'Día 1' } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    renegadoId = (await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'goirnte-renegado', saveId: null } })).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  async function bandaDeTres(): Promise<CombatienteParaMoral[]> {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    const miembro: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Goirnte Renegado', scope: '', destreza: 8, inteligencia: 8, esGrupo: true };
    const { encounterId } = (await abrirCombateDePersonas(prisma, { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' }, [miembro, miembro, miembro]))!;
    const ps = await prisma.combatParticipant.findMany({ where: { encounterId }, orderBy: { createdAt: 'asc' } });
    return ps.map((p) => ({
      participantId: p.id, bando: p.bando, tipo: p.tipo, npcId: p.npcId, esGrupo: p.condicionFisicaGrupo !== null, huido: false, moralTirada: false,
      condicion: 'ILESO', attributes: p.tipo === 'NPC' ? { ...ATR, inteligencia: 14 } : ATR,
    }));
  }
  const enemigos = (cs: CombatienteParaMoral[]) => cs.filter((c) => c.bando === 'ENEMIGO');

  it('sin caídos ni graves nuevos no tira nadie', async () => {
    const cs = await bandaDeTres();
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    expect(await revisarMoralDelCombate(prisma as never, { saveId, encounterId, combatientes: cs, random: d20(1) })).toEqual({ huidos: [], textos: [] });
  });

  it('a la mitad, el líder (Int ≥ 12) ordena la retirada: si escapa, se van todos los que siguen en pie, y solo tira una vez', async () => {
    const cs = await bandaDeTres();
    const [a, b] = enemigos(cs);
    a!.condicion = 'CONVALECIENTE';
    b!.condicion = 'MUERTO';
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(r.huidos).toHaveLength(1);
    expect(r.textos[0]).toContain('escapa');
    expect((await prisma.combatParticipant.findUniqueOrThrow({ where: { id: r.huidos[0]! } })).huido).toBe(true);
    // Ya tiró por quedar a la mitad: no vuelve a tirar.
    const otra = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(otra.huidos).toEqual([]);
  });

  it('P443: un rival con nombre propio que la jugadora aún no conoce huye como «el orco desconocido»', async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    const herrero = await prisma.npc.findFirstOrThrow({ where: { slug: 'herrero-serhu', saveId: null } });
    const miembro: MiembroDeGrupo = { npcId: herrero.id, nombre: herrero.name, scope: '', destreza: 8, inteligencia: 8, esGrupo: false };
    const { encounterId } = (await abrirCombateDePersonas(prisma, { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' }, [miembro]))!;
    const ps = await prisma.combatParticipant.findMany({ where: { encounterId }, orderBy: { createdAt: 'asc' } });
    const cs: CombatienteParaMoral[] = ps.map((p) => ({
      participantId: p.id, bando: p.bando, tipo: p.tipo, npcId: p.npcId, esGrupo: false, huido: false, moralTirada: false,
      condicion: p.bando === 'ENEMIGO' ? 'GRAVE' : 'ILESO', attributes: p.tipo === 'NPC' ? { ...ATR, inteligencia: 14 } : ATR,
    }));
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(r.textos).toEqual(['El orco desconocido pierde el valor y escapa del combate.']);
  });

  /// P443: un rival solitario GRAVE, sin moral tirada.
  async function rivalGrave() {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    const herrero = await prisma.npc.findFirstOrThrow({ where: { slug: 'herrero-serhu', saveId: null } });
    const miembro: MiembroDeGrupo = { npcId: herrero.id, nombre: herrero.name, scope: '', destreza: 8, inteligencia: 8, esGrupo: false };
    const { encounterId } = (await abrirCombateDePersonas(prisma, { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' }, [miembro]))!;
    const ps = await prisma.combatParticipant.findMany({ where: { encounterId }, orderBy: { createdAt: 'asc' } });
    const cs: CombatienteParaMoral[] = ps.map((p) => ({
      participantId: p.id, bando: p.bando, tipo: p.tipo, npcId: p.npcId, esGrupo: false, huido: false, moralTirada: false,
      condicion: p.bando === 'ENEMIGO' ? 'GRAVE' : 'ILESO', attributes: p.tipo === 'NPC' ? { ...ATR, inteligencia: 14, voluntad: 30 } : ATR,
    }));
    return { encounterId, cs };
  }
  async function conVariables<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
    const antes = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { return await fn(); } finally { for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  }

  it('P443: con WMF_HUIDA_PRUEBAS=1 y sin random, el rival pierde el valor y escapa aunque su Voluntad sea altísima', async () => {
    const { encounterId, cs } = await rivalGrave();
    const r = await conVariables({ WMF_HUIDA_PRUEBAS: '1', NODE_ENV: 'test' }, () => prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs })));
    expect(r.textos).toEqual(['El orco desconocido pierde el valor y escapa del combate.']);
    expect(r.huidos).toHaveLength(1);
  });

  it('P443: sin la variable, con NODE_ENV=production o con random, no se fuerza nada', async () => {
    for (const vars of [{ WMF_HUIDA_PRUEBAS: undefined, NODE_ENV: 'test' }, { WMF_HUIDA_PRUEBAS: '1', NODE_ENV: 'production' }]) {
      const { encounterId, cs } = await rivalGrave();
      // Voluntad 30 (+15) y d20 de Math.random: la moral aguanta siempre.
      const r = await conVariables(vars, () => prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs })));
      expect(r.huidos).toEqual([]);
      expect(r.textos[0]).toContain('siguen peleando');
    }
    const { encounterId, cs } = await rivalGrave();
    const r = await conVariables({ WMF_HUIDA_PRUEBAS: '1', NODE_ENV: 'test' }, () => prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(20, 20) })));
    expect(r.huidos).toEqual([]);
  });

  it('caer a GRAVE por primera vez hace tirar; si aguanta, siguen peleando', async () => {
    const cs = await bandaDeTres();
    enemigos(cs)[0]!.condicion = 'GRAVE';
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(20, 20) }));
    expect(r.huidos).toEqual([]);
    expect(r.textos[0]).toContain('siguen peleando');
  });

  it('CR-45: si cae el capitán (Int ≥ 20), los suyos tiran con desventaja, una sola vez', async () => {
    const cs = await bandaDeTres();
    const [capitan, ...resto] = enemigos(cs);
    capitan!.attributes = { ...capitan!.attributes!, inteligencia: 20 };
    capitan!.condicion = 'CONVALECIENTE';
    for (const m of resto) m.attributes = { ...m.attributes!, inteligencia: 8 };
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    // Desbandada (Int 8): cada uno tira moral con desventaja (2 dados) y, si falla, escape.
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(1, 1, 20) }));
    expect(r.textos[0]).toContain('sin quien los mande');
    expect(r.huidos.length).toBeGreaterThan(0);
    const otra = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs.map((c) => (r.huidos.includes(c.participantId) ? { ...c, huido: true } : c)), random: d20(1, 1, 20) }));
    expect(otra.textos.some((t) => t.includes('sin quien los mande'))).toBe(false);
  });
  it('P399: cada motivo de moral dice el suyo; dos turnos seguidos no dejan la misma línea dos veces', async () => {
    const cs = await bandaDeTres();
    const [capitan, segundo, tercero] = enemigos(cs);
    capitan!.attributes = { ...capitan!.attributes!, inteligencia: 20 };
    segundo!.attributes = { ...segundo!.attributes!, inteligencia: 20 };
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    // Como en la tanda 76: cae la capitana, en el turno siguiente otro queda grave y luego fuera.
    const turno = async () => {
      const frescos = await prisma.combatParticipant.findMany({ where: { encounterId } });
      const conMarca = cs.map((c) => ({ ...c, moralTirada: frescos.find((f) => f.id === c.participantId)!.moralTirada }));
      return (await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: conMarca, random: d20(20) }))).textos;
    };
    capitan!.condicion = 'CONVALECIENTE';
    const t1 = await turno();
    tercero!.condicion = 'GRAVE';
    const t2 = await turno();
    tercero!.condicion = 'CONVALECIENTE';
    const t3 = await turno();
    const lineas = [...t1, ...t2, ...t3].filter((t) => t.includes('sostiene'));
    expect(lineas).toHaveLength(3);
    expect(new Set(lineas).size).toBe(3);
    expect(t2.join(' ')).toContain('malherido');
    expect(t3.join(' ')).toContain('mitad');
  });

  it('P402: si quien sostiene es el propio malherido, la línea lo nombra una sola vez', async () => {
    const cs = await bandaDeTres();
    const [capitan] = enemigos(cs);
    capitan!.attributes = { ...capitan!.attributes!, inteligencia: 20, voluntad: 20 };
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    capitan!.condicion = 'GRAVE';
    const r = await prisma.$transaction((tx) => revisarMoralDelCombate(tx, { saveId, encounterId, combatientes: cs, random: d20(20) }));
    const linea = r.textos.find((t) => t.includes('sostiene'))!;
    expect(linea).toMatch(/^Aun malherido, /);
    expect(linea.match(/malherido/g)).toHaveLength(1);
    expect(linea).not.toMatch(/^Con /);
  });

  it('CR-45: el capitán manda ya en la ronda de apertura; los suyos van a por su objetivo y queda marcado', async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    const soldado: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Goirnte Renegado', scope: '', destreza: 8, inteligencia: 8, esGrupo: true };
    const capitan: MiembroDeGrupo = { ...soldado, inteligencia: 20 };
    const { encounterId } = (await abrirCombateDePersonas(prisma, { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' }, [capitan, soldado, soldado]))!;
    const enc = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { participantes: true } });
    const jugadora = enc.participantes.find((p) => p.tipo === 'JUGADOR')!;
    expect(enc.objetivoCapitanId).toBe(jugadora.id);
    expect(enc.participantes.find((p) => p.id === enc.capitanId)?.bando).toBe('ENEMIGO');
    for (const p of enc.participantes.filter((p) => p.bando === 'ENEMIGO')) expect(p.objetivoActualId).toBe(jugadora.id);
    const log = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(log.text).toContain('ordena caer sobre Gorhorn');
  });

  it('CR-45: la marca del panel sale mientras el capitán sigue en pie, y desaparece si huye', async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    const soldado: MiembroDeGrupo = { npcId: renegadoId, nombre: 'Goirnte Renegado', scope: '', destreza: 8, inteligencia: 8, esGrupo: true };
    const { encounterId } = (await abrirCombateDePersonas(prisma, { id: saveId, characterName: 'Gorhorn', attributes: ATR, fictionalMinutes: 600, timeLabel: 'Día 1' }, [{ ...soldado, inteligencia: 20 }, soldado]))!;
    const marca = await marcaDelCapitan(prisma, saveId, encounterId);
    expect(marca?.ordenaCaerSobre).toBe('ti');
    await prisma.combatParticipant.update({ where: { id: marca!.capitanId }, data: { huido: true } });
    expect(await marcaDelCapitan(prisma, saveId, encounterId)).toBeNull();
  });

  it('CR-45: sin nadie de Inteligencia 20 no hay capitán', async () => {
    const cs = await bandaDeTres();
    const encounterId = (await prisma.combatParticipant.findUniqueOrThrow({ where: { id: cs[0]!.participantId } })).encounterId;
    const enc = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
    expect(enc.capitanId).toBeNull();
    expect(enc.objetivoCapitanId).toBeNull();
  });
});
