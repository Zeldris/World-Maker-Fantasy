// Mundo por partida (CR-6, hito 0.2 — roadmap-cronista.md § 5.3). Cada partida tiene su propia copia
// del estado vivo del mundo (facciones, sus relaciones, reino, territorios y edificios de facción, y
// población), para que dos partidas del mismo mundo puedan divergir. El catálogo (filas con
// `saveId` null) queda como plantilla.
//
// `asegurarMundoDePartida` es perezoso e idempotente (mismo patrón que `asegurarZonePointsDePartida`):
// la primera vez clona y marca `WorldState.mundoClonadoEn`; después no hace nada.
import { Prisma, type PrismaClient } from '@prisma/client';
import { registrarSuceso } from './cronista/sucesos.js';
import { ownerKeyFor } from './reinoOwner.js';

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

const CAMPOS_AUTOMATICOS = new Set(['id', 'createdAt', 'updatedAt']);

/// Campos Json de cada modelo (del modelo de datos de Prisma), para copiar sus null como DbNull.
function camposJson(modelo: Prisma.ModelName): Set<string> {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === modelo);
  return new Set((m?.fields ?? []).filter((f) => f.type === 'Json').map((f) => f.name));
}

/// Copia de una fila para `create`: sin id ni fechas automáticas, con los Json nulos como DbNull y
/// con los cambios aplicados encima.
export function copiaDeFila<T extends Record<string, unknown>>(modelo: Prisma.ModelName, fila: T, cambios: Record<string, unknown>): Record<string, unknown> {
  const json = camposJson(modelo);
  const copia: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(fila)) {
    if (CAMPOS_AUTOMATICOS.has(clave)) continue;
    copia[clave] = valor === null && json.has(clave) ? Prisma.DbNull : valor;
  }
  return { ...copia, ...cambios };
}

/// Clona el mundo vivo de la partida si todavía no lo tiene. Devuelve true si ha clonado ahora.
export async function asegurarMundoDePartida(db: Db, saveId: string): Promise<boolean> {
  const estado = await db.worldState.findUnique({ where: { saveId }, select: { mundoClonadoEn: true } });
  // Sin `WorldState` (solo partidas a medio crear o de tests antiguos) no hay dónde marcar la copia.
  if (!estado || estado.mundoClonadoEn) return false;
  if ('$transaction' in db) return db.$transaction((tx) => clonarConCandado(tx, saveId));
  return clonarConCandado(db, saveId);
}

