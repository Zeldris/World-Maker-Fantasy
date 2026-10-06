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
import type { CondicionFisica, OrigenSuceso, Prisma, TerritoryControl, ZonePointTipo } from '@prisma/client';
import { scopeFor } from '../npcScene.js';
import { generarNombre, nombreLibre, type Genero } from './nombres.js';
import { atributosSinPadres, heredarAtributos, type Atributos } from './herencia.js';
import { atributosPorEdad, cicloVital, edadEnAnios, esAdulto, esFertil, MINUTOS_POR_ANIO, nacidoEnDe } from './edades.js';
import { stripRegionArticle } from '../population.js';
import { slugify } from '../../lib/slugify.js';
import { recordFactionEvent, type FactionEventType } from '../factionRelations.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { registrarSuceso, type NuevoSuceso } from './sucesos.js';
import type { TipoSuceso } from './catalogoSucesos.js';
import { aplicarCambioAprobacion, type Valor } from './aprobacion.js';
import { aplicarNivelGanado, aplicarRecuerdo } from './recuerdos.js';
import { apellidoDe, fundarLinaje, linajeParaNacido, nombreConLinaje, unirALinaje } from './linajes.js';
import { aplicarAbrirHilo, aplicarCerrarHilo, registradorDeHilo, type ActorHilo, type Patron } from './hilos.js';

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
  | { tipo: 'SUCESO'; tipos: TipoSuceso[]; npcId?: string; categorias?: string[]; locationId?: string };

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
  | { tipo: 'ajustarPoblacion'; targetSlug: string; delta: number; region?: string; sinSuceso?: boolean }
  | { tipo: 'moverPoblacion'; targetSlug: string; desde: string; hacia: string; fraccion: number; sinSuceso?: boolean }
  | { tipo: 'danarEdificio'; buildingId: string; causa?: string }
  | { tipo: 'repararEdificio'; buildingId: string }
  | { tipo: 'cambiarControlTerritorio'; territoryId: string; faccionSlug: string | null; control: TerritoryControl }
  | { tipo: 'crearPuntoZona'; locationId: string; puntoTipo: ZonePointTipo; targetSlug: string; x: number; y: number; cantidad?: number; label?: string }
  | { tipo: 'retirarPuntoZona'; zonePointId: string }
  | { tipo: 'programarConsecuencia'; regla: string; disparo: Disparo; datos: Record<string, unknown>; caducaDias?: number; aviso?: string; npcId?: string }
  | { tipo: 'anularConsecuencia'; regla: string; npcId?: string }
  | { tipo: 'regalarAlJugador'; npcId: string; mensaje: string }
  | { tipo: 'forzarCombate'; npcId: string; mensaje: string }
  | { tipo: 'ajustarReino'; faccionSlug?: string; riqueza?: number; felicidad?: number }
  | { tipo: 'situarNpc'; npcId: string; locationId: string; condicion: CondicionFisica }
  | { tipo: 'botinAlJugador'; goirnos: number; mensaje: string }
  | { tipo: 'crearNpc'; faccionSlug: string; como?: 'DESTACA' | 'NACE' }
  | { tipo: 'anadirEtiqueta'; clave: string; texto: string }
  | { tipo: 'quitarEtiqueta'; clave: string }
  | { tipo: 'cambiarAprobacion'; companionId: string; delta: number; motivo: Valor }
  | { tipo: 'anadirRecuerdo'; npcId: string; sentimiento: number }
  | { tipo: 'ganarNivelNpc'; npcId: string; titulo?: string }
  | { tipo: 'abrirHilo'; patron: Patron; clave: string; actores: ActorHilo[]; tension: number; resumen: string; cerrado?: boolean }
  | { tipo: 'cerrarHilo'; clave: string; desenlace: string };

