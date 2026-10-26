import type { PrismaClient } from '@prisma/client';

/// QA-256 (2026-10-26): el seed retiraba los objetos que salen del catálogo pero no los lugares, facciones ni NPC:
/// los slugs renombrados o retirados se quedaban en la base y la enciclopedia los seguía mostrando. Aquí se retira
/// solo la fila de CATÁLOGO (`saveId` null) cuyo slug ya no está en `worldCatalog.ts` y a la que NINGUNA partida
/// referencia. Lo que sí cuelga de ella y es del mundo (puntos de zona de plantilla, KingdomStats y edificios de
/// facción, relaciones entre facciones, equipo y oficio del NPC) se va por la cascada del esquema. Las filas con
/// referencias de partida se conservan y se devuelven con el motivo, para avisar por consola.
/// Lo que apunta por slug o id sin FK (`Quest.targetLocationId`/`targetNpcId`/`encargaNpcId`, `Companion.sourceSlug`,
/// `Npc.padreNpcId`/`madreNpcId`, `InventoryItem.capturaNpcId`) se cuenta a mano: la cascada no lo protege.

export interface ResultadoRetiro {
  retirados: string[];
  conservados: { slug: string; motivo: string }[];
}

type Cuenta = [etiqueta: string, cuantas: Promise<number>];

function motivoDe(cuentas: { etiqueta: string; n: number }[]): string {
  return cuentas.filter((c) => c.n > 0).map((c) => `${c.n} ${c.etiqueta}`).join(', ');
}

async function retirar(
  prisma: PrismaClient,
  candidatas: { id: string; slug: string }[],
  referencias: (id: string, slug: string) => Cuenta[],
  borrar: (ids: string[]) => Promise<unknown>,
): Promise<ResultadoRetiro> {
  const resultado: ResultadoRetiro = { retirados: [], conservados: [] };
  const aBorrar: string[] = [];
  for (const c of candidatas) {
    const cuentas = await Promise.all(referencias(c.id, c.slug).map(async ([etiqueta, p]) => ({ etiqueta, n: await p })));
    const motivo = motivoDe(cuentas);
    if (motivo) resultado.conservados.push({ slug: c.slug, motivo });
    else {
      aBorrar.push(c.id);
      resultado.retirados.push(c.slug);
    }
  }
  if (aBorrar.length > 0) await borrar(aBorrar);
  return resultado;
}

export function retirarLugaresHuerfanos(prisma: PrismaClient, worldId: string, slugsVivos: string[]): Promise<ResultadoRetiro> {
  return prisma.location
    .findMany({ where: { worldId, saveId: null, slug: { notIn: slugsVivos } }, select: { id: true, slug: true } })
    .then((candidatas) =>
      retirar(
        prisma,
        candidatas,
        (id) => [
          ['partida(s) con este lugar como posición', prisma.save.count({ where: { currentLocationId: id } })],
          ['partida(s) con este lugar como último descanso', prisma.save.count({ where: { lastRestLocationId: id } })],
          ['visita(s)', prisma.locationVisit.count({ where: { locationId: id } })],
          ['expedición(es) de partida', prisma.expedicion.count({ where: { destinoLocationId: id, saveId: { not: null } } })],
          ['caravana(s)', prisma.caravana.count({ where: { destinoLocationId: id } })],
          ['viajero(s)', prisma.viajero.count({ where: { OR: [{ origenLocationId: id }, { destinoLocationId: id }, { ubicacionLocationId: id }] } })],
          ['campamento(s)', prisma.campamento.count({ where: { locationId: id } })],
          ['parcela(s)', prisma.parcela.count({ where: { locationId: id } })],
          ['objeto(s) en el suelo', prisma.droppedItem.count({ where: { locationId: id } })],
          ['punto(s) de zona de partida', prisma.zonePoint.count({ where: { locationId: id, saveId: { not: null } } })],
          ['edificio(s) de partida', prisma.building.count({ where: { locationId: id, saveId: { not: null } } })],
          ['misión(es) con este destino', prisma.quest.count({ where: { targetLocationId: id } })],
        ],
        (ids) => prisma.location.deleteMany({ where: { id: { in: ids } } }),
      ),
    );
}

export function retirarFaccionesHuerfanas(prisma: PrismaClient, worldId: string, slugsVivos: string[]): Promise<ResultadoRetiro> {
  return prisma.faction
    .findMany({ where: { worldId, saveId: null, slug: { notIn: slugsVivos } }, select: { id: true, slug: true } })
    .then((candidatas) =>
      retirar(
        prisma,
        candidatas,
        (id) => [
          ['territorio(s) de partida', prisma.territory.count({ where: { factionId: id, saveId: { not: null } } })],
          ['edificio(s) de partida', prisma.building.count({ where: { factionId: id, saveId: { not: null } } })],
          ['almacén(es) de partida', prisma.almacenItem.count({ where: { factionId: id, saveId: { not: null } } })],
          ['expedición(es) de partida', prisma.expedicion.count({ where: { factionId: id, saveId: { not: null } } })],
          ['caravana(s)', prisma.caravana.count({ where: { factionId: id } })],
          ['viajero(s)', prisma.viajero.count({ where: { factionId: id } })],
          ['relación(es) de partida', prisma.factionRelation.count({ where: { saveId: { not: null }, OR: [{ sourceFactionId: id }, { targetFactionId: id }] } })],
        ],
        (ids) => prisma.faction.deleteMany({ where: { id: { in: ids } } }),
      ),
    );
}

export function retirarNpcsHuerfanos(prisma: PrismaClient, worldId: string, slugsVivos: string[]): Promise<ResultadoRetiro> {
  return prisma.npc
    .findMany({ where: { worldId, saveId: null, slug: { notIn: slugsVivos } }, select: { id: true, slug: true } })
    .then((candidatas) =>
      retirar(
        prisma,
        candidatas,
        (id, slug) => [
          ['estado(s) de partida', prisma.npcState.count({ where: { npcId: id } })],
          ['participante(s) de combate', prisma.combatParticipant.count({ where: { npcId: id } })],
          ['miembro(s) de expedición', prisma.expedicionMember.count({ where: { npcId: id } })],
          ['compañero(s) de partida', prisma.companion.count({ where: { sourceSlug: slug, save: { worldId } } })],
          ['misión(es) sobre él', prisma.quest.count({ where: { OR: [{ targetNpcId: id }, { encargaNpcId: id }] } })],
          ['hijo(s) de partida', prisma.npc.count({ where: { OR: [{ padreNpcId: id }, { madreNpcId: id }] } })],
          ['objeto(s) de captura', prisma.inventoryItem.count({ where: { capturaNpcId: id } })],
          ['facción(es) de partida que él lidera', prisma.faction.count({ where: { liderNpcId: id, saveId: { not: null } } })],
        ],
        (ids) => prisma.npc.deleteMany({ where: { id: { in: ids } } }),
      ),
    );
}

/// Mensaje de consola, mismo estilo que «Objetos retirados del catálogo».
export function avisarRetiro(tipo: string, r: ResultadoRetiro): void {
  if (r.retirados.length > 0) console.log(`  ${tipo} retirados del catálogo: ${r.retirados.length} (${r.retirados.join(', ')})`);
  for (const c of r.conservados) console.warn(`  AVISO: ${tipo.toLowerCase()} fuera del catálogo que se queda, "${c.slug}", referenciado por ${c.motivo}`);
}
