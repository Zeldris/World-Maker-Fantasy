import { slugify } from '../lib/slugify.js';
import { registrarEnPartidasDelMundo } from './cronista/emisores.js';
import { minutosDeFiccion, registrarSuceso, type NuevoSuceso } from './cronista/sucesos.js';
import { edadEnAnios, esAdulto, nacidoEnDe } from './cronista/edades.js';
import { npcVivoEnPartida, poblacionDeCatalogo, type FiltroPoblacion } from './mundoPartida.js';
import { difundirNoticias, textoAsalto, textoExpedicionDeVuelta, type NoticiaMundo } from './noticiasMundo.js';
import type { Prisma, PrismaClient, FactionRelationType, CondicionFisica, Npc } from '@prisma/client';
import type { MetodoObtencion } from '@prisma/client';
import { cabeEnStock, pendingFactionDays } from './factionEconomy.js';
import { REGION_OWNING_FACTIONS } from './reputation.js';
import { aplicarXpNpc, nivelEfectivo } from './npcProfession.js';
import { xpForCraftSuccess } from './professionProgress.js';
import { attributeForOficio, metodoForOficio, professionIdForOficio } from './harvestAbilities.js';
import { estacionFor, climaFor } from './worldClock.js';
import { applyGatheringRoll, candidateSourcesFor, gatheringRollFor, type SourceCandidate } from '../routes/saves/recolectar.js';
import type { Attribute, AttributeBlock } from './dice.js';
import { resolveExchange, type ExchangeParticipant } from './combatExchange.js';
import { toNpcForCombatAbilities } from './combateMultipleOrquestacion.js';
import { npcCombatAbilitiesFor } from './npcCombatAbilities.js';
import { npcAttributesForLevel } from './progression.js';
import { oneStepWorseThan } from './death.js';
import { recordFactionEvent } from './factionRelations.js';
import type { Clase } from './classAbilities.js';
import type { Carencia, Tramo } from './cronista/carencias.js';
import { situacionDeFaccion } from './cronista/situacionFaccion.js';

/// Expediciones de facción (Fase 13-B del plan oct-2026; diseño en
/// docs/rpgtarkor/sistemas-reino/expediciones-poblacion.md § 4.5). Corren en el avance diario de cada
/// partida (`avanzarExpedicionesDePartida`, desde `avanceDiario.ts`, justo después de su economía),
/// sobre las facciones de su mundo y con el mismo catch-up acotado que la economía (CR-7; CR-35 quitó
/// la versión que corría sobre el catálogo).
///
/// Ciclo (todo en días de ficción): lanzar el día D (EN_TRANSITO, `diaSalida` D) → al llegar, el día
/// D+1, tirada de riesgo y recolección (RECOLECTANDO → RETORNANDO en el mismo paso: la recolección es
/// instantánea) → el día D+2 (`diaRegreso`) COMPLETADA y el botín entra en el Almacén de la facción.
/// Si salta la intercepción la expedición pasa a INTERCEPTADA y pierde la carga. Fase 13-C: al saltar la intercepción, `resolverInterceptacion`
/// enfrenta a un `Npc` real de la facción hostil con los guardias (`resolveExchange`, por rondas); si
/// los guardias aguantan la expedición sigue su curso, si caen se pierde la carga y sube la presión.
/// Muertes (decisión de Álvaro, 2026-09-29): cada participante que cae fuera de combate tira una
/// probabilidad muy baja de morir (`PROBABILIDAD_MUERTE_EN_INTERCEPCION`); la muerte es de MUNDO
/// (`Npc.muertoEnMundo`), no de partida — ver `npcElegibleParaExpedicion` para lo que un tick nunca
/// puede tocar (líderes, NPC de misión/quests, Maestros como guardia/atacante).

// ─────────────────────────── Constantes (valores por defecto revisables) ───────────────────────────

/// Días entre salida y regreso: ida + recolección el primero, vuelta el segundo.
export const DURACION_EXPEDICION_DIAS = 2;
export const MAX_RECOLECTORES = 2;
export const MAX_GUARDIAS = 2;
/// Tope de unidades que un recolector saca en una expedición (una sola fuente/objeto por recolector).
export const MAX_UNIDADES_POR_RECOLECTOR = 3;
/// Riesgo de intercepción (%) según la relación con el dueño de la región del destino.
export const RIESGO_POR_RELACION: Partial<Record<FactionRelationType, number>> = { GUERRA: 50, TENSION: 20 };

/// Métodos de recolección que pueden ejecutarse contra una `Location` sin partida ni cadáveres:
/// minería, tala, extracción (hierbas) y pesca. Excluidos: CAZA (Desollar necesita un cadáver real en
/// escena), PASIVO (objetos narrativos de una Location exacta) y BUSQUEDA (pescador solo sale a Pescar).
export const METODOS_EXPEDICION: MetodoObtencion[] = ['MINERIA', 'TALA', 'EXTRACCION', 'PESCA'];

// ─────────────────────────── Funciones puras ───────────────────────────

/// Método de recolección de un oficio si puede ir en expedición; null si no (desollador, oficios de
/// crafteo, etc.).
export function metodoExpedicionFor(professionId: string): MetodoObtencion | null {
  const metodo = professionId === 'pescador' ? 'PESCA' : metodoForOficio(professionId);
  return metodo && METODOS_EXPEDICION.includes(metodo) ? metodo : null;
}

/// Clave de ruta de recolección para un `professionId`: pescador va a "Pescar" ('pescador-pescar', ver
/// `professionIdForOficio`); el resto usa el propio `professionId`.
export function oficioRutaFor(professionId: string): string {
  return professionId === 'pescador' ? 'pescador-pescar' : professionId;
}

/// ¿El `role` del NPC dice guerrero/guardia/patrulla?
export function esRolGuardia(role: string): boolean {
  return /guerrer|guardia|patrull/i.test(role);
}

// ─────────────────────────── Elegibilidad (salvaguardas de un tick en segundo plano) ───────────────────────────

export type RolExpedicion = 'recolector' | 'guardia' | 'atacante';

/// NPC de trama referenciados por slug en lógica fija (la misión de Gistera Koh y el Orco Enfurecido,
/// `quests.ts`/`turnResolution.ts`): el motor los busca por slug, no por `Quest.targetNpcId`.
export const SLUGS_NPC_DE_TRAMA: readonly string[] = ['gistera-koh', 'orco-enfurecido-hondonada'];

/// Lo que un tick nunca puede tocar, cargado una vez por mundo (`cargarProtegidos`).
export interface NpcsProtegidos {
  /// Ids de líderes de facción (`Faction.liderNpcId`) y de objetivos de misión (`Quest.targetNpcId`).
  ids: ReadonlySet<string>;
  /// Slugs de trama fija y de compañeros de alguna partida (`Companion.sourceSlug`).
  slugs: ReadonlySet<string>;
}

export interface NpcParaElegibilidad {
  id: string;
  slug: string;
  interactionTypes: readonly string[];
  teachesProfession: string | null;
  muertoEnMundo: boolean;
}

