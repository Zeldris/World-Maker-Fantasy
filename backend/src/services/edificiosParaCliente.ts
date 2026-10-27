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
}

export async function edificiosParaCliente(db: Prisma.TransactionClient | PrismaClient, saveId: string, filas: Building[]): Promise<EdificioParaCliente[]> {
  const ocupantes = await ocupantesDeJaulas(db, saveId);
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
  }));
}
