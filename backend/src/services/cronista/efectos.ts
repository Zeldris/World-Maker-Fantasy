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
// Pendientes de la tarea que crea su modelo: `programarConsecuencia`/`anularConsecuencia` (CR-11),
// `anadirEtiqueta`/`quitarEtiqueta`, `cambiarAprobacion` y `anadirRecuerdo` (Fase 4),
// `propagarConocimiento` (Fase 5), `abrirHilo`/`cerrarHilo` (buscadores de historias) y
// `ofrecerMision` (gancho, sin implementar).
import type { OrigenSuceso, Prisma } from '@prisma/client';
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
}

export type Efecto =
  | { tipo: 'cambiarPresion'; origenSlug: string; destinoSlug: string; evento: FactionEventType }
  | { tipo: 'matarNpc'; npcId: string; causa?: string }
  | { tipo: 'asignarCargo'; npcId: string; cargo: string | null; faccionSlug?: string }
  | { tipo: 'cambiarCohesion'; faccionSlug: string; delta: number }
  | { tipo: 'cambiarLider'; faccionSlug: string; npcId: string }
  | { tipo: 'crearFaccion'; slug: string; nombre: string; raza: string; descripcion: string; escindidaDe?: string; liderNpcId?: string }
  | { tipo: 'disolverFaccion'; faccionSlug: string }
  | { tipo: 'absorberFaccion'; faccionSlug: string; absorbenteSlug: string };

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
  }
}

// ─────────────────────────── Auxiliares ───────────────────────────

/// Facción viva de la partida por slug (null si no existe o está disuelta).
async function faccionViva(ctx: CtxEfecto, slug: string) {
  return ctx.tx.faction.findFirst({ where: { saveId: ctx.saveId, slug, disueltaEn: null } });
}

async function registrar<T extends TipoSuceso>(ctx: CtxEfecto, s: Omit<NuevoSuceso<T>, 'saveId' | 'fictionalMinutes' | 'origen' | 'causas'>): Promise<string> {
  return registrarSuceso(ctx.tx, { ...s, saveId: ctx.saveId, fictionalMinutes: ctx.fictionalMinutes, origen: ctx.origen, causas: ctx.causas } as NuevoSuceso<T>);
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
  await ctx.tx.kingdomStats.create({ data: { factionId: faccion.id, ownerKey: ownerKeyFor({ factionId: faccion.id }) } });
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
