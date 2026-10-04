// Lista cerrada de efectos del motor (CR-9, hito 0.2 — roadmap-cronista.md § 7.5). Es la ÚNICA vía por
// la que reacciones, consecuencias y narrador de fondo cambian el mundo de una partida: cada efecto
// valida, aplica y registra su propio suceso en el Libro. Ninguna IA llama a un efecto directamente;
// la IA elige entre candidatos y el motor lo traduce a efectos (D-2).
//
// Un efecto que no puede aplicarse (facción inexistente o ya disuelta, NPC ya muerto…) no falla: no
// hace nada y devuelve `aplicado: false`, para que una cadena de efectos siga con el resto.
//
// Las facciones se nombran por su `slug` dentro de la partida (copias del mundo, nacidas en ella o el
// Reino del jugador). Los efectos numéricos internos (cohesión) no registran suceso propio: lo
// registran sus consecuencias (p. ej. `FACCION_CAE`).
//
// `programarConsecuencia`/`anularConsecuencia` (CR-11) no registran suceso: lo que queda pendiente
// no ha pasado todavía (lo registra la regla al dispararse, o `CONSECUENCIA_PERDIDA` al caducar).
//
// Pendientes de la tarea que los necesita o crea su modelo: `ajustarPrecios` (cuando haya comercio
// local; hoy no hay precios que ajustar fuera del stock),
// `crearNpc` (CR-13, con nacimientos y nombres), `anadirEtiqueta`/`quitarEtiqueta`,
// `cambiarAprobacion` y `anadirRecuerdo` (Fase 4), `propagarConocimiento` (Fase 5),
// `abrirHilo`/`cerrarHilo` (buscadores de historias) y `ofrecerMision` (gancho, sin implementar).
import type { OrigenSuceso, Prisma, TerritoryControl, ZonePointTipo } from '@prisma/client';
import { stripRegionArticle } from '../population.js';
import { slugify } from '../../lib/slugify.js';
import { recordFactionEvent, type FactionEventType } from '../factionRelations.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { registrarSuceso, type NuevoSuceso } from './sucesos.js';
import type { TipoSuceso } from './catalogoSucesos.js';

type Tx = Prisma.TransactionClient;

/// Contexto común: la partida, el momento y quién origina los cambios.
export interface CtxEfecto {
  tx: Tx;
  saveId: string;
  worldId: string;
  fictionalMinutes: number;
  origen: OrigenSuceso;
  /// Sucesos que causan estos efectos (quedan como causas de los que se registren).
  causas?: string[];
  /// Nivel de cascada de los sucesos que se registren (CR-10).
  nivelCascada?: number;
  /// Azar (días de un disparo, tiradas); por defecto `Math.random`.
  random?: () => number;
}

/// Cuándo puede dispararse una consecuencia aplazada (§ 7.2). `minDias`: no antes de esos días
/// desde que se programa. `CUALQUIERA_SALVO_ORIGEN`: cualquier región distinta de `origenSlug`.
export type Disparo =
  | { tipo: 'DIAS'; min: number; max: number }
  | { tipo: 'LLEGAR_REGION'; regionSlug: string; origenSlug?: string; minDias?: number }
  | { tipo: 'ENCUENTRO_NPC'; npcId: string; minDias?: number }
  | { tipo: 'SUCESO'; tipos: TipoSuceso[] };

export const CUALQUIERA_SALVO_ORIGEN = 'CUALQUIERA_SALVO_ORIGEN';

