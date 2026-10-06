import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { registrarSuceso } from '../../services/cronista/sucesos.js';
import { scopeFor } from '../../services/npcScene.js';
import { equipSlotFamily, effectiveAttributes, effectiveInventorySlotsBonus } from '../../services/equipment.js';
import { inventoryCapacityFor, totalInventoryUnits } from '../../services/inventoryCapacity.js';
import type { AttributeBlock, Attribute } from '../../services/dice.js';
import { companionSlotsForRecipeKey, plazasTrabajadorParaTier } from '../../services/construction.js';
import { rejectIfEnded, rejectIfPendingDeath, lockRowForUpdate } from './shared.js';
import { FACTION_REP_CAPTURE_DELTA } from '../../services/reputation.js';
import { applyFactionRepDeltaForResolution } from '../../services/turnResolution.js';
import { activeQuestTitlesTargeting } from '../../services/questResolution.js';
import {
  esDomador,
  maxSlotsDomadorFor,
  felicidadUmbralFor,
  resolverIntento,
  jaulaTamanoRequeridoFor,
  jaulaAlcanzaPara,
  jaulaRecipeKeyFor,
  capturaSlotsFor,
  plazoCapturaHorasForTier,
  autoEquiparDesdeAlmacen,
  type PlantillaSlots,
} from '../../services/companionSupervivencia.js';
import { EquipSlot } from '@prisma/client';
import { bonoSocialDeEtiquetas, etiquetasActivas, INT_NO_SE_RINDE_A_CARNICERO } from '../../services/cronista/etiquetas.js';
import { valoresIniciales } from '../../services/cronista/aprobacion.js';
import { preguntarCompanero } from '../../services/cronista/companeroTierra.js';

/// Grupo 3 § Compañeros y supervivencia (2026-08-25, diseño completo en
/// docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md) — captura+tameo/persuasión, equipo de
/// compañeros/súbditos, Almacén de Reino + plantillas. Hambre/Sed del propio personaje (§5) no
/// tiene rutas propias: se lee ya calculada en GET /saves/:id (detail.ts) y avanza sola en el
/// worldTick de fondo (companionSupervivencia.ts § advancePlayerSurvival).
///
/// Ranuras reducidas de fauna (§6) — simplificación consciente: el doc pide "variando cuánto
/// según tamaño/nivel de la bestia", pero eso exigiría una segunda tabla de calibración manual
/// aparte de `JAULA_TAMANO_REQUERIDO` — de partida, TODA fauna comparte el mismo set reducido
/// (casco/armadura/accesorio), ajustable más adelante si hace falta variar por tamaño de verdad.
const FAUNA_EQUIP_SLOTS: EquipSlot[] = ['CASCO', 'ARMADURA_SUPERIOR', 'ACCESORIO'];

/// Valores válidos de `Companion.rolReino` (string libre en el esquema; estos son los que el
/// código realmente consume): `trabajador`/`guardia`/`productor` (construcciones-reino.md) y
/// `diplomatico` (reino.ts, negociación de facciones).
export const ROLES_REINO = ['trabajador', 'guardia', 'productor', 'diplomatico'] as const;
export function esRolReinoValido(v: unknown): v is (typeof ROLES_REINO)[number] {
  return typeof v === 'string' && (ROLES_REINO as readonly string[]).includes(v);
}
/// Mapeo `PlantillaEquipo.rol` -> `rolReino`: solo los valores que coinciden literalmente
/// (`guardia`, `trabajador`, `productor`). `diplomatico` NO sale de una plantilla (es un rol
/// narrativo, no de equipo) y cualquier `rol` libre de una plantilla personalizada que no coincida
/// devuelve null (no toca el rol del Companion).
export function rolReinoDePlantilla(rolPlantilla: string): string | null {
  const r = rolPlantilla.trim().toLowerCase();
  return r !== 'diplomatico' && esRolReinoValido(r) ? r : null;
}

