import type { Prisma, PrismaClient } from '@prisma/client';

/// QA-256 (2026-10-26): el seed retiraba los objetos que salen del catálogo pero no los lugares, facciones ni NPC:
/// los slugs renombrados o retirados se quedaban en la base y la enciclopedia los seguía mostrando. Aquí se retira
/// solo la fila de CATÁLOGO (`saveId` null) cuyo slug ya no está en `worldCatalog.ts` y a la que NINGUNA partida
/// referencia. Lo que sí cuelga de ella y es del mundo (puntos de zona de plantilla, KingdomStats y edificios de
/// facción, relaciones entre facciones, equipo y oficio del NPC) se va por la cascada del esquema. Las filas con
/// referencias de partida se conservan y se devuelven con el motivo, para avisar por consola.
/// Lo que apunta por slug o id sin FK (`Quest`, `Companion.sourceSlug`, `NpcState.zonaLocationId`, `Suceso`,
/// `Recuerdo`, `Consecuencia`, `MisionOfrecida`, la población de partida por `targetSlug`…) se cuenta a mano: la
/// cascada no lo protege. Las relaciones con FK se repiten como condición del `deleteMany`, para que una referencia
/// creada entre la cuenta y el borrado (el seed con el backend en marcha) no se lleve datos de partida por la cascada.
/// Los edificios y territorios de una facción copia de partida (`mundoPartida.ts`) no llevan `saveId`: cuentan como
/// de partida por la facción.

export interface ResultadoRetiro {
  retirados: string[];
  conservados: { slug: string; motivo: string }[];
}

type Cuenta = [etiqueta: string, cuantas: Promise<number>];

const DE_PARTIDA = { saveId: { not: null } };
const EDIFICIO_DE_PARTIDA: Prisma.BuildingWhereInput = { OR: [DE_PARTIDA, { faction: DE_PARTIDA }] };

async function retirar(
  candidatas: { id: string; slug: string }[],
  referencias: (id: string, slug: string) => Cuenta[],
  borrar: (ids: string[]) => Promise<unknown>,
  quedan: (ids: string[]) => Promise<{ slug: string }[]>,
): Promise<ResultadoRetiro> {
  const resultado: ResultadoRetiro = { retirados: [], conservados: [] };
  const aBorrar: { id: string; slug: string }[] = [];
  for (const c of candidatas) {
    const cuentas = await Promise.all(referencias(c.id, c.slug).map(async ([etiqueta, p]) => ({ etiqueta, n: await p })));
    const motivo = cuentas.filter((x) => x.n > 0).map((x) => `${x.n} ${x.etiqueta}`).join(', ');
    if (motivo) resultado.conservados.push({ slug: c.slug, motivo });
    else aBorrar.push(c);
  }
  if (aBorrar.length === 0) return resultado;
  const ids = aBorrar.map((c) => c.id);
  await borrar(ids);
  const vivas = new Set((await quedan(ids)).map((c) => c.slug));
  for (const c of aBorrar) {
    if (vivas.has(c.slug)) resultado.conservados.push({ slug: c.slug, motivo: 'una referencia de partida nueva durante el seed' });
    else resultado.retirados.push(c.slug);
  }
  return resultado;
}

