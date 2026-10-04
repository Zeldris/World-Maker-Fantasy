// Narrador de fondo (CR-12, hito 0.2 — roadmap-cronista.md § 7.3). Una vez por día de ficción y
// partida (`avanceDiario.ts`) mira qué podría pasar en el mundo sin que la jugadora haga nada y elige
// como mucho un suceso, sin IA:
//
// 1. **Presupuesto de tensión** (`WorldState.presupuestoTension`): crece cada día según el ritmo del
//    mundo (`estiloNarrador`, elegido en Configuración) hasta `TOPE_PRESUPUESTO`. Cada suceso cuesta
//    su importancia base del catálogo.
// 2. **Día de mucha actividad** (`ACTIVIDAD_ALTA` sucesos o más con la jugadora como autora): no hay
//    suceso de fondo, para no ahogarla (el presupuesto se guarda igual).
// 3. **Candidatos:** cada entrada de `SUCESOS_DE_FONDO` propone instancias concretas con su peso
//    (qué par de facciones, qué especie, qué edificio…); las que están en enfriamiento (el mismo
//    tipo de fondo hace menos de `enfriamientoDias`) o no caben en el presupuesto se descartan.
// 4. **Elección por peso** con el azar dado (semilla en tests) y **aplicación**: registra el suceso
//    (origen `MUNDO`) y aplica sus efectos de la lista cerrada con él como causa.
// 5. **Noticia:** al canal «El mundo» según dónde pase (`noticias.ts`): al momento en su región o
//    de una facción aliada; como rumor y días después si pasa lejos o es de una facción que conoce.
//
// 6. **Oportunidad** (12d): escaramuza, caravana, incendio y crecida abren algo que hacer con plazo
//    (`oportunidades.ts`) y su pista va en la noticia.
//
// Pendiente: favorecer hilos abiertos (CR-17) y árbitro con IA (Fase 7).
import type { Prisma, PrismaClient } from '@prisma/client';
import { stripRegionArticle } from '../population.js';
import { slugify } from '../../lib/slugify.js';
import { CATALOGO_SUCESOS, type DatosSuceso, type TipoSuceso } from './catalogoSucesos.js';
import { aplicarEfectos, type CtxEfecto, type Efecto } from './efectos.js';
import { REGIONES_VECINAS } from './regiones.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';
import { categoriaDeFamilia, darNoticia } from './noticias.js';
import { abrirCampoDeBatalla, abrirCaravana, abrirEncargo, type CtxOportunidad, type OportunidadAbierta } from './oportunidades.js';
import { ownerKeyFor } from '../reinoOwner.js';

type Tx = Prisma.TransactionClient;

export type EstiloNarrador = 'TRANQUILO' | 'EQUILIBRADO' | 'CAOTICO';
export const ESTILOS_NARRADOR: EstiloNarrador[] = ['TRANQUILO', 'EQUILIBRADO', 'CAOTICO'];

/// Presupuesto que gana cada día según el ritmo del mundo.
export const RITMO_DIARIO: Record<EstiloNarrador, number> = { TRANQUILO: 1, EQUILIBRADO: 3, CAOTICO: 5 };
/// Lo más que se puede acumular: tras muchos días tranquilos no llega una avalancha.
export const TOPE_PRESUPUESTO = 10;
/// Sucesos de la jugadora en un día a partir de los cuales ese día no hay suceso de fondo.
export const ACTIVIDAD_ALTA = 3;

export function esEstiloNarrador(v: unknown): v is EstiloNarrador {
  return typeof v === 'string' && (ESTILOS_NARRADOR as string[]).includes(v);
}

/// Una posibilidad concreta de un suceso de fondo.
export interface Instancia {
  peso: number;
  /// Suceso que registra el narrador. Sin él, el suceso lo registra el primer efecto (p. ej.
  /// `absorberFaccion` registra `FACCION_ABSORBIDA`).
  suceso?: { datos: DatosSuceso[TipoSuceso]; actores: ActorSuceso[]; regionSlug?: string | null; locationId?: string | null };
  efectos: Efecto[];
  /// CR-12 (12d): oportunidad con plazo que abre (campo de batalla, caravana, encargo); su pista se
  /// añade a la noticia. Null si no se pudo abrir.
  oportunidad?: (ctx: CtxOportunidad) => Promise<OportunidadAbierta | null>;
  /// Para decidir a quién llega la noticia (nombres de facción y `Location.region`).
  noticia: { facciones: string[]; region: string | null };
}