async function clonarConCandado(tx: Tx, saveId: string): Promise<boolean> {
  // Dos peticiones casi a la vez (crear partida + primer turno) no deben clonar dos veces.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mundo|${saveId}`}))`;
  const save = await tx.save.findUniqueOrThrow({
    where: { id: saveId },
    select: { worldId: true, world: { select: { name: true } }, worldState: { select: { mundoClonadoEn: true, fictionalMinutes: true } } },
  });
  if (save.worldState?.mundoClonadoEn) return false;
  const { worldId } = save;
  // CR-7: los marcadores de día de las copias arrancan en el día de la partida (no en el del mundo).
  const diaPartida = Math.floor((save.worldState?.fictionalMinutes ?? 480) / 1440);

  // 2. Facciones de catálogo → copias de la partida (el líder sigue apuntando al Npc de catálogo;
  //    su estado vive en NpcState).
  const facciones = await tx.faction.findMany({ where: { worldId, saveId: null } });
  const copiaDe = new Map<string, string>();
  for (const f of facciones) {
    const nueva = await tx.faction.create({
      data: copiaDeFila('Faction', f, { saveId, origenSlug: f.slug }) as Prisma.FactionUncheckedCreateInput,
      select: { id: true },
    });
    copiaDe.set(f.id, nueva.id);
  }
  const idsCatalogo = [...copiaDe.keys()];

  // 3. Relaciones entre facciones de catálogo → entre sus copias.
  const relaciones = await tx.factionRelation.findMany({ where: { sourceFactionId: { in: idsCatalogo }, targetFactionId: { in: idsCatalogo } } });
  if (relaciones.length > 0) {
    await tx.factionRelation.createMany({
      data: relaciones.map(
        (r) =>
          copiaDeFila('FactionRelation', r, {
            saveId,
            sourceFactionId: copiaDe.get(r.sourceFactionId)!,
            targetFactionId: copiaDe.get(r.targetFactionId)!,
            ultimaSemanaDecaida: Math.floor(diaPartida / 7),
          }) as Prisma.FactionRelationCreateManyInput,
      ),
    });
  }

  // 4. Reino, territorios y edificios de cada facción → a su copia. Territorios y edificios se
  //    quedan sin saveId (cuelgan de la facción copia, que ya es de la partida): las rutas del
  //    reino del jugador los buscan por saveId y no deben ver los de las facciones.
  const stats = await tx.kingdomStats.findMany({ where: { factionId: { in: idsCatalogo } } });
  for (const k of stats) {
    const nueva = copiaDe.get(k.factionId!)!;
    await tx.kingdomStats.create({
      data: copiaDeFila('KingdomStats', k, {
        factionId: nueva,
        ownerKey: ownerKeyFor({ factionId: nueva }),
        ultimoDiaProducido: diaPartida,
        ultimoDiaExpedicion: diaPartida,
      }) as Prisma.KingdomStatsUncheckedCreateInput,
    });
  }
  // Almacén de cada facción (stock del mercado) → a su copia.
  const almacen = await tx.almacenItem.findMany({ where: { factionId: { in: idsCatalogo } } });
  if (almacen.length > 0) {
    await tx.almacenItem.createMany({
      data: almacen.map((a) => copiaDeFila('AlmacenItem', a, { factionId: copiaDe.get(a.factionId!)! }) as Prisma.AlmacenItemCreateManyInput),
    });
  }
  const territorios = await tx.territory.findMany({ where: { factionId: { in: idsCatalogo } } });
  for (const t of territorios) {
    await tx.territory.create({ data: copiaDeFila('Territory', t, { factionId: copiaDe.get(t.factionId!)! }) as Prisma.TerritoryUncheckedCreateInput });
  }
  const edificios = await tx.building.findMany({ where: { factionId: { in: idsCatalogo } } });
  for (const b of edificios) {
    await tx.building.create({ data: copiaDeFila('Building', b, { factionId: copiaDe.get(b.factionId!)! }) as Prisma.BuildingUncheckedCreateInput });
  }

  // 5. Población del mundo → filas de la partida.
  const poblaciones = await tx.worldPopulation.findMany({ where: { worldId, saveId: null } });
  if (poblaciones.length > 0) {
    await tx.worldPopulation.createMany({
      data: poblaciones.map((p) => copiaDeFila('WorldPopulation', p, { saveId }) as Prisma.WorldPopulationCreateManyInput),
    });
  }

  // 6. Marca y 7. suceso de sistema.
  await tx.worldState.update({ where: { saveId }, data: { mundoClonadoEn: new Date() } });
  await registrarSuceso(tx, {
    saveId,
    tipo: 'SISTEMA_MUNDO_INICIADO',
    fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
    actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AFECTADO' }],
    datos: { mundo: save.world.name },
    origen: 'MOTOR',
  });
  return true;
}

/// Filtro de `WorldPopulation` (CR-6): las filas de una partida, o las del mundo (catálogo).
/// Ninguna consulta de población debe filtrar solo por `worldId`: vería catálogo y partidas a la vez.
export type FiltroPoblacion = { saveId: string } | { worldId: string; saveId: null };

export const poblacionDeCatalogo = (worldId: string): FiltroPoblacion => ({ worldId, saveId: null });

