import type { Prisma, PrismaClient, FactionRelationType, CondicionFisica, Npc } from '@prisma/client';
import type { MetodoObtencion } from '@prisma/client';
import { cabeEnStock, pendingFactionDays, worldFictionDay } from './factionEconomy.js';
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

/// Expediciones de facción (Fase 13-B del plan oct-2026; diseño en
/// docs/rpgtarkor/sistemas-reino/expediciones-poblacion.md § 4.5). Corren en `worldTick`
/// (`advanceFactionExpeditions`, justo después de `advanceFactionEconomy`), una vez por mundo y día de
/// ficción, con el mismo reloj (`worldFictionDay`) y el mismo catch-up acotado que la economía.
///
/// Ciclo (todo en días de ficción): lanzar el día D (EN_TRANSITO, `diaSalida` D) → al llegar, el día
/// D+1, tirada de riesgo y recolección (RECOLECTANDO → RETORNANDO en el mismo paso: la recolección es
/// instantánea) → el día D+2 (`diaRegreso`) COMPLETADA y el botín entra en el Almacén de la facción.
/// Si salta la intercepción la expedición pasa a INTERCEPTADA y pierde la carga; nadie muere (los
/// `Npc` son de mundo, no de partida). Fase 13-C: al saltar la intercepción, `resolverInterceptacion`
/// enfrenta a un `Npc` real de la facción hostil con los guardias (`resolveExchange`, por rondas); si
/// los guardias aguantan la expedición sigue su curso, si caen se pierde la carga y sube la presión.

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
}

/// Puro y determinista dado `random`: el combate de intercepción. Cada ronda: (1) el atacante ataca al
/// primer guardia en pie; (2) cada guardia en pie contraataca al atacante. En cada intercambio
/// (`resolveExchange`) un golpe que llega (`golpe_normal`/`golpe_pleno`) empeora un escalón la condición
/// del defensor y un contragolpe (`defensor_contragolpea`) empeora la del atacante — la misma "vida" por
/// escalones (`oneStepWorseThan`) que el resto del combate. Solo vive en memoria: no toca BD.
export function simularCombateInterceptacion(atacante: CombatienteInterceptacion, guardias: CombatienteInterceptacion[], random: () => number): ResultadoCombateInterceptacion {
  if (guardias.length === 0) return { ganador: 'atacante', rondas: 0, tope: false };
  let condAtacante: CondicionFisica = 'ILESO';
  const condGuardias: CondicionFisica[] = guardias.map(() => 'ILESO');

  for (let ronda = 1; ronda <= MAX_RONDAS_INTERCEPTACION; ronda++) {
    // 1) El atacante golpea al primer guardia en pie.
    const objetivo = condGuardias.findIndex((c) => !fueraDeCombate(c));
    const ataque = resolveExchange(participanteDe(atacante, condAtacante), participanteDe(guardias[objetivo]!, condGuardias[objetivo]!), random);
    if (ataque.resultado === 'golpe_normal' || ataque.resultado === 'golpe_pleno') condGuardias[objetivo] = oneStepWorseThan(condGuardias[objetivo]!);
    else if (ataque.resultado === 'defensor_contragolpea') condAtacante = oneStepWorseThan(condAtacante);
    if (fueraDeCombate(condAtacante)) return { ganador: 'defensores', rondas: ronda, tope: false };
    if (condGuardias.every(fueraDeCombate)) return { ganador: 'atacante', rondas: ronda, tope: false };

    // 2) Cada guardia en pie contraataca al atacante.
    for (let g = 0; g < guardias.length; g++) {
      if (fueraDeCombate(condGuardias[g]!)) continue;
      const res = resolveExchange(participanteDe(guardias[g]!, condGuardias[g]!), participanteDe(atacante, condAtacante), random);
      if (res.resultado === 'golpe_normal' || res.resultado === 'golpe_pleno') condAtacante = oneStepWorseThan(condAtacante);
      else if (res.resultado === 'defensor_contragolpea') condGuardias[g] = oneStepWorseThan(condGuardias[g]!);
      if (fueraDeCombate(condAtacante)) return { ganador: 'defensores', rondas: ronda, tope: false };
    }
    if (condGuardias.every(fueraDeCombate)) return { ganador: 'atacante', rondas: ronda, tope: false };
  }
  return { ganador: 'defensores', rondas: MAX_RONDAS_INTERCEPTACION, tope: true };
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
}

