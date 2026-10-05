// Misiones secundarias de la jugadora (CR-40 paso 40e, hito 0.2 — diseño en roadmap-cronista.md,
// entrada CR-40). Aceptar un aviso, llevar la cuenta, cumplir, fallar y abandonar, todo con reglas
// del motor (Q1: el narrador no decide nada):
//
// - **Aceptar** (Q8): como mucho `MAX_SECUNDARIAS_ACTIVAS` a la vez y una por facción (Q4). Nace su
//   `Quest` con la recompensa ya fijada y su plazo. Combatir sitúa el grupo enemigo en el lugar.
// - **Avanzar:** Cazar suma con cada pieza de esa especie abatida (`decrementPopulationOnDeath`);
//   Entregar, al entregar los objetos donde se aceptó; Explorar, Eliminar y Combatir los mira
//   `revisarMisiones` tras cada acción y cada turno.
// - **Cumplir** (Q7, Q17): XP, Goirnos y reputación con quien la encarga; la que va contra otra
//   facción resta reputación con esa. Queda en el Libro (`MISION_COMPLETADA`).
// - **Fallar** (plazo vencido) o **abandonar:** pierde reputación con quien la encargó.
import type { Prisma, PrismaClient, Quest } from '@prisma/client';
import { applyXp } from '../progression.js';
import { applyFactionRepDelta, parseFactionsStatus } from '../reputation.js';
import { npcSinMorirEnPartida } from '../mundoPartida.js';
import { scopeFor } from '../npcScene.js';
import { registrarFinDeMision } from './emisores.js';
import { aplicarEfecto, type CtxEfecto } from './efectos.js';
import { LIENZO_ALTO, LIENZO_ANCHO } from '../zonaPosicion.js';
import { MAX_SECUNDARIAS_ACTIVAS, type HuecosMision, type Recompensa } from './misiones.js';

/// Vale dentro o fuera de una transacción (la caza avanza desde `decrementPopulationOnDeath`).
type Tx = Prisma.TransactionClient | PrismaClient;

/// Lo que guarda la `Quest` de una misión del motor además de sus huecos.
export interface HuecosQuest extends HuecosMision {
  /// Lugar donde se entrega (Entregar): el del tablón o el NPC que la dio.
  entregaEn?: string;
  /// NPC situados para Combatir: derrotarlos a todos la cumple.
  grupo?: string[];
}

export class ErrorMision extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 409) {
    super(message);
  }
}

const huecosDe = (q: Pick<Quest, 'huecos'>) => q.huecos as unknown as HuecosQuest;
const recompensaDe = (q: Pick<Quest, 'recompensa'>) => q.recompensa as unknown as Recompensa;

async function escribir(tx: Tx, saveId: string, texto: string, fictionalMinutes: number): Promise<void> {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalDateLabel: true } });
  await tx.logEntry.create({ data: { saveId, channel: 'CHARACTER', text: texto, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes, isPlayerAction: false, isSystemMessage: true } });
}