export interface CtxNarrador {
  tx: Tx;
  saveId: string;
  worldId: string;
}

export interface SucesoDeFondo {
  tipo: TipoSuceso;
  enfriamientoDias: number;
  candidatos: (ctx: CtxNarrador) => Promise<Instancia[]>;
}

const actorFaccion = (slug: string, papel: ActorSuceso['papel']): ActorSuceso => ({ entidadTipo: 'FACCION', entidadId: slug, papel });
/// Las regiones van en el Libro por su slug, como en el resto del Cronista.
const actorRegion = (region: string, papel: ActorSuceso['papel']): ActorSuceso => ({ entidadTipo: 'REGION', entidadId: slugify(region), papel });

/// Facciones vivas del mundo de la partida (copias y nacidas en ella; nunca el Reino de la jugadora).
const faccionesVivas = { origenSlug: { not: null }, disueltaEn: null } as const;

async function relacionesDe(ctx: CtxNarrador, tipos: ('TENSION' | 'GUERRA' | 'ALIANZA' | 'TRATADO_COMERCIAL')[]) {
  const sel = { slug: true, name: true, cohesion: true } as const;
  return ctx.tx.factionRelation.findMany({
    where: { saveId: ctx.saveId, type: { in: tipos }, sourceFaction: faccionesVivas, targetFaction: faccionesVivas },
    select: { type: true, sourceFaction: { select: sel }, targetFaction: { select: sel } },
    orderBy: { id: 'asc' },
  });
}

/// Fauna de la partida (todo lo que no es raza) con su peso por región.
async function faunaDePartida(ctx: CtxNarrador) {
  const filas = await ctx.tx.worldPopulation.findMany({
    where: { saveId: ctx.saveId, targetType: { not: 'RAZA' } },
    select: { targetSlug: true, label: true, poblacion: true, poblacionMax: true, distribucion: true },
    orderBy: { targetSlug: 'asc' },
  });
  return filas.map((f) => {
    const dist = (f.distribucion as Record<string, number> | null) ?? {};
    // Regiones con nombre completo (el de `Location.region`) en las que la especie tiene peso, y qué
    // parte de la especie vive en cada una.
    const pesos = Object.keys(REGIONES_VECINAS).map((region) => ({ region, peso: dist[stripRegionArticle(region)] ?? 0 })).filter((r) => r.peso > 0);
    const total = pesos.reduce((s, r) => s + r.peso, 0);
    return { ...f, regiones: pesos.map((r) => ({ region: r.region, parte: r.peso / total })) };
  });
}

async function edificiosDeFacciones(ctx: CtxNarrador, region?: string) {
  return ctx.tx.building.findMany({
    where: { status: 'ACTIVO', faction: { saveId: ctx.saveId, ...faccionesVivas }, location: region ? { region } : { isNot: null } },
    select: { id: true, name: true, faction: { select: { slug: true, name: true } }, location: { select: { id: true, name: true, region: true } } },
    orderBy: { id: 'asc' },
  });
}

/// Incendio o crecida en un lugar con un edificio de facción: lo daña.
function desastre(tipo: 'INCENDIO' | 'CRECIDA', causa: string, region?: string): SucesoDeFondo['candidatos'] {
  return async (ctx) =>
    (await edificiosDeFacciones(ctx, region)).map((b) => ({
      peso: 1,
      suceso: {
        datos: { lugar: b.location!.name },
        actores: [{ entidadTipo: 'LOCATION', entidadId: b.location!.id, papel: 'LUGAR' }, actorFaccion(b.faction!.slug, 'AFECTADO')],
        locationId: b.location!.id,
        regionSlug: null,
      },
      efectos: [{ tipo: 'danarEdificio', buildingId: b.id, causa }],
      oportunidad: (o: CtxOportunidad) => abrirEncargo(o, b.faction!.name, b.id, b.location!.id, b.location!.name),
      noticia: { facciones: [b.faction!.name], region: b.location!.region },
    }));
}

