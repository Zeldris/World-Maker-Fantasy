// Emisores con búsqueda propia (CR-3, hito 0.2): sucesos cuyos datos (nombre del personaje, minuto
// de ficción) no siempre tiene a mano quien los dispara. Mismo contrato que `registrarSuceso`:
// dentro de la transacción del llamador.
import type { Prisma, PrismaClient } from '@prisma/client';
import { registrarSuceso, minutosDeFiccion } from './sucesos.js';

type Db = PrismaClient | Prisma.TransactionClient;

/// Una misión se cierra (completada o fallida), sea cual sea el camino que la cierra.
export async function registrarFinDeMision(
  db: Db,
  params: { saveId: string; titulo: string; estado: 'COMPLETADA' | 'FALLIDA'; fictionalMinutes?: number; logEntryId?: string | null },
): Promise<string | null> {
  const save = await db.save.findUnique({ where: { id: params.saveId }, select: { characterName: true, currentLocationId: true } });
  if (!save) return null;
  return registrarSuceso(db, {
    saveId: params.saveId,
    tipo: params.estado === 'COMPLETADA' ? 'MISION_COMPLETADA' : 'MISION_FALLIDA',
    fictionalMinutes: params.fictionalMinutes ?? (await minutosDeFiccion(db, params.saveId)),
    locationId: save.currentLocationId,
    origen: 'JUGADOR',
    logEntryId: params.logEntryId ?? null,
    actores: [{ entidadTipo: 'PERSONAJE', entidadId: params.saveId, papel: 'AUTOR' }],
    datos: { personaje: save.characterName, mision: params.titulo },
  });
}