/// Puro: única regla de quién puede entrar en una expedición o ser atacante de una intercepción.
/// Nunca: muertos de mundo, líderes de facción, NPC con `NPC_MISION`, NPC referenciados por misiones
/// (ids o slugs de trama) ni compañeros de alguna partida. Además los Maestros (`teachesProfession`)
/// no pueden ser `guardia` ni `atacante` (sí `recolector`): un combate del tick podría matarlos.
export function npcElegibleParaExpedicion(npc: NpcParaElegibilidad, rol: RolExpedicion, protegidos: NpcsProtegidos): boolean {
  if (npc.muertoEnMundo) return false;
  if (protegidos.ids.has(npc.id) || protegidos.slugs.has(npc.slug)) return false;
  if (npc.interactionTypes.includes('NPC_MISION')) return false;
  if (npc.teachesProfession && rol !== 'recolector') return false;
  return true;
}

/// Carga los protegidos del mundo: líderes de facción, objetivos de cualquier misión (de cualquier
/// partida y estado), slugs de trama y compañeros reclutados. CR-7: con `saveId`, solo las misiones y
/// compañeros de esa partida (su mundo es solo suyo).
export async function cargarProtegidos(tx: TxDb, worldId: string, saveId: string | null = null): Promise<NpcsProtegidos> {
  const dePartidas = saveId ? { saveId } : { save: { worldId } };
  const [lideres, misiones, companeros] = await Promise.all([
    tx.faction.findMany({ where: { worldId, liderNpcId: { not: null } }, select: { liderNpcId: true } }),
    tx.quest.findMany({ where: { ...dePartidas, targetNpcId: { not: null } }, select: { targetNpcId: true } }),
    tx.companion.findMany({ where: { ...dePartidas, sourceSlug: { not: null } }, select: { sourceSlug: true } }),
  ]);
  return {
    ids: new Set([...lideres.map((f) => f.liderNpcId!), ...misiones.map((q) => q.targetNpcId!)]),
    slugs: new Set([...SLUGS_NPC_DE_TRAMA, ...companeros.map((c) => c.sourceSlug!)]),
  };
}

// ─────────────────────────── Muerte en la intercepción ───────────────────────────

/// Probabilidad (0..1) de que un participante que cae fuera de combate (CONVALECIENTE o peor) en una
/// intercepción muera de verdad. Muy baja a propósito (decisión de Álvaro, 2026-09-29: "es un mundo
/// donde cada muerte cuenta"); aplica igual a guardias y atacante. Inyectable en `resolverInterceptacion`.
export const PROBABILIDAD_MUERTE_EN_INTERCEPCION = 0.03;

/// Puro: ¿muere quien ha caído? La tirada (0..1, de `random()`) cae por debajo de la probabilidad.
export function muereTrasCaer(probabilidad: number, tirada: number): boolean {
  return tirada < probabilidad;
}

export interface MuerteInterceptacion { npcId: string; slug: string; rol: 'atacante' | 'guardia' }

/// Puro y determinista dado `random`: una tirada por cada participante fuera de combate, en orden fijo
/// (atacante y luego guardias en el orden dado). Quien sigue en pie no tira (no consume `random`).
export function tirarMuertes(
  atacante: { id: string; slug: string; condicion: CondicionFisica },
  guardias: { id: string; slug: string; condicion: CondicionFisica }[],
  probabilidad: number,
  random: () => number,
): MuerteInterceptacion[] {
  const muertes: MuerteInterceptacion[] = [];
  if (fueraDeCombate(atacante.condicion) && muereTrasCaer(probabilidad, random())) muertes.push({ npcId: atacante.id, slug: atacante.slug, rol: 'atacante' });
  for (const g of guardias) {
    if (fueraDeCombate(g.condicion) && muereTrasCaer(probabilidad, random())) muertes.push({ npcId: g.id, slug: g.slug, rol: 'guardia' });
  }
  return muertes;
}