/// GANCHO 13-C: se llama cuando la tirada de riesgo salta. Sin guardias (o sin atacante posible) la
/// carga se pierde directamente. Si no, un `Npc` real de la facción hostil combate contra los guardias
/// (`simularCombateInterceptacion`); 'salva' si los guardias resisten. Si ganan los atacantes suma
/// presión a la `FactionRelation` entre las dos facciones con el mismo evento que `BAJA_DE_GUERRA`.
/// No crea `CombatEncounter`/`NpcState` ni toca partidas: nadie muere, los `Npc` son de mundo.
export async function resolverInterceptacion(tx: TxDb, ctx: ContextoInterceptacion, random: () => number): Promise<{ carga: 'perdida' | 'salva'; resumen: ResumenInterceptacion }> {
  const base = { faccionHostil: ctx.faccionHostilNombre, atacanteSlug: null, guardias: [] as string[], rondas: 0 };
  const perdidaSinCombate = (motivo: 'sin-guardias' | 'sin-atacante', guardias: string[] = []) =>
    ({ carga: 'perdida' as const, resumen: { ...base, guardias, ganador: 'sin-combate' as const, motivo, presionAplicada: false } });

  if (ctx.guardiaNpcIds.length === 0) return perdidaSinCombate('sin-guardias');
  if (!ctx.faccionHostilNombre) return perdidaSinCombate('sin-atacante');
  const [candidatos, guardiasNpc] = await Promise.all([
    tx.npc.findMany({ where: { worldId: ctx.worldId, faction: ctx.faccionHostilNombre } }),
    tx.npc.findMany({ where: { id: { in: ctx.guardiaNpcIds } }, orderBy: { id: 'asc' } }),
  ]);
  const atacanteNpc = elegirAtacante(candidatos);
  if (!atacanteNpc) return perdidaSinCombate('sin-atacante');
  if (guardiasNpc.length === 0) return perdidaSinCombate('sin-guardias');

  const combate = simularCombateInterceptacion(combatienteDeNpc(atacanteNpc), guardiasNpc.map(combatienteDeNpc), random);
  const resumen: ResumenInterceptacion = {
    faccionHostil: ctx.faccionHostilNombre, atacanteSlug: atacanteNpc.slug, guardias: guardiasNpc.map((g) => g.slug),
    rondas: combate.rondas, ganador: combate.ganador, ...(combate.tope ? { motivo: 'tope' as const } : {}), presionAplicada: false,
  };
  if (combate.ganador === 'defensores') return { carga: 'salva', resumen };

  // Ganan los atacantes: presión sobre la relación existente entre las dos facciones (en su
  // dirección real, para no crear una fila espejo NEUTRAL); sin fila previa, la del atacante hacia la nuestra.
  const hostil = await tx.faction.findFirst({ where: { worldId: ctx.worldId, name: ctx.faccionHostilNombre, saveId: null }, select: { id: true } });
  if (hostil) {
    const existentes = await tx.factionRelation.findMany({
      where: { worldId: ctx.worldId, OR: [{ sourceFactionId: hostil.id, targetFactionId: ctx.factionId }, { sourceFactionId: ctx.factionId, targetFactionId: hostil.id }] },
      select: { sourceFactionId: true, targetFactionId: true, type: true },
    });
    const rel = [...existentes].sort((a, b) => riesgoPorRelacion(b.type) - riesgoPorRelacion(a.type))[0] ?? { sourceFactionId: hostil.id, targetFactionId: ctx.factionId };
    await recordFactionEvent(tx, ctx.worldId, rel.sourceFactionId, rel.targetFactionId, EVENTO_PRESION_INTERCEPTACION);
    resumen.presionAplicada = true;
  }
  return { carga: 'perdida', resumen };
}

// ─────────────────────────── Ciclo en worldTick ───────────────────────────

type Db = Pick<
  PrismaClient,
  | '$transaction' | 'kingdomStats' | 'worldState' | 'faction' | 'factionRelation' | 'npc' | 'npcProfessionPotential'
  | 'npcProfessionProgress' | 'location' | 'expedicion' | 'expedicionMember' | 'almacenItem' | 'itemCatalog'
  | 'harvestYield' | 'worldPopulation'
>;
type TxDb = Prisma.TransactionClient;

const ACTIVAS = ['EN_TRANSITO', 'RECOLECTANDO', 'RETORNANDO'] as const;

export interface ResultadoExpediciones { diasProcesados: number; lanzadas: number; completadas: number; interceptadas: number; depositados: number }

