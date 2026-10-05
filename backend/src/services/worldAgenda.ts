import type { PrismaClient } from '@prisma/client';
import { stageForPresion, typeForPresion } from './factionRelations.js';
import { ambitoFacciones, type FiltroFacciones } from './mundoPartida.js';
import { advanceEntry, avanzarCadena, entradaInicial, parseAgenda, type AgendaEntry, type Cadena, type SucesoDePaso } from './cronista/cadenas.js';

export { advanceEntry, parseAgenda, type AgendaEntry };

/// El conflicto Serhu (Grupo 3, docs/producto/21-roadmap.md; diseño cerrado con la usuaria el
/// 2026-08-24): el Clan Serhu, aliado en la sombra con la Concordia de Hierro, presiona a los clanes
/// Helsig y Goshg, que resisten. «No hay guerra abierta todavía, solo pequeños conflictos» es el paso
/// 0; cada paso que se cruza sin que la jugadora intervenga agrava el conflicto y se cobra población
/// real de Helsig y Goshg.
///
/// CR-12 (paso 12b, hito 0.2): es la primera **cadena** del Cronista (`cronista/cadenas.ts`): cada
/// paso tiene su texto (canal «El mundo» y hechos del Narrador), sus sucesos del Libro y sus efectos
/// de la lista cerrada; se corta si cae el Clan Serhu o caen Helsig y Goshg a la vez. Su estado sigue
/// en `WorldState.agenda` con la misma forma de siempre.

/// 7 días de ficción por paso — cifra de partida, a afinar jugando.
const DIAS_POR_PASO = 7;

/// Bajas por paso en cada uno de los dos clanes que resisten — cifra de partida, sin verificar en
/// juego real todavía. Helsig (400 población) y Goshg (600) son lo bastante grandes para que esto
/// se note sin ser catastrófico en un solo paso.
const POBLACION_PERDIDA_POR_ETAPA = 20;

const HELSIG_TARGET_SLUG = 'orcos-cristal-helado';
const GOSHG_TARGET_SLUG = 'orcos-cienaga';

export const CONFLICTO_ID = 'conflicto-serhu-concordia-vs-helsig-goshg';

export type RegionControlEstado = 'NEUTRAL_O_DUENO_ORIGINAL' | 'EN_DISPUTA' | 'CONQUISTADA';

export interface RegionControlState {
  estado: RegionControlEstado;
  /// Dueño de la región HOY según este cálculo — el original (`REGION_OWNING_FACTIONS`,
  /// reputation.ts) en `NEUTRAL_O_DUENO_ORIGINAL`/`EN_DISPUTA`, el agresor en `CONQUISTADA`.
  duenoActual: string;
  /// Solo presente en `EN_DISPUTA` — quién presiona.
  agresor?: string;
}

const AGRESOR = 'Clan Serhu-Concordia de Hierro';

/// Región propia del agresor (Las Llanuras del Viento Rojo, dueño de lore "Clan Serhu") — nunca
/// entra en disputa consigo misma aunque el conflicto avance, decisión cerrada con la usuaria
/// explícitamente para esta excepción.
const REGION_DEL_AGRESOR = 'Las Llanuras del Viento Rojo';

/// Las 3 regiones con conflicto sembrado hoy (docs/rpgtarkor/lore-mundo/areas.md) — su dueño ORIGINAL de
/// `REGION_OWNING_FACTIONS` (reputation.ts) es el defensor cuando `stage` entra en disputa.
const REGION_DEFENSOR: Record<string, string> = {
  'Cristal Helado': 'Clan Helsig',
  'Ciénaga Troncal': 'Clan Goshg',
};