async function reloj(tx: Tx, saveId: string): Promise<number> {
  return (await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? 0;
}

/// Plantillas de NPC de una facción (por nombre) para formar un grupo enemigo.
async function plantillasDe(tx: Tx, worldId: string, faccion: string) {
  return tx.npc.findMany({ where: { worldId, kind: 'PLANTILLA', faction: faccion, muertoEnMundo: false }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
}

// ─────────────────────────── Aceptar ───────────────────────────

/// Acepta un aviso a la vista. Devuelve la misión creada.
export async function aceptarMision(prisma: PrismaClient, saveId: string, misionOfrecidaId: string, random: () => number = Math.random): Promise<Quest> {
  return prisma.$transaction(async (tx) => {
    const oferta = await tx.misionOfrecida.findFirst({ where: { id: misionOfrecidaId, saveId }, include: { save: { select: { worldId: true } } } });
    if (!oferta) throw new ErrorMision('Ese aviso no existe', 404);
    if (oferta.estado !== 'DISPONIBLE') throw new ErrorMision('Ese aviso ya no está disponible');
    const activas = await tx.quest.findMany({ where: { saveId, status: 'ACTIVA', tipoMision: { not: null } }, select: { encargaFaccionId: true } });
    if (activas.length >= MAX_SECUNDARIAS_ACTIVAS) throw new ErrorMision(`Ya llevas ${MAX_SECUNDARIAS_ACTIVAS} misiones secundarias: termina o abandona alguna antes`);
    if (activas.some((a) => a.encargaFaccionId === oferta.factionId)) throw new ErrorMision('Ya tienes una misión abierta para esta facción');
    const ahora = await reloj(tx, saveId);
    // El aviso se retira en el avance diario; entre su `retiraEn` y esa pasada ya no vale.
    if (oferta.retiraEn <= ahora) throw new ErrorMision('Ese aviso ya no está disponible');
    const huecos: HuecosQuest = { ...(oferta.huecos as unknown as HuecosMision) };
    // Lo que pedía el aviso ya está hecho (lugar pisado u objetivo caído desde que se colgó): no se
    // acepta para cobrarlo en la siguiente `revisarMisiones`.
    if (huecos.tipo === 'EXPLORAR' && huecos.lugar && (await tx.locationVisit.count({ where: { saveId, locationId: huecos.lugar.id } })) > 0) {
      throw new ErrorMision(`Ya conoces ${huecos.lugar.nombre}: ese aviso no tiene sentido`);
    }
    if (huecos.tipo === 'ELIMINAR' && huecos.objetivoNpc && (await caido(tx, saveId, huecos.objetivoNpc.id))) {
      throw new ErrorMision(`${huecos.objetivoNpc.nombre} ya no es una amenaza`);
    }
    const claim = await tx.misionOfrecida.updateMany({ where: { id: oferta.id, estado: 'DISPONIBLE' }, data: { estado: 'ACEPTADA' } });
    if (claim.count === 0) throw new ErrorMision('Ese aviso ya no está disponible');

    if (oferta.buildingId) {
      const tablon = await tx.building.findUnique({ where: { id: oferta.buildingId }, select: { locationId: true } });
      if (tablon?.locationId) huecos.entregaEn = tablon.locationId;
    } else if (oferta.npcId) {
      // Misión personal (40f): se entrega donde se aceptó, donde estaba el NPC.
      const save = await tx.save.findUnique({ where: { id: saveId }, select: { currentLocationId: true } });
      if (save?.currentLocationId) huecos.entregaEn = save.currentLocationId;
    }
    // Combatir (Q16): el grupo enemigo aparece en el lugar al aceptar.
    if (huecos.tipo === 'COMBATIR' && huecos.enemiga && huecos.lugar) {
      const plantillas = await plantillasDe(tx, oferta.save.worldId, huecos.enemiga.nombre);
      const grupo = plantillas.slice(0, 2);
      if (grupo.length === 0) throw new ErrorMision(`${huecos.enemiga.nombre} no tiene a nadie a quien enviar`);
      const ctx: CtxEfecto = { tx, saveId, worldId: oferta.save.worldId, fictionalMinutes: ahora, origen: 'MOTOR', causas: [], random };
      for (const npc of grupo) {
        await aplicarEfecto(ctx, { tipo: 'situarNpc', npcId: npc.id, locationId: huecos.lugar.id, condicion: 'ILESO' });
        const x = Math.round(80 + random() * (LIENZO_ANCHO - 160));
        const y = Math.round(80 + random() * (LIENZO_ALTO - 160));
        await aplicarEfecto(ctx, { tipo: 'crearPuntoZona', locationId: huecos.lugar.id, puntoTipo: 'NPC', targetSlug: npc.slug, x, y, label: `Partida de ${huecos.enemiga.nombre}` });
      }
      huecos.grupo = grupo.map((n) => n.id);
    }

    const recompensa = oferta.recompensa as unknown as Recompensa;
    const quest = await tx.quest.create({
      data: {
        saveId, title: oferta.titulo, description: oferta.descripcion, status: 'ACTIVA',
        tipoMision: oferta.tipo, huecos: huecos as unknown as Prisma.InputJsonValue, recompensa: oferta.recompensa as Prisma.InputJsonValue,
        encargaFaccionId: oferta.factionId, encargaNpcId: oferta.npcId, cantidad: huecos.cantidad, progreso: 0,
        venceEn: ahora + huecos.plazoDias * 1440, rewardXp: recompensa.xp,
        objetivo: oferta.titulo,
      },
    });
    await tx.misionOfrecida.update({ where: { id: oferta.id }, data: { questId: quest.id } });
    await escribir(tx, saveId, `Misión aceptada: "${quest.title}". Plazo: ${huecos.plazoDias} días.`, ahora);
    return quest;
  });
}

// ─────────────────────────── Cumplir, fallar, abandonar ───────────────────────────

async function aplicarReputacion(tx: Tx, saveId: string, cambios: { faccion: string; delta: number }[]): Promise<void> {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { factionsStatus: true } });
  let estado = parseFactionsStatus(ws?.factionsStatus);
  for (const c of cambios) if (c.delta !== 0) estado = applyFactionRepDelta(estado, c.faccion, c.delta);
  await tx.worldState.update({ where: { saveId }, data: { factionsStatus: estado } });
}

/// Cumple la misión: recompensa, reputación, Libro y aviso. False si ya no estaba activa.
export async function cumplirMision(tx: Tx, quest: Quest): Promise<boolean> {
  const claim = await tx.quest.updateMany({ where: { id: quest.id, status: 'ACTIVA' }, data: { status: 'COMPLETADA', progreso: quest.cantidad ?? quest.progreso } });
  if (claim.count === 0) return false;
  const h = huecosDe(quest);
  const r = recompensaDe(quest);
  const ahora = await reloj(tx, quest.saveId);
  const save = await tx.save.findUniqueOrThrow({ where: { id: quest.saveId }, select: { xp: true, level: true } });
  const xp = applyXp(save.xp, save.level, r.xp);
  await tx.save.update({
    where: { id: quest.saveId },
    data: { xp: xp.newXp, level: xp.newLevel, pendingAttributePoints: { increment: xp.attributePointsGained }, goirnos: { increment: r.goirnos } },
  });
  await aplicarReputacion(tx, quest.saveId, [
    { faccion: h.faccion.nombre, delta: r.reputacion },
    ...(h.enemiga ? [{ faccion: h.enemiga.nombre, delta: r.reputacionConEnemiga }] : []),
  ]);
  await registrarFinDeMision(tx, { saveId: quest.saveId, titulo: quest.title, estado: 'COMPLETADA', fictionalMinutes: ahora });
  await escribir(tx, quest.saveId, `Misión completada: "${quest.title}" — +${r.xp} XP, ${r.goirnos} Goirnos; ${h.faccion.nombre} lo recordará.`, ahora);
  return true;
}

/// Falla (plazo vencido) o abandona la misión: pierde reputación con quien la encargó.
export async function cerrarSinCumplir(tx: Tx, quest: Quest, estado: 'FALLIDA' | 'ABANDONADA'): Promise<boolean> {
  const claim = await tx.quest.updateMany({ where: { id: quest.id, status: 'ACTIVA' }, data: { status: estado } });
  if (claim.count === 0) return false;
  const h = huecosDe(quest);
  const ahora = await reloj(tx, quest.saveId);
  await aplicarReputacion(tx, quest.saveId, [{ faccion: h.faccion.nombre, delta: recompensaDe(quest).reputacionAlFallar }]);
  await registrarFinDeMision(tx, { saveId: quest.saveId, titulo: quest.title, estado, fictionalMinutes: ahora });
  const motivo = estado === 'FALLIDA' ? 'se acabó el plazo' : 'la has dejado';
  await escribir(tx, quest.saveId, `Misión ${estado === 'FALLIDA' ? 'fallida' : 'abandonada'}: "${quest.title}" (${motivo}). ${h.faccion.nombre} no lo olvidará.`, ahora);
  return true;
}

export async function abandonarMision(prisma: PrismaClient, saveId: string, questId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const quest = await tx.quest.findFirst({ where: { id: questId, saveId, tipoMision: { not: null } } });
    if (!quest) throw new ErrorMision('Esa misión no existe', 404);
    if (!(await cerrarSinCumplir(tx, quest, 'ABANDONADA'))) throw new ErrorMision('Esa misión ya está cerrada');
  });
}

