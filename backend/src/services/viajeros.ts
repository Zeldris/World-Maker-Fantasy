// Viajeros (CR-63 paso 63a, hito 0.3 — ADR 0003 y decisiones de detalle Q1-Q2 de CR-63). Todo lo que
// se mueve por el mapa es un viajero con ruta real por los enlaces entre lugares, de la jugadora o de
// una facción, con el mismo motor (como las naves de X4):
//
// - La ruta es la más corta por minutos de camino (`LocationLink.minutosBase`), en los dos sentidos.
// - Cada día camina una jornada de 8 h: cruza los lugares que le alcancen y, si un tramo es más largo,
//   se queda a medio camino (`minutosEnTramo`).
// - IDA → al llegar, TRABAJANDO (lo que haga según su tipo: cazar, capturar…) → VUELTA → TERMINADO.
//
// Lo que hace cada tipo al llegar y al volver lo registra su módulo en `TRABAJOS` (63b caza, 63c
// captura). El avance es idempotente por `ultimoDia` y va día a día (QA-19).
import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/// Q2: lo que camina un viajero en un día.
export const JORNADA_MINUTOS = 8 * 60;

export interface Enlace {
  fromId: string;
  toId: string;
  minutosBase: number;
}

export type EstadoViajero = 'IDA' | 'TRABAJANDO' | 'VUELTA' | 'TERMINADO';

/// Puro: vecinos de cada lugar con sus minutos (los enlaces valen en los dos sentidos).
function grafo(enlaces: Enlace[]): Map<string, Map<string, number>> {
  const g = new Map<string, Map<string, number>>();
  const poner = (a: string, b: string, m: number) => {
    const v = g.get(a) ?? new Map<string, number>();
    v.set(b, Math.min(v.get(b) ?? Infinity, Math.max(0, m)));
    g.set(a, v);
  };
  for (const e of enlaces) {
    poner(e.fromId, e.toId, e.minutosBase);
    poner(e.toId, e.fromId, e.minutosBase);
  }
  return g;
}

/// Puro: la ruta más corta (Dijkstra por minutos) de `desde` a `hasta`, sin incluir `desde`. [] si ya
/// está; null si no hay camino.
export function rutaMasCorta(enlaces: Enlace[], desde: string, hasta: string): string[] | null {
  if (desde === hasta) return [];
  const g = grafo(enlaces);
  const dist = new Map<string, number>([[desde, 0]]);
  const previo = new Map<string, string>();
  const abiertos = new Set<string>([desde]);
  while (abiertos.size > 0) {
    let actual: string | null = null;
    for (const n of abiertos) if (actual === null || dist.get(n)! < dist.get(actual)! || (dist.get(n) === dist.get(actual) && n < actual)) actual = n;
    abiertos.delete(actual!);
    if (actual === hasta) break;
    for (const [vecino, m] of g.get(actual!) ?? []) {
      const d = dist.get(actual!)! + m;
      if (d < (dist.get(vecino) ?? Infinity)) {
        dist.set(vecino, d);
        previo.set(vecino, actual!);
        abiertos.add(vecino);
      }
    }
  }
  if (!dist.has(hasta)) return null;
  const ruta: string[] = [];
  for (let n = hasta; n !== desde; n = previo.get(n)!) ruta.unshift(n);
  return ruta;
}

/// Puro: minutos de camino entre dos lugares enlazados.
export function minutosTramo(enlaces: Enlace[], a: string, b: string): number {
  return grafo(enlaces).get(a)?.get(b) ?? Infinity;
}

export interface Posicion {
  ubicacion: string;
  ruta: string[];
  minutosEnTramo: number;
}

/// Puro: una jornada de camino. Devuelve la posición nueva y los lugares a los que llegó por orden.
export function avanzarJornada(pos: Posicion, enlaces: Enlace[], minutos = JORNADA_MINUTOS): { pos: Posicion; cruzados: string[] } {
  let { ubicacion, minutosEnTramo } = pos;
  const ruta = [...pos.ruta];
  const cruzados: string[] = [];
  let quedan = minutos;
  while (ruta.length > 0) {
    const falta = minutosTramo(enlaces, ubicacion, ruta[0]!) - minutosEnTramo;
    if (falta > quedan) {
      minutosEnTramo += quedan;
      break;
    }
    quedan -= Math.max(0, falta);
    ubicacion = ruta.shift()!;
    minutosEnTramo = 0;
    cruzados.push(ubicacion);
  }
  return { pos: { ubicacion, ruta, minutosEnTramo }, cruzados };
}

// ─────────────────────────── Con base de datos ───────────────────────────

export type ViajeroFila = Prisma.ViajeroGetPayload<{ include: { miembros: true } }>;