/// Puro — control determinista por región, derivado de la etapa real de `CONFLICTO_ID`
/// (Serhu-Concordia vs. Helsig/Goshg) donde exista conflicto sembrado. El resto de regiones (sin
/// entrada en `REGION_DEFENSOR`, ej. Meseta del Orden) se quedan FIJAS con su dueño de
/// `REGION_OWNING_FACTIONS` — nunca se inventa una disputa que el diseño no tiene. `stage` 0-1 =
/// dueño original, 2-3 = en disputa, 4 (`maxStage`) = conquistada por el agresor. Las Llanuras del
/// Viento Rojo (del propio Clan Serhu) son la única excepción: siempre dueño original, pase lo que
/// pase con la etapa.
export function regionControlFor(region: string, agenda: AgendaEntry[], duenoOriginal: string): RegionControlState {
  const conflicto = agenda.find((entry) => entry.id === CONFLICTO_ID);
  return regionControlDesdeStage(region, conflicto?.stage ?? 0, duenoOriginal);
}

/// Puro — misma regla de `regionControlFor`, a partir de una etapa ya conocida (0-4).
export function regionControlDesdeStage(region: string, stage: number, duenoOriginal: string): RegionControlState {
  if (region === REGION_DEL_AGRESOR) return { estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: duenoOriginal };
  if (!REGION_DEFENSOR[region]) return { estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: duenoOriginal };
  const maxStage = CADENA_CONFLICTO_SERHU.pasos.length - 1;
  if (stage >= maxStage) return { estado: 'CONQUISTADA', duenoActual: AGRESOR };
  if (stage >= 2) return { estado: 'EN_DISPUTA', duenoActual: duenoOriginal, agresor: AGRESOR };
  return { estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: duenoOriginal };
}

// ─────────── Fase D del hito 0.1: el conflicto se lee de las relaciones reales ───────────
//
// `FactionRelation` (sembradas el 2026-09-29, `factionRelationsIniciales`) ya tiene Serhu→Helsig y
// Serhu→Goshg con su `presion`/`stage` reales, que además se mueven solas (asaltos de expediciones,
// `factionExpeditions.ts`). El control de cada región en disputa sale ahora de SU relación: Cristal
// Helado de Serhu→Helsig, Ciénaga Troncal de Serhu→Goshg. El temporizador de la agenda sigue (sin él
// nada haría avanzar el conflicto en 0.1), pero en vez de ser la fuente de verdad empuja esas
// relaciones: cada etapa cruzada sube su presión hasta el mínimo de esa etapa (`presionMinimaDeEtapa`,
// nunca la baja). Con la presión sembrada (70 = etapa 1) el control queda igual que antes (etapas 0-1 =
// dueño original), así que la jugadora no ve ningún cambio; una partida que ya iba más avanzada
// sincroniza su relación al primer tick (`sincronizarRelacionesConflicto`). Sin relación en BD (mundo
// sin sembrar) se usa la agenda, como antes.

const AGRESOR_FACCION = 'Clan Serhu';

/// Presión mínima para que `stageForPresion` dé `stage` (etapa 0 → 60, 1 → 70… 4 → 100).
export function presionMinimaDeEtapa(stage: number): number {
  return Math.min(100, 60 + 10 * Math.max(0, stage));
}

type RelacionesClient = Pick<PrismaClient, 'factionRelation' | 'faction'>;

/// Etapa del conflicto por región desde las relaciones reales; región ausente = sin relación en BD.
/// CR-6: `facciones` = las de la partida (`ambitoFacciones`) o las del catálogo.
export async function stagesConflictoPorRegion(db: RelacionesClient, facciones: FiltroFacciones): Promise<Map<string, number>> {
  const relaciones = await db.factionRelation.findMany({
    where: { sourceFaction: { ...facciones, name: AGRESOR_FACCION }, targetFaction: { ...facciones, name: { in: Object.values(REGION_DEFENSOR) } } },
    select: { presion: true, targetFaction: { select: { name: true } } },
  });
  const porRegion = new Map<string, number>();
  for (const [region, defensor] of Object.entries(REGION_DEFENSOR)) {
    const rel = relaciones.find((r) => r.targetFaction.name === defensor);
    if (rel) porRegion.set(region, stageForPresion(rel.presion));
  }
  return porRegion;
}