/// Hash entero estable de una cadena (elecciones deterministas por día y facción).
export function hashEstable(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

export interface CandidatoRecolector { npcId: string; professionId: string; nivel: number }

/// Oficios de recolección viables entre los candidatos, ordenados por `professionId`, rotados de forma
/// determinista por día: el primero es el oficio "de hoy". Lista vacía = nada que lanzar.
export function oficiosDeRecoleccionOrdenados(candidatos: CandidatoRecolector[], dia: number, semilla: string): string[] {
  const oficios = [...new Set(candidatos.filter((c) => metodoExpedicionFor(c.professionId) !== null).map((c) => c.professionId))].sort();
  if (oficios.length === 0) return [];
  const inicio = (dia + hashEstable(semilla)) % oficios.length;
  return [...oficios.slice(inicio), ...oficios.slice(0, inicio)];
}

/// Hasta `MAX_RECOLECTORES` NPC con potencial en el oficio: mayor nivel primero, desempate por id.
export function elegirRecolectores(candidatos: CandidatoRecolector[], professionId: string): CandidatoRecolector[] {
  return candidatos
    .filter((c) => c.professionId === professionId)
    .sort((a, b) => b.nivel - a.nivel || a.npcId.localeCompare(b.npcId))
    .slice(0, MAX_RECOLECTORES);
}

/// Hasta `MAX_GUARDIAS` NPC cuyo `role` diga guerrero/guardia/patrulla (excluyendo a los ya elegidos
/// como recolectores), por id.
export function elegirGuardias(npcs: { id: string; role: string }[], excluidos: string[]): string[] {
  return npcs
    .filter((n) => esRolGuardia(n.role) && !excluidos.includes(n.id))
    .map((n) => n.id)
    .sort()
    .slice(0, MAX_GUARDIAS);
}

/// Orden de destinos a probar: por slug, empezando en un índice determinista por día y facción.
export function ordenarDestinos<T extends { slug: string }>(destinos: T[], dia: number, semilla: string): T[] {
  const orden = [...destinos].sort((a, b) => a.slug.localeCompare(b.slug));
  if (orden.length === 0) return orden;
  const inicio = (dia + hashEstable(semilla)) % orden.length;
  return [...orden.slice(inicio), ...orden.slice(0, inicio)];
}

// ─────────────────────────── Expediciones dirigidas (CR-34 34b) ───────────────────────────

/// Métodos que traen comida, en orden de preferencia cuando falta (Q11): la pesca antes que la
/// extracción. La caza no va de expedición (ver `METODOS_EXPEDICION`).
export const METODOS_COMIDA: MetodoObtencion[] = ['PESCA', 'EXTRACCION'];
/// PROVISIONAL (economía de supervivencia, pregunta 5 a Álvaro): raciones que suma a la reserva de
/// comida cada unidad comestible que trae una expedición mandada por hambre.
export const RACIONES_POR_UNIDAD_COMESTIBLE = 10;

function rangoComida(professionId: string): number {
  const metodo = metodoExpedicionFor(professionId);
  const i = metodo ? METODOS_COMIDA.indexOf(metodo) : -1;
  return i === -1 ? METODOS_COMIDA.length : i;
}

/// Puro: con carencia de comida, los oficios que la traen van primero (orden estable: dentro de cada
/// grupo se mantiene la rotación del día). Sin carencia, la rotación tal cual.
export function priorizarOficios(oficios: string[], carencias: Carencia[]): string[] {
  if (!carencias.some((c) => c.tipo === 'COMIDA')) return oficios;
  return oficios.map((o, i) => ({ o, i })).sort((a, b) => rangoComida(a.o) - rangoComida(b.o) || a.i - b.i).map((x) => x.o);
}

/// Puro: el estratega prueba antes los destinos con menos riesgo de intercepción (Q4); el resto,
/// la rotación del día.
export function priorizarDestinos<T>(destinos: T[], riesgoDe: (d: T) => number, tramo: Tramo | null): T[] {
  if (tramo !== 'ESTRATEGA') return destinos;
  return destinos.map((d, i) => ({ d, i, r: riesgoDe(d) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.d);
}

/// Puro: la carencia que manda la expedición, si el oficio elegido la atiende (hoy solo la comida).
export function motivoDeExpedicion(professionId: string, carencias: Carencia[]): 'COMIDA' | null {
  return carencias.some((c) => c.tipo === 'COMIDA') && rangoComida(professionId) < METODOS_COMIDA.length ? 'COMIDA' : null;
}

/// Puro: ¿se come? Lo recolectable lleva la categoría `consumible`; lo cocinado, `curaHambre`.
export function esComestible(cat: { category: string; curaHambre: number | null }): boolean {
  return cat.category === 'consumible' || (cat.curaHambre ?? 0) > 0;
}

/// Regiones donde una facción puede recolectar: las suyas (`REGION_OWNING_FACTIONS`) y las sin dueño.
export function regionesElegibles(factionName: string, regionesDelMundo: string[]): string[] {
  return regionesDelMundo.filter((r) => {
    const duenos = REGION_OWNING_FACTIONS[r];
    return !duenos || duenos.length === 0 || duenos.includes(factionName);
  });
}

/// Riesgo (0-100) de una relación: GUERRA 50, TENSION 20, el resto 0.
export function riesgoPorRelacion(tipo: FactionRelationType | null | undefined): number {
  return (tipo && RIESGO_POR_RELACION[tipo]) || 0;
}

/// Riesgo de intercepción hacia una región: el mayor entre la relación de la facción con cada OTRO dueño
/// de esa región (regiones compartidas: Meseta, Ciénaga, Margen). Sin relación conocida = 0.
export function riesgoIntercepcion(region: string, factionName: string, relacionesPorFaccion: Map<string, FactionRelationType>): number {
  const duenos = (REGION_OWNING_FACTIONS[region] ?? []).filter((d) => d !== factionName);
  return duenos.reduce((max, d) => Math.max(max, riesgoPorRelacion(relacionesPorFaccion.get(d))), 0);
}

/// La tirada (0..1, de `random()`) dispara la intercepción si cae por debajo del riesgo en porcentaje.
export function seIntercepta(riesgo: number, tirada: number): boolean {
  return riesgo > 0 && tirada * 100 < riesgo;
}

export interface BotinItem { npcId: string; professionId: string; sourceSlug: string; catalogSlug: string; name: string; cantidad: number; tier: number }

/// Un recolector saca UNA fuente/objeto al azar entre lo que su tirada dejó (tras `applyGatheringRoll`),
/// con la cantidad recortada por el grado y por `MAX_UNIDADES_POR_RECOLECTOR`. Null si no queda nada.
export function elegirBotinDeRecolector(candidatos: SourceCandidate[], npcId: string, professionId: string, random: () => number): BotinItem | null {
  const pares = candidatos.flatMap((c) => c.yields.map((y) => ({ c, y })));
  if (pares.length === 0) return null;
  const { c, y } = pares[Math.min(pares.length - 1, Math.floor(random() * pares.length))]!;
  const cantidad = Math.min(y.cantidadMaxima, MAX_UNIDADES_POR_RECOLECTOR);
  if (cantidad <= 0) return null;
  return { npcId, professionId, sourceSlug: c.sourceSlug, catalogSlug: y.itemSlug, name: y.itemName, cantidad, tier: y.tier ?? 1 };
}

/// XP de oficio de un recolector que sacó algo: la de un éxito de crafteo del tier más alto que
/// recogió (`xpForCraftSuccess`, misma escala que el resto de oficios), una vez por expedición.
export function xpRecolector(items: { tier: number }[]): number {
  if (items.length === 0) return 0;
  return xpForCraftSuccess(Math.max(...items.map((i) => i.tier)));
}

// ─────────────────────────── Intercepción con combate (Fase 13-C) ───────────────────────────

/// Tope de rondas del combate de intercepción. Un atacante contra 2 guardias necesita como mucho 6
/// golpes (3 escalones de condición cada uno) para dejarlos fuera; 12 da margen a los fallos. Si se
/// agota, los guardias cuentan como que resisten (la caravana sigue).
export const MAX_RONDAS_INTERCEPTACION = 12;
/// Relleno de `ExchangeParticipant.difficulty`: el intercambio es un check opuesto y este valor no
/// decide nada (mismo criterio y mismo valor que `CHECK_OPUESTO_DIFICULTAD_RELLENO` del combate múltiple).
const DIFICULTAD_RELLENO = 15;
/// Evento de `FactionRelation` que suma presión cuando los atacantes ganan: el mismo que dispara el
/// jugador al matar a un NPC de otra facción (`turnLootKill.ts`), peso +8 en `factionRelations.ts`.
export const EVENTO_PRESION_INTERCEPTACION = 'BAJA_DE_GUERRA' as const;

/// Un combatiente de la intercepción: atributos ya escalados a su nivel y el atributo/bonus de su
/// ataque básico (la primera habilidad de `npcCombatAbilitiesFor`, el "Ataque base").
export interface CombatienteInterceptacion {
  id: string;
  slug: string;
  nombre: string;
  attributes: AttributeBlock;
  attribute: Attribute;
  attributeBonus: number;
}

/// `Npc` → combatiente, con las mismas piezas que el combate múltiple (`datosVivosDe`):
/// `npcAttributesForLevel` para los atributos y `npcCombatAbilitiesFor` para el ataque base.
export function combatienteDeNpc(npc: Npc): CombatienteInterceptacion {
  const ataque = npcCombatAbilitiesFor(toNpcForCombatAbilities(npc), [])[0]!;
  return {
    id: npc.id, slug: npc.slug, nombre: npc.name,
    attributes: npcAttributesForLevel(npc.attributes as unknown as AttributeBlock, npc.level, npc.clase as Clase | null),
    attribute: ataque.attribute,
    attributeBonus: ataque.attributeBonus ?? 0,
  };
}

function participanteDe(c: CombatienteInterceptacion, condicionFisica: CondicionFisica): ExchangeParticipant {
  return { attributes: c.attributes, attribute: c.attribute, attributeBonus: c.attributeBonus, difficulty: DIFICULTAD_RELLENO, condicionFisica, rol: 'ataque' };
}

/// Fuera de combate = CONVALECIENTE o MUERTO (mismo criterio que `objetivosValidos`).
function fueraDeCombate(c: CondicionFisica): boolean {
  return c === 'CONVALECIENTE' || c === 'MUERTO';
}

export interface ResultadoCombateInterceptacion {
  /// 'atacante' si deja fuera a todos los guardias; 'defensores' si el atacante cae o se agota el tope.
  ganador: 'atacante' | 'defensores';
  rondas: number;
  /// true si se agotó `MAX_RONDAS_INTERCEPTACION` sin que cayera nadie del todo (los defensores resisten).
  tope: boolean;
  /// Condición final de cada bando (los que llegan a CONVALECIENTE tiran la probabilidad de muerte).
  condicionAtacante: CondicionFisica;
  condicionGuardias: CondicionFisica[];
}

/// Puro y determinista dado `random`: el combate de intercepción. Cada ronda: (1) el atacante ataca al
/// primer guardia en pie; (2) cada guardia en pie contraataca al atacante. En cada intercambio
/// (`resolveExchange`) un golpe que llega (`golpe_normal`/`golpe_pleno`) empeora un escalón la condición
/// del defensor y un contragolpe (`defensor_contragolpea`) empeora la del atacante — la misma "vida" por
/// escalones (`oneStepWorseThan`) que el resto del combate. Solo vive en memoria: no toca BD.
export function simularCombateInterceptacion(atacante: CombatienteInterceptacion, guardias: CombatienteInterceptacion[], random: () => number): ResultadoCombateInterceptacion {
  if (guardias.length === 0) return { ganador: 'atacante', rondas: 0, tope: false, condicionAtacante: 'ILESO', condicionGuardias: [] };
  let condAtacante: CondicionFisica = 'ILESO';
  const condGuardias: CondicionFisica[] = guardias.map(() => 'ILESO');

  for (let ronda = 1; ronda <= MAX_RONDAS_INTERCEPTACION; ronda++) {
    // 1) El atacante golpea al primer guardia en pie.
    const objetivo = condGuardias.findIndex((c) => !fueraDeCombate(c));
    const ataque = resolveExchange(participanteDe(atacante, condAtacante), participanteDe(guardias[objetivo]!, condGuardias[objetivo]!), random);
    if (ataque.resultado === 'golpe_normal' || ataque.resultado === 'golpe_pleno') condGuardias[objetivo] = oneStepWorseThan(condGuardias[objetivo]!);
    else if (ataque.resultado === 'defensor_contragolpea') condAtacante = oneStepWorseThan(condAtacante);
    if (fueraDeCombate(condAtacante)) return { ganador: 'defensores', rondas: ronda, tope: false, condicionAtacante: condAtacante, condicionGuardias: condGuardias };
    if (condGuardias.every(fueraDeCombate)) return { ganador: 'atacante', rondas: ronda, tope: false, condicionAtacante: condAtacante, condicionGuardias: condGuardias };

    // 2) Cada guardia en pie contraataca al atacante.
    for (let g = 0; g < guardias.length; g++) {
      if (fueraDeCombate(condGuardias[g]!)) continue;
      const res = resolveExchange(participanteDe(guardias[g]!, condGuardias[g]!), participanteDe(atacante, condAtacante), random);
      if (res.resultado === 'golpe_normal' || res.resultado === 'golpe_pleno') condAtacante = oneStepWorseThan(condAtacante);
      else if (res.resultado === 'defensor_contragolpea') condGuardias[g] = oneStepWorseThan(condGuardias[g]!);
      if (fueraDeCombate(condAtacante)) return { ganador: 'defensores', rondas: ronda, tope: false, condicionAtacante: condAtacante, condicionGuardias: condGuardias };
    }
    if (condGuardias.every(fueraDeCombate)) return { ganador: 'atacante', rondas: ronda, tope: false, condicionAtacante: condAtacante, condicionGuardias: condGuardias };
  }
  return { ganador: 'defensores', rondas: MAX_RONDAS_INTERCEPTACION, tope: true, condicionAtacante: condAtacante, condicionGuardias: condGuardias };
}

/// Facción hostil que dispara el riesgo: entre los OTROS dueños de la región, la de mayor riesgo según
/// su relación con la expedición (empate: orden alfabético). Null si ninguna tiene riesgo > 0.
export function faccionHostilDeRegion(region: string, factionName: string, relacionesPorFaccion: Map<string, FactionRelationType>): string | null {
  const duenos = (REGION_OWNING_FACTIONS[region] ?? []).filter((d) => d !== factionName).sort();
  let mejor: string | null = null;
  let riesgoMejor = 0;
  for (const d of duenos) {
    const r = riesgoPorRelacion(relacionesPorFaccion.get(d));
    if (r > riesgoMejor) { mejor = d; riesgoMejor = r; }
  }
  return mejor;
}

/// Atacante determinista entre los NPC de la facción hostil: primero los de `role` guerrero/guardia/
/// patrulla, si no cualquier humanoide (sin `faunaCategoria`); dentro de cada grupo, mayor nivel y
/// después slug. Null si no hay ninguno.
export function elegirAtacante<T extends { slug: string; role: string; level: number; faunaCategoria: string | null }>(npcs: T[]): T | null {
  const orden = (a: T, b: T) => b.level - a.level || a.slug.localeCompare(b.slug);
  const humanoides = npcs.filter((n) => !n.faunaCategoria);
  const guardias = humanoides.filter((n) => esRolGuardia(n.role)).sort(orden);
  return guardias[0] ?? humanoides.sort(orden)[0] ?? null;
}

export interface ContextoInterceptacion {
  expedicionId: string;
  worldId: string;
  factionId: string;
  factionName: string;
  /// Facción hostil dueña de la región del destino que disparó el riesgo (null si no se pudo determinar).
  faccionHostilNombre: string | null;
  guardiaNpcIds: string[];
  recolectorNpcIds: string[];
  /// Probabilidad de morir al caer (por defecto `PROBABILIDAD_MUERTE_EN_INTERCEPCION`); inyectable en tests.
  probabilidadMuerte?: number;
  /// CR-7: partida de la expedición (null = catálogo: muertes de mundo). Con partida, las muertes van a
  /// su `NpcState.muerto` y la facción hostil es la copia de esa partida.
  saveId?: string | null;
  /// Minuto de ficción de las muertes (`NpcState.muertoEn`).
  minutoMuerte?: number;
}

/// Resumen del combate que se guarda en `Expedicion.interceptacion`.
export interface ResumenInterceptacion {
  faccionHostil: string | null;
  atacanteSlug: string | null;
  guardias: string[];
  rondas: number;
  ganador: 'atacante' | 'defensores' | 'sin-combate';
  /// Motivo si no hubo combate: 'sin-guardias' | 'sin-atacante'; o 'tope' si se agotaron las rondas.
  motivo?: 'sin-guardias' | 'sin-atacante' | 'tope';
  presionAplicada: boolean;
  /// Participantes que murieron de verdad (`Npc.muertoEnMundo`); vacío si nadie cayó o nadie tuvo mala suerte.
  muertes: { slug: string; rol: 'atacante' | 'guardia' }[];
}

/// GANCHO 13-C: se llama cuando la tirada de riesgo salta. Sin guardias (o sin atacante posible) la
/// carga se pierde directamente. Si no, un `Npc` real de la facción hostil combate contra los guardias
/// (`simularCombateInterceptacion`); 'salva' si los guardias resisten. Si ganan los atacantes suma
/// presión a la `FactionRelation` entre las dos facciones con el mismo evento que `BAJA_DE_GUERRA`.
/// No crea `CombatEncounter`/`NpcState` ni toca partidas. Cada participante que cae fuera de combate tira
/// la probabilidad de morir (`tirarMuertes`): la muerte es de mundo (`Npc.muertoEnMundo`), se anota en
/// `resumen.muertes`. Atacante y guardias solo salen de `npcElegibleParaExpedicion` (sin líderes,
/// misiones, Maestros ni muertos), así que un tick no puede romper la trama.
export async function resolverInterceptacion(tx: TxDb, ctx: ContextoInterceptacion, random: () => number): Promise<{ carga: 'perdida' | 'salva'; resumen: ResumenInterceptacion; hechoRelacion?: string | null }> {
  const base = { faccionHostil: ctx.faccionHostilNombre, atacanteSlug: null, guardias: [] as string[], rondas: 0, muertes: [] as ResumenInterceptacion['muertes'] };
  const perdidaSinCombate = (motivo: 'sin-guardias' | 'sin-atacante', guardias: string[] = []) =>
    ({ carga: 'perdida' as const, resumen: { ...base, guardias, ganador: 'sin-combate' as const, motivo, presionAplicada: false } });

  if (ctx.guardiaNpcIds.length === 0) return perdidaSinCombate('sin-guardias');
  if (!ctx.faccionHostilNombre) return perdidaSinCombate('sin-atacante');
  const [candidatos, guardiasNpc, protegidos] = await Promise.all([
    tx.npc.findMany({ where: { worldId: ctx.worldId, faction: ctx.faccionHostilNombre, ...npcsVivos(ctx.saveId) } }),
    tx.npc.findMany({ where: { id: { in: ctx.guardiaNpcIds }, ...npcsVivos(ctx.saveId) }, orderBy: { id: 'asc' } }),
    cargarProtegidos(tx, ctx.worldId, ctx.saveId ?? null),
  ]);
  const atacanteNpc = elegirAtacante(candidatos.filter((n) => npcElegibleParaExpedicion(n, 'atacante', protegidos)));
  if (!atacanteNpc) return perdidaSinCombate('sin-atacante');
  if (guardiasNpc.length === 0) return perdidaSinCombate('sin-guardias');

  const combate = simularCombateInterceptacion(combatienteDeNpc(atacanteNpc), guardiasNpc.map(combatienteDeNpc), random);
  const muertes = tirarMuertes(
    { id: atacanteNpc.id, slug: atacanteNpc.slug, condicion: combate.condicionAtacante },
    guardiasNpc.map((g, i) => ({ id: g.id, slug: g.slug, condicion: combate.condicionGuardias[i]! })),
    ctx.probabilidadMuerte ?? PROBABILIDAD_MUERTE_EN_INTERCEPCION, random,
  );
  if (muertes.length > 0) await marcarMuertes(tx, muertes.map((m) => m.npcId), ctx.saveId ?? null, ctx.minutoMuerte ?? null);
  const resumen: ResumenInterceptacion = {
    faccionHostil: ctx.faccionHostilNombre, atacanteSlug: atacanteNpc.slug, guardias: guardiasNpc.map((g) => g.slug),
    rondas: combate.rondas, ganador: combate.ganador, ...(combate.tope ? { motivo: 'tope' as const } : {}), presionAplicada: false,
    muertes: muertes.map((m) => ({ slug: m.slug, rol: m.rol })),
  };
  if (combate.ganador === 'defensores') return { carga: 'salva', resumen };

  // Ganan los atacantes: presión sobre la relación existente entre las dos facciones (en su
  // dirección real, para no crear una fila espejo NEUTRAL); sin fila previa, la del atacante hacia la nuestra.
  const hostil = await tx.faction.findFirst({ where: { ...faccionesDeAmbito(ctx.worldId, ctx.saveId ?? null), name: ctx.faccionHostilNombre }, select: { id: true } });
  if (hostil) {
    const existentes = await tx.factionRelation.findMany({
      where: { worldId: ctx.worldId, OR: [{ sourceFactionId: hostil.id, targetFactionId: ctx.factionId }, { sourceFactionId: ctx.factionId, targetFactionId: hostil.id }] },
      select: { sourceFactionId: true, targetFactionId: true, type: true },
    });
    const rel = [...existentes].sort((a, b) => riesgoPorRelacion(b.type) - riesgoPorRelacion(a.type))[0] ?? { sourceFactionId: hostil.id, targetFactionId: ctx.factionId };
    // Fase D (hito 0.1) — si el asalto cambia la banda de la relación (p. ej. TENSION → GUERRA), el
    // texto vuelve para convertirse en noticia; antes se descartaba.
    const hechoRelacion = await recordFactionEvent(tx, ctx.worldId, rel.sourceFactionId, rel.targetFactionId, EVENTO_PRESION_INTERCEPTACION, ctx.saveId ?? undefined);
    resumen.presionAplicada = true;
    return { carga: 'perdida', resumen, hechoRelacion };
  }
  return { carga: 'perdida', resumen };
}

// ─────────────────────────── Ámbito: catálogo o partida (CR-7) ───────────────────────────

/// NPC vivos en el ámbito: del catálogo (sin muertos de mundo) o de una partida (tampoco los muertos
/// fuera de escena en ella).
function npcsVivos(saveId: string | null | undefined): Prisma.NpcWhereInput {
  return saveId ? npcVivoEnPartida(saveId) : { muertoEnMundo: false };
}

/// Facciones del ámbito: las de catálogo o las copias de la partida.
function faccionesDeAmbito(worldId: string, saveId: string | null): Prisma.FactionWhereInput {
  return saveId ? { saveId, origenSlug: { not: null } } : { worldId, saveId: null };
}

function poblacionDeAmbito(worldId: string, saveId: string | null): FiltroPoblacion {
  return saveId ? { saveId } : poblacionDeCatalogo(worldId);
}

/// Muertes de una intercepción: en una partida, en su `NpcState.muerto`; en el catálogo, de mundo.
async function marcarMuertes(tx: TxDb, npcIds: string[], saveId: string | null, minuto: number | null): Promise<void> {
  if (!saveId) {
    await tx.npc.updateMany({ where: { id: { in: npcIds } }, data: { muertoEnMundo: true } });
    return;
  }
  for (const npcId of npcIds) {
    await tx.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      create: { saveId, npcId, scope: '', muerto: true, muertoEn: minuto },
      update: { muerto: true, muertoEn: minuto },
    });
  }
}

/// Libro de Sucesos de una expedición: en su partida, o (catálogo) en todas las partidas del mundo.
async function registrarEnAmbito(tx: TxDb, worldId: string, saveId: string | null, construir: (saveId: string, fictionalMinutes: number) => NuevoSuceso): Promise<void> {
  if (!saveId) {
    await registrarEnPartidasDelMundo(tx, worldId, construir);
    return;
  }
  await registrarSuceso(tx, construir(saveId, await minutosDeFiccion(tx, saveId)));
}

// ─────────────────────────── Ciclo en worldTick ───────────────────────────

type Db = Pick<
  PrismaClient,
  | '$transaction' | 'kingdomStats' | 'worldState' | 'faction' | 'factionRelation' | 'npc' | 'npcProfessionPotential'
  | 'npcProfessionProgress' | 'location' | 'expedicion' | 'expedicionMember' | 'almacenItem' | 'itemCatalog'
  | 'harvestYield' | 'worldPopulation' | 'save' | 'logEntry'
>;
type TxDb = Prisma.TransactionClient;

const ACTIVAS = ['EN_TRANSITO', 'RECOLECTANDO', 'RETORNANDO'] as const;

/// `noticias`: entradas del canal "El mundo" creadas en las partidas (Fase D del hito 0.1).
export interface ResultadoExpediciones { diasProcesados: number; lanzadas: number; completadas: number; interceptadas: number; depositados: number; muertes: number; noticias: number }

export interface OpcionesExpediciones {
  /// Sustituye a `PROBABILIDAD_MUERTE_EN_INTERCEPCION` (tests).
  probabilidadMuerte?: number;
}

/// CR-7 (hito 0.2): expediciones de las facciones de UNA partida hasta su día de ficción, desde su
/// avance diario (`avanceDiario.ts`).
export async function avanzarExpedicionesDePartida(prisma: Db, worldId: string, saveId: string, diaActual: number, random: () => number = Math.random, opciones: OpcionesExpediciones = {}): Promise<ResultadoExpediciones> {
  const result: ResultadoExpediciones = { diasProcesados: 0, lanzadas: 0, completadas: 0, interceptadas: 0, depositados: 0, muertes: 0, noticias: 0 };
  await expedicionesDeFacciones(prisma, worldId, saveId, diaActual, random, opciones, result);
  return result;
}

/// Avanza y lanza las expediciones de las facciones de la partida. Idempotente por
/// `KingdomStats.ultimoDiaExpedicion`.
async function expedicionesDeFacciones(prisma: Db, worldId: string, saveId: string, diaActual: number, random: () => number, opciones: OpcionesExpediciones, result: ResultadoExpediciones): Promise<void> {
  const statsRows = await prisma.kingdomStats.findMany({
    where: { faction: faccionesDeAmbito(worldId, saveId) },
    include: { faction: { select: { id: true, name: true } } },
  });
  for (const fks of statsRows) {
    const pendientes = pendingFactionDays(fks.ultimoDiaExpedicion, diaActual);
    if (fks.ultimoDiaExpedicion !== null && pendientes === 0 && fks.ultimoDiaExpedicion >= diaActual) continue;
    const faction = fks.faction!;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reclamo atómico del día: solo procesa quien consigue mover el marcador.
      const claim = await tx.kingdomStats.updateMany({
        where: { id: fks.id, ultimoDiaExpedicion: fks.ultimoDiaExpedicion },
        data: { ultimoDiaExpedicion: diaActual },
      });
      if (claim.count === 0 || pendientes === 0) return; // otro tick ya lo hizo, o solo se fija la línea base
      const noticias: NoticiaMundo[] = [];
      for (let i = 1; i <= pendientes; i++) {
        const dia = diaActual - pendientes + i;
        await avanzarDiaFaccion(tx, worldId, saveId, faction, dia, random, result, opciones, noticias);
      }
      result.diasProcesados += pendientes;
      // Fase D (hito 0.1) — en la misma transacción que el reclamo del día: cada noticia sale una vez.
      result.noticias += await difundirNoticias(tx, worldId, noticias, saveId);
    }, { timeout: 60_000, maxWait: 10_000 });
  }
}

