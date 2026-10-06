// Leyendas de la partida (CR-19, hito 0.2 — roadmap-cronista.md § 14 y entrada CR-18, Q4-Q6): la
// crónica tal como la conoce el personaje. Solo sucesos con `Conocimiento`; lo demás no existe en
// ninguna pantalla (D-5, INT-4). Un rumor sale sin detalles («Se dice que…», sin actores, sin fecha
// exacta ni causas) hasta que se confirma. La importancia nunca va como número (INT-2): solo su nivel.
import type { FamiliaSuceso, Prisma, PrismaClient, ViaConocimiento } from '@prisma/client';
import { formatFictionalDate } from '../worldClock.js';
import { regionDeSlug } from './conocimiento.js';
import { comoRumor } from './noticias.js';
import type { EntidadTipo } from './sucesos.js';

/// INT-2: 1-4 sin marca, 5-7 con borde, 8-10 con sello.
export type NivelLeyenda = 'NORMAL' | 'DESTACADO' | 'GRAVE';

export function nivelDeImportancia(importancia: number): NivelLeyenda {
  if (importancia >= 8) return 'GRAVE';
  if (importancia >= 5) return 'DESTACADO';
  return 'NORMAL';
}

export interface ActorLeyenda {
  tipo: string;
  id: string;
  nombre: string;
  papel: string;
}

export interface EntradaLeyenda {
  sucesoId: string;
  tipo: string;
  familia: FamiliaSuceso;
  nivel: NivelLeyenda;
  texto: string;
  rumor: boolean;
  via: ViaConocimiento;
  /// Minuto de ficción en que lo supo.
  sabidoEn: number;
  /// Región donde pasó (nombre), si se sabe.
  region: string | null;
  // Solo si está confirmado (un rumor no da detalles):
  cuando: number | null;
  fecha: string | null;
  lugar: { id: string; nombre: string } | null;
  actores: ActorLeyenda[];
  /// Causas que el personaje también sabe (INT-3).
  causas: string[];
}

export const FAMILIAS: FamiliaSuceso[] = ['CLIMA', 'NATURAL', 'VIDA_MUERTE', 'DIPLOMACIA', 'FACCION', 'ECONOMIA', 'REINO', 'JUGADOR', 'LORE', 'SISTEMA'];
export const TIPOS_ENTIDAD: EntidadTipo[] = ['PERSONAJE', 'NPC', 'COMPANERO', 'FACCION', 'REGION', 'LOCATION', 'TERRITORIO', 'EDIFICIO', 'LINAJE'];
export const LIMITE_LEYENDAS = 200;

const SELECT_SUCESO = {
  id: true, tipo: true, familia: true, importancia: true, texto: true, textoNarrado: true, fictionalMinutes: true, regionSlug: true, locationId: true,
  actores: { select: { entidadTipo: true, entidadId: true, papel: true } },
  causas: { select: { causaId: true } },
} satisfies Prisma.SucesoSelect;

type SucesoLeyenda = Prisma.SucesoGetPayload<{ select: typeof SELECT_SUCESO }>;
type FilaConocimiento = { via: ViaConocimiento; confirmado: boolean; desde: number; suceso: SucesoLeyenda };