/// Catálogo inicial (decidido con la usuaria, 2026-10-04). Todo con efectos que ya existen.
export const SUCESOS_DE_FONDO: SucesoDeFondo[] = [
  {
    // Facciones en tensión o guerra llegan a las manos: sube la presión.
    tipo: 'ESCARAMUZA',
    enfriamientoDias: 2,
    candidatos: async (ctx) =>
      (await relacionesDe(ctx, ['TENSION', 'GUERRA'])).map((r) => ({
        peso: r.type === 'GUERRA' ? 3 : 1,
        suceso: {
          datos: { faccionA: r.sourceFaction.name, faccionB: r.targetFaction.name },
          actores: [actorFaccion(r.sourceFaction.slug, 'AUTOR'), actorFaccion(r.targetFaction.slug, 'VICTIMA')],
        },
        efectos: [{ tipo: 'cambiarPresion', origenSlug: r.sourceFaction.slug, destinoSlug: r.targetFaction.slug, evento: 'BAJA_DE_GUERRA' }],
        oportunidad: (o: CtxOportunidad) => abrirCampoDeBatalla(o, r.sourceFaction.name, r.targetFaction.name),
        noticia: { facciones: [r.sourceFaction.name, r.targetFaction.name], region: null },
      })),
  },
  {
    // Facciones con tratado o alianza comercian: riqueza para las dos y algo de distensión.
    tipo: 'CARAVANA',
    enfriamientoDias: 3,
    candidatos: async (ctx) =>
      (await relacionesDe(ctx, ['ALIANZA', 'TRATADO_COMERCIAL'])).map((r) => ({
        peso: 1,
        suceso: {
          datos: { desde: r.sourceFaction.name, hacia: r.targetFaction.name },
          actores: [actorFaccion(r.sourceFaction.slug, 'BENEFICIARIO'), actorFaccion(r.targetFaction.slug, 'BENEFICIARIO')],
        },
        efectos: [
          { tipo: 'cambiarPresion', origenSlug: r.sourceFaction.slug, destinoSlug: r.targetFaction.slug, evento: 'TRATADO_CUMPLIDO' },
          { tipo: 'ajustarReino', faccionSlug: r.sourceFaction.slug, riqueza: 5 },
          { tipo: 'ajustarReino', faccionSlug: r.targetFaction.slug, riqueza: 5 },
        ],
        oportunidad: (o: CtxOportunidad) => abrirCaravana(o, r.sourceFaction.name, r.targetFaction.name),
        noticia: { facciones: [r.sourceFaction.name, r.targetFaction.name], region: null },
      })),
  },
  {
    // Una plaga se ceba con una especie en una de sus regiones: pierde un quinto de lo que vive allí
    // (la población es de la especie entera; se resta la parte de esa región según su peso). Cada
    // especie pesa 1 en total, repartido entre sus regiones.
    tipo: 'PLAGA',
    enfriamientoDias: 6,
    candidatos: async (ctx) =>
      (await faunaDePartida(ctx))
        .filter((f) => f.poblacion >= 10)
        .flatMap((f) =>
          f.regiones.map(({ region, parte }) => ({
            peso: parte,
            suceso: { datos: { region, afecta: f.label }, actores: [actorRegion(region, 'LUGAR')], regionSlug: slugify(region) },
            efectos: [{ tipo: 'ajustarPoblacion' as const, targetSlug: f.targetSlug, delta: -Math.max(1, Math.round(f.poblacion * parte * 0.2)), region, sinSuceso: true }],
            noticia: { facciones: [], region },
          })),
        ),
  },
  {
    // Una especie lejos de su techo prolifera en una de sus regiones (+15 % de lo que vive allí).
    tipo: 'AUGE_POBLACION',
    enfriamientoDias: 4,
    candidatos: async (ctx) =>
      (await faunaDePartida(ctx))
        .filter((f) => f.poblacion < f.poblacionMax * 0.8)
        .flatMap((f) =>
          f.regiones.map(({ region, parte }) => ({
            peso: parte,
            suceso: { datos: { especie: f.label, region }, actores: [actorRegion(region, 'LUGAR')], regionSlug: slugify(region) },
            efectos: [{ tipo: 'ajustarPoblacion' as const, targetSlug: f.targetSlug, delta: Math.max(1, Math.round(f.poblacion * parte * 0.15)), region, sinSuceso: true }],
            noticia: { facciones: [], region },
          })),
        ),
  },
  {
    // Parte de una especie se va a una región vecina.
    tipo: 'MIGRACION_FAUNA',
    enfriamientoDias: 4,
    candidatos: async (ctx) =>
      (await faunaDePartida(ctx)).flatMap((f) =>
        f.regiones.flatMap(({ region: desde, parte }) =>
          REGIONES_VECINAS[desde]!.map((hacia) => ({
            peso: parte / REGIONES_VECINAS[desde]!.length,
            suceso: {
              datos: { especie: f.label, desde, hacia },
              actores: [actorRegion(desde, 'AFECTADO'), actorRegion(hacia, 'BENEFICIARIO')],
              regionSlug: slugify(desde),
            },
            efectos: [{ tipo: 'moverPoblacion' as const, targetSlug: f.targetSlug, desde, hacia, fraccion: 0.3, sinSuceso: true }],
            // La noticia va por la región de destino, que es donde se nota.
            noticia: { facciones: [], region: hacia },
          })),
        ),
      ),
  },
  { tipo: 'INCENDIO', enfriamientoDias: 5, candidatos: desastre('INCENDIO', 'incendio') },
  // Las crecidas, solo donde hay agua de sobra.
  { tipo: 'CRECIDA', enfriamientoDias: 5, candidatos: desastre('CRECIDA', 'crecida', 'Ciénaga Troncal') },
  {
    // En una facción con poca cohesión el descontento crece.
    tipo: 'MALESTAR_INTERNO',
    enfriamientoDias: 3,
    candidatos: async (ctx) =>
      (await ctx.tx.faction.findMany({ where: { saveId: ctx.saveId, ...faccionesVivas, cohesion: { lt: 40 } }, select: { slug: true, name: true, cohesion: true }, orderBy: { slug: 'asc' } })).map((f) => ({
        peso: 1 + Math.floor((40 - f.cohesion) / 10),
        suceso: { datos: { faccion: f.name }, actores: [actorFaccion(f.slug, 'AFECTADO')] },
        efectos: [{ tipo: 'cambiarCohesion' as const, faccionSlug: f.slug, delta: -5 }],
        noticia: { facciones: [f.name], region: null },
      })),
  },
  {
    // Alguien de renombre visita el Reino de la jugadora: sube la felicidad.
    tipo: 'VISITANTE_ILUSTRE',
    enfriamientoDias: 7,
    candidatos: async (ctx) => {
      const [reino, stats] = await Promise.all([
        ctx.tx.faction.findFirst({ where: { saveId: ctx.saveId, origenSlug: null }, select: { slug: true, name: true } }),
        ctx.tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId: ctx.saveId }) }, select: { id: true } }),
      ]);
      if (!reino || !stats) return [];
      const lideres = await ctx.tx.faction.findMany({
        where: { saveId: ctx.saveId, ...faccionesVivas, liderNpcId: { not: null } },
        select: { name: true, liderNpc: { select: { id: true, name: true } } },
        orderBy: { slug: 'asc' },
      });
      return lideres.map((l) => ({
        peso: 1,
        suceso: {
          datos: { reino: reino.name, visitante: `${l.liderNpc!.name}, de ${l.name}` },
          actores: [actorFaccion(reino.slug, 'BENEFICIARIO'), { entidadTipo: 'NPC' as const, entidadId: l.liderNpc!.id, papel: 'AUTOR' as const }],
        },
        efectos: [{ tipo: 'ajustarReino' as const, felicidad: 5 }],
        noticia: { facciones: [reino.name], region: null },
      }));
    },
  },
  {
    // Una facción débil aliada con una fuerte acaba absorbida por ella (regla de facción, § 7.3).
    tipo: 'FACCION_ABSORBIDA',
    enfriamientoDias: 10,
    candidatos: async (ctx) =>
      (await relacionesDe(ctx, ['ALIANZA']))
        .filter((r) => r.sourceFaction.cohesion < 30 && r.targetFaction.cohesion >= 60)
        .map((r) => ({
          peso: 1,
          efectos: [{ tipo: 'absorberFaccion' as const, faccionSlug: r.sourceFaction.slug, absorbenteSlug: r.targetFaction.slug }],
          noticia: { facciones: [r.sourceFaction.name, r.targetFaction.name], region: null },
        })),
  },
];