async function avanzarDiaFaccion(tx: TxDb, worldId: string, saveId: string | null, faction: { id: string; name: string }, dia: number, random: () => number, result: ResultadoExpediciones, opciones: OpcionesExpediciones, noticias: NoticiaMundo[]): Promise<void> {
  const activas = await tx.expedicion.findMany({ where: { factionId: faction.id, status: { in: [...ACTIVAS] } }, include: { members: true }, orderBy: { diaSalida: 'asc' } });
  for (const exp of activas) {
    if (exp.status === 'RETORNANDO' && dia >= exp.diaRegreso) {
      result.depositados += await completarExpedicion(tx, exp, faction.name, dia, noticias);
      result.completadas++;
    } else if (exp.status !== 'RETORNANDO' && dia >= exp.diaSalida + 1) {
      const { interceptada, muertes } = await llegarAlDestino(tx, worldId, saveId, faction, exp, dia, random, opciones, noticias);
      if (interceptada) result.interceptadas++;
      result.muertes += muertes;
    }
  }
  const sigueActiva = await tx.expedicion.count({ where: { factionId: faction.id, status: { in: [...ACTIVAS] } } });
  if (sigueActiva === 0 && (await lanzarExpedicion(tx, worldId, saveId, faction, dia))) result.lanzadas++;
}