/// Control actual de una región: de su relación real si existe; si no, de la agenda (como antes).
export async function regionControlActual(db: RelacionesClient, facciones: FiltroFacciones, region: string, agenda: AgendaEntry[], duenoOriginal: string): Promise<RegionControlState> {
  if (!REGION_DEFENSOR[region]) return regionControlFor(region, agenda, duenoOriginal);
  const stage = (await stagesConflictoPorRegion(db, facciones)).get(region);
  return stage === undefined ? regionControlFor(region, agenda, duenoOriginal) : regionControlDesdeStage(region, stage, duenoOriginal);
}

/// Sube (nunca baja) la presión de Serhu→Helsig y Serhu→Goshg hasta el mínimo de `stage`.
export async function sincronizarRelacionesConflicto(db: RelacionesClient, facciones: FiltroFacciones, stage: number): Promise<void> {
  const minima = presionMinimaDeEtapa(stage);
  const relaciones = await db.factionRelation.findMany({
    where: { presion: { lt: minima }, sourceFaction: { ...facciones, name: AGRESOR_FACCION }, targetFaction: { ...facciones, name: { in: Object.values(REGION_DEFENSOR) } } },
    select: { id: true },
  });
  for (const r of relaciones) {
    await db.factionRelation.update({ where: { id: r.id }, data: { presion: minima, type: typeForPresion(minima), stage: stageForPresion(minima) } });
  }
}

const faccion = (slug: string, papel: 'AUTOR' | 'VICTIMA' | 'AFECTADO') => ({ entidadTipo: 'FACCION' as const, entidadId: slug, papel });

/// Qué apunta el Libro al cruzar cada paso del conflicto: 1 la relación empeora, 2 la Concordia se
/// alía abiertamente con Serhu, 3 Helsig y Goshg pierden terreno, 4 guerra abierta.
export function sucesosDeEtapaConflicto(etapa: number): SucesoDePaso[] {
  switch (etapa) {
    case 1:
      return [{ tipo: 'CAMBIO_RELACION', actores: [faccion('clan-serhu', 'AUTOR'), faccion('clan-helsig', 'AFECTADO'), faccion('clan-goshg', 'AFECTADO')], datos: { faccionA: 'el Clan Serhu', faccionB: 'los clanes Helsig y Goshg', antes: 'escaramuzas sueltas', despues: 'incursiones organizadas' } }];
    case 2:
      return [{ tipo: 'ALIANZA', actores: [faccion('clan-serhu', 'AUTOR'), faccion('concordia-de-hierro', 'AUTOR')], datos: { faccionA: 'El Clan Serhu', faccionB: 'la Concordia de Hierro' } }];
    case 3:
      return [
        { tipo: 'TERRITORIO_PERDIDO', actores: [faccion('clan-helsig', 'VICTIMA'), faccion('clan-serhu', 'AUTOR')], datos: { faccion: 'El Clan Helsig', territorio: 'parte de sus asentamientos' } },
        { tipo: 'TERRITORIO_PERDIDO', actores: [faccion('clan-goshg', 'VICTIMA'), faccion('clan-serhu', 'AUTOR')], datos: { faccion: 'El Clan Goshg', territorio: 'parte de sus asentamientos' } },
      ];
    case 4:
      return [{ tipo: 'GUERRA_DECLARADA', actores: [faccion('clan-serhu', 'AUTOR'), faccion('concordia-de-hierro', 'AUTOR'), faccion('clan-helsig', 'VICTIMA'), faccion('clan-goshg', 'VICTIMA')], datos: { atacante: 'El Clan Serhu, con la Concordia de Hierro,', atacada: 'los clanes Helsig y Goshg' } }];
    default:
      return [];
  }
}

/// Textos de cada paso (los de la antigua agenda, escritos a mano; el 0 es silencioso).
const TEXTOS_CONFLICTO: readonly string[] = [
  '',
  'Los guerreros del Clan Serhu, animados en secreto por la Concordia de Hierro, intensifican sus incursiones contra los asentamientos del Clan Helsig y el Clan Goshg — ya no son escaramuzas sueltas, hay un patrón real detrás.',
  'Pequeñas partidas Goirntes empiezan a acompañar a los guerreros Serhu en sus asaltos contra Helsig y Goshg — la Concordia deja de ocultar del todo su mano en el conflicto.',
  'Helsig y Goshg pierden terreno de verdad frente a la presión conjunta de Serhu y la Concordia — corren rumores de aldeas enteras abandonadas.',
  'El conflicto entre Serhu-Concordia y Helsig-Goshg se ha convertido en guerra abierta, con bajas reales en ambos bandos cada semana que pasa.',
];

