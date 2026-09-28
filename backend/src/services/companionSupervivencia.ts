import type { Prisma, PrismaClient, CondicionFisica, EquipSlot } from '@prisma/client';
import type { Attribute, AttributeBlock } from './dice.js';
import { rollOpposed, type OpposedRollResult } from './dice.js';
import { npcRecoversFromConvaleciente, npcCorpseShouldDespawn } from './death.js';

/// Grupo 3 § Compañeros y supervivencia (2026-08-25, diseño completo en
/// docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md) — captura+tameo/persuasión de fauna/NPC,
/// Hambre/Sed del propio personaje, equipo de compañeros/súbditos, Almacén de Reino + plantillas.
/// Cifras marcadas "a afinar en vivo" en el propio doc — primer valor de partida, ajustable
/// jugando, mismo criterio que el resto de números de este proyecto.

// ═══════════════════════════════════════════════════════════════════════════
// § 2/3 — Tameo/persuasión: Felicidad y umbrales
// ═══════════════════════════════════════════════════════════════════════════

export const FELICIDAD_GANANCIA = 15;
export const FELICIDAD_PERDIDA = 10;
/// "Necesita SUSTANCIALMENTE menos Felicidad acumulada" (§2) — la mitad, no una diferencia
/// simbólica.
export const FELICIDAD_UMBRAL_GENERAL = 80;
export const FELICIDAD_UMBRAL_DOMADOR = 40;

export function esDomador(clase: string | null, especializacion: string | null): boolean {
  return clase === 'CAZADOR' && especializacion === 'DOMADOR';
}

/// Alfa de la Manada real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 40, capstone: "te
/// permite tener otro compañero... elegir un Alfa entre tus dos compañeros") — el slot garantizado
/// de Domador (`Companion.esSlotDomador`) pasa de 1 a 2 con la habilidad desbloqueada. Mismo
/// criterio de gate por nivel que el resto del catálogo (sin exigir SavedAction equipada — es
/// pasiva, no se usa en un intercambio).
export function maxSlotsDomadorFor(clase: string | null, especializacion: string | null, level: number): number {
  if (!esDomador(clase, especializacion)) return 0;
  return level >= 40 ? 2 : 1;
}

/// Alfa de la Manada real (2026-09-14) — buff PERMANENTE (no `ActiveEffect` con duración por
/// turnos, se recalcula cada vez que se leen los atributos del Companion, mismo criterio que
/// `npcAttributesForLevel`/equipo): "+2 a la voluntad a tus bestias" si tienes los 2 slots de
/// Domador ocupados a la vez (aclarado por Álvaro: "equipados" se refería a que los dos SLOTS de
/// compañero estén cubiertos, no a llevar objetos puestos — nada que ver con `InventoryItem`), más
/// "+2 de fuerza" extra solo para quien esté marcado `esAlfa`. Puro: el caller resuelve cuántos
/// slots de Domador hay ocupados y si ESTE Companion concreto es el Alfa.
export function alfaDeLaManadaBonusFor(base: AttributeBlock, slotsDomadorOcupados: number, esAlfa: boolean): AttributeBlock {
  if (slotsDomadorOcupados < 2) return base;
  return {
    ...base,
    voluntad: base.voluntad + 2,
    fuerza: base.fuerza + (esAlfa ? 2 : 0),
  };
}

export function felicidadUmbralFor(domador: boolean): number {
  return domador ? FELICIDAD_UMBRAL_DOMADOR : FELICIDAD_UMBRAL_GENERAL;
}

/// Un intento de alimentar/persuadir: tirada opuesta + Felicidad actualizada. Puro — el caller
/// persiste `NpcState.capturaFelicidad` con el resultado.
export interface IntentoResult {
  roll: OpposedRollResult;
  felicidadTras: number;
  umbralCompletado: boolean;
}

