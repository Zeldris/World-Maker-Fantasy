// Avance diario por partida (CR-7, hito 0.2 — roadmap-cronista.md § 13.1). El mundo de una partida
// avanza con el reloj de esa partida (`WorldState.fictionalMinutes`), no con el tiempo real
// (decisión D-1): cada día de ficción pendiente desde `WorldState.ultimoDiaSimulado` se simula una
// vez, con tope de `MAX_DIAS_POR_LLAMADA` por llamada (un viaje muy largo se completa en las
// siguientes).
//
// Hoy simula: población de la partida (y su reflejo en el reino de sus facciones), economía de sus
// facciones (producción, consumo, almacén y decaimiento de presión) y la agenda del conflicto. Las
// expediciones siguen en `worldTick.ts` sobre el catálogo hasta el siguiente paso de CR-7; el Reino
// del jugador ya avanza por días en `dailyTick.ts`.
import type { PrismaClient } from '@prisma/client';
import { decaerRelaciones, producirFacciones } from './factionEconomy.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { crecerPoblacionDePartida, syncFactionPopulationToKingdomStats } from './population.js';
import { avanzarAgendaDePartida } from './worldAgenda.js';

export const MAX_DIAS_POR_LLAMADA = 30;

/// Día de ficción de un instante (día 0 = el primero de la partida).
export function diaDeFiccion(fictionalMinutes: number): number {
  return Math.floor(fictionalMinutes / 1440);
}

/// Puro: días a simular ahora (acotado; nunca negativo).
export function diasPendientes(ultimoDiaSimulado: number, diaActual: number): number {
  return Math.min(MAX_DIAS_POR_LLAMADA, Math.max(0, diaActual - ultimoDiaSimulado));
}

/// Simula los días pendientes del mundo de la partida hasta `fictionalMinutes`. Idempotente: dos
/// llamadas con el mismo reloj simulan los días una sola vez (candado de Postgres por partida).
export async function avanzarMundoHasta(
  prisma: PrismaClient,
  saveId: string,
  fictionalMinutes: number,
  random: () => number = Math.random,
): Promise<{ diasSimulados: number }> {
  await asegurarMundoDePartida(prisma, saveId);
  const diasSimulados = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avance|${saveId}`}))`;
      const estado = await tx.worldState.findUnique({ where: { saveId }, select: { ultimoDiaSimulado: true } });
      if (!estado) return 0;
      const dias = diasPendientes(estado.ultimoDiaSimulado, diaDeFiccion(fictionalMinutes));
      if (dias === 0) return 0;

      await crecerPoblacionDePartida(tx, saveId, dias, random);
      await syncFactionPopulationToKingdomStats(tx, { saveId });
      await tx.worldState.update({ where: { saveId }, data: { ultimoDiaSimulado: estado.ultimoDiaSimulado + dias } });
      return dias;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  if (diasSimulados > 0) {
    // Economía de las facciones de la partida: idempotente por sus propios marcadores de día y
    // semana (con transacción por facción), así que va fuera de la de arriba.
    const dia = diaDeFiccion(fictionalMinutes);
    const { worldId } = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
    const resultado = { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 };
    await producirFacciones(prisma, worldId, { saveId, origenSlug: { not: null } }, dia, resultado);
    await decaerRelaciones(prisma, { saveId }, dia, resultado);
    // La agenda lleva sus propias transacciones y avanza por umbrales de tiempo (no por día).
    await avanzarAgendaDePartida(prisma, saveId);
  }
  return { diasSimulados };
}