/// La cadena se corta si cae el agresor, o si caen los dos que resisten (facciones de la partida).
async function motivoDeCorteConflicto({ db, saveId }: { db: Pick<PrismaClient, 'faction' | 'suceso'>; saveId: string }): Promise<string | null> {
  const defensores = Object.values(REGION_DEFENSOR);
  const filas = await db.faction.findMany({
    where: { saveId, origenSlug: { not: null }, name: { in: [AGRESOR_FACCION, ...defensores] } },
    select: { name: true, slug: true, disueltaEn: true },
  });
  const caida = (nombre: string) => filas.some((f) => f.name === nombre && f.disueltaEn !== null);
  if (caida(AGRESOR_FACCION)) return 'Con la caída del Clan Serhu, sus incursiones contra Helsig y Goshg se apagan.';
  if (defensores.every(caida)) return 'Caídos Helsig y Goshg, ya no queda nadie que resista al Clan Serhu: su campaña contra ellos termina.';
  // CR-34 (Q19): manda la IA de facción; si Serhu firma la paz con uno de los dos, la campaña se acaba.
  const agresor = filas.find((f) => f.name === AGRESOR_FACCION);
  const slugsDefensores = filas.filter((f) => f.name !== AGRESOR_FACCION).map((f) => f.slug);
  if (agresor && slugsDefensores.length > 0) {
    const paz = await db.suceso.findFirst({
      where: {
        saveId, tipo: 'TREGUA',
        AND: [{ actores: { some: { entidadTipo: 'FACCION', entidadId: agresor.slug } } }, { actores: { some: { entidadTipo: 'FACCION', entidadId: { in: slugsDefensores } } } }],
      },
      select: { id: true },
    });
    if (paz) return 'Firmada la paz, el Clan Serhu deja de presionar a Helsig y Goshg: su campaña contra ellos termina.';
  }
  return null;
}

export const CADENA_CONFLICTO_SERHU: Cadena = {
  id: CONFLICTO_ID,
  titulo: 'El Clan Serhu, alineado con la Concordia, presiona a Helsig y Goshg',
  intervaloDias: DIAS_POR_PASO,
  pasos: TEXTOS_CONFLICTO.map((texto, paso) => ({
    texto,
    sucesos: sucesosDeEtapaConflicto(paso),
    efectos:
      paso === 0
        ? []
        : [
            { tipo: 'ajustarPoblacion', targetSlug: HELSIG_TARGET_SLUG, delta: -POBLACION_PERDIDA_POR_ETAPA, sinSuceso: true },
            { tipo: 'ajustarPoblacion', targetSlug: GOSHG_TARGET_SLUG, delta: -POBLACION_PERDIDA_POR_ETAPA, sinSuceso: true },
          ],
  })),
  // Solo la partida jugable real de hoy (`characterName === 'Gorhorn'`, mismo criterio que
  // `classAbilityUnlocksFor`) y viva.
  aplicaA: { characterName: 'Gorhorn', endedAt: null },
  motivoDeCorte: motivoDeCorteConflicto,
  // Fase D (hito 0.1): el paso empuja las relaciones reales de la partida (idempotente, solo sube).
  sincronizar: async (prisma, saveId, paso) => sincronizarRelacionesConflicto(prisma, await ambitoFacciones(prisma, saveId), paso),
};

export function initialAgenda(fictionalMinutes: number): AgendaEntry[] {
  return [entradaInicial(CADENA_CONFLICTO_SERHU, fictionalMinutes)];
}

/// CR-7 (hito 0.2): la agenda de UNA partida, desde su avance diario (`avanceDiario.ts`).
export async function avanzarAgendaDePartida(prisma: PrismaClient, saveId: string): Promise<{ advanced: boolean; stagesCrossed: number }> {
  return avanzarCadena(prisma, saveId, CADENA_CONFLICTO_SERHU);
}
