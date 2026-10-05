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
export const TIPOS_ENTIDAD: EntidadTipo[] = ['PERSONAJE', 'NPC', 'COMPANERO', 'FACCION', 'REGION', 'LOCATION', 'TERRITORIO', 'EDIFICIO'];
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
  const [save, npcs, facciones, locs, companeros] = await Promise.all([
    prisma.save.findUnique({ where: { id: saveId }, select: { characterName: true } }),
    ids('NPC').length ? prisma.npc.findMany({ where: { id: { in: ids('NPC') } }, select: { id: true, name: true } }) : [],
    ids('FACCION').length ? prisma.faction.findMany({ where: { saveId, slug: { in: ids('FACCION') } }, select: { slug: true, name: true } }) : [],
    lugares.length ? prisma.location.findMany({ where: { id: { in: lugares } }, select: { id: true, name: true } }) : [],
    ids('COMPANERO').length ? prisma.companion.findMany({ where: { id: { in: ids('COMPANERO') } }, select: { id: true, name: true } }) : [],
  ]);
  const mapa = new Map<string, string>([
    ...npcs.map((n) => [`NPC|${n.id}`, n.name] as const),
    ...facciones.map((f) => [`FACCION|${f.slug}`, f.name] as const),
    ...locs.map((l) => [`LOCATION|${l.id}`, l.name] as const),
    ...companeros.map((c) => [`COMPANERO|${c.id}`, c.name] as const),
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

/// La crónica que conoce el personaje, lo más reciente primero; `antesDe` (minuto de ficción) pagina.
export async function leyendasDePartida(
  prisma: PrismaClient,
  saveId: string,
  filtro: { familia?: FamiliaSuceso; desde?: number; hasta?: number; limite?: number; antesDe?: number } = {},
): Promise<{ entradas: EntradaLeyenda[]; hayMas: boolean }> {
  const take = Math.min(LIMITE_LEYENDAS, Math.max(1, filtro.limite ?? LIMITE_LEYENDAS));
  const minutos: Prisma.IntFilter = {
    ...(filtro.desde !== undefined ? { gte: filtro.desde } : {}),
    ...(filtro.hasta !== undefined ? { lte: filtro.hasta } : {}),
    ...(filtro.antesDe !== undefined ? { lt: filtro.antesDe } : {}),
  };
  const filas = await prisma.conocimiento.findMany({
    where: { saveId, suceso: { ...(filtro.familia ? { familia: filtro.familia } : {}), ...(Object.keys(minutos).length ? { fictionalMinutes: minutos } : {}) } },
    select: { via: true, confirmado: true, desde: true, suceso: { select: SELECT_SUCESO } },
    orderBy: [{ suceso: { fictionalMinutes: 'desc' } }, { id: 'desc' }],
    take: take + 1,
  });
  return { entradas: await aEntradas(prisma, saveId, filas.slice(0, take)), hayMas: filas.length > take };
}

/// Lo que el personaje sabe de una entidad (ficha «En tu partida»): sucesos donde es actor y, para
/// una región o un lugar, lo que pasó allí. Un rumor sale igual que en la crónica, sin detalles.
export async function leyendasDeEntidad(prisma: PrismaClient, saveId: string, tipo: EntidadTipo, id: string): Promise<EntradaLeyenda[]> {
  const donde: Prisma.SucesoWhereInput[] = [{ actores: { some: { entidadTipo: tipo, entidadId: id } } }];
  if (tipo === 'REGION') donde.push({ regionSlug: id });
  if (tipo === 'LOCATION') donde.push({ locationId: id });
  const filas = await prisma.conocimiento.findMany({
    where: { saveId, suceso: { OR: donde } },
    select: { via: true, confirmado: true, desde: true, suceso: { select: SELECT_SUCESO } },
    orderBy: [{ suceso: { fictionalMinutes: 'desc' } }, { id: 'desc' }],
    take: LIMITE_LEYENDAS,
  });
  return aEntradas(prisma, saveId, filas);
}
