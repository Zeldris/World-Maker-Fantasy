// Noticias del mundo con rumor por distancia (CR-12 paso 12d, hito 0.2 — decisión de la usuaria en
// la ronda 2 de CR-12). Lo que pasa en el mundo llega al canal «El mundo» según dónde pase:
//
// | Dónde pasa | Cuándo llega | Cómo |
// |---|---|---|
// | La región del personaje | Al momento | Como hecho |
// | Una región vecina | 1 día después | «Se dice que…» |
// | Más lejos | 2-3 días después | «Se dice que…» |
//
// Una noticia sin lugar (una escaramuza entre dos facciones) solo llega si el personaje conoce a
// alguna de ellas (reputación, `WorldState.factionsStatus`), al día siguiente y como rumor. Las
// facciones aliadas o con tratado con el Reino de la jugadora avisan al momento y como hecho.
//
// Lo que llega tarde se guarda como consecuencia aplazada (`NOTICIA`, disparo por días) y se escribe
// al vencer. Sin rumores falsos todavía (`RUMOR_DE_HAZANA`, Fase 5).
import type { Prisma, PrismaClient } from '@prisma/client';
import { aplicarEfecto } from './efectos.js';
import { REGIONES_VECINAS } from './regiones.js';
import type { CtxConsecuencia, ReglaConsecuencia } from './consecuencias.js';

type Tx = Prisma.TransactionClient;

/// UX-38: categoría de una noticia (icono en «El mundo»).
export type CategoriaNoticia = 'CONFLICTO' | 'COMERCIO' | 'NATURALEZA' | 'REINO' | 'GENTE';

/// Oportunidad que abre una noticia: dónde y hasta cuándo (minuto de ficción).
export interface OportunidadNoticia {
  lugar: string;
  locationId: string;
  venceEn: number;
}

/// Metadatos que guarda `LogEntry.noticia` (UX-38).
export interface MetaNoticia {
  categoria?: CategoriaNoticia;
  oportunidad?: OportunidadNoticia;
  /// CR-34 (34e): propuesta de una facción al Reino, con Aceptar y Rechazar.
  propuesta?: { id: string; faccion: string; tipo: 'TRATADO' | 'ALIANZA'; venceEn: number; respuesta?: 'ACEPTADA' | 'RECHAZADA' | 'CADUCADA' };
  resumen?: true;
  /// En un resumen: los metadatos de cada línea (en orden; null si la línea no tenía).
  lineas?: (MetaNoticia | null)[];
}

/// Categoría según la familia del suceso del Libro.
export function categoriaDeFamilia(familia: string): CategoriaNoticia | undefined {
  switch (familia) {
    case 'DIPLOMACIA':
    case 'FACCION':
      return 'CONFLICTO';
    // CR-13 (Q5): nacimientos, quien destaca, sucesiones y muertes.
    case 'VIDA_MUERTE':
      return 'GENTE';
    case 'ECONOMIA':
      return 'COMERCIO';
    case 'NATURAL':
    case 'CLIMA':
      return 'NATURALEZA';
    case 'REINO':
      return 'REINO';
    default:
      return undefined;
  }
}

export interface Noticia {
  texto: string;
  categoria?: CategoriaNoticia;
  oportunidad?: OportunidadNoticia;
  /// Nombres de las facciones implicadas (`Faction.name`).
  facciones: string[];
  /// Región donde pasa (`Location.region`); null si no tiene lugar concreto.
  region: string | null;
}

/// Distancia (en saltos de `REGIONES_VECINAS`) entre dos regiones; null si alguna no está en el mapa.
export function distanciaRegiones(a: string, b: string): number | null {
  if (!(a in REGIONES_VECINAS) || !(b in REGIONES_VECINAS)) return null;
  const vistos = new Map<string, number>([[a, 0]]);
  const cola = [a];
  while (cola.length > 0) {
    const r = cola.shift()!;
    if (r === b) return vistos.get(r)!;
    for (const v of REGIONES_VECINAS[r]!) {
      if (!vistos.has(v)) {
        vistos.set(v, vistos.get(r)! + 1);
        cola.push(v);
      }
    }
  }
  return null;
}

/// Días de retraso según la distancia (0 = al momento).
export function retrasoPorDistancia(distancia: number): number {
  return Math.min(distancia, 3);
}

/// Comienzos de plantilla que no son nombres propios (el resto empieza por un nombre: una facción,
/// una especie, un NPC… y se queda tal cual).
const INICIOS_COMUNES = ['Gente ', 'Una ', 'Un ', 'Crece ', 'Las aguas ', 'Escasea ', 'Llega ', 'Llegan ', 'Muere ', 'Nace ', 'Se '];

/// «Una caravana viaja…» → «Se dice que una caravana viaja…».
export function comoRumor(texto: string): string {
  const comun = INICIOS_COMUNES.some((i) => texto.startsWith(i));
  return `Se dice que ${comun ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto}`;
}

/// Cuándo y cómo le llega una noticia a la partida: `null` = no le llega.
export function entrega(
  noticia: Noticia,
  personaje: { region: string | null; faccionesConocidas: Set<string>; aliadas: Set<string> },
): { dias: number; rumor: boolean } | null {
  if (noticia.facciones.some((f) => personaje.aliadas.has(f))) return { dias: 0, rumor: false };
  if (noticia.region) {
    if (personaje.region === noticia.region) return { dias: 0, rumor: false };
    const d = personaje.region ? distanciaRegiones(personaje.region, noticia.region) : null;
    const dias = retrasoPorDistancia(d ?? 3);
    return { dias, rumor: true };
  }
  if (noticia.facciones.some((f) => personaje.faccionesConocidas.has(f))) return { dias: 1, rumor: true };
  return null;
}