export type Efecto =
  | { tipo: 'cambiarPresion'; origenSlug: string; destinoSlug: string; evento: FactionEventType }
  | { tipo: 'matarNpc'; npcId: string; causa?: string }
  | { tipo: 'asignarCargo'; npcId: string; cargo: string | null; faccionSlug?: string }
  | { tipo: 'cambiarCohesion'; faccionSlug: string; delta: number }
  | { tipo: 'cambiarLider'; faccionSlug: string; npcId: string }
  | { tipo: 'crearFaccion'; slug: string; nombre: string; raza: string; descripcion: string; escindidaDe?: string; liderNpcId?: string; fraccionPoblacion?: number }
  | { tipo: 'disolverFaccion'; faccionSlug: string }
  | { tipo: 'absorberFaccion'; faccionSlug: string; absorbenteSlug: string }
  | { tipo: 'ajustarPoblacion'; targetSlug: string; delta: number; region?: string }
  | { tipo: 'moverPoblacion'; targetSlug: string; desde: string; hacia: string; fraccion: number }
  | { tipo: 'danarEdificio'; buildingId: string; causa?: string }
  | { tipo: 'repararEdificio'; buildingId: string }
  | { tipo: 'cambiarControlTerritorio'; territoryId: string; faccionSlug: string | null; control: TerritoryControl }
  | { tipo: 'crearPuntoZona'; locationId: string; puntoTipo: ZonePointTipo; targetSlug: string; x: number; y: number; cantidad?: number; label?: string }
  | { tipo: 'retirarPuntoZona'; zonePointId: string }
  | { tipo: 'programarConsecuencia'; regla: string; disparo: Disparo; datos: Record<string, unknown>; caducaDias?: number; aviso?: string; npcId?: string }
  | { tipo: 'anularConsecuencia'; regla: string; npcId?: string }
  | { tipo: 'regalarAlJugador'; npcId: string; mensaje: string };

export interface ResultadoEfecto {
  aplicado: boolean;
  /// Suceso registrado por el efecto (null si no registra o no se aplicó).
  sucesoId: string | null;
  /// Hecho de mundo para narrar, si el efecto lo produce (p. ej. un cambio de banda de relación).
  hecho?: string | null;
}

const NO_APLICADO: ResultadoEfecto = { aplicado: false, sucesoId: null };

export const COHESION_MIN = 0;
export const COHESION_MAX = 100;

/// Aplica una lista de efectos en orden; los que no se pueden aplicar se saltan.
export async function aplicarEfectos(ctx: CtxEfecto, efectos: Efecto[]): Promise<ResultadoEfecto[]> {
  const resultados: ResultadoEfecto[] = [];
  for (const e of efectos) resultados.push(await aplicarEfecto(ctx, e));
  return resultados;
}

export async function aplicarEfecto(ctx: CtxEfecto, e: Efecto): Promise<ResultadoEfecto> {
  switch (e.tipo) {
    case 'cambiarPresion':
      return cambiarPresion(ctx, e);
    case 'matarNpc':
      return matarNpc(ctx, e);
    case 'asignarCargo':
      return asignarCargo(ctx, e);
    case 'cambiarCohesion':
      return cambiarCohesion(ctx, e);
    case 'cambiarLider':
      return cambiarLider(ctx, e);
    case 'crearFaccion':
      return crearFaccion(ctx, e);
    case 'disolverFaccion':
      return disolverFaccion(ctx, e);
    case 'absorberFaccion':
      return absorberFaccion(ctx, e);
    case 'ajustarPoblacion':
      return ajustarPoblacion(ctx, e);
    case 'moverPoblacion':
      return moverPoblacion(ctx, e);
    case 'danarEdificio':
      return danarEdificio(ctx, e);
    case 'repararEdificio':
      return repararEdificio(ctx, e);
    case 'cambiarControlTerritorio':
      return cambiarControlTerritorio(ctx, e);
    case 'crearPuntoZona':
      return crearPuntoZona(ctx, e);
    case 'retirarPuntoZona':
      return retirarPuntoZona(ctx, e);
    case 'programarConsecuencia':
      return programarConsecuencia(ctx, e);
    case 'anularConsecuencia':
      return anularConsecuencia(ctx, e);
    case 'regalarAlJugador':
      return regalarAlJugador(ctx, e);
  }
}

// ─────────────────────────── Auxiliares ───────────────────────────

/// Facción viva de la partida por slug (null si no existe o está disuelta).
async function faccionViva(ctx: CtxEfecto, slug: string) {
  return ctx.tx.faction.findFirst({ where: { saveId: ctx.saveId, slug, disueltaEn: null } });
}

async function registrar<T extends TipoSuceso>(ctx: CtxEfecto, s: Omit<NuevoSuceso<T>, 'saveId' | 'fictionalMinutes' | 'origen' | 'causas'>): Promise<string> {
  return registrarSuceso(ctx.tx, { ...s, saveId: ctx.saveId, fictionalMinutes: ctx.fictionalMinutes, origen: ctx.origen, causas: ctx.causas, nivelCascada: ctx.nivelCascada } as NuevoSuceso<T>);
}

