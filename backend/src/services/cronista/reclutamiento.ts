// Reclutamiento pacífico e informantes (CR-32, hito 0.3 — decisión Q8 de la Fase 4; idea de la
// usuaria del 2026-09-06: convencer sin pelear, «según si le gusta lo que dices»). Tirada de Carisma
// contra una dificultad que depende de la actitud del NPC hacia el personaje (D&D 5e: amistoso 10,
// indiferente 15, hostil 20), que sale de sus recuerdos (CR-16) y de la reputación con su facción.
// Reclutar pide vivienda libre en el Reino (Medieval Dynasty) y nunca vale con un líder. Un informante
// sigue en su facción y pasa lo que sabe cada semana; cada semana puede ser descubierto (10 %).
import type { Prisma, PrismaClient } from '@prisma/client';
import { factionRepFor, parseFactionsStatus, applyFactionRepDelta, FACTION_REP_ATTACK_DELTA } from '../reputation.js';
import { companionSlotsForRecipeKey } from '../construction.js';
import { registrarSuceso } from './sucesos.js';
import { sentimientoTotal } from './recuerdos.js';
import { bonoSocialDeEtiquetas, etiquetasActivas } from './etiquetas.js';
import { valoresIniciales } from './aprobacion.js';
import { conocer } from './difusion.js';
import { aplicarEfecto } from './efectos.js';

type Tx = Prisma.TransactionClient;

export type Actitud = 'AMISTOSO' | 'INDIFERENTE' | 'HOSTIL';
export const CD_POR_ACTITUD: Record<Actitud, number> = { AMISTOSO: 10, INDIFERENTE: 15, HOSTIL: 20 };
export const CD_EXTRA_INFORMANTE = 5;
export const PROB_DESCUBRIR_INFORMANTE = 0.1;
export const DIAS_SEMANA = 7;

/// Puro: actitud a partir de lo que siente por ti (recuerdos) y la reputación con su facción (0-5000).
export function actitudDe(sentimiento: number, reputacion: number | null): Actitud {
  const banda = reputacion === null ? 2 : Math.min(4, Math.floor(reputacion / 1000));
  const puntos = sentimiento + (banda - 2) * 3;
  if (puntos >= 4) return 'AMISTOSO';
  if (puntos <= -4) return 'HOSTIL';
  return 'INDIFERENTE';
}

/// Puro: la tirada (d20 + Carisma/2 + bono de etiquetas contra la dificultad), con la forma de las
/// tiradas del juego para pintarla igual.
export function tiradaDeCarisma(carisma: number, bono: number, dificultad: number, random: () => number) {
  const roll = 1 + Math.floor(random() * 20);
  const result = roll + Math.floor(carisma / 2) + bono;
  const success = result >= dificultad;
  return { attribute: 'carisma' as const, value: carisma, roll, difficulty: dificultad, result, success, gradoExito: success ? ('claro' as const) : ('fallo' as const) };
}

export type ResultadoProposicion =
  | { ok: false; motivo: string }
  | { ok: true; exito: boolean; texto: string; roll: ReturnType<typeof tiradaDeCarisma>; companionId?: string };