export async function retirarLugaresHuerfanos(prisma: PrismaClient, worldId: string, slugsVivos: string[]): Promise<ResultadoRetiro> {
  const candidatas = await prisma.location.findMany({ where: { worldId, saveId: null, slug: { notIn: slugsVivos } }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
  return retirar(
    candidatas,
    (id, slug) => [
      ['partida(s) con este lugar como posición', prisma.save.count({ where: { currentLocationId: id } })],
      ['partida(s) con este lugar como último descanso', prisma.save.count({ where: { lastRestLocationId: id } })],
      ['visita(s)', prisma.locationVisit.count({ where: { locationId: id } })],
      ['expedición(es) de partida', prisma.expedicion.count({ where: { destinoLocationId: id, ...DE_PARTIDA } })],
      ['caravana(s)', prisma.caravana.count({ where: { destinoLocationId: id } })],
      ['viajero(s)', prisma.viajero.count({ where: { OR: [{ origenLocationId: id }, { destinoLocationId: id }, { ubicacionLocationId: id }] } })],
      ['campamento(s)', prisma.campamento.count({ where: { locationId: id } })],
      ['parcela(s)', prisma.parcela.count({ where: { locationId: id } })],
      ['objeto(s) en el suelo', prisma.droppedItem.count({ where: { locationId: id } })],
      ['punto(s) de zona de partida', prisma.zonePoint.count({ where: { locationId: id, ...DE_PARTIDA } })],
      ['edificio(s) de partida', prisma.building.count({ where: { locationId: id, ...EDIFICIO_DE_PARTIDA } })],
      ['misión(es) con este destino', prisma.quest.count({ where: { targetLocationId: id } })],
      ['NPC en su zona', prisma.npcState.count({ where: { zonaLocationId: id } })],
      ['población de partida que pasó por aquí', prisma.worldPopulation.count({ where: { ...DE_PARTIDA, OR: [{ lastHarvestedLocationId: id }, { dispersadoEnLocationId: id }] } })],
      ['suceso(s)', prisma.suceso.count({ where: { locationId: id } })],
      ['NPC de partida con este hogar', prisma.npc.count({ where: { worldId, ...DE_PARTIDA, homeLocationSlug: slug } })],
    ],
    (ids) =>
      prisma.location.deleteMany({
        where: {
          id: { in: ids },
          saves: { none: {} },
          restingSaves: { none: {} },
          visits: { none: {} },
          expediciones: { none: DE_PARTIDA },
          caravanas: { none: {} },
          viajerosOrigen: { none: {} },
          viajerosDestino: { none: {} },
          viajerosUbicacion: { none: {} },
          campamentos: { none: {} },
          parcelas: { none: {} },
          droppedItems: { none: {} },
          zonePoints: { none: DE_PARTIDA },
          buildings: { none: EDIFICIO_DE_PARTIDA },
        },
      }),
    (ids) => prisma.location.findMany({ where: { id: { in: ids } }, select: { slug: true } }),
  );
}

/// Cada partida clonada juega con su propia copia de la facción (`origenSlug`), que no apunta a la de catálogo:
/// borrar esta no le toca nada. Las cuentas protegen lo que sí apunta directo a la de catálogo (partidas de antes de
/// la clonación y misiones ofrecidas).
export async function retirarFaccionesHuerfanas(prisma: PrismaClient, worldId: string, slugsVivos: string[]): Promise<ResultadoRetiro> {
  const candidatas = await prisma.faction.findMany({ where: { worldId, saveId: null, slug: { notIn: slugsVivos } }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
  return retirar(
    candidatas,
    (id) => [
      ['territorio(s) de partida', prisma.territory.count({ where: { factionId: id, ...DE_PARTIDA } })],
      ['edificio(s) de partida', prisma.building.count({ where: { factionId: id, ...DE_PARTIDA } })],
      ['almacén(es) de partida', prisma.almacenItem.count({ where: { factionId: id, ...DE_PARTIDA } })],
      ['expedición(es) de partida', prisma.expedicion.count({ where: { factionId: id, ...DE_PARTIDA } })],
      ['caravana(s)', prisma.caravana.count({ where: { factionId: id } })],
      ['viajero(s)', prisma.viajero.count({ where: { factionId: id } })],
      ['relación(es) de partida', prisma.factionRelation.count({ where: { ...DE_PARTIDA, OR: [{ sourceFactionId: id }, { targetFactionId: id }] } })],
      ['misión(es) ofrecida(s)', prisma.misionOfrecida.count({ where: { factionId: id } })],
    ],
    (ids) =>
      prisma.faction.deleteMany({
        where: {
          id: { in: ids },
          territories: { none: DE_PARTIDA },
          buildings: { none: DE_PARTIDA },
          almacenItems: { none: DE_PARTIDA },
          expediciones: { none: DE_PARTIDA },
          caravanas: { none: {} },
          viajeros: { none: {} },
        },
      }),
    (ids) => prisma.faction.findMany({ where: { id: { in: ids } }, select: { slug: true } }),
  );
}

export async function retirarNpcsHuerfanos(prisma: PrismaClient, worldId: string, slugsVivos: string[]): Promise<ResultadoRetiro> {
  const candidatas = await prisma.npc.findMany({ where: { worldId, saveId: null, slug: { notIn: slugsVivos } }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
  return retirar(
    candidatas,
    (id, slug) => [
      ['estado(s) de partida', prisma.npcState.count({ where: { npcId: id } })],
      ['participante(s) de combate', prisma.combatParticipant.count({ where: { npcId: id } })],
      ['miembro(s) de expedición', prisma.expedicionMember.count({ where: { npcId: id } })],
      ['compañero(s) de partida', prisma.companion.count({ where: { sourceSlug: slug, save: { worldId } } })],
      ['misión(es) sobre él', prisma.quest.count({ where: { OR: [{ targetNpcId: id }, { encargaNpcId: id }] } })],
      ['hijo(s) de partida', prisma.npc.count({ where: { OR: [{ padreNpcId: id }, { madreNpcId: id }] } })],
      ['objeto(s) de captura', prisma.inventoryItem.count({ where: { capturaNpcId: id } })],
      ['facción(es) de partida que él lidera', prisma.faction.count({ where: { liderNpcId: id, ...DE_PARTIDA } })],
      ['recuerdo(s)', prisma.recuerdo.count({ where: { npcId: id } })],
      ['consecuencia(s)', prisma.consecuencia.count({ where: { npcId: id } })],
      ['misión(es) ofrecida(s)', prisma.misionOfrecida.count({ where: { npcId: id } })],
      ['población de partida', prisma.worldPopulation.count({ where: { ...DE_PARTIDA, targetSlug: slug } })],
      ['punto(s) de zona de partida', prisma.zonePoint.count({ where: { ...DE_PARTIDA, targetSlug: slug } })],
      ['combate(s) pendiente(s)', prisma.save.count({ where: { worldId, pendingCombatNpcSlugs: { array_contains: [slug] } } })],
    ],
    (ids) =>
      prisma.npc.deleteMany({
        where: {
          id: { in: ids },
          npcStates: { none: {} },
          combatParticipants: { none: {} },
          expedicionMembers: { none: {} },
          faccionesLideradas: { none: DE_PARTIDA },
        },
      }),
    (ids) => prisma.npc.findMany({ where: { id: { in: ids } }, select: { slug: true } }),
  );
}

/// Mensaje de consola, mismo estilo que «Objetos retirados del catálogo».
export function avisarRetiro(tipo: string, r: ResultadoRetiro): void {
  if (r.retirados.length > 0) console.log(`  ${tipo} retirados del catálogo: ${r.retirados.length} (${r.retirados.join(', ')})`);
  for (const c of r.conservados) console.warn(`  AVISO: ${tipo.toLowerCase()} fuera del catálogo que se queda, "${c.slug}", referenciado por ${c.motivo}`);
}
