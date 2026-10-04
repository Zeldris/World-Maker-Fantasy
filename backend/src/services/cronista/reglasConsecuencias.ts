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
import { regionesVecinas } from './regiones.js';
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
      worldId, faction: faccion.name, kind: 'PRINCIPAL', ...npcVivoEnPartida(saveId),
      ...(faccion.liderNpcId ? { id: { not: faccion.liderNpcId } } : {}),
      NOT: { npcStates: { some: { saveId, OR: [{ muerto: true }, { condicionFisica: 'MUERTO' }] } } },
    },
    select: { id: true, name: true, attributes: true, npcStates: { where: { saveId, cargo: 'heredero', lealtadFaccionId: faccion.id }, select: { id: true } } },
  });
  return npcs.sort((a, b) => (b.npcStates.length - a.npcStates.length) || inteligencia(b.attributes) - inteligencia(a.attributes) || a.id.localeCompare(b.id));
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
        efectos.push({ tipo: 'moverPoblacion', targetSlug, desde: region, hacia, fraccion: porVecina / (1 - i * porVecina) });
      });
    }
    // La facción como tal deja de tener gente.
    for (const campo of CAMPOS_FACCION) efectos.push({ tipo: 'ajustarPoblacion', targetSlug: `${faccionSlug}-${campo}`, delta: -1_000_000 });
    return efectos;
  },
};

export const REGLAS_DEL_JUEGO: ReglaConsecuencia[] = [SUCESION_PENDIENTE, REFUGIADOS];