const actorFaccion = (slug: string, papel: 'AUTOR' | 'VICTIMA' | 'AFECTADO' | 'BENEFICIARIO') => ({ entidadTipo: 'FACCION' as const, entidadId: slug, papel });
const actorNpc = (id: string, papel: 'AUTOR' | 'VICTIMA' | 'AFECTADO' | 'BENEFICIARIO') => ({ entidadTipo: 'NPC' as const, entidadId: id, papel });

async function estadoNpc(ctx: CtxEfecto, npcId: string, data: Omit<Prisma.NpcStateUncheckedCreateInput, 'saveId' | 'npcId' | 'scope'>) {
  return ctx.tx.npcState.upsert({
    where: { saveId_npcId_scope: { saveId: ctx.saveId, npcId, scope: '' } },
    create: { saveId: ctx.saveId, npcId, scope: '', ...data },
    update: data,
  });
}

// ─────────────────────────── Efectos ───────────────────────────

async function cambiarPresion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'cambiarPresion' }>): Promise<ResultadoEfecto> {
  if (e.origenSlug === e.destinoSlug) return NO_APLICADO;
  const [origen, destino] = await Promise.all([faccionViva(ctx, e.origenSlug), faccionViva(ctx, e.destinoSlug)]);
  if (!origen || !destino) return NO_APLICADO;
  // `recordFactionEvent` ya registra `CAMBIO_RELACION` si la relación cambia de banda.
  const hecho = await recordFactionEvent(ctx.tx, ctx.worldId, origen.id, destino.id, e.evento, ctx.saveId);
  return { aplicado: true, sucesoId: null, hecho };
}

async function matarNpc(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'matarNpc' }>): Promise<ResultadoEfecto> {
  const npc = await ctx.tx.npc.findFirst({ where: { id: e.npcId, worldId: ctx.worldId }, select: { id: true, name: true, muertoEnMundo: true } });
  if (!npc || npc.muertoEnMundo) return NO_APLICADO;
  const previo = await ctx.tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: ctx.saveId, npcId: npc.id, scope: '' } }, select: { muerto: true } });
  if (previo?.muerto) return NO_APLICADO;
  await estadoNpc(ctx, npc.id, { muerto: true, muertoEn: ctx.fictionalMinutes });
  const sucesoId = await registrar(ctx, {
    tipo: 'MUERTE_NPC',
    actores: [actorNpc(npc.id, 'VICTIMA')],
    datos: { npc: npc.name, ...(e.causa ? { causa: e.causa } : {}) },
  });
  return { aplicado: true, sucesoId };
}

async function asignarCargo(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'asignarCargo' }>): Promise<ResultadoEfecto> {
  const npc = await ctx.tx.npc.findFirst({ where: { id: e.npcId, worldId: ctx.worldId }, select: { id: true, name: true } });
  if (!npc) return NO_APLICADO;
  const faccion = e.faccionSlug ? await faccionViva(ctx, e.faccionSlug) : null;
  if (e.faccionSlug && !faccion) return NO_APLICADO;
  await estadoNpc(ctx, npc.id, { cargo: e.cargo, ...(faccion ? { lealtadFaccionId: faccion.id } : {}) });
  // Solo el heredero tiene suceso propio; el resto de cargos son estado.
  if (e.cargo !== 'heredero' || !faccion) return { aplicado: true, sucesoId: null };
  const lider = faccion.liderNpcId ? await ctx.tx.npc.findUnique({ where: { id: faccion.liderNpcId }, select: { name: true } }) : null;
  const sucesoId = await registrar(ctx, {
    tipo: 'HEREDERO_DESIGNADO',
    actores: [actorNpc(npc.id, 'BENEFICIARIO'), actorFaccion(faccion.slug, 'AFECTADO')],
    datos: { heredero: npc.name, lider: lider?.name ?? 'sin líder', faccion: faccion.name },
  });
  return { aplicado: true, sucesoId };
}

async function cambiarCohesion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'cambiarCohesion' }>): Promise<ResultadoEfecto> {
  const faccion = await faccionViva(ctx, e.faccionSlug);
  if (!faccion) return NO_APLICADO;
  const cohesion = Math.max(COHESION_MIN, Math.min(COHESION_MAX, faccion.cohesion + e.delta));
  if (cohesion === faccion.cohesion) return NO_APLICADO;
  await ctx.tx.faction.update({ where: { id: faccion.id }, data: { cohesion } });
  return { aplicado: true, sucesoId: null };
}