export async function companerosRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════════════
  // § 1 — Captura (fauna y NPC, mismo mecanismo)
  // ═══════════════════════════════════════════════════════════════════════

  /// Candidatos a capturar en la escena actual — mismo patrón que GET /saves/:id/saquear-zona
  /// (panels.ts): barre NpcState en GRAVE/CONVALECIENTE de esta Location, sin capturar todavía.
  app.get<{ Params: { id: string } }>('/saves/:id/capturables', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, currentLocationId: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocationId) return { candidates: [], tieneCuerdas: false };

    const tieneCuerdas = !!(await prisma.inventoryItem.findFirst({ where: { saveId: save.id, catalogSlug: 'cuerdas' }, select: { id: true } }));

    const states = await prisma.npcState.findMany({
      where: { saveId: save.id, condicionFisica: { in: ['GRAVE', 'CONVALECIENTE'] }, capturado: false },
    });
    if (states.length === 0) return { candidates: [], tieneCuerdas };

    // Rediseño de captura (2026-08-28): mientras se ata, `NpcState.capturado` se libera de nuevo a
    // `false` (para que el grupo pueda seguir) — sin este filtro, un individuo YA atado y
    // esperando en el inventario (todavía sin depositar en Jaula) volvería a listarse aquí como
    // capturable de nuevo. Excluye cualquier `(npcId, scope)` que ya tenga una captura en tránsito.
    const enTransito = await prisma.inventoryItem.findMany({ where: { saveId: save.id, capturaNpcId: { not: null } }, select: { capturaNpcId: true, capturaScope: true } });
    const enTransitoKeys = new Set(enTransito.map((c) => `${c.capturaNpcId}::${c.capturaScope}`));

    const npcs = await prisma.npc.findMany({ where: { id: { in: states.map((s) => s.npcId) }, worldId: save.worldId } });
    const npcById = new Map(npcs.map((n) => [n.id, n]));
    const candidates = states
      .map((state) => {
        const npc = npcById.get(state.npcId);
        if (!npc || scopeFor(npc.kind, save.currentLocationId) !== state.scope) return null;
        // Solo lo que de verdad se puede tamear/persuadir — sin atributoResistencia no hay tirada
        // opuesta posible, aunque esté GRAVE/CONVALECIENTE.
        if (!npc.atributoResistencia) return null;
        if (enTransitoKeys.has(`${npc.id}::${state.scope}`)) return null;
        return { npcSlug: npc.slug, name: npc.name, tipo: npc.ataqueNatural !== null ? ('FAUNA' as const) : ('NPC' as const) };
      })
      .filter((c): c is NonNullable<typeof c> => !!c);
    return { candidates, tieneCuerdas };
  });

  /// Señal interna para abortar la transacción de captura sin que Prisma la trate como un error de
  /// escritura real (hallazgo 48) — capturada justo después del `$transaction`, nunca se propaga.
  class CapturaEnCursoError extends Error {}

  /// Atar con éxito — REDISEÑO 2026-08-28 (docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md): la
  /// captura deja de vivir in-situ en `NpcState.capturado` (eso rompía la caza en grupo — una sola
  /// fila `NpcState` no podía ser "el individuo capturado" Y "el individuo activo para seguir
  /// cazando al resto" a la vez) y se materializa como `InventoryItem` en tránsito. El `NpcState`
  /// de origen se resetea EXACTAMENTE igual que `grupoContinua` (turnResolution.ts): si quedan más
  /// miembros del grupo, "resucita" a ILESO para el siguiente; si no, vuelve a MUERTO/CONVALECIENTE
  /// normal, disponible para saqueo/decapitar como cualquier baja normal. Solo 1 captura activa a
  /// la vez en toda la partida — regla nueva. CONVALECIENTE deja de ser "victoria automática"
  /// (2026-08-26) — requiere `cuerdas` (crafteable, se consume al atar).
  app.post<{ Params: { id: string; npcSlug: string }; Body: { participantId?: string } }>('/saves/:id/capturar/:npcSlug', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, currentLocationId: true, endedAt: true, pendingDeathResolution: true, characterName: true, pendingCombatNpcSlugs: true, worldState: { select: { fictionalMinutes: true, fictionalDateLabel: true } } } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual' });

    // Regla nueva (§1 del rediseño): solo 1 captura activa a la vez, para toda la partida —
    // cualquier InventoryItem en tránsito (capturaNpcId no null) todavía sin depositar.
    const capturaEnCurso = await prisma.inventoryItem.findFirst({ where: { saveId: save.id, capturaNpcId: { not: null } }, select: { id: true } });
    if (capturaEnCurso) {
      return reply.status(400).send({ error: 'Ya llevas una captura sin resolver — suéltala o deposítala antes de atar a otra.' });
    }

    const cuerdasItem = await prisma.inventoryItem.findFirst({ where: { saveId: save.id, catalogSlug: 'cuerdas' }, select: { id: true, catalogSlug: true } });
    if (!cuerdasItem) return reply.status(400).send({ error: 'Necesitas cuerdas (en inventario) para intentar atar.' });
    const cuerdaCatalog = await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: cuerdasItem.catalogSlug ?? 'cuerdas' }, select: { tier: true } });

    const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: request.params.npcSlug, saveId: null } });
    if (!npc || !npc.atributoResistencia) return reply.status(404).send({ error: 'Objetivo no capturable' });

    // Combate múltiple real (2026-08-29, ver comentario de `CombatParticipant.dismissedGrupo` en
    // schema.prisma — mismo hueco exacto que Clemente): con `participantId`, un miembro de grupo
    // tiene su condición real en `CombatParticipant.condicionFisicaGrupo`, nunca en `NpcState`
    // (fila compartida por toda la especie). El resto del flujo de captura (cuerdas, inventario,
    // InventoryItem en tránsito) es idéntico — solo cambia de dónde se lee la condición y qué se
    // marca como "ya resuelto": `dismissedGrupo` en el propio `CombatParticipant`, nunca
    // `NpcState.groupSize/groupDefeated` (sistema viejo, no aplica a un CombatEncounter real).
    const participantId = request.body?.participantId;
    let scope: string;
    let state: { id: string; groupSize: number | null; groupDefeated: number } | null;
    let esGrupoReal = false;
    if (participantId) {
      const participant = await prisma.combatParticipant.findUnique({ where: { id: participantId } });
      if (!participant || participant.npcId !== npc.id) {
        return reply.status(404).send({ error: 'Ese combatiente no existe en este combate.' });
      }
      if (participant.dismissedGrupo) {
        return reply.status(400).send({ error: 'Ese combatiente ya fue resuelto.' });
      }
      scope = participant.npcScope;
      esGrupoReal = participant.condicionFisicaGrupo !== null;
      const npcState = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
      const condicionReal = esGrupoReal ? participant.condicionFisicaGrupo! : (npcState?.condicionFisica ?? 'ILESO');
      if (!['GRAVE', 'CONVALECIENTE'].includes(condicionReal) || npcState?.capturado) {
        return reply.status(400).send({ error: 'Este objetivo no está listo para atar (tiene que estar GRAVE o CONVALECIENTE, sin capturar ya).' });
      }
      state = npcState ? { id: npcState.id, groupSize: npcState.groupSize, groupDefeated: npcState.groupDefeated } : null;
    } else {
      scope = scopeFor(npc.kind, save.currentLocationId);
      const npcState = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
      if (!npcState || !['GRAVE', 'CONVALECIENTE'].includes(npcState.condicionFisica) || npcState.capturado) {
        return reply.status(400).send({ error: 'Este objetivo no está listo para atar (tiene que estar GRAVE o CONVALECIENTE, sin capturar ya).' });
      }
      state = { id: npcState.id, groupSize: npcState.groupSize, groupDefeated: npcState.groupDefeated };
    }

    const esFauna = npc.ataqueNatural !== null;
    // CR-14 (Q4): ante un «Carnicero», nadie con cabeza (Inteligencia ≥ 12) se deja atar con vida.
    if (!esFauna && ((npc.attributes as AttributeBlock | null)?.inteligencia ?? 0) >= INT_NO_SE_RINDE_A_CARNICERO && (await etiquetasActivas(prisma, save.id)).has('CARNICERO')) {
      return reply.status(400).send({ error: `${npc.name} sabe lo que haces con los rendidos: prefiere morir antes que dejarse atar.` });
    }
    const slotsNecesarios = capturaSlotsFor(esFauna, npc.slug);
    // Sin hueco en el inventario → falla el intento (confirmado ronda 3): la cuerda no se gasta,
    // el objetivo sigue GRAVE/CONVALECIENTE para reintentar tras hacer hueco.
    const [playerAttributesRow, inventoryRows, equippedItems] = await Promise.all([
      prisma.save.findUniqueOrThrow({ where: { id: save.id }, select: { attributes: true } }),
      prisma.inventoryItem.findMany({ where: { saveId: save.id }, select: { name: true } }),
      prisma.inventoryItem.findMany({ where: { saveId: save.id, slot: { not: null } }, select: { statBonuses: true } }),
    ]);
    const attrs = playerAttributesRow.attributes as AttributeBlock;
    const capacidad = inventoryCapacityFor(attrs.fuerza, attrs.constitucion, effectiveInventorySlotsBonus(equippedItems));
    const usados = totalInventoryUnits(inventoryRows);
    if (usados + slotsNecesarios > capacidad) {
      return reply.status(400).send({ error: `No tienes hueco en el inventario (necesitas ${slotsNecesarios} slots libres para transportar la captura).` });
    }

    if (esGrupoReal) {
      // Claim atómico sobre el propio CombatParticipant — mismo criterio que `saqueado`, pero
      // aquí no hay NpcState.groupSize/groupDefeated real que avanzar (eso es del sistema viejo):
      // el individuo capturado simplemente se marca resuelto, el resto del grupo sigue como está.
      const claimed = await prisma.combatParticipant.updateMany({ where: { id: participantId!, dismissedGrupo: null }, data: { dismissedGrupo: true } });
      if (claimed.count === 0) return reply.status(409).send({ error: 'Alguien más ya ató a este objetivo.' });
      if (state) await prisma.npcState.update({ where: { id: state.id }, data: { capturado: true, capturaFelicidad: 0 } });
    } else {
      // Claim atómico — mismo patrón que `saqueado` (turnResolution.ts): el `where` incluye
      // `capturado: false` para que dos peticiones casi simultáneas no reclamen el mismo objetivo.
      const claimed = await prisma.npcState.updateMany({ where: { id: state!.id, capturado: false }, data: { capturado: true } });
      if (claimed.count === 0) return reply.status(409).send({ error: 'Alguien más ya ató a este objetivo.' });

      // Libera el NpcState de origen — mismo criterio EXACTO que `grupoContinua`
      // (turnResolution.ts): si quedan más miembros del grupo, resucita a ILESO para el siguiente.
      // Sin grupo (Fase G del 0.1, hallazgo G28): antes se quedaba CONVALECIENTE «disponible para
      // saqueo/decapitar», pero el individuo ya está atado en el inventario — quedaba un fantasma
      // en escena que se podía volver a matar, y `combat/cerrar` lo contaba como pendiente (409):
      // el combate no se cerraba nunca. Ahora también vuelve a ILESO (el siguiente de la especie)
      // y sale de `pendingCombatNpcSlugs`.
      const grupoContinua = !!(state!.groupSize && state!.groupDefeated + 1 < state!.groupSize);
      await prisma.npcState.update({
        where: { id: state!.id },
        data: grupoContinua
          ? { condicionFisica: 'ILESO', groupDefeated: { increment: 1 }, capturado: false, capturaFelicidad: 0 }
          : { condicionFisica: 'ILESO', capturado: false, capturaFelicidad: 0 },
      });
      if (!grupoContinua) {
        const pendientes = ((save.pendingCombatNpcSlugs as string[] | null) ?? []).filter((slug) => slug !== npc.slug);
        await prisma.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: pendientes } });
      }
    }

    const nowMinutes = save.worldState?.fictionalMinutes ?? 480;
    const plazoHoras = plazoCapturaHorasForTier(cuerdaCatalog?.tier ?? 1);
    const capturaExpiraAtMinutes = plazoHoras === null ? null : nowMinutes + plazoHoras * 60;
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
    const text = `${save.characterName} ata a ${npc.name}, todavía con vida — la captura queda sin resolver.`;

    // Se consume la cuerda y se crea la captura en tránsito en la misma transacción — mismo
    // criterio de siempre (evitar gastarla en un intento que pierde la carrera).
    //
    // Hallazgo 48 (revisar-partida-hallazgos.md, 2026-09-15): "solo 1 captura activa a la vez" se
    // comprobaba (línea ~99) fuera de esta transacción, sin volver a re-chequear aquí — dos
    // capturas casi simultáneas sobre objetivos distintos (alcanzable en combate múltiple con 2+
    // GRAVE/CONVALECIENTE a la vez) podían pasar las dos el guard. `lockRowForUpdate` sobre `Save`
    // serializa: la segunda transacción ve ya la captura que dejó la primera antes de decidir.
    const resultado = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      const capturaEnCursoFresca = await tx.inventoryItem.findFirst({ where: { saveId: save.id, capturaNpcId: { not: null } }, select: { id: true } });
      if (capturaEnCursoFresca) {
        throw new CapturaEnCursoError();
      }
      await tx.inventoryItem.delete({ where: { id: cuerdasItem.id } });
      const createdItem = await tx.inventoryItem.create({
        data: {
          saveId: save.id,
          name: `${npc.name} (Capturado) (${slotsNecesarios})`,
          description: esFauna ? 'Una criatura atada, todavía sin domesticar — hay que depositarla en una Jaula para poder ganarse su confianza.' : `${npc.name}, retenido tras la captura — sin resolver todavía.`,
          origin: 'Captura',
          capturaNpcId: npc.id,
          capturaScope: scope,
          capturaExpiraAtMinutes,
        },
      });
      // Libro de Sucesos (CR-3, hito 0.2).
      await registrarSuceso(tx, {
        saveId: save.id,
        tipo: 'CAPTURA',
        fictionalMinutes: nowMinutes,
        locationId: save.currentLocationId,
        origen: 'JUGADOR',
        actores: [
          { entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' },
          { entidadTipo: 'NPC', entidadId: npc.id, papel: 'VICTIMA' },
        ],
        datos: { personaje: save.characterName, capturado: npc.name },
      });
      // Reputación de facción (2026-09-04, bug real jugando en vivo: "me resta la reputación
      // antes de matarlo... si elijo matar tiene que esperar a que resuelva el combate antes de
      // restarlo, en el turno final") — Capturar es una de las 3 decisiones finales posibles
      // desde GRAVE/CONVALECIENTE (junto a Matar/Clemente), con su propio coste asimétrico (ver
      // FACTION_REP_CAPTURE_DELTA, reputation.ts). Sin LogEntry propio hasta ahora (mutación
      // silenciosa) — se añade uno breve para que el chip de reputación tenga dónde colgarse,
      // mismo patrón que Clemente (session.ts).
      // isSystemMessage (ver comentario completo en schema.prisma) — texto fijo determinista.
      const createdLog = await tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, isSystemMessage: true } });
      const rep = await applyFactionRepDeltaForResolution(tx, save.id, npc.faction, FACTION_REP_CAPTURE_DELTA);
      // Aviso de misión pendiente (2026-09-15, hallazgo real jugando en vivo) — solo lectura, no
      // cierra nada (Capturar deja al NPC vivo, "derrotar a X" solo se cierra con MUERTE real,
      // decisión explícita de 2026-08-31). Ver `activeQuestTitlesTargeting`.
      const misionesPendientes = await activeQuestTitlesTargeting(tx, save.id, npc.id);
      return { item: createdItem, logEntry: createdLog, factionRepChange: rep, misionesPendientes };
    }).catch((err) => {
      if (err instanceof CapturaEnCursoError) return null;
      throw err;
    });
    if (!resultado) {
      return reply.status(400).send({ error: 'Ya llevas una captura sin resolver — suéltala o deposítala antes de atar a otra.' });
    }
    const { item, logEntry, factionRepChange, misionesPendientes } = resultado;

    return {
      npcSlug: npc.slug,
      tipo: esFauna ? 'FAUNA' : 'NPC',
      inventoryItemId: item.id,
      capturaExpiraAtMinutes,
      logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() },
      factionRepChange,
      misionesPendientes,
    };
  });

  /// Depositar una captura del inventario en una Jaula con hueco — mismo criterio de tamaño que
  /// antes (`jaulaAlcanzaPara`), capacidad = 1 animal por Jaula. NPC no tiene edificio de destino
  /// todavía (Celda de Retención, pausada — ver el doc de rediseño) — de momento solo fauna puede
  /// depositarse; un NPC capturado se queda en el inventario hasta soltarlo o (futuro) depositarlo.
  app.post<{ Params: { id: string; itemId: string } }>('/saves/:id/capturas/:itemId/depositar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { worldId: true, endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id, capturaNpcId: { not: null } } });
    if (!item) return reply.status(404).send({ error: 'Captura no encontrada en el inventario' });
    const npc = await prisma.npc.findUnique({ where: { id: item.capturaNpcId! } });
    if (!npc) return reply.status(404).send({ error: 'Objetivo no encontrado' });
    const esFauna = npc.ataqueNatural !== null;
    if (!esFauna) {
      return reply.status(400).send({ error: 'Los NPC capturados todavía no tienen un edificio de destino (Celda de Retención, pendiente de construir).' });
    }

    const tamanoRequerido = jaulaTamanoRequeridoFor(npc.slug);

    // Hallazgo 49 (revisar-partida-hallazgos.md, 2026-09-15): qué Jaula tiene hueco se calculaba
    // fuera de transacción, sin re-chequeo en la escritura final (`$transaction([...])` en array,
    // sin lock) — dos depósitos casi simultáneos podían leer la misma Jaula como "con hueco" y
    // asignarle `capturaJaulaBuildingId` a las dos. Mismo patrón que el hallazgo 48:
    // `lockRowForUpdate` sobre `Save` serializa, y la ocupación se relee DENTRO de la transacción.
    const jaulaResult = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', request.params.id, ['id']);
      const jaulas = await tx.building.findMany({
        where: { saveId: request.params.id, status: 'ACTIVO', recipeKey: { in: ['jaula-pequena', 'jaula-mediana', 'jaula-grande'] } },
      });
      // Deuda técnica cerrada (auditoría 2026-09-01): antes era un `findFirst` de NpcState por
      // cada jaula dentro del bucle (patrón N+1) — una sola consulta con `IN` trae la ocupación de
      // TODAS las jaulas de golpe, comprobada después en memoria contra un Set.
      const jaulasOcupadas = new Set(
        (await tx.npcState.findMany({ where: { capturaJaulaBuildingId: { in: jaulas.map((j) => j.id) } }, select: { capturaJaulaBuildingId: true } })).map(
          (s) => s.capturaJaulaBuildingId,
        ),
      );
      const jaulaConHueco = jaulas.find((jaula) => {
        const jaulaTamano = jaula.recipeKey === jaulaRecipeKeyFor('GRANDE') ? 'GRANDE' : jaula.recipeKey === jaulaRecipeKeyFor('MEDIANA') ? 'MEDIANA' : 'PEQUENA';
        return jaulaAlcanzaPara(jaulaTamano, tamanoRequerido) && !jaulasOcupadas.has(jaula.id);
      });
      if (!jaulaConHueco) return null;

      // La captura pasa de InventoryItem (en tránsito) a NpcState.capturaJaulaBuildingId (en
      // proceso de tameo) — mismo NpcState de origen (npcId+scope), ya liberado del grupo al atar.
      await tx.inventoryItem.delete({ where: { id: item.id } });
      await tx.npcState.updateMany({
        where: { saveId: request.params.id, npcId: npc.id, scope: item.capturaScope! },
        data: { capturado: true, capturaFelicidad: 0, capturaJaulaBuildingId: jaulaConHueco.id },
      });
      return jaulaConHueco;
    });
    if (!jaulaResult) {
      return reply.status(400).send({ error: `Necesitas una Jaula (${tamanoRequerido.toLowerCase()} o mayor) con hueco libre para depositar a esta criatura.` });
    }
    return { ok: true, jaulaBuildingId: jaulaResult.id };
  });

  /// Soltar/liberar una captura EN EL INVENTARIO (antes de depositar) — disponible en cualquier
  /// momento (confirmado ronda 3). Libera el slot de "1 captura a la vez" al instante. Distinto del
  /// `/tameo-pendientes/:npcSlug/soltar` de abajo, que suelta una captura YA depositada en Jaula.
  app.post<{ Params: { id: string; itemId: string } }>('/saves/:id/capturas/:itemId/soltar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id, capturaNpcId: { not: null } } });
    if (!item) return reply.status(404).send({ error: 'Captura no encontrada en el inventario' });
    await prisma.inventoryItem.delete({ where: { id: item.id } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // § 2/3 — Tameo/persuasión: alimentar (fauna) o persuadir (NPC), mismo mecanismo.
  // REDISEÑO 2026-08-28: `NpcState.capturado` ya solo se marca `true` al DEPOSITAR en Jaula (ver
  // `/capturas/:itemId/depositar` arriba) — para entonces el NpcState de origen ya fue liberado del
  // grupo al atar, así que `scope` vuelve a ser inequívoco (una fila = una captura en proceso real,
  // nunca compite con "el individuo activo del grupo"). El bug original de grupo se resolvía ahí,
  // no aquí — estos 3 endpoints no necesitan más cambios que los del propio flujo de antes.
  // ═══════════════════════════════════════════════════════════════════════

  app.get<{ Params: { id: string } }>('/saves/:id/tameo-pendientes', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, worldId: true, clase: true, especializacion: true },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const domador = esDomador(save.clase, save.especializacion);

    const states = await prisma.npcState.findMany({ where: { saveId: save.id, capturado: true } });
    // "Capturado" pero ya confirmado como Companion (sourceSlug ya asignado) no debe seguir
    // apareciendo aquí — comparado contra los Companion ya creados de este save.
    const yaConfirmados = new Set(
      (await prisma.companion.findMany({ where: { saveId: save.id, sourceSlug: { not: null } }, select: { sourceSlug: true } })).map((c) => c.sourceSlug),
    );
    const npcs = await prisma.npc.findMany({ where: { id: { in: states.map((s) => s.npcId) }, worldId: save.worldId } });
    const npcById = new Map(npcs.map((n) => [n.id, n]));

    const pendientes = states
      .map((state) => {
        const npc = npcById.get(state.npcId);
        if (!npc || yaConfirmados.has(npc.slug)) return null;
        const esFauna = npc.ataqueNatural !== null;
        // Ventaja de información del Domador (§2) — SOLO para fauna, nunca persuasión de NPC.
        const mostrarResistencia = esFauna && domador;
        return {
          npcSlug: npc.slug,
          name: npc.name,
          tipo: esFauna ? ('FAUNA' as const) : ('NPC' as const),
          felicidad: state.capturaFelicidad,
          umbral: felicidadUmbralFor(esFauna && domador),
          atributoResistencia: mostrarResistencia ? npc.atributoResistencia : null,
          enJaula: state.capturaJaulaBuildingId !== null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);
    return { pendientes };
  });

  app.post<{ Params: { id: string; npcSlug: string }; Body: { attribute: Attribute } }>(
    '/saves/:id/tameo-pendientes/:npcSlug/intentar',
    async (request, reply) => {
      const { attribute } = request.body;
      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        include: { inventoryItems: { where: { slot: { not: null } } } },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: request.params.npcSlug, saveId: null } });
      if (!npc || !npc.atributoResistencia) return reply.status(404).send({ error: 'Objetivo no encontrado' });
      const state = await prisma.npcState.findFirst({ where: { saveId: save.id, npcId: npc.id, capturado: true } });
      if (!state) return reply.status(400).send({ error: 'Este objetivo no está capturado todavía.' });

      const esFauna = npc.ataqueNatural !== null;
      const domador = esDomador(save.clase, save.especializacion) && esFauna;
      const playerAttributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
      // domesticablePct (fauna) / reclutablePct (NPC) — disposición real de catálogo, ver comentario
      // completo en resolverIntento (companionSupervivencia.ts).
      const disposicionPct = esFauna ? npc.domesticablePct : npc.reclutablePct;
      const intento = resolverIntento(
        playerAttributes,
        attribute,
        npc.attributes as AttributeBlock,
        npc.atributoResistencia as Attribute,
        state.capturaFelicidad,
        domador,
        disposicionPct,
        Math.random,
        // CR-14 (Q4): las etiquetas pesan al convencer a un capturado (solo personas, no fauna).
        esFauna ? 0 : bonoSocialDeEtiquetas(await etiquetasActivas(prisma, save.id), 'RENDIDO'),
      );

      await prisma.npcState.update({ where: { id: state.id }, data: { capturaFelicidad: intento.felicidadTras } });
      return { roll: intento.roll, felicidad: intento.felicidadTras, umbral: felicidadUmbralFor(domador), umbralCompletado: intento.umbralCompletado };
    },
  );

  /// Confirma el tameo/persuasión ya completado (Felicidad ≥ umbral) — crea el `Companion` real,
  /// respetando el tope de slots (edificio, o garantizado del Domador si aplica). Sin hueco
  /// libre, se suelta (§2/§3: "sin slot libre... se suelta, no se queda esperando").
  app.post<{ Params: { id: string; npcSlug: string }; Body: { name?: string; role?: string; notes?: string } }>(
    '/saves/:id/tameo-pendientes/:npcSlug/confirmar',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, clase: true, especializacion: true, level: true, endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: request.params.npcSlug, saveId: null } });
      if (!npc) return reply.status(404).send({ error: 'Objetivo no encontrado' });
      const state = await prisma.npcState.findFirst({ where: { saveId: save.id, npcId: npc.id, capturado: true } });
      if (!state) return reply.status(400).send({ error: 'Este objetivo no está capturado todavía.' });

      const esFauna = npc.ataqueNatural !== null;
      const domador = esDomador(save.clase, save.especializacion) && esFauna;
      const umbral = felicidadUmbralFor(domador);
      if (state.capturaFelicidad < umbral) {
        return reply.status(400).send({ error: `Todavía no ha ganado suficiente confianza (${state.capturaFelicidad}/${umbral}).` });
      }

      // Condición de carrera real (auditoría de código 2026-08-25): esta ruta no pasa por
      // `claimTurnInFlight` (exclusivo de /turn/narrate), así que dos confirmaciones casi
      // simultáneas (dos capturas pendientes distintas, o doble clic) leían el mismo
      // `companionCount`/`esSlotDomador` antes de que ninguna escribiera, pasando ambas el check y
      // creando ambas — el reino terminaba con más compañeros que huecos reales, o con dos slots de
      // Domador "gratis". Mismo patrón que `progression.ts` (`/attribute-points`): se bloquea la
      // fila de `Save` con `SELECT ... FOR UPDATE` para serializar confirmaciones de la MISMA
      // partida — la segunda ve ya el estado que dejó la primera antes de decidir nada.
      const outcome = await prisma.$transaction(async (tx) => {
        await lockRowForUpdate(tx, 'Save', save.id, ['id']);

        // Slot(s) garantizado(s) del Domador (§2) — solo para fauna con Domador real; el resto
        // compite por `companionSlotsForRecipeKey` como cualquier compañero. Alfa de la Manada
        // (Domador 40) amplía el tope de 1 a 2 (`maxSlotsDomadorFor`).
        let esSlotDomador = false;
        if (domador) {
          const slotsDomadorUsados = await tx.companion.count({ where: { saveId: save.id, esSlotDomador: true } });
          esSlotDomador = slotsDomadorUsados < maxSlotsDomadorFor(save.clase, save.especializacion, save.level);
        }
        if (!esSlotDomador) {
          const [companionCount, buildings] = await Promise.all([
            tx.companion.count({ where: { saveId: save.id, esSlotDomador: false } }),
            tx.building.findMany({ where: { saveId: save.id, status: 'ACTIVO' }, select: { recipeKey: true } }),
          ]);
          const maxCompanions = buildings.reduce((sum, b) => sum + companionSlotsForRecipeKey(b.recipeKey), 0);
          if (companionCount >= maxCompanions) {
            // Sin hueco — se suelta (§2/§3), no se queda esperando.
            await tx.npcState.update({ where: { id: state.id }, data: { capturaJaulaBuildingId: null } });
            return { kind: 'sin-hueco' as const };
          }
        }

        const created = await tx.companion.create({
          data: {
            saveId: save.id,
            name: request.body.name ?? npc.name,
            role: request.body.role ?? (esFauna ? 'mascota' : 'aliado'),
            notes: request.body.notes ?? '',
            tipo: esFauna ? 'FAUNA' : 'NPC',
            sourceSlug: npc.slug,
            felicidad: state.capturaFelicidad,
            esSlotDomador,
            // Bug real (auditoría de deuda técnica 2026-08-25): este campo nunca se rellenaba pese a
            // que el comentario del modelo (schema.prisma) ya prometía "se copia tal cual el
            // attributes del Npc de catálogo origen" — sin esto, `datosVivosDe`
            // (combateMultipleOrquestacion.ts) descarta SIEMPRE a cualquier compañero de un
            // CombatEncounter (`!companion.attributes` → null), así que ningún compañero podía luchar
            // nunca. Se guarda el bloque CRUDO (nivel 1) — el escalado por nivel del Npc origen se
            // aplica en el momento de combatir, no aquí.
            attributes: npc.attributes as object,
            // CR-15: valores de su pueblo y su carácter (solo personas; los animales tienen felicidad).
            ...(esFauna ? {} : { valores: valoresIniciales(npc.raza, npc.personality) }),
          },
        });
        // Libera la Jaula (si venía de fauna) — ya no está "en proceso", ahora es un Companion real.
        if (state.capturaJaulaBuildingId) await tx.npcState.update({ where: { id: state.id }, data: { capturaJaulaBuildingId: null } });
        return { kind: 'ok' as const, companion: created };
      });

      if (outcome.kind === 'sin-hueco') {
        return reply.status(409).send({ error: 'No tienes ningún slot de compañero libre — se suelta.' });
      }
      return { companion: outcome.companion };
    },
  );

  /// Soltar — abandona el proceso a medias (o forzado por falta de slot, ver /confirmar arriba).
  /// Deja `capturado: true` (mismo criterio que `saqueado`: no vuelve a ofrecerse capturar dos
  /// veces al mismo individuo) pero libera la Jaula.
  app.post<{ Params: { id: string; npcSlug: string } }>('/saves/:id/tameo-pendientes/:npcSlug/soltar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: request.params.npcSlug, saveId: null } });
    if (!npc) return reply.status(404).send({ error: 'Objetivo no encontrado' });
    await prisma.npcState.updateMany({ where: { saveId: save.id, npcId: npc.id, capturado: true }, data: { capturaJaulaBuildingId: null } });
    return { ok: true };
  });

  /// Alfa de la Manada real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 40, capstone: "te
  /// permite... elegir un Alfa para que tenga un buff extra... entre tus dos compañeros") — marca
  /// un `Companion` concreto como Alfa (nunca más de uno a la vez por `saveId`, invariante aplicado
  /// aquí desmarcando cualquier otro dentro de la misma transacción). Exige la habilidad
  /// desbloqueada (Domador + nivel 40, `maxSlotsDomadorFor`) y que el objetivo sea uno de los 2
  /// slots garantizados del Domador — nunca un compañero cualquiera del Reino.
  // CR-42 (hito 0.3): «¿Qué se sabe en tu tierra?» — lo cuenta un compañero con mente que te aprecia.
  app.post<{ Params: { id: string; companionId: string } }>('/saves/:id/companeros/:companionId/tierra', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    const r = await preguntarCompanero(prisma, save.id, request.params.companionId);
    if ('error' in r) return reply.status(400).send({ error: r.error });
    const entrada = await prisma.logEntry.create({
      data: { saveId: save.id, channel: 'CHARACTER', isSystemMessage: true, text: r.frase, timeLabel: save.worldState?.fictionalDateLabel ?? '', fictionalMinutes: save.worldState?.fictionalMinutes ?? 0 },
    });
    return { frase: r.frase, contadas: r.contadas, logEntryId: entrada.id };
  });

  app.post<{ Params: { id: string; companionId: string } }>('/saves/:id/companeros/:companionId/alfa', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, clase: true, especializacion: true, level: true, endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    if (maxSlotsDomadorFor(save.clase, save.especializacion, save.level) < 2) {
      return reply.status(400).send({ error: 'Todavía no has desbloqueado Alfa de la Manada (Domador, nivel 40).' });
    }
    const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: save.id } });
    if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });
    if (!companion.esSlotDomador) {
      return reply.status(400).send({ error: 'Solo puedes elegir Alfa entre tus 2 compañeros del slot garantizado del Domador.' });
    }

    await prisma.$transaction([
      prisma.companion.updateMany({ where: { saveId: save.id, esAlfa: true }, data: { esAlfa: false } }),
      prisma.companion.update({ where: { id: companion.id }, data: { esAlfa: true } }),
    ]);
    return { ok: true, alfaCompanionId: companion.id };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // § 6 — Equipo de compañero (mismo patrón que PATCH /saves/:id/inventario/:itemId,
  // inventario.ts, con las ranuras reducidas de fauna y sin restricción de clase/requisitos —
  // eso es solo del propio personaje jugable).
  // ═══════════════════════════════════════════════════════════════════════

  app.patch<{ Params: { id: string; companionId: string; itemId: string }; Body: { slot: EquipSlot | null } }>(
    '/saves/:id/companeros/:companionId/equipo/:itemId',
    async (request, reply) => {
      const { slot } = request.body;
      if (slot !== null && !Object.values(EquipSlot).includes(slot)) return reply.status(400).send({ error: `Ranura no válida: "${slot}"` });

      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { worldId: true, endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: request.params.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });
      const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id, companionId: null, subjectId: null } });
      if (!item) return reply.status(404).send({ error: 'Objeto no encontrado (o ya equipado en otro sitio)' });

      if (slot && companion.tipo === 'FAUNA' && !FAUNA_EQUIP_SLOTS.includes(slot)) {
        return reply.status(400).send({ error: `Esta mascota solo puede llevar: ${FAUNA_EQUIP_SLOTS.join(', ')}.` });
      }
      if (slot && item.catalogSlug) {
        const catalogItem = await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: item.catalogSlug } });
        if (catalogItem && (!catalogItem.equipSlot || !equipSlotFamily(catalogItem.equipSlot).includes(slot))) {
          return reply.status(400).send({ error: `"${item.name}" no se puede equipar ahí — va en ${catalogItem.equipSlot}, no en ${slot}.` });
        }
      }

      await prisma.$transaction([
        ...(slot
          ? [
              prisma.inventoryItem.updateMany({
                where: { saveId: request.params.id, companionId: companion.id, slot: { in: equipSlotFamily(slot) }, NOT: { id: item.id } },
                data: { slot: null },
              }),
            ]
          : []),
        prisma.inventoryItem.update({ where: { id: item.id }, data: { slot, companionId: slot ? companion.id : null } }),
      ]);
      return { id: item.id, slot, companionId: slot ? companion.id : null };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════
  // § 7 — Almacén de Reino + Plantillas de equipo
  // ═══════════════════════════════════════════════════════════════════════

  /// Depositar un objeto de la mochila personal en el Almacén — dispara el auto-equipo inmediato
  /// (§7: "cada súbdito con una plantilla asignada se auto-equipa en cuanto haya en el almacén un
  /// objeto que encaje").
  app.post<{ Params: { id: string; itemId: string } }>('/saves/:id/almacen/depositar/:itemId', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id, slot: null, companionId: null, subjectId: null } });
    if (!item) return reply.status(404).send({ error: 'Objeto no encontrado (o ya equipado)' });

    const result = await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.delete({ where: { id: item.id } });
      await tx.almacenItem.create({
        data: { saveId: request.params.id, name: item.name, description: item.description, catalogSlug: item.catalogSlug, statBonuses: item.statBonuses ?? undefined },
      });
      return autoEquiparDesdeAlmacen(tx, request.params.id);
    });
    return { ok: true, autoEquipados: result.equipados };
  });

  /// Retirar un objeto del Almacén de vuelta a la mochila personal, sin equiparlo.
  app.post<{ Params: { id: string; almacenItemId: string } }>('/saves/:id/almacen/retirar/:almacenItemId', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const item = await prisma.almacenItem.findFirst({ where: { id: request.params.almacenItemId, saveId: request.params.id } });
    if (!item) return reply.status(404).send({ error: 'Objeto no encontrado en el Almacén' });
    await prisma.$transaction([
      prisma.almacenItem.delete({ where: { id: item.id } }),
      prisma.inventoryItem.create({
        data: { saveId: request.params.id, name: item.name, description: item.description, catalogSlug: item.catalogSlug, statBonuses: item.statBonuses ?? undefined, origin: 'Almacén de Reino' },
      }),
    ]);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { name: string; rol: string; personalizada?: boolean; slots: PlantillaSlots; prioridad?: number } }>(
    '/saves/:id/plantillas',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const { name, rol, personalizada, slots, prioridad } = request.body;
      if (!name || !rol || !slots) return reply.status(400).send({ error: 'Faltan campos: name, rol, slots' });
      const created = await prisma.plantillaEquipo.create({
        data: { saveId: request.params.id, name, rol, personalizada: personalizada ?? true, slots: slots as object, prioridad: prioridad ?? 0 },
      });
      return created;
    },
  );

  app.patch<{ Params: { id: string; plantillaId: string }; Body: { name?: string; rol?: string; slots?: PlantillaSlots; prioridad?: number } }>(
    '/saves/:id/plantillas/:plantillaId',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const plantilla = await prisma.plantillaEquipo.findFirst({ where: { id: request.params.plantillaId, saveId: request.params.id } });
      if (!plantilla) return reply.status(404).send({ error: 'Plantilla no encontrada' });
      if (!plantilla.personalizada) return reply.status(400).send({ error: 'Esta plantilla es básica, no se puede editar' });
      const updated = await prisma.plantillaEquipo.update({
        where: { id: plantilla.id },
        data: {
          name: request.body.name,
          rol: request.body.rol,
          slots: request.body.slots ? (request.body.slots as object) : undefined,
          prioridad: request.body.prioridad,
        },
      });
      // Reasignar puede haber destapado huecos nuevos que ya se pueden rellenar del Almacén.
      await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, request.params.id));
      return updated;
    },
  );

  app.delete<{ Params: { id: string; plantillaId: string } }>('/saves/:id/plantillas/:plantillaId', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;

    const plantilla = await prisma.plantillaEquipo.findFirst({ where: { id: request.params.plantillaId, saveId: request.params.id } });
    if (!plantilla) return reply.status(404).send({ error: 'Plantilla no encontrada' });
    if (!plantilla.personalizada) return reply.status(400).send({ error: 'Esta plantilla es básica, no se puede borrar' });
    await prisma.plantillaEquipo.delete({ where: { id: plantilla.id } });
    return { ok: true };
  });

  /// Asigna/quita una plantilla a un compañero integrado en el Reino (`rolReino`).
  /// Rol resultante (H-1): `body.rolReino` explícito (validado) manda; si no viene y la plantilla
  /// asignada tiene un `rol` que es un `rolReino` válido, se toma de ella (ver `rolReinoDePlantilla`);
  /// si no, se conserva el que ya tenía. Un `diplomatico` nunca se pisa por la plantilla.
  app.post<{ Params: { id: string; companionId: string }; Body: { plantillaEquipoId: string | null; rolReino?: string } }>(
    '/saves/:id/companeros/:companionId/plantilla',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: request.params.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });

      const { plantillaEquipoId, rolReino: rolBody } = request.body;
      if (rolBody !== undefined && !esRolReinoValido(rolBody)) {
        return reply.status(400).send({ error: `rolReino inválido. Valores válidos: ${ROLES_REINO.join(', ')}` });
      }
      let rolReino: string | null = rolBody ?? companion.rolReino;
      if (rolBody === undefined && plantillaEquipoId && companion.rolReino !== 'diplomatico') {
        const plantilla = await prisma.plantillaEquipo.findFirst({ where: { id: plantillaEquipoId, saveId: request.params.id }, select: { rol: true } });
        if (!plantilla) return reply.status(404).send({ error: 'Plantilla no encontrada' });
        rolReino = rolReinoDePlantilla(plantilla.rol) ?? rolReino;
      }
      await prisma.companion.update({ where: { id: companion.id }, data: { plantillaEquipoId, rolReino } });
      await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, request.params.id));
      return { ok: true };
    },
  );

  /// Fija (o quita, con `null`) el `rolReino` de un Companion directamente (H-1). Quitar el rol
  /// también lo desasigna de su edificio: sin `rolReino` no es trabajador de nadie.
  app.post<{ Params: { id: string; companionId: string }; Body: { rolReino: string | null } }>(
    '/saves/:id/companeros/:companionId/rol-reino',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: request.params.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });
      const rolReino = request.body?.rolReino ?? null;
      if (rolReino !== null && !esRolReinoValido(rolReino)) {
        return reply.status(400).send({ error: `rolReino inválido. Valores válidos: ${ROLES_REINO.join(', ')}` });
      }
      const updated = await prisma.companion.update({
        where: { id: companion.id },
        data: rolReino === null ? { rolReino: null, buildingId: null } : { rolReino },
        select: { id: true, rolReino: true, buildingId: true },
      });
      return { ok: true, companion: updated };
    },
  );

  /// Asigna/quita un `Companion` a un `Building` real (hueco D, rediseño de Producción estilo
  /// Bellwright, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter) — sin esto, `tickOrdenesProduccion`
  /// (kingdomProduction.ts) nunca tenía ningún trabajador real que asignar a ninguna orden. Guard:
  /// el Companion debe tener `rolReino` ya asignado (decisión: "el reino no cuenta con quien no
  /// está integrado" — mismo criterio que `PLANTILLAS_BASICAS`/`companionesReino` del frontend, un
  /// Companion sin rol de Reino no es candidato a trabajador). `buildingId: null` desasigna.
  app.post<{ Params: { id: string; companionId: string }; Body: { buildingId: string | null } }>(
    '/saves/:id/companeros/:companionId/asignar-edificio',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const companion = await prisma.companion.findFirst({ where: { id: request.params.companionId, saveId: request.params.id } });
      if (!companion) return reply.status(404).send({ error: 'Compañero no encontrado' });
      if (!companion.rolReino) {
        return reply.status(400).send({ error: 'Este compañero no está integrado en el Reino — asígnale un rolReino primero' });
      }

      const { buildingId } = request.body;
      if (buildingId) {
        const building = await prisma.building.findFirst({ where: { id: buildingId, saveId: request.params.id } });
        if (!building) return reply.status(404).send({ error: 'Edificio no encontrado' });
        // Plazas de trabajador por nivel de edificio de oficio (docs/rpgtarkor/sistemas-reino/
        // edificios-de-oficio.md § 2/§ 7, 2026-09-28) — 1/2/4 según `Building.tier`; null (la
        // mayoría de edificios, sin nivel propio: Campamento, Choza...) nunca bloquea. Cuenta solo
        // los trabajadores YA asignados a ESTE edificio, sin incluirse a sí mismo si ya estaba
        // asignado aquí (reasignar al mismo Building no debe contar como "uno más").
        const plazas = plazasTrabajadorParaTier(building.tier);
        if (plazas != null) {
          const ocupadas = await prisma.companion.count({ where: { buildingId, id: { not: companion.id } } });
          if (ocupadas >= plazas) {
            return reply.status(400).send({ error: `Este edificio ya tiene sus ${plazas} plaza(s) de trabajador ocupadas` });
          }
        }
      }

      const updated = await prisma.companion.update({ where: { id: companion.id }, data: { buildingId }, select: { id: true, buildingId: true } });
      return { ok: true, companion: updated };
    },
  );

  /// Asigna/quita una plantilla a un súbdito de Reino.
  app.post<{ Params: { id: string; subjectId: string }; Body: { plantillaEquipoId: string | null } }>(
    '/saves/:id/subjects/:subjectId/plantilla',
    async (request, reply) => {
      const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { endedAt: true, pendingDeathResolution: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const subject = await prisma.subject.findFirst({ where: { id: request.params.subjectId, saveId: request.params.id } });
      if (!subject) return reply.status(404).send({ error: 'Súbdito no encontrado' });
      await prisma.subject.update({ where: { id: subject.id }, data: { plantillaEquipoId: request.body.plantillaEquipoId } });
      await prisma.$transaction((tx) => autoEquiparDesdeAlmacen(tx, request.params.id));
      return { ok: true };
    },
  );
}
