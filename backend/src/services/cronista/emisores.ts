// Emisores con búsqueda propia (CR-3, hito 0.2): sucesos cuyos datos (nombre del personaje, minuto
// de ficción) no siempre tiene a mano quien los dispara. Mismo contrato que `registrarSuceso`:
// dentro de la transacción del llamador.
import type { Prisma, PrismaClient } from '@prisma/client';
import { registrarSuceso, minutosDeFiccion, type NuevoSuceso } from './sucesos.js';

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

/// Un suceso del propio mundo (expediciones, agenda, clima…) se apunta en el Libro de cada partida
/// viva de ese mundo. Hoy el mundo es compartido; con el mundo por partida (CR-6) cada partida
/// tendrá el suyo y esto pasará a ser una sola. Devuelve los ids creados.
export async function registrarEnPartidasDelMundo(
  db: Db,
  worldId: string,
  construir: (saveId: string, fictionalMinutes: number) => NuevoSuceso,
): Promise<string[]> {
  const saves = await db.save.findMany({ where: { worldId, endedAt: null }, select: { id: true } });
  const ids: string[] = [];
  for (const { id } of saves) ids.push(await registrarSuceso(db, construir(id, await minutosDeFiccion(db, id))));
  return ids;
}

/// Lo que le pasa con el tiempo a un NPC herido o muerto: se recupera de estar convaleciente, o su
/// cadáver termina desapareciendo.
export async function registrarSucesoDeNpc(
  db: Db,
  params: { saveId: string; npcId: string; tipo: 'RECUPERACION_NPC' | 'CADAVER_DESAPARECE'; fictionalMinutes: number },
): Promise<string | null> {
  const npc = await db.npc.findUnique({ where: { id: params.npcId }, select: { name: true } });
  if (!npc) return null;
  return registrarSuceso(db, {
    saveId: params.saveId,
    tipo: params.tipo,
    fictionalMinutes: params.fictionalMinutes,
    origen: 'MUNDO',
    actores: [{ entidadTipo: 'NPC', entidadId: params.npcId, papel: 'AFECTADO' }],
    datos: { npc: npc.name },
  });
}