/// Lanza como mucho una expedición: oficio de recolección de "hoy" entre los NPC de la facción con
/// potencial, destino = `Location` de sus regiones (o sin dueño) que tenga fuentes para ese oficio.
/// Devuelve false si no hay recolectores o ningún destino viable.
async function lanzarExpedicion(tx: TxDb, worldId: string, saveId: string | null, faction: { id: string; name: string }, dia: number): Promise<boolean> {
  const [todos, protegidos] = await Promise.all([
    tx.npc.findMany({ where: { worldId, faction: faction.name, ...npcsVivos(saveId) }, select: { id: true, slug: true, role: true, interactionTypes: true, teachesProfession: true, muertoEnMundo: true, raza: true, nacidoEn: true } }),
    cargarProtegidos(tx, worldId, saveId),
  ]);
  // CR-13 13c: los niños (nacidos en la partida sin llegar a la madurez) no salen de expedición.
  const npcs = todos.filter((n) => esAdulto(n.raza, edadEnAnios(nacidoEnDe(n), dia * 1440)) && npcElegibleParaExpedicion(n, 'recolector', protegidos));
  if (npcs.length === 0) return false;
  const npcIds = npcs.map((n) => n.id);
  const [potenciales, progresos] = await Promise.all([
    tx.npcProfessionPotential.findMany({ where: { npcId: { in: npcIds } } }),
    tx.npcProfessionProgress.findMany({ where: { npcId: { in: npcIds } } }),
  ]);
  const candidatos: CandidatoRecolector[] = potenciales.map((p) => ({
    npcId: p.npcId,
    professionId: p.professionId,
    nivel: nivelEfectivo(progresos.find((g) => g.npcId === p.npcId && g.professionId === p.professionId), p),
  }));
  // CR-34 34b: la carencia (vista con el juicio del líder) decide qué oficio sale primero.
  const situacion = await situacionDeFaccion(tx, faction.id);
  const carencias = situacion?.carencias ?? [];
  const oficios = priorizarOficios(oficiosDeRecoleccionOrdenados(candidatos, dia, faction.id), carencias);
  if (oficios.length === 0) return false;

  const regiones = regionesElegibles(faction.name, (await tx.location.findMany({ where: { worldId }, distinct: ['region'], select: { region: true } })).map((l) => l.region));
  if (regiones.length === 0) return false;
  const locations = (await tx.location.findMany({ where: { worldId, region: { in: regiones } }, select: { id: true, slug: true, region: true, name: true } }))
    .filter((l) => !l.slug.includes('-interior')); // interiores de edificios: no son destinos de recolección
  const relaciones = await tx.factionRelation.findMany({ where: { worldId, OR: [{ sourceFactionId: faction.id }, { targetFactionId: faction.id }] }, include: { sourceFaction: { select: { name: true } }, targetFaction: { select: { name: true } } } });
  const porFaccion = new Map<string, FactionRelationType>();
  for (const r of relaciones) {
    const otra = r.sourceFactionId === faction.id ? r.targetFaction.name : r.sourceFaction.name;
    // Si hay relación en ambas direcciones, manda la de mayor riesgo.
    if (riesgoPorRelacion(r.type) >= riesgoPorRelacion(porFaccion.get(otra))) porFaccion.set(otra, r.type);
  }
  const destinos = priorizarDestinos(ordenarDestinos(locations, dia, faction.id), (d) => riesgoIntercepcion(d.region, faction.name, porFaccion), situacion?.tramo ?? null);

  for (const professionId of oficios) {
    const recolectores = elegirRecolectores(candidatos, professionId);
    const nivelMax = Math.max(...recolectores.map((r) => r.nivel));
    const metodo = metodoExpedicionFor(professionId)!;
    for (const destino of destinos) {
      const { candidates } = await candidateSourcesFor(worldId, metodo, destino.region, null, destino.slug, estacionFor(dia * 1440), climaFor(dia * 1440, destino.region), nivelMax, tx, poblacionDeAmbito(worldId, saveId));
      if (candidates.length === 0) continue;

      const guardias = elegirGuardias(todos.filter((n) => npcElegibleParaExpedicion(n, 'guardia', protegidos)), recolectores.map((r) => r.npcId));
      await tx.expedicion.create({
        data: {
          worldId, saveId, factionId: faction.id, destinoLocationId: destino.id, professionId,
          status: 'EN_TRANSITO', diaSalida: dia, diaRegreso: dia + DURACION_EXPEDICION_DIAS,
          riesgo: riesgoIntercepcion(destino.region, faction.name, porFaccion),
          motivo: motivoDeExpedicion(professionId, carencias),
          members: { create: [...recolectores.map((r) => ({ npcId: r.npcId, rol: 'recolector' })), ...guardias.map((npcId) => ({ npcId, rol: 'guardia' }))] },
        },
      });
      // Libro de Sucesos (CR-3, hito 0.2).
      const faccionSlug = (await tx.faction.findUniqueOrThrow({ where: { id: faction.id }, select: { slug: true } })).slug;
      await registrarEnAmbito(tx, worldId, saveId, (partida, fictionalMinutes) => ({
        saveId: partida, tipo: 'EXPEDICION_SALE', fictionalMinutes, regionSlug: slugify(destino.region), locationId: destino.id, origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: faccionSlug, papel: 'AUTOR' }],
        datos: { faccion: faction.name, destino: destino.name },
      }));
      return true;
    }
  }
  return false;
}