// ─────────────────────────── Avanzar ───────────────────────────

/// Cazar: una pieza más de `especieSlug` abatida en `region` (desde `decrementPopulationOnDeath`). Solo
/// cuenta en la región de la misión; sin región conocida, cuenta.
export async function avanzarCaza(tx: Tx, saveId: string, especieSlug: string, region: string | null = null): Promise<void> {
  const misiones = await tx.quest.findMany({ where: { saveId, status: 'ACTIVA', tipoMision: 'CAZAR' } });
  for (const q of misiones) {
    const h = huecosDe(q);
    if (h.especie?.slug !== especieSlug) continue;
    if (region && h.region && region !== h.region) continue;
    const progreso = q.progreso + 1;
    await tx.quest.update({ where: { id: q.id }, data: { progreso } });
    if (progreso >= (q.cantidad ?? 1)) await cumplirMision(tx, { ...q, progreso });
  }
}

/// Entregar: la jugadora entrega los objetos donde aceptó la misión.
export async function entregarMision(prisma: PrismaClient, saveId: string, questId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const quest = await tx.quest.findFirst({ where: { id: questId, saveId, tipoMision: 'ENTREGAR', status: 'ACTIVA' } });
    if (!quest) throw new ErrorMision('No hay ninguna entrega pendiente con ese id', 404);
    const h = huecosDe(quest);
    const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true } });
    if (h.entregaEn && save.currentLocationId !== h.entregaEn) throw new ErrorMision('Tienes que entregarlo donde aceptaste el encargo');
    const faltan = (quest.cantidad ?? 1) - quest.progreso;
    const objetos = await tx.inventoryItem.findMany({
      where: { saveId, catalogSlug: h.objeto!.slug, slot: null, companionId: null, subjectId: null },
      select: { id: true }, orderBy: { createdAt: 'asc' }, take: faltan,
    });
    if (objetos.length === 0) throw new ErrorMision(`No llevas ${h.objeto!.nombre}`);
    await tx.inventoryItem.deleteMany({ where: { id: { in: objetos.map((o) => o.id) } } });
    const progreso = quest.progreso + objetos.length;
    await tx.quest.update({ where: { id: quest.id }, data: { progreso } });
    if (progreso >= (quest.cantidad ?? 1)) await cumplirMision(tx, { ...quest, progreso });
    else await escribir(tx, saveId, `Entregas ${objetos.length} × ${h.objeto!.nombre}; faltan ${(quest.cantidad ?? 1) - progreso}.`, await reloj(tx, saveId));
  });
}