/// Recorre las facciones de catálogo y, por mundo y una sola vez por día de ficción, avanza sus
/// expediciones y lanza una nueva si no tienen ninguna activa. Marcador: `KingdomStats.ultimoDiaExpedicion`.
/// `random` es inyectable (tirada de riesgo, tiradas de recolección y elección de botín).
export async function advanceFactionExpeditions(prisma: Db, random: () => number = Math.random): Promise<ResultadoExpediciones> {
  const result: ResultadoExpediciones = { diasProcesados: 0, lanzadas: 0, completadas: 0, interceptadas: 0, depositados: 0 };

  const estados = await prisma.worldState.findMany({ select: { fictionalMinutes: true, save: { select: { worldId: true } } } });
  const minutosPorMundo = new Map<string, number[]>();
  for (const e of estados) {
    const lista = minutosPorMundo.get(e.save.worldId) ?? [];
    lista.push(e.fictionalMinutes);
    minutosPorMundo.set(e.save.worldId, lista);
  }

  for (const [worldId, minutos] of minutosPorMundo) {
    const diaActual = worldFictionDay(minutos);
    if (diaActual === null) continue;

    const statsRows = await prisma.kingdomStats.findMany({
      where: { faction: { worldId, saveId: null } },
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
        for (let i = 1; i <= pendientes; i++) {
          const dia = diaActual - pendientes + i;
          await avanzarDiaFaccion(tx, worldId, faction, dia, random, result);
        }
        result.diasProcesados += pendientes;
      }, { timeout: 60_000, maxWait: 10_000 });
    }
  }
  return result;
}

async function avanzarDiaFaccion(tx: TxDb, worldId: string, faction: { id: string; name: string }, dia: number, random: () => number, result: ResultadoExpediciones): Promise<void> {
  const activas = await tx.expedicion.findMany({ where: { factionId: faction.id, status: { in: [...ACTIVAS] } }, include: { members: true }, orderBy: { diaSalida: 'asc' } });
  for (const exp of activas) {
    if (exp.status === 'RETORNANDO' && dia >= exp.diaRegreso) {
      result.depositados += await completarExpedicion(tx, exp);
      result.completadas++;
    } else if (exp.status !== 'RETORNANDO' && dia >= exp.diaSalida + 1) {
      const interceptada = await llegarAlDestino(tx, worldId, faction, exp, dia, random);
      if (interceptada) result.interceptadas++;
    }
  }
  const sigueActiva = await tx.expedicion.count({ where: { factionId: faction.id, status: { in: [...ACTIVAS] } } });
  if (sigueActiva === 0 && (await lanzarExpedicion(tx, worldId, faction, dia))) result.lanzadas++;
}