async function cambiarLider(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'cambiarLider' }>): Promise<ResultadoEfecto> {
  const faccion = await faccionViva(ctx, e.faccionSlug);
  if (!faccion || faccion.liderNpcId === e.npcId) return NO_APLICADO;
  const npc = await ctx.tx.npc.findFirst({ where: { id: e.npcId, worldId: ctx.worldId, muertoEnMundo: false }, select: { id: true, name: true } });
  if (!npc) return NO_APLICADO;
  const estado = await ctx.tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: ctx.saveId, npcId: npc.id, scope: '' } }, select: { muerto: true } });
  if (estado?.muerto) return NO_APLICADO;
  await ctx.tx.faction.update({ where: { id: faccion.id }, data: { liderNpcId: npc.id } });
  await estadoNpc(ctx, npc.id, { cargo: 'lider', lealtadFaccionId: faccion.id });
  const sucesoId = await registrar(ctx, {
    tipo: 'CAMBIO_LIDER',
    actores: [actorFaccion(faccion.slug, 'AFECTADO'), actorNpc(npc.id, 'BENEFICIARIO')],
    datos: { faccion: faccion.name, nuevoLider: npc.name },
  });
  return { aplicado: true, sucesoId };
}

async function crearFaccion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'crearFaccion' }>): Promise<ResultadoEfecto> {
  if (await ctx.tx.faction.findFirst({ where: { saveId: ctx.saveId, slug: e.slug }, select: { id: true } })) return NO_APLICADO;
  const madre = e.escindidaDe ? await faccionViva(ctx, e.escindidaDe) : null;
  if (e.escindidaDe && !madre) return NO_APLICADO;
  const faccion = await ctx.tx.faction.create({
    data: {
      worldId: ctx.worldId,
      saveId: ctx.saveId,
      slug: e.slug,
      name: e.nombre,
      raza: e.raza,
      description: e.descripcion,
      // Con `origenSlug` cuenta como facción del mundo de la partida (no como el Reino del jugador,
      // que es la única sin él): la de la madre si nace por escisión, si no la suya propia.
      origenSlug: madre?.slug ?? e.slug,
      fundadaEn: ctx.fictionalMinutes,
      liderNpcId: e.liderNpcId ?? null,
    },
  });
  // En una escisión, la nueva se lleva parte de la gente de la madre.
  const statsMadre = madre && e.fraccionPoblacion ? await ctx.tx.kingdomStats.findUnique({ where: { factionId: madre.id } }) : null;
  const parte = (n: number) => Math.floor(n * Math.min(1, e.fraccionPoblacion ?? 0));
  const llevada = statsMadre ? { poblacion: parte(statsMadre.poblacion), soldados: parte(statsMadre.soldados), trabajadores: parte(statsMadre.trabajadores) } : null;
  await ctx.tx.kingdomStats.create({ data: { factionId: faccion.id, ownerKey: ownerKeyFor({ factionId: faccion.id }), ...(llevada ?? {}) } });
  if (statsMadre && llevada) {
    await ctx.tx.kingdomStats.update({
      where: { id: statsMadre.id },
      data: { poblacion: { decrement: llevada.poblacion }, soldados: { decrement: llevada.soldados }, trabajadores: { decrement: llevada.trabajadores } },
    });
  }
  if (e.liderNpcId) await estadoNpc(ctx, e.liderNpcId, { cargo: 'lider', lealtadFaccionId: faccion.id });
  const sucesoId = madre
    ? await registrar(ctx, {
        tipo: 'FACCION_ESCINDIDA',
        actores: [actorFaccion(madre.slug, 'VICTIMA'), actorFaccion(faccion.slug, 'AUTOR')],
        datos: { faccion: madre.name, nueva: faccion.name },
      })
    : await registrar(ctx, {
        tipo: 'FACCION_FUNDADA',
        actores: [actorFaccion(faccion.slug, 'AUTOR'), ...(e.liderNpcId ? [actorNpc(e.liderNpcId, 'AUTOR')] : [])],
        datos: { faccion: faccion.name },
      });
  return { aplicado: true, sucesoId };
}

