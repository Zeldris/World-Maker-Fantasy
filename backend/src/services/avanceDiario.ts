// Avance diario por partida (CR-7, hito 0.2 — roadmap-cronista.md § 13.1). El mundo de una partida
// avanza con el reloj de esa partida (`WorldState.fictionalMinutes`), no con el tiempo real
// (decisión D-1): cada día de ficción pendiente desde `WorldState.ultimoDiaSimulado` se simula una
// vez, con tope de `MAX_DIAS_POR_LLAMADA` por llamada (un viaje muy largo se completa en las
// siguientes).
//
// Simula: población de la partida (y su reflejo en el reino de sus facciones), economía de sus
// facciones (producción, consumo, almacén y decaimiento de presión), sus expediciones (con muertes
// en `NpcState.muerto` de la partida), la agenda del conflicto, el narrador de fondo y las
// decisiones de facción (CR-34). El Reino del jugador ya avanza por
// días en `dailyTick.ts`.
import { difundir } from './cronista/difusion.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { decaerRelaciones, producirFacciones } from './factionEconomy.js';
import { avanzarExpedicionesDePartida } from './factionExpeditions.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { crecerPoblacionDePartida, syncFactionPopulationToKingdomStats } from './population.js';
import { avanzarAgendaDePartida } from './worldAgenda.js';
import { procesarReacciones } from './cronista/reacciones.js';
import { evaluarConsecuencias } from './cronista/consecuencias.js';
import { narrarDia } from './cronista/narradorFondo.js';
import { decidirFacciones } from './cronista/decisionesFaccion.js';
import { renovarTablones } from './cronista/generarMisiones.js';
import { revisarMisiones } from './cronista/misionesJugadora.js';
import { envejecerDia } from './cronista/envejecer.js';
import { agruparNoticias, marcaDeNoticias } from './cronista/noticias.js';

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
  const marcaNoticias = await marcaDeNoticias(prisma, saveId);
  const { dias: diasSimulados, desde } = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avance|${saveId}`}))`;
      const estado = await tx.worldState.findUnique({ where: { saveId }, select: { ultimoDiaSimulado: true } });
      if (!estado) return { dias: 0, desde: 0 };
      const dias = diasPendientes(estado.ultimoDiaSimulado, diaDeFiccion(fictionalMinutes));
      if (dias === 0) return { dias: 0, desde: 0 };

      await crecerPoblacionDePartida(tx, saveId, dias, random);
      await syncFactionPopulationToKingdomStats(tx, { saveId });
      await tx.worldState.update({ where: { saveId }, data: { ultimoDiaSimulado: estado.ultimoDiaSimulado + dias } });
      return { dias, desde: estado.ultimoDiaSimulado + 1 };
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
    await avanzarExpedicionesDePartida(prisma, worldId, saveId, dia, random);
    // La agenda lleva sus propias transacciones y avanza por umbrales de tiempo (no por día).
    await avanzarAgendaDePartida(prisma, saveId);
    // CR-12: el narrador de fondo, una vez por cada día simulado (cada día lo reclama una sola llamada,
    // la que lo simuló arriba).
    for (let d = desde; d < desde + diasSimulados; d++) {
      await narrarDia(prisma, saveId, d, random);
      // CR-34: decisiones de las facciones del mundo de la partida (gastan el mismo presupuesto).
      await decidirFacciones(prisma, saveId, d, random);
      // CR-40: avisos vencidos fuera y tablones de avisos rellenos con misiones del mundo de la partida.
      await renovarTablones(prisma, saveId, d, random);
      // CR-13 13b: edad de los nacidos en la partida y muerte de viejo.
      await envejecerDia(prisma, saveId, d, random);
    }
  }
  // CR-10: reacciones de lo que haya pasado en el turno o en estos días; CR-11: consecuencias que
  // toquen ahora (días, región), y otra vuelta de reacciones por lo que hayan registrado.
  await procesarReacciones(prisma, saveId, random);
  if ((await evaluarConsecuencias(prisma, saveId, {}, random)).disparadas > 0) await procesarReacciones(prisma, saveId, random);
  // CR-18 (18b): lo que llega solo (≥ 7 o de una aliada) a la región donde está el personaje; antes
  // del resumen, para que lo que llega al final de un viaje entre en él.
  await difundir(prisma, saveId);
  // CR-12 (12d) / UX-31: varios días de golpe (viaje, descanso largo) → un solo resumen en «El mundo».
  if (diasSimulados >= 2) await agruparNoticias(prisma, saveId, marcaNoticias);
  // CR-40 (40e): misiones del motor exploradas, objetivos caídos o plazos vencidos.
  await revisarMisiones(prisma, saveId);
  return { diasSimulados };
}

