// Encuentros por el camino (CR-63 paso 63f, hito 0.3 — decisión Q8 y ADR 0002). Al llegar a cada
// lugar de su ruta, un viajero puede toparse con fauna agresiva o con gente hostil (bandas) que haya
// allí; más a menudo si el tramo tiene riesgo apuntado.
//
// - Sin la jugadora en ese lugar: se pelea de fondo (8 contra 8) y avisa en el Reino; si pierden,
//   vuelven a casa desde allí.
// - Con ella allí: se detienen y se lo cuentan. Puede atacar ella al enemigo (en vivo, con su grupo);
//   si no, ellos pelean al día siguiente. Pelear en vivo codo con codo con la partida queda para
//   «escoltar» (`CR-64`): el combate en vivo aún no admite súbditos ni gente genérica.
import { Prisma, type CondicionFisica, type Temperamento } from '@prisma/client';
import { simularCombateDeFondo, TAMANO_SUBCOMBATE_FONDO, type CombatienteFondo } from './combateDeFondo.js';
import { combatienteDeNpc } from './factionExpeditions.js';
import { descontarZonePointCaza } from './caza.js';
import { decrementPopulationOnDeath } from './population.js';
import { aplicarBajas, cazadoresDe } from './partidasCaza.js';
import { avisoDeViajero, GANCHOS, type TrasCruzar, type ViajeroFila } from './viajeros.js';

type Tx = Prisma.TransactionClient;

/// Q8: probabilidad de encuentro al llegar a un lugar (más si el tramo tiene riesgo).
export const PROB_ENCUENTRO = 0.1;
export const PROB_ENCUENTRO_RIESGO = 0.25;
const HOSTIL: Temperamento[] = ['AGRESIVO', 'ENEMIGO'];
const enPie = (c: CondicionFisica) => c !== 'CONVALECIENTE' && c !== 'MUERTO';

/// El grupo hostil más numeroso del lugar (fauna agresiva o gente enemiga), sin contar a los suyos.
async function hostilEn(tx: Tx, v: ViajeroFila, locationId: string) {
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const puntos = await tx.zonePoint.findMany({ where: { saveId: v.saveId, locationId, activo: true, cantidad: { gt: 0 }, tipo: { in: ['FAUNA', 'NPC'] } }, orderBy: [{ cantidad: 'desc' }, { id: 'asc' }] });
  if (puntos.length === 0) return null;
  const npcs = await tx.npc.findMany({ where: { worldId, saveId: null, slug: { in: puntos.map((p) => p.targetSlug) }, temperamento: { in: HOSTIL } } });
  const suya = v.factionId ? (await tx.faction.findUnique({ where: { id: v.factionId }, select: { name: true } }))?.name : null;
  for (const p of puntos) {
    const npc = npcs.find((n) => n.slug === p.targetSlug);
    if (npc && (!suya || npc.faction !== suya)) return { punto: p, npc };
  }
  return null;
}