/// Proponer a un NPC con nombre que se una al Reino (`RECLUTAR`) o que te informe (`INFORMANTE`).
export async function proponer(
  prisma: PrismaClient,
  saveId: string,
  npcSlug: string,
  modo: 'RECLUTAR' | 'INFORMANTE',
  random: () => number = Math.random,
): Promise<ResultadoProposicion> {
  return prisma.$transaction(async (tx) => {
    const save = await tx.save.findUniqueOrThrow({
      where: { id: saveId },
      select: { worldId: true, characterName: true, attributes: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true, factionsStatus: true } } },
    });
    const ahora = save.worldState?.fictionalMinutes ?? 0;
    const npc = await tx.npc.findFirst({
      where: { worldId: save.worldId, slug: npcSlug, kind: 'PRINCIPAL', OR: [{ saveId: null }, { saveId }] },
      select: { id: true, slug: true, name: true, faction: true, raza: true, personality: true, attributes: true },
    });
    if (!npc) return { ok: false, motivo: 'No hay nadie así a quien proponérselo.' };
    const faccion = npc.faction ? await tx.faction.findFirst({ where: { saveId, name: npc.faction, origenSlug: { not: null }, disueltaEn: null } }) : null;
    if (faccion?.liderNpcId === npc.id) return { ok: false, motivo: `${npc.name} manda en ${faccion.name}: no va a dejar a los suyos.` };
    const estado = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } } });
    if (estado?.muerto) return { ok: false, motivo: 'Ya no está entre los vivos.' };
    if ((await tx.companion.count({ where: { saveId, sourceSlug: npc.slug } })) > 0) return { ok: false, motivo: `${npc.name} ya va contigo.` };
    if (modo === 'INFORMANTE' && !faccion) return { ok: false, motivo: `${npc.name} no tiene facción de la que contarte nada.` };
    if (modo === 'INFORMANTE' && estado?.informanteDesde != null) return { ok: false, motivo: `${npc.name} ya te cuenta lo que sabe.` };
    const inicioDia = Math.floor(ahora / 1440) * 1440;
    const yaHoy = await tx.suceso.count({
      where: { saveId, tipo: 'RECLUTAMIENTO_FALLIDO', fictionalMinutes: { gte: inicioDia }, actores: { some: { entidadTipo: 'NPC', entidadId: npc.id } } },
    });
    if (yaHoy > 0) return { ok: false, motivo: `${npc.name} ya te ha dicho que no. Hoy no va a cambiar de idea.` };
    if (modo === 'RECLUTAR') {
      const [n, edificios] = await Promise.all([
        tx.companion.count({ where: { saveId, esSlotDomador: false } }),
        tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true } }),
      ]);
      if (n >= edificios.reduce((s, b) => s + companionSlotsForRecipeKey(b.recipeKey), 0)) {
        return { ok: false, motivo: 'No tienes dónde alojar a nadie más en tu Reino.' };
      }
    }

    const recuerdos = await tx.recuerdo.findMany({ where: { saveId, npcId: npc.id, sobreTipo: 'PERSONAJE' }, select: { sentimiento: true, importancia: true, desdeMinutes: true } });
    const actitud = actitudDe(sentimientoTotal(recuerdos, ahora), npc.faction ? factionRepFor(parseFactionsStatus(save.worldState?.factionsStatus), npc.faction) : null);
    const dificultad = CD_POR_ACTITUD[actitud] + (modo === 'INFORMANTE' ? CD_EXTRA_INFORMANTE : 0);
    const carisma = (save.attributes as { carisma?: number }).carisma ?? 10;
    const roll = tiradaDeCarisma(carisma, bonoSocialDeEtiquetas(await etiquetasActivas(tx, saveId), 'PERSUADIR'), dificultad, random);
    const yo = { entidadTipo: 'PERSONAJE' as const, entidadId: saveId, papel: 'AUTOR' as const };

    if (!roll.success) {
      // Q8: no se deja convencer — le sienta un poco mal (recuerdo −1, CR-16) y hoy no hay otra.
      await registrarSuceso(tx, {
        saveId, tipo: 'RECLUTAMIENTO_FALLIDO', fictionalMinutes: ahora, locationId: save.currentLocationId, origen: 'JUGADOR',
        actores: [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'AFECTADO' }], datos: { personaje: save.characterName, npc: npc.name },
      });
      return { ok: true, exito: false, roll, texto: `${npc.name} te escucha, pero no le convence lo que dices.` };
    }

    if (modo === 'INFORMANTE') {
      await tx.npcState.upsert({
        where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } },
        create: { saveId, npcId: npc.id, scope: '', informanteDesde: ahora },
        update: { informanteDesde: ahora },
      });
      await registrarSuceso(tx, {
        saveId, tipo: 'INFORMANTE_CAPTADO', fictionalMinutes: ahora, locationId: save.currentLocationId, origen: 'JUGADOR',
        actores: [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], datos: { personaje: save.characterName, informante: npc.name, faccion: npc.faction! },
      });
      return { ok: true, exito: true, roll, texto: `${npc.name} acepta: te hará llegar lo que pase en ${npc.faction}. Que no se entere nadie.` };
    }

    const companero = await tx.companion.create({
      data: {
        saveId, name: npc.name, role: 'aliado', notes: '', tipo: 'NPC', sourceSlug: npc.slug,
        attributes: npc.attributes as object, valores: valoresIniciales(npc.raza, npc.personality),
      },
    });
    // Deja su sitio en el mapa de la partida y su lealtad pasa al Reino (si lo hay).
    await tx.zonePoint.updateMany({ where: { saveId, targetSlug: npc.slug, tipo: 'NPC' }, data: { activo: false } });
    const reino = await tx.faction.findFirst({ where: { saveId, origenSlug: null }, select: { id: true } });
    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } },
      create: { saveId, npcId: npc.id, scope: '', lealtadFaccionId: reino?.id ?? null, informanteDesde: null },
      update: { lealtadFaccionId: reino?.id ?? null, informanteDesde: null },
    });
    await registrarSuceso(tx, {
      saveId, tipo: 'RECLUTAMIENTO', fictionalMinutes: ahora, locationId: save.currentLocationId, origen: 'JUGADOR',
      actores: [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], datos: { personaje: save.characterName, reclutado: npc.name },
    });
    return { ok: true, exito: true, roll, texto: `${npc.name} recoge sus cosas y se viene contigo.`, companionId: companero.id };
  }, { maxWait: 10_000, timeout: 20_000 });
}