export interface ResultadoEfecto {
  aplicado: boolean;
  /// Suceso registrado por el efecto (null si no registra o no se aplicó).
  sucesoId: string | null;
  /// Hecho de mundo para narrar, si el efecto lo produce (p. ej. un cambio de banda de relación).
  hecho?: string | null;
  /// Id de lo que el efecto ha creado, si crea algo (p. ej. el punto de `crearPuntoZona`).
  id?: string;
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
    case 'anadirEtiqueta':
      return anadirEtiqueta(ctx, e);
    case 'quitarEtiqueta':
      return quitarEtiqueta(ctx, e);
    case 'anadirRecuerdo':
      return (await aplicarRecuerdo(ctx.tx, { saveId: ctx.saveId, npcId: e.npcId, sentimiento: e.sentimiento, sucesoId: ctx.causas?.[0] ?? null, fictionalMinutes: ctx.fictionalMinutes }))
        ? { aplicado: true, sucesoId: null }
        : NO_APLICADO;
    case 'ganarNivelNpc':
      return (await aplicarNivelGanado(ctx.tx, { saveId: ctx.saveId, npcId: e.npcId, titulo: e.titulo })) ? { aplicado: true, sucesoId: null } : NO_APLICADO;
    case 'abrirHilo': {
      const sucesoId = await aplicarAbrirHilo(ctx.tx, { saveId: ctx.saveId, fictionalMinutes: ctx.fictionalMinutes, causa: ctx.causas?.[0] ?? null, ...e }, registradorDeHilo(ctx.tx, ctx));
      return sucesoId ? { aplicado: true, sucesoId } : NO_APLICADO;
    }
    case 'cerrarHilo': {
      const sucesoId = await aplicarCerrarHilo(ctx.tx, { saveId: ctx.saveId, fictionalMinutes: ctx.fictionalMinutes, causa: ctx.causas?.[0] ?? null, clave: e.clave, desenlace: e.desenlace }, registradorDeHilo(ctx.tx, ctx));
      return sucesoId ? { aplicado: true, sucesoId } : NO_APLICADO;
    }
    case 'cambiarAprobacion':
      return (await aplicarCambioAprobacion(ctx.tx, { saveId: ctx.saveId, companionId: e.companionId, delta: e.delta, motivo: e.motivo, fictionalMinutes: ctx.fictionalMinutes })) === null
        ? NO_APLICADO
        : { aplicado: true, sucesoId: null };
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
    case 'ajustarReino':
      return ajustarReino(ctx, e);
    case 'situarNpc':
      return situarNpc(ctx, e);
    case 'botinAlJugador':
      return botinAlJugador(ctx, e);
    case 'crearNpc':
      return crearNpc(ctx, e);
    case 'forzarCombate':
      return forzarCombate(ctx, e);
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

/// CR-14: una etiqueta del personaje. Si ya la tenía activa no hace nada; si estaba apagada, vuelve.
async function anadirEtiqueta(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'anadirEtiqueta' }>): Promise<ResultadoEfecto> {
  const clave = { saveId_entidadTipo_entidadId_clave: { saveId: ctx.saveId, entidadTipo: 'PERSONAJE', entidadId: ctx.saveId, clave: e.clave } };
  const ya = await ctx.tx.etiqueta.findUnique({ where: clave, select: { activa: true } });
  if (ya?.activa) return NO_APLICADO;
  const save = await ctx.tx.save.findUniqueOrThrow({ where: { id: ctx.saveId }, select: { characterName: true } });
  const sucesoId = await registrar(ctx, {
    tipo: 'ETIQUETA_GANADA',
    actores: [{ entidadTipo: 'PERSONAJE', entidadId: ctx.saveId, papel: 'AFECTADO' }],
    datos: { personaje: save.characterName, etiqueta: e.texto },
  });
  const datos = { texto: e.texto, sucesoId, desdeMinutes: ctx.fictionalMinutes, activa: true };
  await ctx.tx.etiqueta.upsert({ where: clave, create: { saveId: ctx.saveId, entidadTipo: 'PERSONAJE', entidadId: ctx.saveId, clave: e.clave, ...datos }, update: datos });
  return { aplicado: true, sucesoId };
}

