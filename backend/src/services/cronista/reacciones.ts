// Reacciones inmediatas (CR-10, hito 0.2 — roadmap-cronista.md § 7.1, contrato § 6.2). Datos, no
// lógica dispersa: cada reacción escucha unos tipos de suceso y, si su condición se cumple, aplica
// efectos de la lista cerrada (`efectos.ts`) o registra sucesos derivados.
//
// `registrarSuceso` deja cada suceso en cola (`Suceso.reaccionesPendientes`); `procesarReacciones`
// la vacía al final del turno, del día o de una acción — nunca dentro de la misma llamada. En
// anchura, con tope de `TOPE_NIVEL_CASCADA` niveles y `TOPE_SUCESOS_CASCADA` sucesos por llamada: lo
// que supere el tope pasa al día siguiente como consecuencia aplazada (`REACCION_APLAZADA`, CR-11).
//
// De la tabla de § 7.1 faltan (con su tarea): recuerdos y etiquetas tras una muerte o un perdón
// (Fase 4), `SUCESION_PENDIENTE`, `DEUDA_DE_VIDA` y `PROMESA_VENCE` (CR-11), la fauna que huye de
// una tormenta (necesita vecinos entre regiones), la hambruna de 3 días seguidos (necesita llevar la
// cuenta) y etiquetas/aprobación por sucesos del jugador (Fase 4). `GUERRA_DECLARADA` ya la registra
// `recordFactionEvent` al pasar a guerra.
import type { Prisma, PrismaClient } from '@prisma/client';
import { slugify } from '../../lib/slugify.js';
import { aplicarEfectos, CUALQUIERA_SALVO_ORIGEN, type CtxEfecto, type Efecto } from './efectos.js';
import { registrarSuceso, type NuevoSuceso } from './sucesos.js';
import { dispararPorSuceso } from './consecuencias.js';
import type { TipoSuceso } from './catalogoSucesos.js';

type Tx = Prisma.TransactionClient;

export const TOPE_NIVEL_CASCADA = 3;
export const TOPE_SUCESOS_CASCADA = 20;
/// Probabilidad de que una tormenta extrema dañe cada edificio activo del jugador en su región.
export const PROB_DANO_TORMENTA = 0.5;

export interface SucesoEnCola {
  id: string;
  tipo: string;
  saveId: string;
  fictionalMinutes: number;
  regionSlug: string | null;
  locationId?: string | null;
  nivelCascada: number;
  actores: { entidadTipo: string; entidadId: string; papel: string }[];
}

export interface CtxReaccion {
  tx: Tx;
  worldId: string;
  suceso: SucesoEnCola;
  random: () => number;
}

type SucesoDerivado = Omit<NuevoSuceso, 'saveId' | 'fictionalMinutes' | 'origen' | 'causas' | 'nivelCascada'>;

export interface Reaccion {
  id: string;
  escucha: TipoSuceso[];
  /// Menor = antes; orden estable.
  prioridad: number;
  condicion: (ctx: CtxReaccion) => Promise<boolean>;
  efectos?: (ctx: CtxReaccion) => Promise<Efecto[]>;
  registra?: (ctx: CtxReaccion) => Promise<SucesoDerivado[]>;
}

// ─────────────────────────── Auxiliares ───────────────────────────

const actor = (s: SucesoEnCola, entidadTipo: string, papel: string) => s.actores.find((a) => a.entidadTipo === entidadTipo && a.papel === papel)?.entidadId ?? null;

/// Facción viva de la partida a la que pertenece un NPC (por el nombre de su facción).
async function faccionDeNpc(ctx: CtxReaccion, npcId: string) {
  const npc = await ctx.tx.npc.findUnique({ where: { id: npcId }, select: { faction: true } });
  if (!npc?.faction) return null;
  return ctx.tx.faction.findFirst({ where: { saveId: ctx.suceso.saveId, name: npc.faction, origenSlug: { not: null }, disueltaEn: null } });
}

/// Facción viva de la partida que tiene a este NPC de líder.
async function faccionLideradaPor(ctx: CtxReaccion, npcId: string) {
  return ctx.tx.faction.findFirst({ where: { saveId: ctx.suceso.saveId, liderNpcId: npcId, disueltaEn: null } });
}

