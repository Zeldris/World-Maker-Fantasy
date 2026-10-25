// Memoria del narrador (CR-21…CR-23, hito 0.3 — roadmap-cronista.md § 11 y decisiones Q1-Q4 de la
// Fase 6). Un bloque escrito por código, nunca por IA, que va al narrador en cada turno:
//  1. Verdad obligatoria (CR-21, ≤ 600): muertos de la escena, quién manda, guerras de la región,
//     títulos de la jugadora, lo que piensan sus compañeros y lo que cada NPC recuerda de ella.
//  2. Callbacks por entidad (CR-22, como en BG3): los 3 sucesos más importantes que la jugadora
//     conoce de cada NPC, facción o lugar de la escena.
//  3. Hilos abiertos que tocan a la escena (una línea cada uno).
//  4. Memoria por relevancia (CR-23, Generative Agents): 0,3·recencia + 0,3·importancia +
//     0,4·relevancia sobre lo que la jugadora conoce; relevancia por actores y palabras, sin IA.
// Presupuesto total ≤ 1.800 caracteres; se recorta por el final (la verdad nunca).
import type { Prisma, PrismaClient } from '@prisma/client';
import { sentimientoTotal } from './recuerdos.js';
import { etiquetaDeAprobacion } from './aprobacion.js';
import { REGION_OWNING_FACTIONS } from '../reputation.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const TOPE_VERDAD = 600;
export const TOPE_TOTAL = 1800;
export const CALLBACKS_POR_ENTIDAD = 3;
export const MAX_MEMORIA = 10;
/// Recencia: vale la mitad cada 7 días de ficción.
export const MEDIA_VIDA_RECENCIA_DIAS = 7;
const MIN_DIA = 1440;

export interface Escena {
  saveId: string;
  /// NPC presentes (ids) con su nombre y si están muertos.
  npcs: { id: string; name: string; faction: string | null; muerto: boolean }[];
  locationId: string | null;
  region: string | null;
  accion: string;
  ahora: number;
}

// ─────────────────────────── Puro ───────────────────────────

const VACIAS = new Set(['para', 'como', 'pero', 'con', 'que', 'una', 'unos', 'unas', 'los', 'las', 'del', 'por', 'sus', 'este', 'esta', 'esto', 'muy', 'más', 'mas', 'hacia', 'sobre', 'entre', 'tras', 'desde', 'hasta', 'cuando', 'donde']);

/// Puro: palabras con peso de un texto (minúsculas, sin acentos, ≥ 4 letras, sin palabras vacías).
export function palabrasClave(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .split(/[^a-z0-9ñ]+/)
      .filter((w) => w.length >= 4 && !VACIAS.has(w)),
  );
}

/// Puro: puntuación de un recuerdo para la memoria por relevancia (Q1).
export function puntuar(
  s: { importancia: number; fictionalMinutes: number; texto: string; actorIds: string[] },
  ctx: { ahora: number; palabras: Set<string>; actoresEscena: Set<string> },
): number {
  const dias = Math.max(0, ctx.ahora - s.fictionalMinutes) / MIN_DIA;
  const recencia = Math.pow(0.5, dias / MEDIA_VIDA_RECENCIA_DIAS);
  const importancia = Math.max(0, Math.min(10, s.importancia)) / 10;
  const porActor = s.actorIds.some((a) => ctx.actoresEscena.has(a)) ? 1 : 0;
  const propias = palabrasClave(s.texto);
  const comunes = [...ctx.palabras].filter((w) => propias.has(w)).length;
  const porPalabras = ctx.palabras.size === 0 ? 0 : Math.min(1, comunes / Math.min(3, ctx.palabras.size));
  const relevancia = Math.max(porActor, porPalabras);
  return 0.3 * recencia + 0.3 * importancia + 0.4 * relevancia;
}

/// Puro: junta las secciones en orden y recorta por el final hasta el presupuesto. La primera
/// (verdad) se recorta a su propio tope pero nunca se quita.
export function componer(secciones: { titulo: string; lineas: string[] }[], tope = TOPE_TOTAL): string {
  const out: string[] = [];
  let usado = 0;
  for (const [i, sec] of secciones.entries()) {
    if (sec.lineas.length === 0) continue;
    const cabecera = `${sec.titulo}:`;
    const lineas: string[] = [];
    let tam = cabecera.length;
    for (const l of sec.lineas) {
      const linea = `- ${l}`;
      const limite = i === 0 ? Math.min(TOPE_VERDAD, tope) : tope - usado;
      if (tam + 1 + linea.length > limite) break;
      lineas.push(linea);
      tam += 1 + linea.length;
    }
    if (lineas.length === 0) continue;
    out.push([cabecera, ...lineas].join('\n'));
    usado += tam + 2;
    if (usado >= tope) break;
  }
  return out.join('\n\n');
}

// ─────────────────────────── Secciones ───────────────────────────