/// Nombres para mostrar de los actores y lugares (en lote).
async function nombres(prisma: PrismaClient, saveId: string, sucesos: SucesoLeyenda[]): Promise<(tipo: string, id: string) => string> {
  const ids = (tipo: string) => [...new Set(sucesos.flatMap((s) => s.actores.filter((a) => a.entidadTipo === tipo).map((a) => a.entidadId)))];
  const lugares = [...new Set([...ids('LOCATION'), ...sucesos.map((s) => s.locationId).filter((l): l is string => !!l)])];
  const [save, npcs, facciones, locs, companeros, linajes, subditos] = await Promise.all([
    prisma.save.findUnique({ where: { id: saveId }, select: { characterName: true } }),
    ids('NPC').length ? prisma.npc.findMany({ where: { id: { in: ids('NPC') } }, select: { id: true, name: true } }) : [],
    ids('FACCION').length ? prisma.faction.findMany({ where: { saveId, slug: { in: ids('FACCION') } }, select: { slug: true, name: true } }) : [],
    lugares.length ? prisma.location.findMany({ where: { id: { in: lugares } }, select: { id: true, name: true } }) : [],
    ids('COMPANERO').length ? prisma.companion.findMany({ where: { id: { in: ids('COMPANERO') } }, select: { id: true, name: true } }) : [],
    ids('LINAJE').length ? prisma.linaje.findMany({ where: { id: { in: ids('LINAJE') } }, select: { id: true, nombre: true, tipo: true } }) : [],
    ids('SUBDITO').length ? prisma.subject.findMany({ where: { id: { in: ids('SUBDITO') } }, select: { id: true, name: true } }) : [],
  ]);
  const mapa = new Map<string, string>([
    ...npcs.map((n) => [`NPC|${n.id}`, n.name] as const),
    ...facciones.map((f) => [`FACCION|${f.slug}`, f.name] as const),
    ...locs.map((l) => [`LOCATION|${l.id}`, l.name] as const),
    ...companeros.map((c) => [`COMPANERO|${c.id}`, c.name] as const),
    ...linajes.map((l) => [`LINAJE|${l.id}`, l.tipo === 'RASTRO' ? `rastro ${l.nombre}` : `los ${l.nombre}`] as const),
    ...subditos.map((x) => [`SUBDITO|${x.id}`, x.name] as const),
  ]);
  return (tipo, id) => {
    if (tipo === 'PERSONAJE') return save?.characterName ?? 'Tú';
    if (tipo === 'REGION') return regionDeSlug(id) ?? id;
    return mapa.get(`${tipo}|${id}`) ?? id;
  };
}

/// De filas de conocimiento a entradas de Leyendas (lo más reciente primero, como vienen).
async function aEntradas(prisma: PrismaClient, saveId: string, filas: FilaConocimiento[]): Promise<EntradaLeyenda[]> {
  const sucesos = filas.map((f) => f.suceso);
  const nombre = await nombres(prisma, saveId, sucesos);
  const causaIds = [...new Set(sucesos.flatMap((s) => s.causas.map((c) => c.causaId)))];
  const sabidas = new Set(
    causaIds.length
      ? (await prisma.conocimiento.findMany({ where: { saveId, sucesoId: { in: causaIds } }, select: { sucesoId: true } })).map((c) => c.sucesoId)
      : [],
  );
  return filas.map(({ via, confirmado, desde, suceso: s }) => {
    const base = s.textoNarrado ?? s.texto;
    const region = regionDeSlug(s.regionSlug);
    return {
      sucesoId: s.id,
      tipo: s.tipo,
      familia: s.familia,
      nivel: nivelDeImportancia(s.importancia),
      texto: confirmado ? base : comoRumor(base),
      rumor: !confirmado,
      via,
      sabidoEn: desde,
      region,
      cuando: confirmado ? s.fictionalMinutes : null,
      fecha: confirmado ? formatFictionalDate(s.fictionalMinutes) : null,
      lugar: confirmado && s.locationId ? { id: s.locationId, nombre: nombre('LOCATION', s.locationId) } : null,
      actores: confirmado ? s.actores.map((a) => ({ tipo: a.entidadTipo, id: a.entidadId, nombre: nombre(a.entidadTipo, a.entidadId), papel: a.papel })) : [],
      causas: confirmado ? s.causas.map((c) => c.causaId).filter((id) => sabidas.has(id)) : [],
    };
  });
}

/// La crónica que conoce el personaje, lo más reciente primero. `cursor` (el `siguiente` de la página
/// anterior) pagina sin saltarse los sucesos que comparten minuto.
export async function leyendasDePartida(
  prisma: PrismaClient,
  saveId: string,
  filtro: { familia?: FamiliaSuceso; desde?: number; hasta?: number; limite?: number; cursor?: string } = {},
): Promise<{ entradas: EntradaLeyenda[]; hayMas: boolean; siguiente: string | null }> {
  const take = Math.min(LIMITE_LEYENDAS, Math.max(1, filtro.limite ?? LIMITE_LEYENDAS));
  const minutos: Prisma.IntFilter = {
    ...(filtro.desde !== undefined ? { gte: filtro.desde } : {}),
    ...(filtro.hasta !== undefined ? { lte: filtro.hasta } : {}),
  };
  const filas = await prisma.conocimiento.findMany({
    where: { saveId, suceso: { ...(filtro.familia ? { familia: filtro.familia } : {}), ...(Object.keys(minutos).length ? { fictionalMinutes: minutos } : {}) } },
    select: { id: true, via: true, confirmado: true, desde: true, suceso: { select: SELECT_SUCESO } },
    orderBy: [{ suceso: { fictionalMinutes: 'desc' } }, { id: 'desc' }],
    ...(filtro.cursor ? { cursor: { id: filtro.cursor }, skip: 1 } : {}),
    take: take + 1,
  });
  const pagina = filas.slice(0, take);
  const hayMas = filas.length > take;
  return { entradas: await aEntradas(prisma, saveId, pagina), hayMas, siguiente: hayMas ? pagina[pagina.length - 1]!.id : null };
}