/// Disuelve una facción del mundo de la partida (nunca el Reino del jugador): marca `disueltaEn` y
/// borra sus relaciones. Su población, territorios y NPC los reparten otras reglas (refugiados…).
async function disolverFaccion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'disolverFaccion' }>): Promise<ResultadoEfecto> {
  const faccion = await faccionViva(ctx, e.faccionSlug);
  if (!faccion || faccion.origenSlug === null) return NO_APLICADO;
  await ctx.tx.faction.update({ where: { id: faccion.id }, data: { disueltaEn: ctx.fictionalMinutes } });
  await ctx.tx.factionRelation.deleteMany({ where: { OR: [{ sourceFactionId: faccion.id }, { targetFactionId: faccion.id }] } });
  const sucesoId = await registrar(ctx, { tipo: 'FACCION_CAE', actores: [actorFaccion(faccion.slug, 'VICTIMA')], datos: { faccion: faccion.name } });
  return { aplicado: true, sucesoId };
}

/// La absorbente se queda con la gente, los recursos, los territorios, los edificios y el almacén de
/// la absorbida, que queda disuelta y sin relaciones.
async function absorberFaccion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'absorberFaccion' }>): Promise<ResultadoEfecto> {
  if (e.faccionSlug === e.absorbenteSlug) return NO_APLICADO;
  const [absorbida, absorbente] = await Promise.all([faccionViva(ctx, e.faccionSlug), faccionViva(ctx, e.absorbenteSlug)]);
  if (!absorbida || !absorbente || absorbida.origenSlug === null) return NO_APLICADO;

  const [statsAbsorbida, statsAbsorbente] = await Promise.all([
    ctx.tx.kingdomStats.findUnique({ where: { factionId: absorbida.id } }),
    ctx.tx.kingdomStats.findUnique({ where: { factionId: absorbente.id } }),
  ]);
  if (statsAbsorbida && statsAbsorbente) {
    await ctx.tx.kingdomStats.update({
      where: { id: statsAbsorbente.id },
      data: {
        poblacion: { increment: statsAbsorbida.poblacion },
        soldados: { increment: statsAbsorbida.soldados },
        trabajadores: { increment: statsAbsorbida.trabajadores },
        visitantes: { increment: statsAbsorbida.visitantes },
        comida: { increment: statsAbsorbida.comida },
        bebida: { increment: statsAbsorbida.bebida },
        riqueza: { increment: statsAbsorbida.riqueza },
      },
    });
  }
  await ctx.tx.territory.updateMany({ where: { factionId: absorbida.id }, data: { factionId: absorbente.id } });
  await ctx.tx.almacenItem.updateMany({ where: { factionId: absorbida.id }, data: { factionId: absorbente.id } });
  // Un edificio de facción es único por (facción, receta): los que la absorbente ya tiene se quedan
  // con la absorbida (disuelta) en vez de duplicarse.
  const yaTiene = new Set((await ctx.tx.building.findMany({ where: { factionId: absorbente.id }, select: { recipeKey: true } })).map((b) => b.recipeKey));
  const edificios = await ctx.tx.building.findMany({ where: { factionId: absorbida.id }, select: { id: true, recipeKey: true } });
  const movibles = edificios.filter((b) => b.recipeKey === null || !yaTiene.has(b.recipeKey)).map((b) => b.id);
  if (movibles.length > 0) await ctx.tx.building.updateMany({ where: { id: { in: movibles } }, data: { factionId: absorbente.id } });

  await ctx.tx.faction.update({ where: { id: absorbida.id }, data: { disueltaEn: ctx.fictionalMinutes } });
  await ctx.tx.factionRelation.deleteMany({ where: { OR: [{ sourceFactionId: absorbida.id }, { targetFactionId: absorbida.id }] } });
  const sucesoId = await registrar(ctx, {
    tipo: 'FACCION_ABSORBIDA',
    actores: [actorFaccion(absorbida.slug, 'VICTIMA'), actorFaccion(absorbente.slug, 'BENEFICIARIO')],
    datos: { faccion: absorbida.name, absorbente: absorbente.name },
  });
  return { aplicado: true, sucesoId };
}

// ─────────────────────────── Población ───────────────────────────

/// Cambio de población a partir del cual se registra auge o declive (fracción de la de antes).
export const UMBRAL_CAMBIO_NOTABLE = 0.1;