/// Llegada al destino (día `diaSalida + 1`): tirada de riesgo única. Si salta, `resolverInterceptacion`
/// (combate 13-C) decide: si los guardias caen, INTERCEPTADA y carga perdida; si resisten, sigue como
/// si no hubiera saltado (con el resumen del combate en `interceptacion`). Cada recolector tira su
/// recolección con los atributos del `Npc` y su nivel efectivo, y la expedición pasa a RETORNANDO con
/// el botín guardado (se deposita al completar). No reduce la población del mundo ni pone cooldown a
/// la fuente: son NPC de facción, no una partida. Devuelve si fue interceptada y cuántos murieron en el combate.
async function llegarAlDestino(
  tx: TxDb, worldId: string, saveId: string | null, faction: { id: string; name: string },
  exp: { id: string; destinoLocationId: string; professionId: string; riesgo: number; members: { npcId: string; rol: string }[] },
  dia: number, random: () => number, opciones: OpcionesExpediciones, noticias: NoticiaMundo[],
): Promise<{ interceptada: boolean; muertes: number }> {
  const destino = await tx.location.findUniqueOrThrow({ where: { id: exp.destinoLocationId }, select: { slug: true, region: true, name: true } });
  const tirada = random();
  let interceptacion: Prisma.InputJsonValue | undefined;
  let muertes = 0;
  if (seIntercepta(exp.riesgo, tirada)) {
    const relaciones = await tx.factionRelation.findMany({ where: { worldId, OR: [{ sourceFactionId: faction.id }, { targetFactionId: faction.id }] }, include: { sourceFaction: { select: { name: true } }, targetFaction: { select: { name: true } } } });
    const porFaccion = new Map<string, FactionRelationType>();
    for (const r of relaciones) {
      const otra = r.sourceFactionId === faction.id ? r.targetFaction.name : r.sourceFaction.name;
      if (riesgoPorRelacion(r.type) >= riesgoPorRelacion(porFaccion.get(otra))) porFaccion.set(otra, r.type);
    }
    const res = await resolverInterceptacion(tx, {
      expedicionId: exp.id, worldId, factionId: faction.id, factionName: faction.name,
      faccionHostilNombre: faccionHostilDeRegion(destino.region, faction.name, porFaccion),
      guardiaNpcIds: exp.members.filter((m) => m.rol === 'guardia').map((m) => m.npcId),
      recolectorNpcIds: exp.members.filter((m) => m.rol === 'recolector').map((m) => m.npcId),
      probabilidadMuerte: opciones.probabilidadMuerte,
      saveId, minutoMuerte: dia * 1440,
    }, random);
    muertes = res.resumen.muertes.length;
    interceptacion = res.resumen as unknown as Prisma.InputJsonValue;
    // Fase D (hito 0.1) — noticia del asalto y, si movió la relación de banda, del cambio.
    const implicadas = [faction.name, ...(res.resumen.faccionHostil ? [res.resumen.faccionHostil] : [])];
    noticias.push({
      facciones: implicadas,
      region: destino.region,
      dia,
      texto: textoAsalto({
        faccion: faction.name,
        lugar: destino.name,
        hostil: res.resumen.faccionHostil,
        carga: res.carga,
        motivo: res.resumen.motivo,
        muertesPropias: res.resumen.muertes.filter((m) => m.rol === 'guardia').length,
        muertesHostiles: res.resumen.muertes.filter((m) => m.rol === 'atacante').length,
      }),
    });
    if (res.hechoRelacion) noticias.push({ facciones: implicadas, region: null, dia, texto: res.hechoRelacion });
    // Libro de Sucesos (CR-3, hito 0.2): el asalto, con su resultado en los datos del texto.
    const faccionSlug = (await tx.faction.findUniqueOrThrow({ where: { id: faction.id }, select: { slug: true } })).slug;
    await registrarEnAmbito(tx, worldId, saveId, (partida, fictionalMinutes) => ({
      saveId: partida, tipo: 'EXPEDICION_INTERCEPTADA', fictionalMinutes, regionSlug: slugify(destino.region), locationId: exp.destinoLocationId, origen: 'MUNDO',
      actores: [{ entidadTipo: 'FACCION', entidadId: faccionSlug, papel: 'VICTIMA' }],
      datos: { faccion: faction.name, interceptora: res.resumen.faccionHostil ?? 'unos asaltantes', destino: destino.name },
    }));
    if (res.carga === 'perdida') {
      await tx.expedicion.update({ where: { id: exp.id }, data: { status: 'INTERCEPTADA', tiradaRiesgo: tirada * 100, botin: undefined, interceptacion } });
      return { interceptada: true, muertes };
    }
  }

  const metodo = metodoExpedicionFor(exp.professionId)!;
  const ruta = oficioRutaFor(exp.professionId);
  const recolectorIds = exp.members.filter((m) => m.rol === 'recolector').map((m) => m.npcId);
  const [npcs, potenciales, progresos] = await Promise.all([
    tx.npc.findMany({ where: { id: { in: recolectorIds }, ...npcsVivos(saveId) }, select: { id: true, attributes: true } }),
    tx.npcProfessionPotential.findMany({ where: { npcId: { in: recolectorIds }, professionId: exp.professionId } }),
    tx.npcProfessionProgress.findMany({ where: { npcId: { in: recolectorIds }, professionId: exp.professionId } }),
  ]);
  const items: BotinItem[] = [];
  for (const npc of npcs) {
    const potencial = potenciales.find((p) => p.npcId === npc.id);
    const nivel = nivelEfectivo(progresos.find((g) => g.npcId === npc.id), potencial);
    if (nivel < 1) continue;
    const roll = gatheringRollFor(
      { attributes: npc.attributes as unknown as AttributeBlock, secondaryAttributesJson: null, inventoryItems: [], professionProgress: [{ professionId: professionIdForOficio(ruta), nivel }] },
      ruta, random,
    );
    const { candidates } = await candidateSourcesFor(worldId, metodo, destino.region, null, destino.slug, estacionFor(dia * 1440), climaFor(dia * 1440, destino.region), nivel, tx, poblacionDeAmbito(worldId, saveId));
    const item = elegirBotinDeRecolector(applyGatheringRoll(candidates, roll), npc.id, exp.professionId, random);
    if (item) items.push(item);
  }
  await tx.expedicion.update({
    where: { id: exp.id },
    data: { status: 'RETORNANDO', tiradaRiesgo: tirada * 100, botin: { items } as unknown as Prisma.InputJsonValue, interceptacion },
  });
  return { interceptada: false, muertes };
}