/// Coste de un suceso de fondo: su importancia base.
export function costeDe(tipo: TipoSuceso): number {
  return CATALOGO_SUCESOS[tipo].importanciaBase;
}

/// Elige por peso (`random` en [0, 1)). Null si no hay nada.
export function elegirPorPeso<T extends { peso: number }>(opciones: T[], random: () => number): T | null {
  const total = opciones.reduce((s, o) => s + Math.max(0, o.peso), 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const o of opciones) {
    r -= Math.max(0, o.peso);
    if (r < 0) return o;
  }
  return opciones[opciones.length - 1]!;
}

export interface ResultadoNarrador {
  sucesoId: string | null;
  tipo: TipoSuceso | null;
  presupuesto: number;
  motivo?: 'actividad' | 'sin-candidatos';
}

/// Narra el día `dia` de la partida: como mucho un suceso de fondo.
export async function narrarDia(
  prisma: PrismaClient,
  saveId: string,
  dia: number,
  random: () => number = Math.random,
  catalogo: SucesoDeFondo[] = SUCESOS_DE_FONDO,
): Promise<ResultadoNarrador> {
  return prisma.$transaction(
    async (tx) => {
      const save = await tx.save.findUniqueOrThrow({
        where: { id: saveId },
        select: { worldId: true, worldState: { select: { fictionalMinutes: true, presupuestoTension: true, estiloNarrador: true } } },
      });
      const ws = save.worldState!;
      const estilo = esEstiloNarrador(ws.estiloNarrador) ? ws.estiloNarrador : 'EQUILIBRADO';
      let presupuesto = Math.min(TOPE_PRESUPUESTO, ws.presupuestoTension + RITMO_DIARIO[estilo]);
      const guardar = () => tx.worldState.update({ where: { saveId }, data: { presupuestoTension: presupuesto } });

      const inicioDia = dia * 1440;
      const actividad = await tx.suceso.count({
        where: { saveId, fictionalMinutes: { gte: inicioDia, lt: inicioDia + 1440 }, actores: { some: { entidadTipo: 'PERSONAJE', papel: 'AUTOR' } } },
      });
      if (actividad >= ACTIVIDAD_ALTA) {
        await guardar();
        return { sucesoId: null, tipo: null, presupuesto, motivo: 'actividad' };
      }

      const ctx: CtxNarrador = { tx, saveId, worldId: save.worldId };
      const opciones: { tipo: TipoSuceso; instancia: Instancia; peso: number }[] = [];
      for (const s of catalogo) {
        if (costeDe(s.tipo) > presupuesto) continue;
        const reciente = await tx.suceso.count({ where: { saveId, tipo: s.tipo, origen: 'MUNDO', fictionalMinutes: { gte: inicioDia - (s.enfriamientoDias - 1) * 1440 } } });
        if (reciente > 0) continue;
        for (const instancia of await s.candidatos(ctx)) opciones.push({ tipo: s.tipo, instancia, peso: instancia.peso });
      }
      const elegida = elegirPorPeso(opciones, random);
      if (!elegida) {
        await guardar();
        return { sucesoId: null, tipo: null, presupuesto, motivo: 'sin-candidatos' };
      }

      // Al mediodía de ese día, pero nunca por delante del reloj de la partida.
      const minutos = Math.min(inicioDia + 720, ws.fictionalMinutes);
      const { suceso } = elegida.instancia;
      const sucesoPropio = suceso
        ? await registrarSuceso(tx, { saveId, tipo: elegida.tipo, fictionalMinutes: minutos, origen: 'MUNDO', ...suceso } as Parameters<typeof registrarSuceso>[1])
        : null;
      const ctxEfecto: CtxEfecto = { tx, saveId, worldId: save.worldId, fictionalMinutes: minutos, origen: 'MUNDO', causas: sucesoPropio ? [sucesoPropio] : [], random };
      const resultados = await aplicarEfectos(ctxEfecto, elegida.instancia.efectos);
      const sucesoId = sucesoPropio ?? resultados.find((r) => r.sucesoId)?.sucesoId ?? null;
      if (!sucesoId) {
        await guardar();
        return { sucesoId: null, tipo: null, presupuesto, motivo: 'sin-candidatos' };
      }

      presupuesto -= costeDe(elegida.tipo);
      await guardar();
      const { texto } = await tx.suceso.findUniqueOrThrow({ where: { id: sucesoId }, select: { texto: true } });
      const oportunidad = elegida.instancia.oportunidad
        ? await elegida.instancia.oportunidad({ tx, saveId, worldId: save.worldId, fictionalMinutes: minutos, random, causa: sucesoId })
        : null;
      await darNoticia(tx, { saveId, worldId: save.worldId, fictionalMinutes: minutos, causa: sucesoId }, {
        ...elegida.instancia.noticia,
        texto: oportunidad ? `${texto} ${oportunidad.pista}` : texto,
        categoria: categoriaDeFamilia(CATALOGO_SUCESOS[elegida.tipo].familia),
        ...(oportunidad ? { oportunidad: { lugar: oportunidad.lugar, locationId: oportunidad.locationId, venceEn: oportunidad.venceEn } } : {}),
      });
      return { sucesoId, tipo: elegida.tipo, presupuesto };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