/// Facciones aliadas o con tratado con el Reino de la jugadora (por nombre).
async function aliadasDelReino(tx: Tx, saveId: string): Promise<Set<string>> {
  const reino = await tx.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true } });
  if (!reino) return new Set();
  const relaciones = await tx.factionRelation.findMany({
    where: { type: { in: ['ALIANZA', 'TRATADO_COMERCIAL'] }, OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] },
    select: { sourceFaction: { select: { id: true, name: true } }, targetFaction: { select: { id: true, name: true } } },
  });
  return new Set(relaciones.map((r) => (r.sourceFaction.id === reino.id ? r.targetFaction.name : r.sourceFaction.name)));
}

async function escribir(tx: Tx, saveId: string, texto: string, fictionalMinutes: number, meta: MetaNoticia | null): Promise<void> {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalDateLabel: true } });
  await tx.logEntry.create({
    data: { saveId, channel: 'WORLD', text: texto, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes, isSystemMessage: true, ...(meta ? { noticia: meta as Prisma.InputJsonValue } : {}) },
  });
}

function metaDe(noticia: Noticia): MetaNoticia | null {
  const meta: MetaNoticia = { ...(noticia.categoria ? { categoria: noticia.categoria } : {}), ...(noticia.oportunidad ? { oportunidad: noticia.oportunidad } : {}) };
  return Object.keys(meta).length > 0 ? meta : null;
}

/// Da una noticia a la partida: al momento, o como rumor que llega días después. Devuelve cuándo.
export async function darNoticia(
  tx: Tx,
  ctx: { saveId: string; worldId: string; fictionalMinutes: number; causa?: string | null },
  noticia: Noticia,
): Promise<{ dias: number; rumor: boolean } | null> {
  const save = await tx.save.findUnique({
    where: { id: ctx.saveId },
    select: { currentLocation: { select: { region: true } }, worldState: { select: { factionsStatus: true } } },
  });
  if (!save) return null;
  const personaje = {
    region: save.currentLocation?.region ?? null,
    faccionesConocidas: new Set(Object.keys((save.worldState?.factionsStatus as Record<string, number> | null) ?? {})),
    aliadas: await aliadasDelReino(tx, ctx.saveId),
  };
  const cuando = entrega(noticia, personaje);
  if (!cuando) return null;
  const texto = cuando.rumor ? comoRumor(noticia.texto) : noticia.texto;
  const meta = metaDe(noticia);
  if (cuando.dias === 0) {
    await escribir(tx, ctx.saveId, texto, ctx.fictionalMinutes, meta);
    return cuando;
  }
  await aplicarEfecto(
    { tx, saveId: ctx.saveId, worldId: ctx.worldId, fictionalMinutes: ctx.fictionalMinutes, origen: 'MOTOR', causas: ctx.causa ? [ctx.causa] : [] },
    { tipo: 'programarConsecuencia', regla: 'NOTICIA', disparo: { tipo: 'DIAS', min: cuando.dias, max: cuando.dias }, datos: { texto, meta }, caducaDias: cuando.dias + 30 },
  );
  return cuando;
}

/// Regla de la noticia que llega tarde: al vencer, se escribe en «El mundo».
export const NOTICIA: ReglaConsecuencia = {
  id: 'NOTICIA',
  alDisparar: async (ctx: CtxConsecuencia) => {
    const { texto, meta } = ctx.consecuencia.datos as { texto: string; meta?: MetaNoticia | null };
    await escribir(ctx.tx, ctx.saveId, texto, ctx.fictionalMinutes, meta ?? null);
    return [];
  },
};

/// Cabecera del resumen de varios días (UX-31).
export const CABECERA_RESUMEN = 'Mientras pasaban los días…';

/// Resumen al cruzar varios días de golpe (UX-31, decisión de la ronda 2 de CR-12): las entradas de
/// «El mundo» escritas después de `marca` (`marcaDeNoticias`) se juntan en una sola, con una línea
/// por noticia, en vez de llegar en ráfaga. Con menos de 2 no hace nada.
export async function agruparNoticias(prisma: PrismaClient, saveId: string, marca: Date): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const entradas = await tx.logEntry.findMany({
      where: { saveId, channel: 'WORLD', createdAt: { gt: marca } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, text: true, timeLabel: true, fictionalMinutes: true, noticia: true },
    });
    if (entradas.length < 2) return 0;
    const ultima = entradas[entradas.length - 1]!;
    await tx.logEntry.deleteMany({ where: { id: { in: entradas.map((e) => e.id) } } });
    await tx.logEntry.create({
      data: {
        saveId, channel: 'WORLD', isSystemMessage: true, timeLabel: ultima.timeLabel, fictionalMinutes: ultima.fictionalMinutes, noticia: { resumen: true, lineas: entradas.map((e) => (e.noticia as MetaNoticia | null) ?? null) } as Prisma.InputJsonValue,
        text: [CABECERA_RESUMEN, ...entradas.map((e) => `• ${e.text}`)].join('\n'),
        // Cada línea conserva su categoría y su oportunidad (revisión del PR de CR-13).
      },
    });
    return entradas.length;
  });
}

/// Marca para `agruparNoticias`: el `createdAt` de la última entrada de «El mundo» (mismo reloj que
/// el de las que vendrán), o el principio de los tiempos si no hay ninguna.
export async function marcaDeNoticias(prisma: PrismaClient, saveId: string): Promise<Date> {
  const ultima = await prisma.logEntry.findFirst({ where: { saveId, channel: 'WORLD' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  return ultima?.createdAt ?? new Date(0);
}