/// CR-21: la verdad obligatoria de esta escena.
export async function verdadObligatoria(db: Db, e: Escena): Promise<string[]> {
  const lineas: string[] = [];
  const muertos = e.npcs.filter((n) => n.muerto);
  if (muertos.length) lineas.push(`Muertos: ${muertos.map((n) => n.name).join(', ')}. No pueden hablar, actuar ni aparecer vivos.`);

  const nombresFaccion = [...new Set(e.npcs.map((n) => n.faction).filter((f): f is string => !!f))];
  if (nombresFaccion.length) {
    const facciones = await db.faction.findMany({ where: { saveId: e.saveId, name: { in: nombresFaccion }, disueltaEn: null }, select: { name: true, liderNpcId: true } });
    const lideres = await db.npc.findMany({ where: { id: { in: facciones.map((f) => f.liderNpcId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    for (const f of facciones) {
      const l = lideres.find((n) => n.id === f.liderNpcId);
      if (l) lineas.push(`En ${f.name} manda ${l.name}.`);
    }
  }

  const implicadas = [...nombresFaccion, ...(e.region ? (REGION_OWNING_FACTIONS[e.region] ?? []) : [])];
  if (implicadas.length) {
    const guerras = await db.factionRelation.findMany({
      where: { saveId: e.saveId, type: 'GUERRA', OR: [{ sourceFaction: { name: { in: implicadas } } }, { targetFaction: { name: { in: implicadas } } }] },
      select: { sourceFaction: { select: { name: true } }, targetFaction: { select: { name: true } } },
      take: 6,
    });
    const vistas = new Set<string>();
    for (const g of guerras) {
      const par = [g.sourceFaction.name, g.targetFaction.name].sort().join(' y ');
      if (vistas.has(par)) continue;
      vistas.add(par);
      lineas.push(`Guerra abierta entre ${par}.`);
    }
  }

  const etiquetas = await db.etiqueta.findMany({ where: { saveId: e.saveId, entidadTipo: 'PERSONAJE', activa: true }, select: { texto: true }, take: 6 });
  if (etiquetas.length) lineas.push(`A la jugadora la conocen como: ${etiquetas.map((t) => t.texto).join(', ')}.`);

  const companeros = await db.companion.findMany({
    where: { saveId: e.saveId, tipo: 'NPC', rolReino: null, condicionFisica: { not: 'MUERTO' }, combatGroupSlotIndex: 0 },
    select: { name: true, aprobacion: true },
    take: 4,
  });
  for (const c of companeros) lineas.push(`${c.name} (compañero) está ${etiquetaDeAprobacion(c.aprobacion).toLowerCase()} con ella.`);

  const vivos = e.npcs.filter((n) => !n.muerto);
  if (vivos.length) {
    const [recuerdos, estados] = await Promise.all([
      db.recuerdo.findMany({ where: { saveId: e.saveId, npcId: { in: vivos.map((n) => n.id) }, sobreTipo: 'PERSONAJE' }, select: { npcId: true, sentimiento: true, importancia: true, desdeMinutes: true } }),
      db.npcState.findMany({ where: { saveId: e.saveId, npcId: { in: vivos.map((n) => n.id) }, titulo: { not: null } }, select: { npcId: true, titulo: true } }),
    ]);
    for (const n of vivos) {
      const total = sentimientoTotal(recuerdos.filter((r) => r.npcId === n.id), e.ahora);
      const titulo = estados.find((s) => s.npcId === n.id)?.titulo;
      const trato = total <= -8 ? 'le guarda rencor' : total < -2 ? 'desconfía de ella' : total >= 6 ? 'le tiene aprecio' : total > 2 ? 'la ve con buenos ojos' : null;
      if (trato || titulo) lineas.push(`${n.name}${titulo ? ` («${titulo}»)` : ''}${trato ? ` ${trato}` : ' la recuerda'}.`);
    }
  }
  return lineas;
}

/// Sucesos que conoce la jugadora (para callbacks y memoria).
async function sucesosConocidos(db: Db, saveId: string, filtro: Prisma.SucesoWhereInput, take: number) {
  return db.suceso.findMany({
    where: { saveId, conocimientos: { some: { confirmado: true } }, ...filtro },
    select: { id: true, texto: true, importancia: true, fictionalMinutes: true, actores: { select: { entidadId: true } } },
    orderBy: [{ importancia: 'desc' }, { fictionalMinutes: 'desc' }],
    take,
  });
}

/// CR-22: los 3 sucesos más importantes que conoce la jugadora de cada NPC, facción y lugar.
export async function callbacks(db: Db, e: Escena): Promise<{ lineas: string[]; ids: Set<string> }> {
  const lineas: string[] = [];
  const ids = new Set<string>();
  const entidades: { nombre: string; filtro: Prisma.SucesoWhereInput }[] = [
    ...e.npcs.map((n) => ({ nombre: n.name, filtro: { actores: { some: { entidadTipo: 'NPC', entidadId: n.id } } } })),
  ];
  const facciones = [...new Set(e.npcs.map((n) => n.faction).filter((f): f is string => !!f))];
  if (facciones.length) {
    for (const f of await db.faction.findMany({ where: { saveId: e.saveId, name: { in: facciones } }, select: { slug: true, name: true } })) {
      entidades.push({ nombre: f.name, filtro: { actores: { some: { entidadTipo: 'FACCION', entidadId: f.slug } } } });
    }
  }
  if (e.locationId) {
    const lugar = await db.location.findUnique({ where: { id: e.locationId }, select: { name: true } });
    if (lugar) entidades.push({ nombre: lugar.name, filtro: { locationId: e.locationId } });
  }
  // Las consultas van a la vez (es el camino de cada turno); el reparto sin repetir, en orden.
  const porEntidad = await Promise.all(entidades.map((ent) => sucesosConocidos(db, e.saveId, ent.filtro, CALLBACKS_POR_ENTIDAD)));
  for (const [i, ent] of entidades.entries()) {
    const ss = porEntidad[i]!.filter((s) => !ids.has(s.id));
    if (ss.length === 0) continue;
    for (const s of ss) ids.add(s.id);
    lineas.push(`${ent.nombre}: ${ss.map((s) => s.texto).join(' ')}`);
  }
  return { lineas, ids };
}

/// Hilos abiertos que tocan a alguien de la escena y que la jugadora conoce.
export async function hilosDeEscena(db: Db, e: Escena): Promise<string[]> {
  const ids = new Set(e.npcs.map((n) => n.id));
  if (ids.size === 0) return [];
  // Primero los que tocan a la escena y luego el tope (uno poco tenso pero presente también cuenta).
  const hilos = await db.hilo.findMany({ where: { saveId: e.saveId, estado: 'ABIERTO' }, select: { resumen: true, actores: true, sucesoIds: true }, orderBy: { tension: 'desc' } });
  const tocan = hilos.filter((h) => (h.actores as { entidadId: string }[]).some((a) => ids.has(a.entidadId))).slice(0, 20);
  if (tocan.length === 0) return [];
  const sabidos = new Set((await db.conocimiento.findMany({ where: { saveId: e.saveId, sucesoId: { in: tocan.flatMap((h) => h.sucesoIds) } }, select: { sucesoId: true } })).map((c) => c.sucesoId));
  return tocan.filter((h) => h.sucesoIds.some((id) => sabidos.has(id))).map((h) => h.resumen);
}

/// CR-23: lo que la jugadora conoce, ordenado por recencia, importancia y relevancia.
export async function memoriaPorRelevancia(db: Db, e: Escena, excluir: Set<string>): Promise<string[]> {
  const candidatos = await db.suceso.findMany({
    where: { saveId: e.saveId, conocimientos: { some: { confirmado: true } }, importancia: { gte: 3 }, fictionalMinutes: { lte: e.ahora } },
    select: { id: true, texto: true, importancia: true, fictionalMinutes: true, actores: { select: { entidadId: true } } },
    orderBy: { fictionalMinutes: 'desc' },
    take: 200,
  });
  const ctx = { ahora: e.ahora, palabras: palabrasClave(e.accion), actoresEscena: new Set([...e.npcs.map((n) => n.id), ...(e.locationId ? [e.locationId] : [])]) };
  return sinTextosRepetidos(
    candidatos
      .filter((s) => !excluir.has(s.id))
      .map((s) => ({ s, p: puntuar({ ...s, actorIds: s.actores.map((a) => a.entidadId) }, ctx) }))
      .sort((a, b) => b.p - a.p)
      .map(({ s }) => s.texto),
  ).slice(0, MAX_MEMORIA);
}

/// Puro (P247): un mismo texto (p. ej. «Gorhorn despierta de nuevo en X», una vez por cada muerte) ocupa un
/// solo hueco de la memoria, no tres de diez. Conserva el primero (el mejor puntuado) y el orden.
export function sinTextosRepetidos(textos: string[]): string[] {
  return [...new Set(textos)];
}

/// El bloque completo para el narrador (o '' si no hay nada que contar).
export async function bloqueMemoria(db: Db, e: Escena): Promise<string> {
  const [verdad, cb, hilos] = await Promise.all([verdadObligatoria(db, e), callbacks(db, e), hilosDeEscena(db, e)]);
  const memoria = await memoriaPorRelevancia(db, e, cb.ids);
  return componer([
    { titulo: 'VERDAD DEL MUNDO (obligatoria: nunca la contradigas)', lineas: verdad },
    { titulo: 'LO QUE LA JUGADORA YA SABE DE QUIENES ESTÁN AQUÍ (menciónalo si viene a cuento)', lineas: cb.lineas },
    { titulo: 'HISTORIAS EN MARCHA QUE TOCAN A LA ESCENA', lineas: hilos },
    { titulo: 'RECUERDOS QUE PUEDEN VENIR A CUENTO', lineas: memoria },
  ]);
}