/// Lanza como mucho una expedición: oficio de recolección de "hoy" entre los NPC de la facción con
/// potencial, destino = `Location` de sus regiones (o sin dueño) que tenga fuentes para ese oficio.
/// Devuelve false si no hay recolectores o ningún destino viable.
async function lanzarExpedicion(tx: TxDb, worldId: string, faction: { id: string; name: string }, dia: number): Promise<boolean> {
  const npcs = await tx.npc.findMany({ where: { worldId, faction: faction.name }, select: { id: true, role: true } });
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
  const oficios = oficiosDeRecoleccionOrdenados(candidatos, dia, faction.id);
  if (oficios.length === 0) return false;

  const regiones = regionesElegibles(faction.name, (await tx.location.findMany({ where: { worldId }, distinct: ['region'], select: { region: true } })).map((l) => l.region));
  if (regiones.length === 0) return false;
  const locations = (await tx.location.findMany({ where: { worldId, region: { in: regiones } }, select: { id: true, slug: true, region: true } }))
    .filter((l) => !l.slug.includes('-interior')); // interiores de edificios: no son destinos de recolección
  const destinos = ordenarDestinos(locations, dia, faction.id);

  for (const professionId of oficios) {
    const recolectores = elegirRecolectores(candidatos, professionId);
    const nivelMax = Math.max(...recolectores.map((r) => r.nivel));
    const metodo = metodoExpedicionFor(professionId)!;
    for (const destino of destinos) {
      const { candidates } = await candidateSourcesFor(worldId, metodo, destino.region, null, destino.slug, estacionFor(dia * 1440), climaFor(dia * 1440, destino.region), nivelMax, tx);
      if (candidates.length === 0) continue;

      const relaciones = await tx.factionRelation.findMany({ where: { worldId, OR: [{ sourceFactionId: faction.id }, { targetFactionId: faction.id }] }, include: { sourceFaction: { select: { name: true } }, targetFaction: { select: { name: true } } } });
      const porFaccion = new Map<string, FactionRelationType>();
      for (const r of relaciones) {
        const otra = r.sourceFactionId === faction.id ? r.targetFaction.name : r.sourceFaction.name;
        // Si hay relación en ambas direcciones, manda la de mayor riesgo.
        if (riesgoPorRelacion(r.type) >= riesgoPorRelacion(porFaccion.get(otra))) porFaccion.set(otra, r.type);
      }
      const guardias = elegirGuardias(npcs, recolectores.map((r) => r.npcId));
      await tx.expedicion.create({
        data: {
          worldId, factionId: faction.id, destinoLocationId: destino.id, professionId,
          status: 'EN_TRANSITO', diaSalida: dia, diaRegreso: dia + DURACION_EXPEDICION_DIAS,
          riesgo: riesgoIntercepcion(destino.region, faction.name, porFaccion),
          members: { create: [...recolectores.map((r) => ({ npcId: r.npcId, rol: 'recolector' })), ...guardias.map((npcId) => ({ npcId, rol: 'guardia' }))] },
        },
      });
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
/// la fuente: son NPC de facción, no una partida. Devuelve true si fue interceptada.
async function llegarAlDestino(
  tx: TxDb, worldId: string, faction: { id: string; name: string },
  exp: { id: string; destinoLocationId: string; professionId: string; riesgo: number; members: { npcId: string; rol: string }[] },
  dia: number, random: () => number,
): Promise<boolean> {
  const destino = await tx.location.findUniqueOrThrow({ where: { id: exp.destinoLocationId }, select: { slug: true, region: true } });
  const tirada = random();
  let interceptacion: Prisma.InputJsonValue | undefined;
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
    }, random);
    interceptacion = res.resumen as unknown as Prisma.InputJsonValue;
    if (res.carga === 'perdida') {
      await tx.expedicion.update({ where: { id: exp.id }, data: { status: 'INTERCEPTADA', tiradaRiesgo: tirada * 100, botin: undefined, interceptacion } });
      return true;
    }
  }

  const metodo = metodoExpedicionFor(exp.professionId)!;
  const ruta = oficioRutaFor(exp.professionId);
  const recolectorIds = exp.members.filter((m) => m.rol === 'recolector').map((m) => m.npcId);
  const [npcs, potenciales, progresos] = await Promise.all([
    tx.npc.findMany({ where: { id: { in: recolectorIds } }, select: { id: true, attributes: true } }),
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
    const { candidates } = await candidateSourcesFor(worldId, metodo, destino.region, null, destino.slug, estacionFor(dia * 1440), climaFor(dia * 1440, destino.region), nivel, tx);
    const item = elegirBotinDeRecolector(applyGatheringRoll(candidates, roll), npc.id, exp.professionId, random);
    if (item) items.push(item);
  }
  await tx.expedicion.update({
    where: { id: exp.id },
    data: { status: 'RETORNANDO', tiradaRiesgo: tirada * 100, botin: { items } as unknown as Prisma.InputJsonValue, interceptacion },
  });
  return false;
}

/// Regreso (día `diaRegreso`): el botín entra en `AlmacenItem.factionId` (una fila por unidad, respetando
/// el tope `cabeEnStock` por `catalogSlug`) y cada recolector que sacó algo recibe XP de oficio en
/// `NpcProfessionProgress` (sin pasar de su `nivelMaximo`). Devuelve las unidades depositadas.
async function completarExpedicion(tx: TxDb, exp: { id: string; factionId: string; worldId: string; professionId: string; botin: unknown }): Promise<number> {
  const items = ((exp.botin as { items?: BotinItem[] } | null)?.items) ?? [];
  let depositados = 0;
  if (items.length > 0) {
    const existentes = await tx.almacenItem.findMany({ where: { factionId: exp.factionId, catalogSlug: { not: null } }, select: { catalogSlug: true } });
    const cuenta = new Map<string, number>();
    for (const e of existentes) cuenta.set(e.catalogSlug!, (cuenta.get(e.catalogSlug!) ?? 0) + 1);
    const catalogo = await tx.itemCatalog.findMany({ where: { worldId: exp.worldId, slug: { in: [...new Set(items.map((i) => i.catalogSlug))] } }, select: { slug: true, name: true, description: true } });
    const nuevos: Prisma.AlmacenItemCreateManyInput[] = [];
    for (const item of items) {
      const cat = catalogo.find((c) => c.slug === item.catalogSlug);
      for (let u = 0; u < item.cantidad; u++) {
        const actual = cuenta.get(item.catalogSlug) ?? 0;
        if (!cabeEnStock(actual)) break;
        cuenta.set(item.catalogSlug, actual + 1);
        nuevos.push({ factionId: exp.factionId, name: cat?.name ?? item.name, description: cat?.description ?? '', catalogSlug: item.catalogSlug });
      }
    }
    if (nuevos.length > 0) await tx.almacenItem.createMany({ data: nuevos });
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