/// Lo que el personaje sabe de una entidad (ficha «En tu partida»): sucesos donde es actor y, para
/// una región o un lugar, lo que pasó allí. Un rumor no dice quién ni dónde exactamente (Q4), así que
/// solo sale en la ficha de su región.
export async function leyendasDeEntidad(prisma: PrismaClient, saveId: string, tipo: EntidadTipo, id: string): Promise<EntradaLeyenda[]> {
  const donde: Prisma.ConocimientoWhereInput[] = [{ confirmado: true, suceso: { actores: { some: { entidadTipo: tipo, entidadId: id } } } }];
  if (tipo === 'REGION') donde.push({ suceso: { regionSlug: id } });
  if (tipo === 'LOCATION') donde.push({ confirmado: true, suceso: { locationId: id } });
  const filas = await prisma.conocimiento.findMany({
    where: { saveId, OR: donde },
    select: { via: true, confirmado: true, desde: true, suceso: { select: SELECT_SUCESO } },
    orderBy: [{ suceso: { fictionalMinutes: 'desc' } }, { id: 'desc' }],
    take: LIMITE_LEYENDAS,
  });
  return aEntradas(prisma, saveId, filas);
}

/// Fichas de la Enciclopedia que tienen sección «En tu partida» (20b) y el tipo de actor del Libro.
export const FICHAS_CON_LEYENDAS = { npc: 'NPC', faction: 'FACCION', location: 'LOCATION' } as const;
export type FichaConLeyendas = keyof typeof FICHAS_CON_LEYENDAS;

/// Lo que el personaje sabe de una ficha de la Enciclopedia, por su slug: los NPC y los lugares
/// figuran en el Libro por id (del catálogo o, si nació en la partida, el suyo); las facciones de la
/// partida conservan el slug del catálogo.
export async function leyendasDeFicha(prisma: PrismaClient, saveId: string, ficha: FichaConLeyendas, slug: string): Promise<EntradaLeyenda[]> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return [];
  const tipo = FICHAS_CON_LEYENDAS[ficha];
  let ids: string[] = [slug];
  if (ficha === 'npc') {
    ids = (await prisma.npc.findMany({ where: { slug, OR: [{ worldId: save.worldId, saveId: null }, { saveId }] }, select: { id: true } })).map((n) => n.id);
  } else if (ficha === 'location') {
    ids = (await prisma.location.findMany({ where: { worldId: save.worldId, slug }, select: { id: true } })).map((l) => l.id);
  }
  if (ids.length === 0) return [];
  // Solo hechos confirmados: un rumor no revela a quién implica (Q4).
  const donde: Prisma.SucesoWhereInput[] = [{ actores: { some: { entidadTipo: tipo, entidadId: { in: ids } } } }];
  if (tipo === 'LOCATION') donde.push({ locationId: { in: ids } });
  const filas = await prisma.conocimiento.findMany({
    where: { saveId, confirmado: true, suceso: { OR: donde } },
    select: { via: true, confirmado: true, desde: true, suceso: { select: SELECT_SUCESO } },
    orderBy: [{ suceso: { fictionalMinutes: 'desc' } }, { id: 'desc' }],
    take: LIMITE_LEYENDAS,
  });
  return aEntradas(prisma, saveId, filas);
}


// ─────────────────────────── Linajes (CR-52) ───────────────────────────

export interface MiembroLinaje {
  id: string;
  tipo: 'NPC' | 'SUBDITO' | 'PERSONAJE';
  nombre: string;
  vivo: boolean;
  padreId: string | null;
  madreId: string | null;
}

