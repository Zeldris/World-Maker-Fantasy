import type { Building, Prisma, PrismaClient } from '@prisma/client';
import { fichaDeEdificioParaPanel } from './construction.js';
import { costeDeReparar } from './asaltos.js';
import { ocupantesDeJaulas, type OcupanteDeJaula } from './companionSupervivencia.js';

/// Edificio tal como lo recibe el panel del Reino. Un único constructor para GET /saves/:id y para la respuesta de un
/// turno (REVIEW.md: lo que se añade a un camino va a todos): antes cada uno armaba su lista y el del turno
/// se quedaba sin `caida`, `costeReparar` y lo que se añadiera después.
export interface EdificioParaCliente {
  id: string;
  territoryId: string | null;
  locationId: string | null;
  recipeKey: string | null;
  tier: number | null;
  name: string;
  kind: string;
  status: Building['status'];
  caida: boolean;
  costeReparar: number | null;
  description: string;
  /// P346: quien está atado en esta Jaula (null si no es Jaula o está vacía).
  ocupante: OcupanteDeJaula | null;
  /// P350: por qué y cuándo se dañó (solo si está DANADO). `causa` null = el suceso no la guardó; el día es el que
  /// ve la jugadora (el primero de la partida es el 1). Sale del Libro de Sucesos: no hay campo nuevo en `Building`.
  danio: { causa: string | null; dia: number } | null;
}

/// P350: el último `EDIFICIO_DANADO` de cada edificio dañado (causa y día). Un daño anterior al Libro de Sucesos no
/// tiene suceso: se queda sin entrada y el panel dice solo «Dañado».
async function danosDeEdificios(db: Prisma.TransactionClient | PrismaClient, saveId: string, ids: string[]): Promise<Map<string, { causa: string | null; dia: number }>> {
  const mapa = new Map<string, { causa: string | null; dia: number }>();
  if (ids.length === 0) return mapa;
  const filas = await db.sucesoActor.findMany({
    where: { entidadTipo: 'EDIFICIO', papel: 'VICTIMA', entidadId: { in: ids }, suceso: { saveId, tipo: 'EDIFICIO_DANADO' } },
    select: { entidadId: true, suceso: { select: { fictionalMinutes: true, datos: true } } },
    orderBy: { suceso: { fictionalMinutes: 'desc' } },
  });
  for (const f of filas) {
    if (mapa.has(f.entidadId)) continue;
    const causa = (f.suceso.datos as { causa?: unknown } | null)?.causa;
    mapa.set(f.entidadId, { causa: typeof causa === 'string' && causa.trim() ? causa : null, dia: Math.floor(f.suceso.fictionalMinutes / 1440) + 1 });
  }
  return mapa;
}

export async function edificiosParaCliente(db: Prisma.TransactionClient | PrismaClient, saveId: string, filas: Building[]): Promise<EdificioParaCliente[]> {
  const ocupantes = await ocupantesDeJaulas(db, saveId);
  const danios = await danosDeEdificios(db, saveId, filas.filter((b) => b.status === 'DANADO').map((b) => b.id));
  return filas.map((b) => fichaDeEdificioParaPanel({
    id: b.id,
    territoryId: b.territoryId,
    locationId: b.locationId,
    recipeKey: b.recipeKey,
    tier: b.tier,
    name: b.name,
    kind: b.kind,
    status: b.status,
    caida: b.caida,
    costeReparar: b.status === 'DANADO' || b.caida ? costeDeReparar(b.recipeKey, b.tier) : null,
    description: b.description,
    ocupante: ocupantes.get(b.id) ?? null,
    danio: b.status === 'DANADO' ? (danios.get(b.id) ?? null) : null,
  }));
}