/// Testigo de la muerte que es de la facción de la víctima (el primero, si hay varios).
async function vengadorDe(ctx: CtxReaccion) {
  const victimaId = actor(ctx.suceso, 'NPC', 'VICTIMA');
  const testigos = ctx.suceso.actores.filter((a) => a.entidadTipo === 'NPC' && a.papel === 'TESTIGO').map((a) => a.entidadId);
  if (!victimaId || testigos.length === 0 || !actor(ctx.suceso, 'PERSONAJE', 'AUTOR')) return null;
  const victima = await ctx.tx.npc.findUnique({ where: { id: victimaId }, select: { faction: true } });
  if (!victima?.faction) return null;
  return ctx.tx.npc.findFirst({ where: { id: { in: testigos }, faction: victima.faction }, select: { id: true, name: true }, orderBy: { slug: 'asc' } });
}

const reinoDelJugador = (ctx: CtxReaccion) => ctx.tx.faction.findFirst({ where: { saveId: ctx.suceso.saveId, origenSlug: null } });

// ─────────────────────────── Reacciones ───────────────────────────

export const REACCIONES: Reaccion[] = [
  {
    id: 'MUERTE_CAUSADA_SUBE_PRESION',
    escucha: ['MUERTE_CAUSADA'],
    prioridad: 10,
    condicion: async (ctx) => {
      const victima = actor(ctx.suceso, 'NPC', 'VICTIMA');
      return !!actor(ctx.suceso, 'PERSONAJE', 'AUTOR') && !!victima && !!(await faccionDeNpc(ctx, victima)) && !!(await reinoDelJugador(ctx));
    },
    efectos: async (ctx) => {
      const [faccion, reino] = await Promise.all([faccionDeNpc(ctx, actor(ctx.suceso, 'NPC', 'VICTIMA')!), reinoDelJugador(ctx)]);
      return [{ tipo: 'cambiarPresion', origenSlug: faccion!.slug, destinoSlug: reino!.slug, evento: 'BAJA_DE_GUERRA' }];
    },
  },
  {
    id: 'LIDER_MUERE_ABRE_SUCESION',
    escucha: ['MUERTE_NPC', 'MUERTE_CAUSADA'],
    prioridad: 20,
    condicion: async (ctx) => {
      const victima = actor(ctx.suceso, 'NPC', 'VICTIMA');
      if (!victima || !(await faccionLideradaPor(ctx, victima))) return false;
      // Una muerte puede llegar por dos vías (MUERTE_CAUSADA y MUERTE_NPC): el líder muere una vez.
      const yaRegistrada = await ctx.tx.sucesoActor.count({ where: { entidadTipo: 'NPC', entidadId: victima, papel: 'VICTIMA', suceso: { saveId: ctx.suceso.saveId, tipo: 'MUERTE_LIDER' } } });
      return yaRegistrada === 0;
    },
    registra: async (ctx) => {
      const victimaId = actor(ctx.suceso, 'NPC', 'VICTIMA')!;
      const [faccion, npc] = await Promise.all([faccionLideradaPor(ctx, victimaId), ctx.tx.npc.findUniqueOrThrow({ where: { id: victimaId }, select: { name: true } })]);
      return [{
        tipo: 'MUERTE_LIDER',
        actores: [{ entidadTipo: 'NPC', entidadId: victimaId, papel: 'VICTIMA' }, { entidadTipo: 'FACCION', entidadId: faccion!.slug, papel: 'AFECTADO' }],
        datos: { lider: npc.name, faccion: faccion!.name },
      }];
    },
  },
  {
    id: 'MUERTE_LIDER_BAJA_COHESION',
    escucha: ['MUERTE_LIDER'],
    prioridad: 10,
    condicion: async (ctx) => !!actor(ctx.suceso, 'FACCION', 'AFECTADO'),
    efectos: async (ctx) => [{ tipo: 'cambiarCohesion', faccionSlug: actor(ctx.suceso, 'FACCION', 'AFECTADO')!, delta: -25 }],
  },
  {
    // CR-11: la sucesión se decide a los 1-3 días (regla SUCESION_PENDIENTE, por cohesión).
    id: 'MUERTE_LIDER_ABRE_SUCESION',
    escucha: ['MUERTE_LIDER'],
    prioridad: 20,
    condicion: async (ctx) => !!actor(ctx.suceso, 'FACCION', 'AFECTADO'),
    efectos: async (ctx) => [{
      tipo: 'programarConsecuencia', regla: 'SUCESION_PENDIENTE', disparo: { tipo: 'DIAS', min: 1, max: 3 },
      datos: { faccionSlug: actor(ctx.suceso, 'FACCION', 'AFECTADO')! },
    }],
  },
  {
    // CR-11: a los 2-6 días su gente huye a las regiones vecinas (regla REFUGIADOS).
    id: 'FACCION_CAE_REFUGIADOS',
    escucha: ['FACCION_CAE'],
    prioridad: 10,
    condicion: async (ctx) => !!actor(ctx.suceso, 'FACCION', 'VICTIMA'),
    efectos: async (ctx) => [{
      tipo: 'programarConsecuencia', regla: 'REFUGIADOS', disparo: { tipo: 'DIAS', min: 2, max: 6 },
      datos: { faccionSlug: actor(ctx.suceso, 'FACCION', 'VICTIMA')! },
    }],
  },
  {
    // CR-11: el perdonado volverá a agradecerlo en otra región (regla DEUDA_DE_VIDA). Solo NPC con
    // nombre: una plantilla no es nadie en concreto que pueda volver.
    id: 'PERDON_DEUDA_DE_VIDA',
    escucha: ['PERDON_CONCEDIDO'],
    prioridad: 10,
    condicion: async (ctx) => {
      const perdonado = actor(ctx.suceso, 'NPC', 'BENEFICIARIO');
      if (!perdonado || !actor(ctx.suceso, 'PERSONAJE', 'AUTOR')) return false;
      return (await ctx.tx.npc.count({ where: { id: perdonado, kind: 'PRINCIPAL' } })) > 0;
    },
    efectos: async (ctx) => {
      const perdonado = actor(ctx.suceso, 'NPC', 'BENEFICIARIO')!;
      const npc = await ctx.tx.npc.findUniqueOrThrow({ where: { id: perdonado }, select: { name: true } });
      const lugar = ctx.suceso.locationId
        ? await ctx.tx.location.findUnique({ where: { id: ctx.suceso.locationId }, select: { region: true } })
        : (await ctx.tx.save.findUnique({ where: { id: ctx.suceso.saveId }, select: { currentLocation: { select: { region: true } } } }))?.currentLocation;
      if (!lugar) return [];
      return [{
        tipo: 'programarConsecuencia', regla: 'DEUDA_DE_VIDA',
        disparo: { tipo: 'LLEGAR_REGION', regionSlug: CUALQUIERA_SALVO_ORIGEN, origenSlug: slugify(lugar.region), minDias: 3 },
        caducaDias: 20, npcId: perdonado, datos: { npcId: perdonado },
        aviso: `Algo te dice que volverás a ver a ${npc.name}.`,
      }];
    },
  },
  {
    // CR-11: como mucho un vengador, el testigo de la facción de la víctima (regla VENGANZA_PARIENTE).
    id: 'MUERTE_CAUSADA_VENGANZA',
    escucha: ['MUERTE_CAUSADA'],
    prioridad: 30,
    condicion: async (ctx) => !!(await vengadorDe(ctx)),
    efectos: async (ctx) => {
      const vengador = (await vengadorDe(ctx))!;
      return [{
        tipo: 'programarConsecuencia', regla: 'VENGANZA_PARIENTE', disparo: { tipo: 'DIAS', min: 5, max: 15 },
        caducaDias: 30, npcId: vengador.id, datos: { vengadorId: vengador.id, victimaId: actor(ctx.suceso, 'NPC', 'VICTIMA')! },
        aviso: `${vengador.name} lo ha visto todo, y no lo va a olvidar.`,
      }];
    },
  },
  {
    id: 'SIN_TERRITORIOS_CAE',
    escucha: ['TERRITORIO_CONQUISTADO'],
    prioridad: 10,
    condicion: async (ctx) => {
      const perdedora = actor(ctx.suceso, 'FACCION', 'VICTIMA');
      if (!perdedora) return false;
      const faccion = await ctx.tx.faction.findFirst({ where: { saveId: ctx.suceso.saveId, slug: perdedora, disueltaEn: null, origenSlug: { not: null } }, select: { id: true } });
      return !!faccion && (await ctx.tx.territory.count({ where: { factionId: faccion.id } })) === 0;
    },
    efectos: async (ctx) => [{ tipo: 'disolverFaccion', faccionSlug: actor(ctx.suceso, 'FACCION', 'VICTIMA')! }],
  },
  {
    id: 'TORMENTA_DANA_EDIFICIOS',
    escucha: ['TORMENTA_EXTREMA'],
    prioridad: 10,
    condicion: async (ctx) => !!ctx.suceso.regionSlug,
    efectos: async (ctx) => {
      const edificios = await ctx.tx.building.findMany({
        where: { saveId: ctx.suceso.saveId, status: 'ACTIVO', location: { isNot: null } },
        select: { id: true, location: { select: { region: true } } },
      });
      return edificios
        .filter((b) => b.location && slugify(b.location.region) === ctx.suceso.regionSlug)
        .filter(() => ctx.random() < PROB_DANO_TORMENTA)
        .map((b) => ({ tipo: 'danarEdificio' as const, buildingId: b.id, causa: 'una tormenta' }));
    },
  },
];