export interface LinajeLeyenda {
  id: string;
  nombre: string;
  tipo: string;
  pueblo: string;
  /// El linaje del personaje.
  propio: boolean;
  miembros: MiembroLinaje[];
  /// Lo que sabe el personaje de esta familia (lo más reciente primero).
  historia: EntradaLeyenda[];
}

export const HISTORIA_POR_LINAJE = 8;

/// «Linajes» de Leyendas: las familias de las que el personaje sabe algo (y la suya), con sus
/// miembros (padres incluidos, para el árbol) y su historia conocida.
export async function linajesConocidos(prisma: PrismaClient, saveId: string): Promise<LinajeLeyenda[]> {
  const sabidos = await prisma.conocimiento.findMany({
    where: { saveId, confirmado: true, suceso: { actores: { some: { entidadTipo: 'LINAJE' } } } },
    select: { suceso: { select: { actores: { where: { entidadTipo: 'LINAJE' }, select: { entidadId: true } } } } },
  });
  const propio = await prisma.linajeMiembro.findFirst({ where: { saveId, entidadTipo: 'PERSONAJE', entidadId: saveId }, select: { linajeId: true } });
  const ids = [...new Set([...(propio ? [propio.linajeId] : []), ...sabidos.flatMap((c) => c.suceso.actores.map((a) => a.entidadId))])];
  if (ids.length === 0) return [];
  const linajes = await prisma.linaje.findMany({ where: { saveId, id: { in: ids } }, include: { miembros: true }, orderBy: { nombre: 'asc' } });
  const npcIds = linajes.flatMap((l) => l.miembros.filter((m) => m.entidadTipo === 'NPC').map((m) => m.entidadId));
  const subditoIds = linajes.flatMap((l) => l.miembros.filter((m) => m.entidadTipo === 'SUBDITO').map((m) => m.entidadId));
  const subditos = new Map(
    (await prisma.subject.findMany({ where: { id: { in: subditoIds } }, select: { id: true, name: true, estado: true, padreId: true, madreId: true } })).map((s) => [s.id, s]),
  );
  const [npcs, muertos, save] = await Promise.all([
    prisma.npc.findMany({ where: { id: { in: npcIds } }, select: { id: true, name: true, muertoEnMundo: true, padreNpcId: true, madreNpcId: true, nacidoEn: true } }),
    prisma.npcState.findMany({ where: { saveId, npcId: { in: npcIds }, OR: [{ muerto: true }, { condicionFisica: 'MUERTO' }] }, select: { npcId: true } }),
    prisma.save.findUnique({ where: { id: saveId }, select: { characterName: true } }),
  ]);
  const porId = new Map(npcs.map((n) => [n.id, n]));
  const caidos = new Set(muertos.map((m) => m.npcId));
  const out: LinajeLeyenda[] = [];
  for (const l of linajes) {
    const miembros: MiembroLinaje[] = l.miembros.flatMap((m): MiembroLinaje[] => {
      if (m.entidadTipo === 'PERSONAJE') return [{ id: m.entidadId, tipo: 'PERSONAJE', nombre: save?.characterName ?? 'Tú', vivo: true, padreId: null, madreId: null }];
      if (m.entidadTipo === 'SUBDITO') {
        const sb = subditos.get(m.entidadId);
        return sb ? [{ id: sb.id, tipo: 'SUBDITO', nombre: sb.name, vivo: sb.estado !== 'MUERTO', padreId: sb.padreId, madreId: sb.madreId }] : [];
      }
      const n = porId.get(m.entidadId);
      if (!n) return [];
      return [{ id: n.id, tipo: 'NPC', nombre: n.name, vivo: !n.muertoEnMundo && !caidos.has(n.id), padreId: n.padreNpcId, madreId: n.madreNpcId }];
    });
    const historia = (await leyendasDeEntidad(prisma, saveId, 'LINAJE', l.id)).slice(0, HISTORIA_POR_LINAJE);
    out.push({ id: l.id, nombre: l.nombre, tipo: l.tipo, pueblo: l.pueblo, propio: l.id === propio?.linajeId, miembros, historia });
  }
  return out.sort((a, b) => Number(b.propio) - Number(a.propio));
}