/// Bug real (auditoría de lore 2026-08-25, decisión de la usuaria "hay que engancharlo"):
/// `Npc.reclutablePct`/`domesticablePct` (schema.prisma, "% de que ESTA especie/individuo tenga la
/// capacidad en absoluto") nunca se leían aquí — la tirada opuesta pura de atributos hacía a
/// cualquier NPC/fauna igual de persuadible/domable con los atributos adecuados, sin importar su
/// disposición de catálogo (Torgash Ketg, `reclutablePct: 5`, era tan fácil de convencer como uno
/// con 95). Nunca se toca `rollOpposed`/dice.ts (primitivo compartido con combate) — la resistencia
/// extra se suma aquí, sobre el resultado ya tirado, mismo criterio que el resto del proyecto de no
/// mezclar dificultades ad hoc con los primitivos de dado. 100% de disposición = sin penalización
/// (el resultado de `rollOpposed` no cambia); cada 10 puntos por debajo de 100 añaden +1 de
/// resistencia — con 5%, +9 de resistencia efectiva, "casi nunca cede por persuasión sola".
export function resolverIntento(
  playerAttributes: AttributeBlock,
  playerAttribute: Attribute,
  resistenciaAttributes: AttributeBlock,
  resistenciaAttribute: Attribute,
  felicidadActual: number,
  domador: boolean,
  disposicionPct: number,
  random: () => number = Math.random,
): IntentoResult {
  const rollBase = rollOpposed(playerAttributes, playerAttribute, resistenciaAttributes, resistenciaAttribute, random);
  const resistenciaExtra = Math.floor((100 - disposicionPct) / 10);
  const margen = rollBase.margen - resistenciaExtra;
  const roll: OpposedRollResult = { ...rollBase, resistenciaResult: rollBase.resistenciaResult + resistenciaExtra, margen, gano: margen > 0 };
  const felicidadTras = Math.max(0, felicidadActual + (roll.gano ? FELICIDAD_GANANCIA : -FELICIDAD_PERDIDA));
  return { roll, felicidadTras, umbralCompletado: felicidadTras >= felicidadUmbralFor(domador) };
}

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — Jaula: tamaño requerido por especie (sin campo nuevo en el catálogo, calibrado a mano
// aquí — mismo criterio que el propio doc pide, ver companeros-y-supervivencia.md § 2)
// ═══════════════════════════════════════════════════════════════════════════

export type JaulaTamano = 'PEQUENA' | 'MEDIANA' | 'GRANDE';

const JAULA_TAMANO_REQUERIDO: Record<string, JaulaTamano> = {
  'aullador-rojo': 'MEDIANA',
  'zense-ceniza': 'PEQUENA',
  canizor: 'MEDIANA',
  'corredor-de-cauce': 'MEDIANA',
  corretolvas: 'MEDIANA',
  cruzavientos: 'GRANDE',
  'gargantua-de-ceniza': 'GRANDE',
  murgol: 'GRANDE',
  'rondador-de-brasas': 'MEDIANA',
  'salamandra-de-escoria': 'PEQUENA',
  guchapo: 'GRANDE',
  cuernahoja: 'MEDIANA',
  coracelo: 'MEDIANA',
};

export function jaulaTamanoRequeridoFor(faunaSlug: string): JaulaTamano {
  return JAULA_TAMANO_REQUERIDO[faunaSlug] ?? 'PEQUENA';
}

/// Orden de "cabe en" — una jaula GRANDE aloja cualquier tamaño, no solo el suyo (mismo criterio
/// que un corral grande sirve también para algo pequeño).
const JAULA_ORDEN: JaulaTamano[] = ['PEQUENA', 'MEDIANA', 'GRANDE'];

export function jaulaAlcanzaPara(jaula: JaulaTamano, requerido: JaulaTamano): boolean {
  return JAULA_ORDEN.indexOf(jaula) >= JAULA_ORDEN.indexOf(requerido);
}

export function jaulaRecipeKeyFor(tamano: JaulaTamano): string {
  return `jaula-${tamano.toLowerCase()}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Rediseño de captura (2026-08-28, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md) — la captura se
// materializa como InventoryItem en tránsito (ver `InventoryItem.capturaNpcId`, schema.prisma) en
// vez de vivir in-situ en NpcState. Slots que ocupa en el inventario y plazo de expiración antes de
// depositarla en Jaula/Celda de Retención.
// ═══════════════════════════════════════════════════════════════════════════

/// NPC (raza inteligente) siempre 5 slots — equivalente a MEDIANA, sin tabla de calibración propia
/// (un humanoide adulto no varía tanto como la fauna, que sí va de PEQUEÑA a GRANDE).
export const CAPTURA_SLOTS_NPC = 5;

const CAPTURA_SLOTS_POR_JAULA_TAMANO: Record<JaulaTamano, number> = {
  PEQUENA: 3,
  MEDIANA: 5,
  GRANDE: 8,
};

export function capturaSlotsFor(esFauna: boolean, faunaSlug?: string): number {
  if (!esFauna) return CAPTURA_SLOTS_NPC;
  return CAPTURA_SLOTS_POR_JAULA_TAMANO[jaulaTamanoRequeridoFor(faunaSlug ?? '')];
}

/// Plazo en el inventario (horas de ficción) antes de que la captura se escape sola si no se ha
/// depositado en Jaula/Celda — depende del tier de la CUERDA usada al atar, no una cifra fija
/// (ronda 4 de diseño, cifras dadas explícitamente por la usuaria). Solo existe tier 1 en el
/// catálogo real hoy; tiers 2-6 quedan listos para cuando se craftee esa cuerda. Tier 7 = null
/// (nunca expira, "no pueden escapar").
const PLAZO_CAPTURA_HORAS_POR_TIER: Record<number, number | null> = {
  1: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: null,
};

export function plazoCapturaHorasForTier(cuerdaTier: number): number | null {
  return PLAZO_CAPTURA_HORAS_POR_TIER[cuerdaTier] ?? PLAZO_CAPTURA_HORAS_POR_TIER[1];
}

/// Puro — mismo patrón que `npcCorpseShouldDespawn`/`npcRecoversFromConvaleciente` (death.ts):
/// dado cuándo expira (ya calculado al atar) y el minuto de ficción actual, decide si toca escapar.
/// `expiraAtMinutes: null` = tier 7, nunca expira.
export function capturaEnInventarioExpiro(expiraAtMinutes: number | null, nowMinutes: number): boolean {
  if (expiraAtMinutes === null) return false;
  return nowMinutes >= expiraAtMinutes;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 4/5 — Comida/Agua (compañeros) y Hambre/Sed (personaje): mismo modelo de porcentaje
// derivado en vivo desde `fictionalMinutes`, nunca un contador que se decrementa aparte (mismo
// patrón que `NpcState.condicionFisicaSinceMinutes`).
// ═══════════════════════════════════════════════════════════════════════════

/// "Agua baja más rápido — cada ~5h" / "Comida baja más despacio — cada ~12h" (§4/§5) — leído
/// como el intervalo por cada -25%, 4 tramos hasta 0% (encaja con "por debajo del 25%" como el
/// primer umbral real que el propio doc menciona).
export const AGUA_MINUTOS_POR_TRAMO = 5 * 60;
export const COMIDA_MINUTOS_POR_TRAMO = 12 * 60;
const TRAMOS_HASTA_VACIO = 4;
export const UMBRAL_DESCUIDO_PCT = 25;

export function porcentajeSupervivencia(lastAtMinutes: number | null, nowMinutes: number, minutosPorTramo: number): number {
  if (lastAtMinutes === null) return 100;
  const elapsed = Math.max(0, nowMinutes - lastAtMinutes);
  const tramos = Math.min(TRAMOS_HASTA_VACIO, Math.floor(elapsed / minutosPorTramo));
  return 100 - tramos * 25;
}

export function comidaPct(lastFedAtMinutes: number | null, nowMinutes: number): number {
  return porcentajeSupervivencia(lastFedAtMinutes, nowMinutes, COMIDA_MINUTOS_POR_TRAMO);
}

export function aguaPct(lastWateredAtMinutes: number | null, nowMinutes: number): number {
  return porcentajeSupervivencia(lastWateredAtMinutes, nowMinutes, AGUA_MINUTOS_POR_TRAMO);
}

/// Habilidad "Comer/Beber" (2026-09-04) — inversa de `porcentajeSupervivencia`: dado el
/// `lastAtMinutes` actual y una ganancia en puntos porcentuales (p.ej. `curaHambre` de un objeto
/// consumido), calcula el NUEVO `lastAtMinutes` a persistir que produce ese pct resultante. El
/// modelo es "hace cuánto comiste", así que "subir el %" significa mover el timestamp hacia
/// adelante (más cerca de `nowMinutes`), nunca sumar directamente sobre el pct.
/// `porcentajeSupervivencia` es escalonada (tramos fijos de 25%) — invertirla exige redondear al
/// tramo más cercano, no interpolar de forma continua: un objeto que cura +18 pct mueve el
/// resultado real al tramo de 25 más próximo, igual que ya ocurre al calcular el pct hacia abajo.
export function lastAtMinutesForGanancia(lastAtMinutes: number | null, nowMinutes: number, minutosPorTramo: number, gananciaPct: number): number {
  const pctActual = porcentajeSupervivencia(lastAtMinutes, nowMinutes, minutosPorTramo);
  const pctObjetivo = Math.min(100, pctActual + Math.max(0, gananciaPct));
  if (pctObjetivo >= 100) return nowMinutes;
  const tramosRestantes = Math.min(TRAMOS_HASTA_VACIO, Math.max(0, Math.round((100 - pctObjetivo) / 25)));
  return Math.max(0, nowMinutes - tramosRestantes * minutosPorTramo);
}

/// § 4 — descuido de compañero: comida O agua por debajo de `UMBRAL_DESCUIDO_PCT` erosiona
/// Felicidad "muy despacio" — un paso pequeño fijo por barrido de `advanceCompanionSurvival`
/// (worldTick, no por minuto de ficción: mismo criterio que el resto de sweeps periódicos de
/// este proyecto, population.ts/worldAgenda.ts).
export const FELICIDAD_DESCUIDO_PASO = 1;

/// § 5 — Hambre/Sed del propio personaje: solo UNO de los dos en carencia topa en CONVALECIENTE
/// (nunca lo empeora más allá); las DOS a la vez siguen bajando sin suelo. La muerte real por
/// inanición (ambas a 0% durante 24h seguidas) se deja fuera a propósito de esta pasada — exige
/// enganchar el mismo pipeline de respawn/deathCount que hoy solo dispara `narrateAndPersistTurn`
/// desde dentro de un turno real (turnResolution.ts), un contexto que `advancePlayerSurvival`
/// (llamado desde el worker de fondo, sin turno en marcha) no tiene sin un refactor aparte — no
/// se improvisa aquí un segundo camino de muerte/respawn a medio verificar contra ese real.
export function condicionPorSupervivencia(comida: number, agua: number, actual: CondicionFisica): CondicionFisica | null {
  const ORDEN: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO'];
  const idxActual = ORDEN.indexOf(actual);
  const ambasCero = comida <= 0 && agua <= 0;
  const algunaCarencia = comida < UMBRAL_DESCUIDO_PCT || agua < UMBRAL_DESCUIDO_PCT;
  if (!algunaCarencia) return null;
  // Tope real: una sola carencia nunca pasa de CONVALECIENTE; las dos a la vez sí podrían seguir
  // bajando (ver comentario de arriba, muerte real fuera de alcance esta pasada — se queda en
  // CONVALECIENTE también, en vez de fingir un MUERTO sin el pipeline real detrás).
  const tope = ORDEN.indexOf('CONVALECIENTE');
  if (idxActual >= tope) return null;
  const siguiente = ORDEN[Math.min(tope, idxActual + 1)];
  return ambasCero ? siguiente : idxActual + 1 <= tope ? siguiente : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Slots de compañero — el garantizado del Domador (`esSlotDomador`) NUNCA cuenta contra
// `companionSlotsForRecipeKey` (Campamento/Choza). `questResolution.ts`/`turnResolution.ts`/
// `routes/saves/companeros.ts` aplican esta regla directo como filtro Prisma
// (`tx.companion.count({ where: { esSlotDomador: false } })`) — una función JS aparte no sirve de
// mucho para una condición de una línea que se necesita a nivel de query, no de predicado por fila
// (deuda técnica, auditoría 2026-08-25: había una `companionCountsAgainstBuildingSlots` exportada
// que ningún caller llamaba nunca — código muerto retirado, la regla real vive en los 3 filtros).
// ═══════════════════════════════════════════════════════════════════════════
// World tick — barridos periódicos (mismo patrón que population.ts/worldAgenda.ts, llamados
// desde workers/worldTick.ts)
// ═══════════════════════════════════════════════════════════════════════════

/// Compañeros reales (con `felicidad` no nulo, es decir venidos de captura — los de quest/
/// narración libre no tienen esta capa) — descuida Felicidad si Comida o Agua están bajas.
export async function advanceCompanionSurvival(prisma: PrismaClient): Promise<{ companionsAfectados: number }> {
  const companions = await prisma.companion.findMany({
    where: { felicidad: { not: null }, save: { endedAt: null } },
    select: { id: true, felicidad: true, lastFedAtMinutes: true, lastWateredAtMinutes: true, save: { select: { worldState: { select: { fictionalMinutes: true } } } } },
  });
  let companionsAfectados = 0;
  for (const c of companions) {
    const nowMinutes = c.save.worldState?.fictionalMinutes ?? 0;
    const comida = comidaPct(c.lastFedAtMinutes, nowMinutes);
    const agua = aguaPct(c.lastWateredAtMinutes, nowMinutes);
    if (comida < UMBRAL_DESCUIDO_PCT || agua < UMBRAL_DESCUIDO_PCT) {
      const nuevaFelicidad = Math.max(0, (c.felicidad ?? 0) - FELICIDAD_DESCUIDO_PASO);
      if (nuevaFelicidad !== c.felicidad) {
        await prisma.companion.update({ where: { id: c.id }, data: { felicidad: nuevaFelicidad } });
        companionsAfectados++;
      }
    }
  }
  return { companionsAfectados };
}

/// Hambre/Sed del propio personaje — topado en CONVALECIENTE (ver `condicionPorSupervivencia`).
/// Nunca mejora la condición aquí, solo la empeora — curar/descansar sigue siendo la única vía
/// para subir, mismo criterio que el resto de `condicionFisica` (docs/14 § 1).
export async function advancePlayerSurvival(prisma: PrismaClient): Promise<{ savesAfectados: number }> {
  const saves = await prisma.save.findMany({
    where: { endedAt: null },
    select: { id: true, condicionFisica: true, lastAteAtMinutes: true, lastDrankAtMinutes: true, worldState: { select: { fictionalMinutes: true } } },
  });
  let savesAfectados = 0;
  for (const s of saves) {
    const nowMinutes = s.worldState?.fictionalMinutes ?? 0;
    const comida = comidaPct(s.lastAteAtMinutes, nowMinutes);
    const agua = aguaPct(s.lastDrankAtMinutes, nowMinutes);
    const nueva = condicionPorSupervivencia(comida, agua, s.condicionFisica);
    if (nueva && nueva !== s.condicionFisica) {
      await prisma.save.update({ where: { id: s.id }, data: { condicionFisica: nueva } });
      savesAfectados++;
    }
  }
  return { savesAfectados };
}

/// Recuperación de CONVALECIENTE (6h de ficción) / desaparición de cadáver MUERTO (48h de ficción)
/// — § 5-bis punto 11 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md, 2026-09-21): mismo patrón que
/// `advancePlayerSurvival`/`growAllPopulations` (cálculo DERIVADO de un timestamp de ficción, no
/// acumulativo — encaja sin cambiar de semántica). Coexiste a propósito con
/// `applyCondicionTimeouts` (turnResolution.ts, dentro del turno síncrono) — decisión explícita de
/// Álvaro ("la más completa y profesional"): el turno sigue aplicándolo al resolverse (sin cambio,
/// cero riesgo de regresión en los tests existentes) Y este tick de fondo cubre el hueco real (el
/// jugador tarda en volver a actuar mientras el servidor sigue corriendo — un cadáver se
/// descompone y un NPC se recupera aunque el jugador esté lejos, mismo criterio "el mundo sigue"
/// que ya aplica a población). Aplicar el mismo timeout dos veces no hace nada la segunda vez (ya
/// no hay `NpcState` en ese estado) — inofensivo por diseño, sin necesidad de guard adicional.
export async function advanceCorpseAndRecoveryTimeouts(prisma: PrismaClient): Promise<{ recovered: number; despawned: number }> {
  const saves = await prisma.save.findMany({
    where: { endedAt: null },
    select: { id: true, worldState: { select: { fictionalMinutes: true } } },
  });
  let recovered = 0;
  let despawned = 0;
  for (const s of saves) {
    const nowMinutes = s.worldState?.fictionalMinutes;
    if (nowMinutes == null) continue;
    const affected = await prisma.npcState.findMany({
      where: { saveId: s.id, condicionFisica: { in: ['CONVALECIENTE', 'MUERTO'] } },
      select: { id: true, condicionFisica: true, condicionFisicaSinceMinutes: true },
    });
    for (const state of affected) {
      if (state.condicionFisica === 'CONVALECIENTE' && npcRecoversFromConvaleciente(state.condicionFisicaSinceMinutes, nowMinutes)) {
        await prisma.npcState.update({ where: { id: state.id }, data: { condicionFisica: 'HERIDO', condicionFisicaSinceMinutes: nowMinutes } });
        recovered++;
      } else if (state.condicionFisica === 'MUERTO' && npcCorpseShouldDespawn(state.condicionFisicaSinceMinutes, nowMinutes)) {
        await prisma.npcState.delete({ where: { id: state.id } });
        despawned++;
      }
    }
  }
  return { recovered, despawned };
}

// ═══════════════════════════════════════════════════════════════════════════
// § 7 — Auto-equipo desde el Almacén de Reino
// ═══════════════════════════════════════════════════════════════════════════

export type PlantillaSlots = Record<string, { catalogSlug?: string; category?: string }>;

function almacenItemMatchesSlot(item: { catalogSlug: string | null }, criterio: { catalogSlug?: string; category?: string }, catalogBySlug: Map<string, { category: string }>): boolean {
  if (criterio.catalogSlug) return item.catalogSlug === criterio.catalogSlug;
  if (criterio.category) {
    const info = item.catalogSlug ? catalogBySlug.get(item.catalogSlug) : undefined;
    return !!info && info.category === criterio.category;
  }
  return false;
}

/// Recorre las plantillas por `prioridad` ascendente (menor = se sirve antes) y, para cada
/// súbdito/compañero con esa plantilla y hueco todavía vacío, busca en el Almacén el primer
/// objeto que encaje — si lo encuentra, lo mueve de `AlmacenItem` a `InventoryItem` (equipado en
/// ese dueño). Determinista, sin tirada — se llama justo después de depositar en el Almacén
/// (`POST /saves/:id/almacen/depositar`), no en un tick de fondo.
export async function autoEquiparDesdeAlmacen(tx: Prisma.TransactionClient, saveId: string): Promise<{ equipados: number }> {
  const [plantillas, catalogRows] = await Promise.all([
    tx.plantillaEquipo.findMany({
      where: { saveId },
      orderBy: { prioridad: 'asc' },
      include: {
        subjects: { select: { id: true } },
        companions: { select: { id: true } },
      },
    }),
    tx.itemCatalog.findMany({ where: { worldId: (await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } })).worldId }, select: { slug: true, category: true } }),
  ]);
  const catalogBySlug = new Map(catalogRows.map((c) => [c.slug, { category: c.category }]));
  let equipados = 0;

  // Deuda técnica cerrada (auditoría 2026-09-15) — patrón N+1: antes se recargaba el Almacén
  // COMPLETO (`tx.almacenItem.findMany`) una vez por cada slot vacío de cada owner de cada
  // plantilla, dentro de una `$transaction` (más tiempo de conexión/lock cuanto más
  // plantillas/súbditos tenga la partida). Cargado una sola vez aquí; los objetos ya asignados a
  // un slot anterior en esta misma pasada se descartan en memoria (`usados`, por id) para que dos
  // slots distintos nunca reclamen el mismo objeto del Almacén sin haber vuelto a consultar BD.
  const disponibles = await tx.almacenItem.findMany({ where: { saveId } });
  const usados = new Set<string>();

  for (const plantilla of plantillas) {
    const slots = plantilla.slots as unknown as PlantillaSlots;
    const owners: { kind: 'subject' | 'companion'; id: string }[] = [
      ...plantilla.subjects.map((s) => ({ kind: 'subject' as const, id: s.id })),
      ...plantilla.companions.map((c) => ({ kind: 'companion' as const, id: c.id })),
    ];
    for (const owner of owners) {
      const yaEquipado = await tx.inventoryItem.findMany({
        where: owner.kind === 'subject' ? { subjectId: owner.id } : { companionId: owner.id },
        select: { slot: true },
      });
      const slotsOcupados = new Set(yaEquipado.map((i) => i.slot).filter((s): s is EquipSlot => s !== null));
      for (const [slotKey, criterio] of Object.entries(slots)) {
        const slot = slotKey as EquipSlot;
        if (slotsOcupados.has(slot)) continue;
        const match = disponibles.find((item) => !usados.has(item.id) && almacenItemMatchesSlot(item, criterio, catalogBySlug));
        if (!match) continue;
        usados.add(match.id);
        await tx.almacenItem.delete({ where: { id: match.id } });
        await tx.inventoryItem.create({
          data: {
            saveId,
            name: match.name,
            description: match.description,
            catalogSlug: match.catalogSlug,
            statBonuses: match.statBonuses ?? undefined,
            slot,
            ...(owner.kind === 'subject' ? { subjectId: owner.id } : { companionId: owner.id }),
          },
        });
        equipados++;
      }
    }
  }
  return { equipados };
}
