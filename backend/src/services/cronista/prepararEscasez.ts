// P180 (2026-11-03): paso de preparación `escasez:<facción>[:comida]`, SOLO con funciones del juego (QA-151): deja a una
// facción del mundo en COMIDA carencia (la que hace que su tablón cuelgue encargos «le falta…» / «para el Clan…»,
// `generarMisiones.ts#candidatasDeFaccion`). Lo hace como el juego: el efecto `danarEdificio` (`efectos.ts`, el de las
// tormentas) sobre sus cocinas activas, de una en una, hasta que `situacionDeFaccion` (la que lee el generador de
// misiones) ve la carencia; la producción de comida baja, el balance se hace negativo y la reserva se agota en días.
// No toca la comida ni los números del Reino: solo edificios.
import type { PrismaClient } from '@prisma/client';
import { COCINA_RECIPE_KEYS } from '../kingdomTick.js';
import { aplicarEfecto } from './efectos.js';
import { situacionDeFaccion } from './situacionFaccion.js';

export type ResultadoEscasez = { yaTenia: boolean; danados: string[]; gravedad: string } | { error: string };

const comidaCarencia = async (prisma: PrismaClient, factionId: string) => (await situacionDeFaccion(prisma, factionId))?.carencias.find((c) => c.tipo === 'COMIDA') ?? null;

export async function dejarEnEscasez(prisma: PrismaClient, { saveId, faccionSlug, recurso }: { saveId: string; faccionSlug: string; recurso: string | null }): Promise<ResultadoEscasez> {
  if (recurso && recurso !== 'comida') return { error: `escasez: solo hay escasez de comida (los encargos «le falta…» salen de la carencia de COMIDA), no de «${recurso}».` };
  const [save, ws, faccion] = await Promise.all([
    prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } }),
    prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }),
    prisma.faction.findFirst({ where: { saveId, origenSlug: faccionSlug, disueltaEn: null }, select: { id: true, name: true } }),
  ]);
  if (!save || !ws) return { error: `escasez: no hay partida ${saveId} con reloj.` };
  if (!faccion) return { error: `escasez: no hay facción «${faccionSlug}» (origenSlug) en la partida.` };
  const previa = await comidaCarencia(prisma, faccion.id);
  if (previa) return { yaTenia: true, danados: [], gravedad: previa.gravedad };
  const cocinas = await prisma.building.findMany({ where: { factionId: faccion.id, status: 'ACTIVO', recipeKey: { in: [...COCINA_RECIPE_KEYS] } }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } });
  const danados: string[] = [];
  for (const c of cocinas) {
    const res = await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId: save.worldId, fictionalMinutes: ws.fictionalMinutes, origen: 'MOTOR' }, { tipo: 'danarEdificio', buildingId: c.id, causa: 'una tormenta' }));
    if (res.aplicado) danados.push(c.name);
    const ahora = await comidaCarencia(prisma, faccion.id);
    if (ahora) return { yaTenia: false, danados, gravedad: ahora.gravedad };
  }
  return { error: `escasez: ${faccion.name} sigue sin carencia de comida tras dañar ${danados.length} cocina(s) (${danados.join(', ') || 'ninguna activa'}): su reserva da para más de 10 días; quítale comida con el juego o usa otra facción.` };
}
