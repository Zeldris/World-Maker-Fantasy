// Reglas de consecuencias aplazadas del juego (CR-11, hito 0.2 — roadmap-cronista.md § 7.2 y las
// decisiones de la entrevista de CR-11). Las registra `consecuencias.ts` al cargarse. Sin importar
// `consecuencias.ts` desde aquí (evita el ciclo de módulos).
import type { Faction, Prisma } from '@prisma/client';
import { slugify } from '../../lib/slugify.js';
import { npcVivoEnPartida } from '../mundoPartida.js';
import { populationTargetSlugFor } from '../population.js';
import { REGION_OWNING_FACTIONS } from '../reputation.js';
import type { Efecto } from './efectos.js';
import { nombreDeEscision } from './nombresFaccion.js';
import { NOTICIA } from './noticias.js';
import { edadEnAnios, esAdulto, nacidoEnDe } from './edades.js';
import { REGLAS_OPORTUNIDADES } from './oportunidades.js';
import { regionesVecinas } from './regiones.js';
import { CELL_SIZE_PX, LIENZO_ANCHO } from '../zonaPosicion.js';
import type { CtxConsecuencia, ReglaConsecuencia } from './consecuencias.js';

type Tx = Prisma.TransactionClient;

/// § 7.3: por debajo cae, en medio se escinde, por encima sucesión normal.
export const COHESION_CAIDA = 20;
export const COHESION_ESCISION = 50;
/// Parte de la gente que se lleva la facción escindida.
export const FRACCION_ESCISION = 0.3;
/// Parte del peso regional de su raza que huye a las regiones vecinas cuando cae una facción.
export const FRACCION_REFUGIADOS = 0.5;

const inteligencia = (attributes: unknown) => Number((attributes as { inteligencia?: number } | null)?.inteligencia ?? 0);