/// Lo que hace un tipo de viajero al llegar a su destino (TRABAJANDO) y al volver a casa. Lo
/// registran sus módulos (63b caza, 63c captura). Sin entrada, llega y se da la vuelta.
export interface TrabajoViajero {
  alLlegar?: (tx: Tx, v: ViajeroFila, dia: number, random: () => number) => Promise<void>;
  alVolver?: (tx: Tx, v: ViajeroFila, dia: number, random: () => number) => Promise<void>;
}
export const TRABAJOS: Record<string, TrabajoViajero> = {};

export async function enlacesDelMundo(tx: Tx, worldId: string): Promise<Enlace[]> {
  return tx.locationLink.findMany({ where: { from: { worldId } }, select: { fromId: true, toId: true, minutosBase: true } });
}

export interface NuevoViajero {
  saveId: string;
  factionId?: string | null;
  tipo: string;
  origenLocationId: string;
  destinoLocationId: string;
  objetivo?: string | null;
  orden?: Prisma.InputJsonValue | null;
  dia: number;
  miembros: { companionId?: string; subjectId?: string; genericos?: number; rol: string }[];
}

/// Crea un viajero con su ruta; falla si no hay camino.
export async function crearViajero(tx: Tx, n: NuevoViajero): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: n.saveId }, select: { worldId: true } });
  const ruta = rutaMasCorta(await enlacesDelMundo(tx, worldId), n.origenLocationId, n.destinoLocationId);
  if (!ruta) return { ok: false, motivo: 'No hay camino hasta allí.' };
  const v = await tx.viajero.create({
    data: {
      saveId: n.saveId, factionId: n.factionId ?? null, tipo: n.tipo, objetivo: n.objetivo ?? null,
      origenLocationId: n.origenLocationId, destinoLocationId: n.destinoLocationId, ubicacionLocationId: n.origenLocationId,
      ruta, diaSalida: n.dia, ultimoDia: n.dia, orden: n.orden ?? undefined,
      diario: [{ locationId: n.origenLocationId, dia: n.dia }],
      miembros: { create: n.miembros.map((m) => ({ companionId: m.companionId ?? null, subjectId: m.subjectId ?? null, genericos: m.genericos ?? 0, rol: m.rol })) },
    },
  });
  return { ok: true, id: v.id };
}

/// Un día de un viajero (el `dia` siguiente a su `ultimoDia`).
export async function diaDeViajero(tx: Tx, v: ViajeroFila, enlaces: Enlace[], dia: number, random: () => number): Promise<void> {
  const trabajo = TRABAJOS[v.tipo] ?? {};
  let estado = v.estado as EstadoViajero;
  let pos: Posicion = { ubicacion: v.ubicacionLocationId, ruta: v.ruta, minutosEnTramo: v.minutosEnTramo };
  const diario = [...((v.diario as { locationId: string; dia: number }[] | null) ?? [])];
  if (estado === 'TRABAJANDO') {
    // Un día en el destino; luego, de vuelta por la ruta más corta.
    await trabajo.alLlegar?.(tx, v, dia, random);
    estado = 'VUELTA';
    pos = { ubicacion: pos.ubicacion, ruta: rutaMasCorta(enlaces, pos.ubicacion, v.origenLocationId) ?? [], minutosEnTramo: 0 };
  } else if (estado === 'IDA' || estado === 'VUELTA') {
    const r = avanzarJornada(pos, enlaces);
    pos = r.pos;
    for (const l of r.cruzados) diario.push({ locationId: l, dia });
    if (pos.ruta.length === 0) estado = estado === 'IDA' ? 'TRABAJANDO' : 'TERMINADO';
  }
  const actualizado = await tx.viajero.update({
    where: { id: v.id },
    data: { estado, ubicacionLocationId: pos.ubicacion, ruta: pos.ruta, minutosEnTramo: pos.minutosEnTramo, ultimoDia: dia, diario },
    include: { miembros: true },
  });
  // Al volver a casa, con su posición ya en el origen (descarga, orden permanente…).
  if (estado === 'TERMINADO' && v.estado !== 'TERMINADO') await trabajo.alVolver?.(tx, actualizado, dia, random);
}

/// El día `dia` de todos los viajeros de la partida que aún no lo han vivido (idempotente por
/// `ultimoDia`). Lo llama `avanzarMundoHasta` dentro de su bucle de días, que ya da cada día a una sola
/// llamada (la que lo simuló), así que no hay dos pasadas sobre el mismo día.
export async function avanzarViajeros(prisma: PrismaClient, saveId: string, dia: number, random: () => number): Promise<number> {
  const { worldId } = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const enlaces = await enlacesDelMundo(prisma, worldId);
  const pendientes = await prisma.viajero.findMany({ where: { saveId, estado: { not: 'TERMINADO' }, ultimoDia: { lt: dia } }, include: { miembros: true }, orderBy: { createdAt: 'asc' } });
  for (const v of pendientes) {
    // Un viajero creado a mitad de un salto vive solo los días que le tocan desde su salida.
    await prisma.$transaction((tx) => diaDeViajero(tx, v, enlaces, dia, random));
  }
  return pendientes.length;
}