/// Filtro de la población de la partida, clonando su mundo si aún no lo tiene. Una partida sin
/// `WorldState` (solo en tests antiguos) usa la del mundo.
export async function ambitoPoblacion(db: Db, saveId: string): Promise<FiltroPoblacion> {
  const save = await db.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true, worldState: { select: { mundoClonadoEn: true } } } });
  if (!save.worldState) return poblacionDeCatalogo(save.worldId);
  if (!save.worldState.mundoClonadoEn) await asegurarMundoDePartida(db, saveId);
  return { saveId };
}

/// Filtro de `Faction` (CR-6): las copias del mundo de una partida, o las de catálogo. El Reino del
/// jugador (con `saveId` pero sin `origenSlug`) no entra en ninguno de los dos.
export type FiltroFacciones = { saveId: string; origenSlug: { not: null } } | { worldId: string; saveId: null };

export const faccionesDeCatalogo = (worldId: string): FiltroFacciones => ({ worldId, saveId: null });

/// Filtro de las facciones de la partida, clonando su mundo si aún no lo tiene (mismo criterio
/// que `ambitoPoblacion`).
export async function ambitoFacciones(db: Db, saveId: string): Promise<FiltroFacciones> {
  const poblacion = await ambitoPoblacion(db, saveId);
  return 'worldId' in poblacion ? faccionesDeCatalogo(poblacion.worldId) : { saveId, origenSlug: { not: null } };
}

/// Filtro de `Npc` vivos para una partida (CR-7): ni muertos de mundo (`Npc.muertoEnMundo`, de antes
/// del mundo por partida) ni muertos en ESTA partida fuera de escena (`NpcState.muerto`, p. ej. en
/// una expedición de facción). CR-13: y solo los del catálogo o nacidos en ESTA partida (un NPC
/// nacido en otra partida no existe aquí). Todo va en el mismo `NOT` (lista): el filtro no añade
/// otras claves de primer nivel que pisen las del que lo usa.
export function npcVivoEnPartida(saveId: string): Prisma.NpcWhereInput {
  return {
    muertoEnMundo: false,
    NOT: [{ npcStates: { some: { saveId, muerto: true } } }, { saveId: { not: null }, NOT: { saveId } }],
  };
}

/// CR-13: vivo en la partida y además sin haber caído en combate con la jugadora (un NPC con nombre
/// muerto en combate solo tiene `condicionFisica: 'MUERTO'` en su estado de ámbito '', no `muerto`).
export function npcSinMorirEnPartida(saveId: string): Prisma.NpcWhereInput {
  return { AND: [npcVivoEnPartida(saveId), { NOT: { npcStates: { some: { saveId, scope: '', condicionFisica: 'MUERTO' } } } }] };
}

/// P172/P178: vivo y sin haber caído en ningún sitio de la partida (cualquier ámbito: un NPC de plantilla
/// guarda su estado por lugar). Testigos de un bando y quien lleva un edificio.
export function npcSinCaerEnPartida(saveId: string): Prisma.NpcWhereInput {
  return { AND: [npcVivoEnPartida(saveId), { NOT: { npcStates: { some: { saveId, condicionFisica: 'MUERTO' } } } }] };
}

/// CR-13: `Npc` que existen en una partida: los del catálogo y los nacidos en ella (sin mirar si
/// viven). Para listados del mundo entero (Enciclopedia, descubrimientos).
export function npcDeLaPartida(saveId: string): Prisma.NpcWhereInput {
  return { OR: [{ saveId: null }, { saveId }] };
}

/// Ids de los NPC muertos fuera de escena en una partida (para filtros en memoria).
export async function npcsMuertosEnPartida(db: Db, saveId: string): Promise<Set<string>> {
  const filas = await db.npcState.findMany({ where: { saveId, muerto: true }, select: { npcId: true } });
  return new Set(filas.map((f) => f.npcId));
}

/// QA-27 (P44): lugares que ve una partida — los del catálogo y sus propios interiores (Capital,
/// Cuartel Avanzado), nunca los de otras partidas. Para toda consulta de `Location` por mundo o región.
export const lugaresVisibles = (saveId: string) => ({ OR: [{ saveId: null }, { saveId }] });