/// Pelea de fondo de la partida contra un grupo hostil. Devuelve si se quedan con el campo.
export async function pelearEncuentro(tx: Tx, v: ViajeroFila, hostil: NonNullable<Awaited<ReturnType<typeof hostilEn>>>, dia: number, random: () => number): Promise<boolean> {
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const cazadores = (await cazadoresDe(tx, v, worldId)).slice(0, TAMANO_SUBCOMBATE_FONDO);
  if (cazadores.length === 0) return true;
  const { punto, npc } = hostil;
  const base = combatienteDeNpc(npc);
  const n = Math.min(punto.cantidad, TAMANO_SUBCOMBATE_FONDO);
  const enemigos: CombatienteFondo[] = Array.from({ length: n }, (_, i) => ({ id: `hostil-${punto.id}-${i}`, nombre: npc.name, bando: 'B', attributes: base.attributes, attribute: base.attribute, attributeBonus: base.attributeBonus, nivel: npc.level, conMoral: punto.tipo === 'NPC' }));
  const r = simularCombateDeFondo([...cazadores.map((h) => h.c), ...enemigos], random);
  const condicion = new Map<string, CondicionFisica>(r.estados.filter((e) => !e.id.startsWith('hostil-')).map((e) => [e.id, e.condicion]));
  const muertos = new Set(r.estados.filter((e) => e.muerto && !e.id.startsWith('hostil-')).map((e) => e.id));
  await aplicarBajas(tx, v.saveId, cazadores, condicion, muertos, dia);
  const caidos = r.estados.filter((e) => e.id.startsWith('hostil-') && !enPie(e.condicion)).length;
  if (caidos > 0) {
    await descontarZonePointCaza(tx, v.saveId, punto.id, caidos);
    const lugar = await tx.location.findUnique({ where: { id: punto.locationId }, select: { region: true } });
    for (let i = 0; i < caidos; i++) await decrementPopulationOnDeath(tx, v.saveId, npc.raza ?? null, npc.slug, lugar?.region ?? null);
  }
  const ganan = r.ganador === 'A';
  const lugar = await tx.location.findUnique({ where: { id: punto.locationId }, select: { name: true } });
  await avisoDeViajero(tx, v, `Por el camino, en ${lugar?.name ?? 'un paso'}, la partida se topa con ${n} ${npc.name}: ${ganan ? 'los rechaza' : 'se retira y vuelve a casa'}${caidos > 0 ? ` (caen ${caidos})` : ''}${muertos.size > 0 ? `; pierde a ${muertos.size} de los suyos` : ''}.`);
  return ganan;
}

GANCHOS.alCruzar = async (tx, v, locationId, desde, dia, random): Promise<TrasCruzar> => {
  const riesgo = await tx.locationLink.findFirst({ where: { OR: [{ fromId: desde, toId: locationId }, { fromId: locationId, toId: desde }], riesgo: { not: null } }, select: { id: true } });
  if (random() >= (riesgo ? PROB_ENCUENTRO_RIESGO : PROB_ENCUENTRO)) return 'sigue';
  const hostil = await hostilEn(tx, v, locationId);
  if (!hostil) return 'sigue';
  const save = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { currentLocationId: true, worldState: { select: { fictionalDateLabel: true, fictionalMinutes: true } } } });
  if (save.currentLocationId === locationId) {
    // Con la jugadora delante: se detienen y lo dejan para mañana.
    await tx.viajero.update({ where: { id: v.id }, data: { encuentro: { zonePointId: hostil.punto.id } } });
    const quien = v.factionId ? `Una partida de ${(await tx.faction.findUnique({ where: { id: v.factionId }, select: { name: true } }))?.name ?? 'otra facción'}` : 'Tu partida';
    await tx.logEntry.create({
      data: {
        saveId: v.saveId, channel: 'CHARACTER', isSystemMessage: true, timeLabel: save.worldState?.fictionalDateLabel ?? '', fictionalMinutes: save.worldState?.fictionalMinutes ?? undefined,
        text: `${quien} se topa aquí con ${hostil.punto.cantidad} ${hostil.npc.name} y se detiene. Si quieres ayudarles, atácalos tú; si no, pelearán mañana.`,
      },
    });
    return 'para';
  }
  return (await pelearEncuentro(tx, v, hostil, dia, random)) ? 'sigue' : 'vuelve';
};

GANCHOS.pendiente = async (tx, v, dia, random): Promise<TrasCruzar> => {
  const zonePointId = (v.encuentro as { zonePointId?: string } | null)?.zonePointId;
  await tx.viajero.update({ where: { id: v.id }, data: { encuentro: Prisma.DbNull } });
  if (!zonePointId) return 'sigue';
  const punto = await tx.zonePoint.findUnique({ where: { id: zonePointId } });
  if (!punto || !punto.activo || punto.cantidad <= 0) return 'sigue'; // ya no están (p. ej. los venció la jugadora)
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const npc = await tx.npc.findFirst({ where: { worldId, saveId: null, slug: punto.targetSlug } });
  if (!npc) return 'sigue';
  return (await pelearEncuentro(tx, v, { punto, npc }, dia, random)) ? 'sigue' : 'vuelve';
};