// ─────────────────────────── Cola ───────────────────────────

/// Aplica una reacción a un suceso: sus efectos y los sucesos que registra, un nivel de cascada más abajo.
export async function ejecutarReaccion(tx: Tx, worldId: string, suceso: SucesoEnCola, r: Reaccion, random: () => number): Promise<void> {
  const ctx: CtxReaccion = { tx, worldId, suceso, random };
  const ctxEfecto: CtxEfecto = {
    tx, saveId: suceso.saveId, worldId, fictionalMinutes: suceso.fictionalMinutes, origen: 'MOTOR',
    causas: [suceso.id], nivelCascada: suceso.nivelCascada + 1, random,
  };
  if (r.efectos) await aplicarEfectos(ctxEfecto, await r.efectos(ctx));
  for (const d of (await r.registra?.(ctx)) ?? []) {
    await registrarSuceso(tx, { ...d, saveId: suceso.saveId, fictionalMinutes: suceso.fictionalMinutes, origen: 'MOTOR', causas: [suceso.id], nivelCascada: suceso.nivelCascada + 1 } as NuevoSuceso);
  }
}

/// Vacía la cola de reacciones de la partida. Devuelve cuántos sucesos reaccionaron.
export async function procesarReacciones(prisma: PrismaClient, saveId: string, random: () => number = Math.random, reacciones: Reaccion[] = REACCIONES): Promise<{ procesados: number; aplazados: number }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return { procesados: 0, aplazados: 0 };
  const ordenadas = [...reacciones].sort((a, b) => a.prioridad - b.prioridad);
  let procesados = 0;
  let aplazados = 0;

  for (;;) {
    const pendientes = await prisma.suceso.findMany({
      where: { saveId, reaccionesPendientes: true },
      orderBy: [{ nivelCascada: 'asc' }, { createdAt: 'asc' }],
      take: 50,
      select: { id: true, tipo: true, saveId: true, fictionalMinutes: true, regionSlug: true, locationId: true, nivelCascada: true, actores: true },
    });
    if (pendientes.length === 0) break;

    for (const suceso of pendientes) {
      await prisma.$transaction(async (tx) => {
        // Reclamo atómico: otra llamada simultánea no lo procesa dos veces.
        const claim = await tx.suceso.updateMany({ where: { id: suceso.id, reaccionesPendientes: true }, data: { reaccionesPendientes: false } });
        if (claim.count === 0) return;
        const ctx: CtxReaccion = { tx, worldId: save.worldId, suceso, random };
        const aplican: Reaccion[] = [];
        for (const r of ordenadas) if (r.escucha.includes(suceso.tipo as TipoSuceso) && (await r.condicion(ctx))) aplican.push(r);
        // CR-11: consecuencias que esperaban a un suceso de este tipo.
        await dispararPorSuceso(tx, save.worldId, suceso, random);
        if (aplican.length === 0) return;

        if (suceso.nivelCascada >= TOPE_NIVEL_CASCADA || procesados >= TOPE_SUCESOS_CASCADA) {
          // Pasa del tope: se ejecutará al día siguiente (CR-11).
          const ctxEfecto: CtxEfecto = { tx, saveId, worldId: save.worldId, fictionalMinutes: suceso.fictionalMinutes, origen: 'MOTOR', causas: [suceso.id], random };
          await aplicarEfectos(ctxEfecto, aplican.map((r) => ({
            tipo: 'programarConsecuencia' as const, regla: 'REACCION_APLAZADA', disparo: { tipo: 'DIAS' as const, min: 1, max: 1 }, datos: { sucesoId: suceso.id, reaccionId: r.id },
          })));
          aplazados += aplican.length;
          return;
        }

        procesados++;
        for (const r of aplican) await ejecutarReaccion(tx, save.worldId, suceso, r, random);
      });
    }
  }
  return { procesados, aplazados };
}