/// Regreso (día `diaRegreso`): el botín entra en `AlmacenItem.factionId` (una fila por unidad, respetando
/// el tope `cabeEnStock` por `catalogSlug`) y cada recolector que sacó algo recibe XP de oficio en
/// `NpcProfessionProgress` (sin pasar de su `nivelMaximo`). Devuelve las unidades depositadas.
async function completarExpedicion(
  tx: TxDb,
  exp: { id: string; factionId: string; worldId: string; saveId: string | null; professionId: string; botin: unknown; destinoLocationId: string; motivo: string | null },
  faccionNombre: string,
  dia: number,
  noticias: NoticiaMundo[],
): Promise<number> {
  const items = ((exp.botin as { items?: BotinItem[] } | null)?.items) ?? [];
  // Fase D (hito 0.1) — noticia del regreso con botín (sin botín no hay nada que contar).
  if (items.length > 0) {
    const destino = await tx.location.findUnique({ where: { id: exp.destinoLocationId }, select: { name: true, region: true } });
    const texto = textoExpedicionDeVuelta(faccionNombre, destino?.name ?? 'los alrededores', items);
    if (texto) noticias.push({ facciones: [faccionNombre], region: destino?.region ?? null, dia, texto });
  }
  // Libro de Sucesos (CR-3, hito 0.2): la vuelta, con o sin botín.
  const destinoVuelta = await tx.location.findUnique({ where: { id: exp.destinoLocationId }, select: { name: true, region: true } });
  const botin = items.length > 0 ? [...new Set(items.map((i) => i.name))].slice(0, 3).join(', ') : undefined;
  const faccionSlug = (await tx.faction.findUniqueOrThrow({ where: { id: exp.factionId }, select: { slug: true } })).slug;
  await registrarEnAmbito(tx, exp.worldId, exp.saveId, (partida, fictionalMinutes) => ({
    saveId: partida, tipo: 'EXPEDICION_VUELVE', fictionalMinutes, regionSlug: destinoVuelta ? slugify(destinoVuelta.region) : null, origen: 'MUNDO',
    actores: [{ entidadTipo: 'FACCION', entidadId: faccionSlug, papel: 'AUTOR' }],
    datos: { faccion: faccionNombre, destino: destinoVuelta?.name ?? 'los alrededores', botin },
  }));
  let depositados = 0;
  if (items.length > 0) {
    const existentes = await tx.almacenItem.findMany({ where: { factionId: exp.factionId, catalogSlug: { not: null } }, select: { catalogSlug: true } });
    const cuenta = new Map<string, number>();
    for (const e of existentes) cuenta.set(e.catalogSlug!, (cuenta.get(e.catalogSlug!) ?? 0) + 1);
    const catalogo = await tx.itemCatalog.findMany({ where: { worldId: exp.worldId, slug: { in: [...new Set(items.map((i) => i.catalogSlug))] } }, select: { slug: true, name: true, description: true, category: true, curaHambre: true } });
    const nuevos: Prisma.AlmacenItemCreateManyInput[] = [];
    let raciones = 0;
    for (const item of items) {
      const cat = catalogo.find((c) => c.slug === item.catalogSlug);
      // CR-34 34b: si salió por hambre, lo que se come va a la reserva, no al Almacén.
      if (exp.motivo === 'COMIDA' && cat && esComestible(cat)) {
        raciones += item.cantidad * RACIONES_POR_UNIDAD_COMESTIBLE;
        continue;
      }
      for (let u = 0; u < item.cantidad; u++) {
        const actual = cuenta.get(item.catalogSlug) ?? 0;
        if (!cabeEnStock(actual)) break;
        cuenta.set(item.catalogSlug, actual + 1);
        nuevos.push({ factionId: exp.factionId, name: cat?.name ?? item.name, description: cat?.description ?? '', catalogSlug: item.catalogSlug });
      }
    }
    if (nuevos.length > 0) await tx.almacenItem.createMany({ data: nuevos });
    if (raciones > 0) await tx.kingdomStats.updateMany({ where: { factionId: exp.factionId }, data: { comida: { increment: raciones } } });
    depositados = nuevos.length;

    // XP de oficio: una vez por recolector que sacó algo.
    for (const npcId of new Set(items.map((i) => i.npcId))) {
      const xp = xpRecolector(items.filter((i) => i.npcId === npcId));
      const potencial = await tx.npcProfessionPotential.findUnique({ where: { npcId_professionId: { npcId, professionId: exp.professionId } } });
      if (!potencial) continue;
      const progreso = await tx.npcProfessionProgress.findUnique({ where: { npcId_professionId: { npcId, professionId: exp.professionId } } });
      const nuevo = aplicarXpNpc(progreso ?? { nivel: 1, xp: 0 }, potencial, xp);
      await tx.npcProfessionProgress.upsert({
        where: { npcId_professionId: { npcId, professionId: exp.professionId } },
        create: { npcId, professionId: exp.professionId, nivel: nuevo.nivel, xp: nuevo.xp },
        update: { nivel: nuevo.nivel, xp: nuevo.xp },
      });
    }
  }
  await tx.expedicion.update({ where: { id: exp.id }, data: { status: 'COMPLETADA', botin: { items, depositados } as unknown as Prisma.InputJsonValue } });
  return depositados;
}