/// Suma o resta población de la partida (entre 0 y su techo). Registra `AUGE_POBLACION` o
/// `DECLIVE_POBLACION` si el cambio es notable (≥ 10 % de la de antes).
async function ajustarPoblacion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'ajustarPoblacion' }>): Promise<ResultadoEfecto> {
  const fila = await ctx.tx.worldPopulation.findFirst({ where: { saveId: ctx.saveId, targetSlug: e.targetSlug } });
  if (!fila) return NO_APLICADO;
  const poblacion = Math.max(0, Math.min(fila.poblacionMax, fila.poblacion + e.delta));
  const cambio = poblacion - fila.poblacion;
  if (cambio === 0) return NO_APLICADO;
  await ctx.tx.worldPopulation.update({ where: { id: fila.id }, data: { poblacion } });
  if (Math.abs(cambio) < Math.max(1, fila.poblacion * UMBRAL_CAMBIO_NOTABLE)) return { aplicado: true, sucesoId: null };
  const sucesoId = await registrar(ctx, {
    tipo: cambio > 0 ? 'AUGE_POBLACION' : 'DECLIVE_POBLACION',
    actores: e.region ? [{ entidadTipo: 'REGION', entidadId: slugify(e.region), papel: 'LUGAR' }] : [],
    datos: { especie: fila.label, region: e.region ?? 'la región' },
  });
  return { aplicado: true, sucesoId };
}

/// Pasa una fracción del peso regional (`distribucion`) de una región a otra: la población no cambia,
/// cambia dónde aparece. Registra `MIGRACION_FAUNA`.
async function moverPoblacion(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'moverPoblacion' }>): Promise<ResultadoEfecto> {
  const desde = stripRegionArticle(e.desde);
  const hacia = stripRegionArticle(e.hacia);
  if (desde === hacia || e.fraccion <= 0) return NO_APLICADO;
  const fila = await ctx.tx.worldPopulation.findFirst({ where: { saveId: ctx.saveId, targetSlug: e.targetSlug } });
  if (!fila) return NO_APLICADO;
  const distribucion = { ...((fila.distribucion as Record<string, number> | null) ?? {}) };
  const origen = distribucion[desde] ?? 0;
  if (origen <= 0) return NO_APLICADO;
  const movido = origen * Math.min(1, e.fraccion);
  distribucion[desde] = origen - movido;
  distribucion[hacia] = (distribucion[hacia] ?? 0) + movido;
  await ctx.tx.worldPopulation.update({ where: { id: fila.id }, data: { distribucion } });
  const sucesoId = await registrar(ctx, {
    tipo: 'MIGRACION_FAUNA',
    actores: [{ entidadTipo: 'REGION', entidadId: slugify(e.desde), papel: 'AFECTADO' }, { entidadTipo: 'REGION', entidadId: slugify(e.hacia), papel: 'BENEFICIARIO' }],
    datos: { especie: fila.label, desde: e.desde, hacia: e.hacia },
  });
  return { aplicado: true, sucesoId };
}

// ─────────────────────────── Edificios y territorio ───────────────────────────

/// Edificio de la partida: del jugador (`saveId`) o de una facción de su mundo.
async function edificioDePartida(ctx: CtxEfecto, id: string) {
  return ctx.tx.building.findFirst({ where: { id, OR: [{ saveId: ctx.saveId }, { faction: { saveId: ctx.saveId } }] } });
}

async function danarEdificio(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'danarEdificio' }>): Promise<ResultadoEfecto> {
  const edificio = await edificioDePartida(ctx, e.buildingId);
  if (!edificio || edificio.status !== 'ACTIVO') return NO_APLICADO;
  await ctx.tx.building.update({ where: { id: edificio.id }, data: { status: 'DANADO' } });
  const sucesoId = await registrar(ctx, {
    tipo: 'EDIFICIO_DANADO',
    actores: [{ entidadTipo: 'EDIFICIO', entidadId: edificio.id, papel: 'VICTIMA' }],
    datos: { edificio: edificio.name, ...(e.causa ? { causa: e.causa } : {}) },
  });
  return { aplicado: true, sucesoId };
}

/// Sin suceso propio: reparar es estado (el Libro ya tiene el daño).
async function repararEdificio(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'repararEdificio' }>): Promise<ResultadoEfecto> {
  const edificio = await edificioDePartida(ctx, e.buildingId);
  if (!edificio || edificio.status !== 'DANADO') return NO_APLICADO;
  await ctx.tx.building.update({ where: { id: edificio.id }, data: { status: 'ACTIVO' } });
  return { aplicado: true, sucesoId: null };
}