async function quitarEtiqueta(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'quitarEtiqueta' }>): Promise<ResultadoEfecto> {
  const etiqueta = await ctx.tx.etiqueta.findUnique({
    where: { saveId_entidadTipo_entidadId_clave: { saveId: ctx.saveId, entidadTipo: 'PERSONAJE', entidadId: ctx.saveId, clave: e.clave } },
  });
  if (!etiqueta?.activa) return NO_APLICADO;
  await ctx.tx.etiqueta.update({ where: { id: etiqueta.id }, data: { activa: false } });
  const save = await ctx.tx.save.findUniqueOrThrow({ where: { id: ctx.saveId }, select: { characterName: true } });
  const sucesoId = await registrar(ctx, {
    tipo: 'ETIQUETA_PERDIDA',
    actores: [{ entidadTipo: 'PERSONAJE', entidadId: ctx.saveId, papel: 'AFECTADO' }],
    datos: { personaje: save.characterName, etiqueta: etiqueta.texto },
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
  // `sinSuceso`: lo cuenta el suceso que lo causa (p. ej. una plaga del narrador de fondo, CR-12).
  if (e.sinSuceso || Math.abs(cambio) < Math.max(1, fila.poblacion * UMBRAL_CAMBIO_NOTABLE)) return { aplicado: true, sucesoId: null };
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
  if (e.sinSuceso) return { aplicado: true, sucesoId: null };
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
  const punto = await ctx.tx.zonePoint.create({
    data: {
      saveId: ctx.saveId, locationId: location.id, tipo: e.puntoTipo, targetSlug: e.targetSlug,
      x: e.x, y: e.y, origenX: e.x, origenY: e.y, cantidad: e.cantidad ?? 1, label: e.label ?? null,
      lastUpdatedAtMinutes: ctx.fictionalMinutes,
    },
  });
  return { aplicado: true, sucesoId: null, id: punto.id };
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

// ─────────────────────────── Reino ───────────────────────────

/// Suma riqueza o felicidad (0-100) al reino de una facción de la partida o, sin `faccionSlug`, al
/// Reino de la jugadora (CR-12: caravanas, visitante ilustre). Sin suceso propio: es estado y lo
/// cuenta el suceso que lo causa.
async function ajustarReino(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'ajustarReino' }>): Promise<ResultadoEfecto> {
  let ownerKey = ownerKeyFor({ saveId: ctx.saveId });
  if (e.faccionSlug) {
    const faccion = await faccionViva(ctx, e.faccionSlug);
    if (!faccion) return NO_APLICADO;
    ownerKey = ownerKeyFor({ factionId: faccion.id });
  }
  const stats = await ctx.tx.kingdomStats.findUnique({ where: { ownerKey } });
  if (!stats) return NO_APLICADO;
  const riqueza = Math.max(0, stats.riqueza + (e.riqueza ?? 0));
  const felicidad = Math.max(0, Math.min(100, stats.felicidad + (e.felicidad ?? 0)));
  if (riqueza === stats.riqueza && felicidad === stats.felicidad) return NO_APLICADO;
  await ctx.tx.kingdomStats.update({ where: { id: stats.id }, data: { riqueza, felicidad } });
  return { aplicado: true, sucesoId: null };
}

// ─────────────────────────── NPC en un lugar (CR-12) ───────────────────────────

/// Pone a un NPC en un lugar con una condición (p. ej. el caído y el herido de un campo de
/// batalla): su estado en la partida con el ámbito que le toca allí (`scopeFor`). Sin suceso: lo
/// cuenta el suceso que lo causa.
async function situarNpc(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'situarNpc' }>): Promise<ResultadoEfecto> {
  const npc = await ctx.tx.npc.findFirst({ where: { id: e.npcId, worldId: ctx.worldId }, select: { id: true, kind: true } });
  const location = await ctx.tx.location.findFirst({ where: { id: e.locationId, worldId: ctx.worldId }, select: { id: true } });
  if (!npc || !location) return NO_APLICADO;
  const scope = scopeFor(npc.kind, location.id);
  const data = { condicionFisica: e.condicion, saqueado: false, muerto: e.condicion === 'MUERTO' && scope === '', ...(e.condicion === 'MUERTO' ? { muertoEn: ctx.fictionalMinutes } : {}) };
  await ctx.tx.npcState.upsert({
    where: { saveId_npcId_scope: { saveId: ctx.saveId, npcId: npc.id, scope } },
    create: { saveId: ctx.saveId, npcId: npc.id, scope, ...data },
    update: data,
  });
  return { aplicado: true, sucesoId: null };
}

/// La jugadora se lleva unos goirnos (p. ej. la carga de una caravana asaltada). `mensaje` va al
/// canal del personaje. Sin suceso propio: lo cuenta el que lo causa.
async function botinAlJugador(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'botinAlJugador' }>): Promise<ResultadoEfecto> {
  if (e.goirnos <= 0) return NO_APLICADO;
  const save = await ctx.tx.save.update({ where: { id: ctx.saveId }, data: { goirnos: { increment: e.goirnos } }, select: { worldState: { select: { fictionalDateLabel: true } } } });
  await ctx.tx.logEntry.create({
    data: { saveId: ctx.saveId, channel: 'CHARACTER', text: e.mensaje, timeLabel: save.worldState?.fictionalDateLabel ?? '', fictionalMinutes: ctx.fictionalMinutes, isSystemMessage: true },
  });
  return { aplicado: true, sucesoId: null };
}

// ─────────────────────────── NPC nuevos (CR-13) ───────────────────────────