/// ¿Ha caído este NPC en la partida (muerto o rendido en combate)? `locationId`: dónde se le situó; las
/// plantillas guardan su estado por lugar (`scopeFor`), los NPC con nombre en el ámbito ''.
async function caido(tx: Tx, saveId: string, npcId: string, locationId: string | null = null): Promise<boolean> {
  const npc = await tx.npc.findUnique({ where: { id: npcId }, select: { kind: true } });
  if (!npc) return true;
  const scope = scopeFor(npc.kind, locationId);
  if (scope === '' && (await tx.npc.count({ where: { id: npcId, ...npcSinMorirEnPartida(saveId) } })) === 0) return true;
  return (await tx.npcState.count({ where: { saveId, npcId, scope, condicionFisica: { in: ['CONVALECIENTE', 'MUERTO'] } } })) > 0;
}

/// Revisa las misiones del motor activas: vencidas, lugares explorados, objetivos caídos. Idempotente.
export async function revisarMisiones(prisma: PrismaClient, saveId: string): Promise<{ cumplidas: number; fallidas: number }> {
  return prisma.$transaction(async (tx) => {
    const resultado = { cumplidas: 0, fallidas: 0 };
    const activas = await tx.quest.findMany({ where: { saveId, status: 'ACTIVA', tipoMision: { not: null } }, orderBy: { createdAt: 'asc' } });
    if (activas.length === 0) return resultado;
    const ahora = await reloj(tx, saveId);
    for (const q of activas) {
      const h = huecosDe(q);
      let hecha = false;
      if (q.tipoMision === 'EXPLORAR' && h.lugar) hecha = (await tx.locationVisit.count({ where: { saveId, locationId: h.lugar.id } })) > 0;
      else if (q.tipoMision === 'ELIMINAR' && h.objetivoNpc) hecha = await caido(tx, saveId, h.objetivoNpc.id);
      else if (q.tipoMision === 'COMBATIR' && h.grupo?.length) {
        hecha = true;
        for (const npcId of h.grupo) if (!(await caido(tx, saveId, npcId, h.lugar?.id ?? null))) hecha = false;
      }
      if (hecha) {
        if (await cumplirMision(tx, q)) resultado.cumplidas++;
      } else if (q.venceEn !== null && ahora >= q.venceEn) {
        if (await cerrarSinCumplir(tx, q, 'FALLIDA')) resultado.fallidas++;
      }
    }
    return resultado;
  });
}