/// Avanza el mundo de la partida solo si su reloj ha cruzado algún día sin simular (una lectura si
/// no hay nada que hacer).
export async function avanzarSiCruzaDia(prisma: PrismaClient, saveId: string): Promise<{ diasSimulados: number }> {
  const ws = await prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true, ultimoDiaSimulado: true } });
  if (!ws || diaDeFiccion(ws.fictionalMinutes) <= ws.ultimoDiaSimulado) return { diasSimulados: 0 };
  return avanzarMundoHasta(prisma, saveId, ws.fictionalMinutes);
}

/// UX-29 / UX-35: trabajo de fondo de cada partida tras responder (avance diario, reacciones…). Uno
/// detrás de otro por partida, y el turno siguiente espera a que acabe antes de empezar: el turno
/// nunca espera al día, y el día nunca se cruza con un turno en la base (sin bloqueos mutuos).
const fondoPorPartida = new Map<string, Promise<void>>();

/// Encola `trabajo` tras el fondo que ya tenga la partida. Nunca rechaza.
export function enSegundoPlano(saveId: string, trabajo: () => Promise<unknown>): Promise<void> {
  const previo = fondoPorPartida.get(saveId) ?? Promise.resolve();
  const este = previo.then(trabajo).then(
    () => undefined,
    (err) => console.error('[fondo] error en el trabajo de fondo de la partida:', err),
  );
  fondoPorPartida.set(saveId, este);
  void este.finally(() => {
    if (fondoPorPartida.get(saveId) === este) fondoPorPartida.delete(saveId);
  });
  return este;
}

/// Espera a que acabe el trabajo de fondo pendiente de la partida (si lo hay).
export async function esperarSegundoPlano(saveId: string): Promise<void> {
  while (fondoPorPartida.has(saveId)) await fondoPorPartida.get(saveId);
}

/// Tras cada POST correcto a una partida (`/saves/:id/...`): moverse por la zona, descansar,
/// recolectar, cazar, el modo dinámico… cualquier acción que mueva el reloj sin pasar por el turno
/// narrado avanza también el mundo de la partida. Nunca rompe la respuesta (va tras enviarla).
export function registrarAvanceTrasAcciones(app: FastifyInstance, prisma: PrismaClient): void {
  // UX-29: ninguna acción de la partida empieza mientras su trabajo de fondo (p. ej. el día que cruzó
  // el turno anterior) sigue escribiendo; así nunca se pisan ni se bloquean en la base.
  app.addHook('preHandler', async (request) => {
    if (request.method !== 'POST' || !request.routeOptions.url?.startsWith('/saves/:id')) return;
    const saveId = (request.params as { id?: string } | undefined)?.id;
    if (saveId) await esperarSegundoPlano(saveId);
  });
  app.addHook('onResponse', async (request, reply) => {
    if (request.method !== 'POST' || reply.statusCode >= 400) return;
    if (!request.routeOptions.url?.startsWith('/saves/:id')) return;
    const saveId = (request.params as { id?: string } | undefined)?.id;
    if (!saveId) return;
    await enSegundoPlano(saveId, () => trasAccion(prisma, saveId));
  });
}

async function trasAccion(prisma: PrismaClient, saveId: string): Promise<void> {
  await avanzarSiCruzaDia(prisma, saveId).catch((err) => console.error('[avanceDiario] error tras la acción:', err));
  // CR-10/CR-11: reacciones de lo que haya registrado la acción y consecuencias que toquen (p. ej.
  // al llegar a otra región). Si cruzó día, ya se hizo arriba; repetirlo no cambia nada.
  await procesarReacciones(prisma, saveId).catch((err) => console.error('[reacciones] error tras la acción:', err));
  await evaluarConsecuencias(prisma, saveId)
    .then((r) => (r.disparadas > 0 ? procesarReacciones(prisma, saveId) : undefined))
    .catch((err) => console.error('[consecuencias] error tras la acción:', err));
  // CR-18 (18b): al cambiar de región llega lo que allí ya se sabe de lo grande y reciente.
  await difundir(prisma, saveId).catch((err) => console.error('[difusion] error tras la acción:', err));
  // CR-40 (40e): moverse por la zona o pelear puede cumplir una misión del motor.
  await revisarMisiones(prisma, saveId).catch((err) => console.error('[misiones] error tras la acción:', err));
}