/// Cambia quién controla un territorio de la partida y cómo. `faccionSlug` null = sin dueño. El
/// territorio del jugador cuelga de la partida (`saveId`); el de una facción, de la facción.
async function cambiarControlTerritorio(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'cambiarControlTerritorio' }>): Promise<ResultadoEfecto> {
  const territorio = await ctx.tx.territory.findFirst({
    where: { id: e.territoryId, OR: [{ saveId: ctx.saveId }, { faction: { saveId: ctx.saveId } }] },
    include: { faction: { select: { slug: true, name: true } } },
  });
  if (!territorio) return NO_APLICADO;
  const nueva = e.faccionSlug ? await faccionViva(ctx, e.faccionSlug) : null;
  if (e.faccionSlug && !nueva) return NO_APLICADO;
  const delJugador = nueva?.origenSlug === null;
  const dueno = delJugador ? { saveId: ctx.saveId, factionId: null } : nueva ? { saveId: null, factionId: nueva.id } : { saveId: null, factionId: null };
  const mismoDueno = territorio.saveId === dueno.saveId && territorio.factionId === dueno.factionId;
  if (mismoDueno && territorio.control === e.control) return NO_APLICADO;
  await ctx.tx.territory.update({ where: { id: territorio.id }, data: { ...dueno, control: e.control } });
  if (mismoDueno && e.control !== 'PERDIDO') return { aplicado: true, sucesoId: null };

  const anterior = territorio.faction?.name ?? (territorio.saveId ? 'el reino del jugador' : undefined);
  const sucesoId = nueva && !mismoDueno
    ? await registrar(ctx, {
        tipo: 'TERRITORIO_CONQUISTADO',
        actores: [actorFaccion(nueva.slug, 'AUTOR'), { entidadTipo: 'TERRITORIO', entidadId: territorio.id, papel: 'LUGAR' }, ...(territorio.faction ? [actorFaccion(territorio.faction.slug, 'VICTIMA')] : [])],
        datos: { faccion: nueva.name, territorio: territorio.name, ...(anterior ? { anteriorDueno: anterior } : {}) },
      })
    : await registrar(ctx, {
        tipo: 'TERRITORIO_PERDIDO',
        actores: [{ entidadTipo: 'TERRITORIO', entidadId: territorio.id, papel: 'LUGAR' }, ...(territorio.faction ? [actorFaccion(territorio.faction.slug, 'VICTIMA')] : [])],
        datos: { faccion: anterior ?? 'nadie', territorio: territorio.name },
      });
  return { aplicado: true, sucesoId };
}

// ─────────────────────────── Puntos de zona ───────────────────────────

/// Punto nuevo en el mapa de zona de la partida (sin suceso: es lo que se ve, no lo que pasa).
async function crearPuntoZona(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'crearPuntoZona' }>): Promise<ResultadoEfecto> {
  const location = await ctx.tx.location.findFirst({ where: { id: e.locationId, worldId: ctx.worldId }, select: { id: true } });
  if (!location) return NO_APLICADO;
  await ctx.tx.zonePoint.create({
    data: {
      saveId: ctx.saveId, locationId: location.id, tipo: e.puntoTipo, targetSlug: e.targetSlug,
      x: e.x, y: e.y, origenX: e.x, origenY: e.y, cantidad: e.cantidad ?? 1, label: e.label ?? null,
      lastUpdatedAtMinutes: ctx.fictionalMinutes,
    },
  });
  return { aplicado: true, sucesoId: null };
}

async function retirarPuntoZona(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'retirarPuntoZona' }>): Promise<ResultadoEfecto> {
  const r = await ctx.tx.zonePoint.updateMany({ where: { id: e.zonePointId, saveId: ctx.saveId, activo: true }, data: { activo: false } });
  return r.count > 0 ? { aplicado: true, sucesoId: null } : NO_APLICADO;
}

// ─────────────────────────── Consecuencias aplazadas (CR-11) ───────────────────────────