/// «Alguien que destaca» (CR-13 13a): un adulto joven de una facción de la partida empieza a tener
/// nombre propio. Con `como: 'NACE'` (13c), un bebé de una pareja de la facción en edad fértil
/// (`NACIMIENTO_NOTABLE`); sin pareja, no nace. Elige género al azar; si la facción tiene un hombre y una mujer con nombre de su
/// raza (vivos o muertos), son sus padres y hereda de ellos (`herencia.ts`); si no, toma los
/// atributos de alguien de su raza con ±1. Nombre del generador (`nombres.ts`), sin repetir ninguno
/// del mundo ni de la partida. El NPC es de la partida (`Npc.saveId`). Registra `NPC_DESTACA`.
async function crearNpc(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'crearNpc' }>): Promise<ResultadoEfecto> {
  const random = ctx.random ?? Math.random;
  const faccion = await faccionViva(ctx, e.faccionSlug);
  if (!faccion) return NO_APLICADO;
  const deLaPartida = { OR: [{ saveId: null }, { saveId: ctx.saveId }] };
  const conNombre = await ctx.tx.npc.findMany({
    where: { worldId: ctx.worldId, kind: 'PRINCIPAL', raza: faccion.raza, ...deLaPartida },
    orderBy: { slug: 'asc' },
  });
  // CR-13 13b: solo adultos pueden ser padres; 13c: para un nacimiento, en edad fértil y vivos.
  const nace = e.como === 'NACE';
  // Muertos fuera de escena o caídos en combate con la jugadora (solo `condicionFisica`).
  const muertos = nace
    ? await ctx.tx.npcState.findMany({ where: { saveId: ctx.saveId, OR: [{ muerto: true }, { scope: '', condicionFisica: 'MUERTO' }] }, select: { npcId: true } })
    : [];
  const muertosIds = new Set(muertos.map((m) => m.npcId));
  const adultos = conNombre.filter((n) => {
    const edadPadre = edadEnAnios(nacidoEnDe(n), ctx.fictionalMinutes);
    return nace ? esFertil(n.raza, edadPadre) && !n.muertoEnMundo && !muertosIds.has(n.id) : esAdulto(n.raza, edadPadre);
  });
  const deSuFaccion = adultos.filter((n) => n.faction === faccion.name);
  const elegir = <T>(l: T[]) => (l.length === 0 ? null : l[Math.floor(random() * l.length)]!);
  const padre = elegir(deSuFaccion.filter((n) => n.genero === 'M'));
  const madre = elegir(deSuFaccion.filter((n) => n.genero === 'F'));
  const base = padre ?? madre ?? elegir(deSuFaccion) ?? elegir(adultos);
  if (!base || (nace && !(padre && madre))) return NO_APLICADO;

  const genero: Genero = random() < 0.5 ? 'F' : 'M';
  const potenciales: Atributos = padre && madre
    ? heredarAtributos(padre.attributes as Atributos, madre.attributes as Atributos, random).atributos
    : atributosSinPadres(base.attributes as Atributos, random);
  const usados = new Set(
    (await ctx.tx.npc.findMany({ where: { worldId: ctx.worldId, ...deLaPartida }, select: { name: true } })).map((n) => n.name.toLowerCase()),
  );
  const nombreGenerado = generarNombre(faccion.raza, genero, random, usados);
  // CR-52: una cría lleva el apellido (o el rastro) que le toca por sus padres; quien destaca sin
  // padres conocidos funda el linaje de su apellido, si lo tiene.
  const linaje = nace && padre && madre && faccion.raza
    ? await linajeParaNacido(ctx.tx, { saveId: ctx.saveId, pueblo: faccion.raza, madreId: madre.id, padreId: padre.id, ahora: ctx.fictionalMinutes, random })
    : null;
  const propio = nombreGenerado.split(' ')[0]!;
  const nombre = linaje ? nombreLibre(linaje.tipo === 'RASTRO' ? propio : nombreConLinaje(propio, linaje), usados) : nombreGenerado;
  // CR-13 13b: quien destaca es un adulto joven (de la madurez de su raza a 5 años más); 13c: un
  // nacimiento, hoy.
  const edad = nace ? 0 : cicloVital(faccion.raza).madurez + Math.floor(random() * 6);
  const nacidoEn = nace ? ctx.fictionalMinutes : ctx.fictionalMinutes - edad * MINUTOS_POR_ANIO - Math.floor(random() * MINUTOS_POR_ANIO);
  const padres = padre && madre ? `${padre.name} y ${madre.name}` : undefined;

  const npc = await ctx.tx.npc.create({
    data: {
      worldId: ctx.worldId,
      saveId: ctx.saveId,
      kind: 'PRINCIPAL',
      slug: `${slugify(nombre)}-${ctx.saveId.slice(-6)}`,
      name: nombre,
      aliases: [...new Set([nombre.toLowerCase(), nombre.split(' ')[0]!.toLowerCase()])],
      faction: faccion.name,
      role: nace ? `${genero === 'F' ? 'Niña' : 'Niño'} de ${faccion.name}` : `Joven de ${faccion.name}`,
      genero,
      level: base.level,
      attributes: atributosPorEdad(potenciales, faccion.raza, edadEnAnios(nacidoEn, ctx.fictionalMinutes)),
      atributosPotenciales: potenciales,
      nacidoEn,
      bio: nace
        ? `${genero === 'F' ? 'Nacida' : 'Nacido'} en ${faccion.name}, ${genero === 'F' ? 'hija' : 'hijo'} de ${padres}.`
        : `Joven de ${faccion.name} que empieza a hacerse un nombre${padres ? `; ${genero === 'F' ? 'hija' : 'hijo'} de ${padres}` : ''}.`,
      personality: base.personality,
      homeLocationSlug: base.homeLocationSlug,
      raza: faccion.raza,
      clase: base.clase,
      temperamento: base.temperamento,
      habilidadesRaciales: base.habilidadesRaciales ?? [],
      padreNpcId: padre && madre ? padre.id : null,
      madreNpcId: padre && madre ? madre.id : null,
    },
  });
  if (linaje) await unirALinaje(ctx.tx, { saveId: ctx.saveId, linajeId: linaje.id, entidadTipo: 'NPC', entidadId: npc.id, desdeMinutes: ctx.fictionalMinutes });
  else if (faccion.raza) {
    const apellido = apellidoDe(nombre, faccion.raza, faccion.name);
    if (apellido) {
      const l = await fundarLinaje(ctx.tx, { saveId: ctx.saveId, pueblo: faccion.raza, desdeMinutes: ctx.fictionalMinutes, random, nombre: apellido, soloNuevo: true });
      if (l) await unirALinaje(ctx.tx, { saveId: ctx.saveId, linajeId: l.id, entidadTipo: 'NPC', entidadId: npc.id, desdeMinutes: ctx.fictionalMinutes });
    }
  }
  const actores = [
    actorNpc(npc.id, 'AUTOR'), actorFaccion(faccion.slug, 'BENEFICIARIO'),
    ...(padre && madre ? [actorNpc(padre.id, 'AFECTADO'), actorNpc(madre.id, 'AFECTADO')] : []),
    ...(linaje ? [{ entidadTipo: 'LINAJE' as const, entidadId: linaje.id, papel: 'BENEFICIARIO' as const }] : []),
  ];
  const sucesoId = nace
    ? await registrar(ctx, { tipo: 'NACIMIENTO_NOTABLE', actores, datos: { nacido: nombre, genero, ...(padres ? { padres } : {}) } })
    : await registrar(ctx, { tipo: 'NPC_DESTACA', actores, datos: { npc: nombre, faccion: faccion.name, genero, ...(padres ? { padres } : {}) } });
  return { aplicado: true, sucesoId, id: npc.id };
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

/// Un NPC se lanza contra la jugadora: queda como combate pendiente (mismo camino que un viaje
/// interrumpido por un agresor). Sin suceso propio: el desenlace del combate registra el suyo.
async function forzarCombate(ctx: CtxEfecto, e: Extract<Efecto, { tipo: 'forzarCombate' }>): Promise<ResultadoEfecto> {
  const [npc, save] = await Promise.all([
    ctx.tx.npc.findFirst({ where: { id: e.npcId, worldId: ctx.worldId }, select: { slug: true } }),
    ctx.tx.save.findUnique({ where: { id: ctx.saveId }, select: { pendingCombatNpcSlugs: true, worldState: { select: { fictionalDateLabel: true } } } }),
  ]);
  const pendientes = Array.isArray(save?.pendingCombatNpcSlugs) ? (save.pendingCombatNpcSlugs as string[]) : [];
  if (!npc || !save || pendientes.includes(npc.slug)) return NO_APLICADO;
  await ctx.tx.save.update({ where: { id: ctx.saveId }, data: { pendingCombatNpcSlugs: [...pendientes, npc.slug] } });
  await ctx.tx.logEntry.create({
    data: { saveId: ctx.saveId, channel: 'CHARACTER', text: e.mensaje, timeLabel: save.worldState?.fictionalDateLabel ?? '', fictionalMinutes: ctx.fictionalMinutes, isSystemMessage: true },
  });
  return { aplicado: true, sucesoId: null };
}