/// NPC con nombre de la facción, vivos en la partida (ni muertos fuera de escena ni a manos del
/// jugador), sin el líder actual: el heredero designado primero y después por Inteligencia.
export async function candidatosALider(tx: Tx, saveId: string, worldId: string, faccion: Faction) {
  const npcs = await tx.npc.findMany({
    where: {
      worldId, faction: faccion.name, kind: 'PRINCIPAL',
      ...(faccion.liderNpcId ? { id: { not: faccion.liderNpcId } } : {}),
      // Ojo: `npcVivoEnPartida` ya trae su propio NOT; dos NOT en el mismo objeto se pisan.
      AND: [npcVivoEnPartida(saveId), { NOT: { npcStates: { some: { saveId, condicionFisica: 'MUERTO' } } } }],
    },
    select: { id: true, name: true, attributes: true, slug: true, raza: true, nacidoEn: true, npcStates: { where: { saveId, cargo: 'heredero', lealtadFaccionId: faccion.id }, select: { id: true } } },
  });
  // CR-13 13b: solo adultos pueden liderar o heredar.
  const ahora = (await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? 0;
  return npcs
    .filter((n) => esAdulto(n.raza, edadEnAnios(nacidoEnDe(n), ahora)))
    .sort((a, b) => (b.npcStates.length - a.npcStates.length) || inteligencia(b.attributes) - inteligencia(a.attributes) || a.id.localeCompare(b.id));
}

const SUCESION_PENDIENTE: ReglaConsecuencia = {
  id: 'SUCESION_PENDIENTE',
  alDisparar: async (ctx: CtxConsecuencia): Promise<Efecto[] | null> => {
    const { faccionSlug } = ctx.consecuencia.datos as { faccionSlug: string };
    const faccion = await ctx.tx.faction.findFirst({ where: { saveId: ctx.saveId, slug: faccionSlug, disueltaEn: null } });
    if (!faccion) return null;
    const candidatos = await candidatosALider(ctx.tx, ctx.saveId, ctx.worldId, faccion);
    if (faccion.cohesion < COHESION_CAIDA || candidatos.length === 0) return [{ tipo: 'disolverFaccion', faccionSlug }];
    const sucesion: Efecto = { tipo: 'cambiarLider', faccionSlug, npcId: candidatos[0]!.id };
    if (faccion.cohesion > COHESION_ESCISION || candidatos.length < 2) return [sucesion];

    const usados = new Set((await ctx.tx.faction.findMany({ where: { saveId: ctx.saveId }, select: { name: true } })).map((f) => f.name));
    const nombre = nombreDeEscision(faccion.raza, candidatos[1]!.name, usados);
    if (!nombre) return [sucesion];
    return [
      sucesion,
      {
        tipo: 'crearFaccion',
        slug: slugify(nombre.nombre),
        nombre: nombre.nombre,
        raza: faccion.raza,
        descripcion: `Escindida de ${faccion.name} tras la muerte de su líder (${nombre.traduccion}).`,
        escindidaDe: faccionSlug,
        liderNpcId: candidatos[1]!.id,
        fraccionPoblacion: FRACCION_ESCISION,
      },
    ];
  },
};

const CAMPOS_FACCION = ['poblacion', 'soldados', 'trabajadores', 'visitantes'];

const REFUGIADOS: ReglaConsecuencia = {
  id: 'REFUGIADOS',
  alDisparar: async (ctx: CtxConsecuencia): Promise<Efecto[] | null> => {
    const { faccionSlug } = ctx.consecuencia.datos as { faccionSlug: string };
    const faccion = await ctx.tx.faction.findFirst({ where: { saveId: ctx.saveId, slug: faccionSlug } });
    if (!faccion) return null;
    const efectos: Efecto[] = [];
    // Su gente se dispersa por las regiones vecinas de las que eran suyas, a partes iguales.
    for (const [region, duenas] of Object.entries(REGION_OWNING_FACTIONS)) {
      if (!duenas.includes(faccion.name)) continue;
      const targetSlug = populationTargetSlugFor(faccion.raza, faccion.slug, region);
      const vecinas = regionesVecinas(region);
      if (!targetSlug || vecinas.length === 0) continue;
      const porVecina = FRACCION_REFUGIADOS / vecinas.length;
      vecinas.forEach((hacia, i) => {
        efectos.push({ tipo: 'moverPoblacion', targetSlug, desde: region, hacia, fraccion: porVecina / (1 - i * porVecina), sinSuceso: true });
      });
    }
    // La facción como tal deja de tener gente. Sin sucesos propios (no son fauna que migra ni un
    // declive natural): lo cuenta `FACCION_CAE`.
    for (const campo of CAMPOS_FACCION) efectos.push({ tipo: 'ajustarPoblacion', targetSlug: `${faccionSlug}-${campo}`, delta: -1_000_000, sinSuceso: true });
    return efectos;
  },
};

// ─────────────────────────── Deuda de vida ───────────────────────────

/// NPC vivo en la partida (ni muerto fuera de escena, ni a manos del jugador, ni de mundo).
async function npcVivo(tx: Tx, saveId: string, npcId: string) {
  return tx.npc.findFirst({
    where: { id: npcId, AND: [npcVivoEnPartida(saveId), { NOT: { npcStates: { some: { saveId, condicionFisica: 'MUERTO' } } } }] },
    select: { id: true, slug: true, name: true, temperamento: true },
  });
}

/// Al llegar a otra región (3-20 días después del perdón), el perdonado aparece junto a la jugadora
/// como punto de NPC; al cruzarse con él (ENCUENTRO_NPC) llega el regalo. Si murió o es enemigo, se
/// pierde.
const DEUDA_DE_VIDA: ReglaConsecuencia = {
  id: 'DEUDA_DE_VIDA',
  alDisparar: async (ctx) => {
    const { npcId } = ctx.consecuencia.datos as { npcId: string };
    const [npc, save] = await Promise.all([
      npcVivo(ctx.tx, ctx.saveId, npcId),
      ctx.tx.save.findUnique({ where: { id: ctx.saveId }, select: { currentLocationId: true, zonaPosX: true, zonaPosY: true } }),
    ]);
    if (!npc || npc.temperamento === 'ENEMIGO' || !save?.currentLocationId) return null;
    // Una celda a su derecha (o a la izquierda si no cabe).
    const x0 = save.zonaPosX ?? 400;
    const x = x0 + CELL_SIZE_PX <= LIENZO_ANCHO ? x0 + CELL_SIZE_PX : x0 - CELL_SIZE_PX;
    return [
      { tipo: 'crearPuntoZona', locationId: save.currentLocationId, puntoTipo: 'NPC', targetSlug: npc.slug, x, y: save.zonaPosY ?? 300, label: npc.name },
      {
        tipo: 'programarConsecuencia', regla: 'DEUDA_DE_VIDA_REGALO', disparo: { tipo: 'ENCUENTRO_NPC', npcId: npc.id },
        caducaDias: 2, npcId: npc.id, datos: { npcId: npc.id, locationId: save.currentLocationId },
      },
    ];
  },
};

async function puntoDelNpc(ctx: CtxConsecuencia) {
  const { npcId, locationId } = ctx.consecuencia.datos as { npcId: string; locationId: string };
  const npc = await ctx.tx.npc.findUnique({ where: { id: npcId }, select: { slug: true } });
  if (!npc) return null;
  return ctx.tx.zonePoint.findFirst({ where: { saveId: ctx.saveId, locationId, targetSlug: npc.slug, activo: true }, select: { id: true } });
}

/// Al cruzarse con él: su regalo y el punto se retira. Si no llega a cruzarse (2 días), se va igual.
const DEUDA_DE_VIDA_REGALO: ReglaConsecuencia = {
  id: 'DEUDA_DE_VIDA_REGALO',
  alDisparar: async (ctx) => {
    const { npcId } = ctx.consecuencia.datos as { npcId: string };
    const npc = await npcVivo(ctx.tx, ctx.saveId, npcId);
    if (!npc) return null;
    const punto = await puntoDelNpc(ctx);
    return [
      { tipo: 'regalarAlJugador', npcId: npc.id, mensaje: `${npc.name} se acerca: «No olvido que me dejaste vivir.»` },
      ...(punto ? [{ tipo: 'retirarPuntoZona' as const, zonePointId: punto.id }] : []),
    ];
  },
  alCaducar: async (ctx) => {
    const punto = await puntoDelNpc(ctx);
    return punto ? [{ tipo: 'retirarPuntoZona', zonePointId: punto.id }] : [];
  },
};

// ─────────────────────────── Venganza ───────────────────────────

/// A los 5-15 días, el vengador aparece a una celda de la jugadora (si sigue vivo). Al cruzarse,
/// combate (VENGANZA_ATAQUE). Si no llegan a cruzarse (3 días), se va.
const VENGANZA_PARIENTE: ReglaConsecuencia = {
  id: 'VENGANZA_PARIENTE',
  alDisparar: async (ctx) => {
    const { vengadorId } = ctx.consecuencia.datos as { vengadorId: string };
    const [npc, save] = await Promise.all([
      npcVivo(ctx.tx, ctx.saveId, vengadorId),
      ctx.tx.save.findUnique({ where: { id: ctx.saveId }, select: { currentLocationId: true, zonaPosX: true, zonaPosY: true } }),
    ]);
    if (!npc || !save?.currentLocationId) return null;
    const x0 = save.zonaPosX ?? 400;
    const x = x0 + CELL_SIZE_PX <= LIENZO_ANCHO ? x0 + CELL_SIZE_PX : x0 - CELL_SIZE_PX;
    return [
      { tipo: 'crearPuntoZona', locationId: save.currentLocationId, puntoTipo: 'NPC', targetSlug: npc.slug, x, y: save.zonaPosY ?? 300, label: npc.name },
      {
        tipo: 'programarConsecuencia', regla: 'VENGANZA_ATAQUE', disparo: { tipo: 'ENCUENTRO_NPC', npcId: npc.id },
        caducaDias: 3, npcId: npc.id, datos: { npcId: npc.id, locationId: save.currentLocationId },
      },
    ];
  },
};

const VENGANZA_ATAQUE: ReglaConsecuencia = {
  id: 'VENGANZA_ATAQUE',
  alDisparar: async (ctx) => {
    const { npcId } = ctx.consecuencia.datos as { npcId: string };
    const npc = await npcVivo(ctx.tx, ctx.saveId, npcId);
    if (!npc) return null;
    return [{ tipo: 'forzarCombate', npcId: npc.id, mensaje: `${npc.name} te ha encontrado. «Vi lo que hiciste.»` }];
  },
  alCaducar: async (ctx) => {
    const punto = await puntoDelNpc(ctx);
    return punto ? [{ tipo: 'retirarPuntoZona', zonePointId: punto.id }] : [];
  },
};

export const REGLAS_DEL_JUEGO: ReglaConsecuencia[] = [SUCESION_PENDIENTE, REFUGIADOS, DEUDA_DE_VIDA, DEUDA_DE_VIDA_REGALO, VENGANZA_PARIENTE, VENGANZA_ATAQUE, NOTICIA, ...REGLAS_OPORTUNIDADES];