/// Deja una consecuencia pendiente. `aviso`: frase insinuada en el canal del personaje (solo para las
/// que nacen de un acto de la jugadora). `npcId`: a quién afecta (para anularla o dispararla al
/// cruzarse con él).
async function programarConsecuencia(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'programarConsecuencia' }>): Promise<ResultadoEfecto> {
  const random = ctx.random ?? Math.random;
  const hoy = Math.floor(ctx.fictionalMinutes / 1440);
  const d = e.disparo;
  const desdeDia =
    d.tipo === 'DIAS' ? hoy + d.min + Math.floor(random() * (d.max - d.min + 1))
    : d.tipo === 'SUCESO' ? hoy
    : hoy + (d.minDias ?? 0);
  await ctx.tx.consecuencia.create({
    data: {
      saveId: ctx.saveId,
      regla: e.regla,
      tipoDisparo: d.tipo,
      disparo: d as unknown as Prisma.InputJsonValue,
      desdeDia,
      regionSlug: d.tipo === 'LLEGAR_REGION' ? d.regionSlug : null,
      npcId: d.tipo === 'ENCUENTRO_NPC' ? d.npcId : (e.npcId ?? null),
      caducaEn: e.caducaDias !== undefined ? ctx.fictionalMinutes + e.caducaDias * 1440 : null,
      datos: e.datos as Prisma.InputJsonValue,
      origenSucesoId: ctx.causas?.[0] ?? null,
      creadaEn: ctx.fictionalMinutes,
    },
  });
  if (e.aviso) {
    const ws = await ctx.tx.worldState.findUnique({ where: { saveId: ctx.saveId }, select: { fictionalDateLabel: true } });
    await ctx.tx.logEntry.create({
      data: { saveId: ctx.saveId, channel: 'CHARACTER', text: e.aviso, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes: ctx.fictionalMinutes, isSystemMessage: true },
    });
  }
  return { aplicado: true, sucesoId: null };
}

async function anularConsecuencia(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'anularConsecuencia' }>): Promise<ResultadoEfecto> {
  const r = await ctx.tx.consecuencia.updateMany({
    where: { saveId: ctx.saveId, regla: e.regla, estado: 'PENDIENTE', ...(e.npcId ? { npcId: e.npcId } : {}) },
    data: { estado: 'ANULADA', resueltaEn: ctx.fictionalMinutes },
  });
  return r.count > 0 ? { aplicado: true, sucesoId: null } : NO_APLICADO;
}

// ─────────────────────────── Regalos ───────────────────────────

/// Goirnos que regala un NPC sin nada en su equipo (10-30).
export const GOIRNOS_REGALO_MIN = 10;
export const GOIRNOS_REGALO_MAX = 30;

/// Un NPC regala algo a la jugadora: un objeto de su propio equipo de catálogo o, si no lleva nada,
/// unos goirnos. `mensaje` va al canal del personaje con lo regalado al final. Registra `REGALO`.
async function regalarAlJugador(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'regalarAlJugador' }>): Promise<ResultadoEfecto> {
  const [npc, save] = await Promise.all([
    ctx.tx.npc.findFirst({ where: { id: e.npcId, worldId: ctx.worldId }, select: { id: true, name: true, items: { include: { item: true }, orderBy: { item: { name: 'asc' } } } } }),
    ctx.tx.save.findUnique({ where: { id: ctx.saveId }, select: { characterName: true, worldState: { select: { fictionalDateLabel: true } } } }),
  ]);
  if (!npc || !save) return NO_APLICADO;
  const objeto = npc.items[0]?.item ?? null;
  let regalo: string;
  if (objeto) {
    await ctx.tx.inventoryItem.create({
      data: {
        saveId: ctx.saveId, name: objeto.name, description: objeto.description, origin: `regalo de ${npc.name}`,
        catalogSlug: objeto.slug, statBonuses: objeto.statBonuses ?? undefined,
      },
    });
    regalo = objeto.name;
  } else {
    const random = ctx.random ?? Math.random;
    const goirnos = GOIRNOS_REGALO_MIN + Math.floor(random() * (GOIRNOS_REGALO_MAX - GOIRNOS_REGALO_MIN + 1));
    await ctx.tx.save.update({ where: { id: ctx.saveId }, data: { goirnos: { increment: goirnos } } });
    regalo = `${goirnos} goirnos`;
  }
  await ctx.tx.logEntry.create({
    data: { saveId: ctx.saveId, channel: 'CHARACTER', text: `${e.mensaje} Te entrega ${regalo}.`, timeLabel: save.worldState?.fictionalDateLabel ?? '', fictionalMinutes: ctx.fictionalMinutes, isSystemMessage: true },
  });
  const sucesoId = await registrar(ctx, {
    tipo: 'REGALO',
    actores: [actorNpc(npc.id, 'AUTOR'), { entidadTipo: 'PERSONAJE', entidadId: ctx.saveId, papel: 'BENEFICIARIO' }],
    datos: { personaje: npc.name, a: save.characterName, objeto: { nombre: regalo } },
  });
  return { aplicado: true, sucesoId };
}