/// Una vez por semana de ficción: cada informante pasa lo que ha pasado en su facción en esa semana,
/// o lo descubren (10 %): muere o desaparece, y la reputación con su facción cae.
export async function revisarInformantes(tx: Tx, p: { saveId: string; worldId: string; dia: number; random: () => number }): Promise<void> {
  if (p.dia % DIAS_SEMANA !== 0) return;
  const informantes = await tx.npcState.findMany({ where: { saveId: p.saveId, informanteDesde: { not: null }, muerto: false }, select: { id: true, npcId: true } });
  if (informantes.length === 0) return;
  const ws = await tx.worldState.findUniqueOrThrow({ where: { saveId: p.saveId }, select: { fictionalMinutes: true, fictionalDateLabel: true, factionsStatus: true } });
  // El final de ese día (en un salto de varios días, cada semana mira su propia semana).
  const ahora = Math.min(ws.fictionalMinutes, (p.dia + 1) * 1440 - 1);
  const log = (text: string) => tx.logEntry.create({ data: { saveId: p.saveId, channel: 'CHARACTER', isSystemMessage: true, text, timeLabel: ws.fictionalDateLabel ?? '', fictionalMinutes: ahora } });
  for (const inf of informantes) {
    const npc = await tx.npc.findUnique({ where: { id: inf.npcId }, select: { slug: true, name: true, faction: true } });
    if (!npc?.faction) continue;
    const faccion = await tx.faction.findFirst({ where: { saveId: p.saveId, name: npc.faction, origenSlug: { not: null } }, select: { slug: true, name: true } });
    if (!faccion) continue;
    if (p.random() < PROB_DESCUBRIR_INFORMANTE) {
      const muere = p.random() < 0.5;
      await tx.npcState.update({ where: { id: inf.id }, data: { informanteDesde: null } });
      const destino = muere ? 'lo matan' : 'desaparece y nadie sabe adónde';
      await registrarSuceso(tx, {
        saveId: p.saveId, tipo: 'INFORMANTE_DESCUBIERTO', fictionalMinutes: ahora, origen: 'MUNDO',
        actores: [{ entidadTipo: 'NPC', entidadId: inf.npcId, papel: 'VICTIMA' }, { entidadTipo: 'FACCION', entidadId: faccion.slug, papel: 'AUTOR' }, { entidadTipo: 'PERSONAJE', entidadId: p.saveId, papel: 'AFECTADO' }],
        datos: { informante: npc.name, faccion: faccion.name, destino },
      });
      if (muere) await aplicarEfecto({ tx, saveId: p.saveId, worldId: p.worldId, fictionalMinutes: ahora, origen: 'MUNDO' }, { tipo: 'matarNpc', npcId: inf.npcId, causa: 'descubierto como informante' });
      else await tx.zonePoint.updateMany({ where: { saveId: p.saveId, targetSlug: npc.slug, tipo: 'NPC' }, data: { activo: false } });
      const rep = applyFactionRepDelta(parseFactionsStatus(ws.factionsStatus), faccion.name, FACTION_REP_ATTACK_DELTA);
      await tx.worldState.update({ where: { saveId: p.saveId }, data: { factionsStatus: rep } });
      await log(`Malas noticias: en ${faccion.name} han descubierto a ${npc.name}, y ${destino}. Allí ya saben quién estaba detrás.`);
      continue;
    }
    const sucesos = await tx.suceso.findMany({
      where: { saveId: p.saveId, fictionalMinutes: { gte: ahora - DIAS_SEMANA * 1440, lte: ahora }, importancia: { gte: 3 }, actores: { some: { entidadTipo: 'FACCION', entidadId: faccion.slug } } },
      select: { id: true, texto: true },
      orderBy: { importancia: 'desc' },
      take: 3,
    });
    const nuevas: string[] = [];
    for (const s of sucesos) {
      const r = await conocer(tx, { saveId: p.saveId, sucesoId: s.id, via: 'NPC', confirmado: true, minutos: ahora, escribirNoticia: true, fuente: `informante:${npc.slug}` });
      if (r) nuevas.push(s.texto);
    }
    await log(
      nuevas.length > 0
        ? `${npc.name} te hace llegar noticias de ${faccion.name}: ${nuevas.map((t) => `«${t}»`).join(' ')}`
        : `${npc.name} te hace saber que en ${faccion.name} todo sigue tranquilo.`,
    );
  }
}
