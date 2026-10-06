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
import { avanzarComercio } from './caravanas.js';
import { procesarReacciones } from './cronista/reacciones.js';
import { evaluarConsecuencias } from './cronista/consecuencias.js';
import { narrarDia } from './cronista/narradorFondo.js';
import { decidirFacciones } from './cronista/decisionesFaccion.js';
import { renovarTablones } from './cronista/generarMisiones.js';
import { revisarMisiones } from './cronista/misionesJugadora.js';
import { envejecerDia } from './cronista/envejecer.js';
import { agruparNoticias, marcaDeNoticias } from './cronista/noticias.js';
import { revisarEtiquetasDeReputacion } from './cronista/etiquetas.js';
import { revisarMarchas } from './cronista/aprobacion.js';
import { asegurarLinajes } from './cronista/linajes.js';
import { avanzarSubditos } from './cronista/subditos.js';
import { revisarLlegadas } from './cronista/llegadas.js';
import { revisarFamilias } from './cronista/familias.js';
import { revisarSalidas } from './cronista/salidas.js';
import { revisarInformantes } from './cronista/reclutamiento.js';

export const MAX_DIAS_POR_LLAMADA = 30;

/// Día de ficción de un instante (día 0 = el primero de la partida).
export function diaDeFiccion(fictionalMinutes: number): number {
  return Math.floor(fictionalMinutes / 1440);
}

/// Puro: días a simular ahora (acotado; nunca negativo).
export function diasPendientes(ultimoDiaSimulado: number, diaActual: number): number {
  return Math.min(MAX_DIAS_POR_LLAMADA, Math.max(0, diaActual - ultimoDiaSimulado));
}

/// CR-48: tiempo por paso del avance diario (solo con `AVANCE_PERFIL=1`; `npm run benchmark-avance`).
const perfil = new Map<string, { ms: number; veces: number }>();
async function paso<T>(nombre: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.AVANCE_PERFIL !== '1') return fn();
  const t = performance.now();
  try {
    return await fn();
  } finally {
    const p = perfil.get(nombre) ?? { ms: 0, veces: 0 };
    perfil.set(nombre, { ms: p.ms + performance.now() - t, veces: p.veces + 1 });
  }
}
/// Lo medido hasta ahora (y lo vacía).
export function leerPerfilAvance(): Record<string, { ms: number; veces: number }> {
  const r = Object.fromEntries(perfil);
  perfil.clear();
  return r;
}

/// Simula los días pendientes del mundo de la partida hasta `fictionalMinutes`. Idempotente: dos
/// llamadas con el mismo reloj simulan los días una sola vez (candado de Postgres por partida).
export async function avanzarMundoHasta(
  prisma: PrismaClient,
  saveId: string,
  fictionalMinutes: number,
  random: () => number = Math.random,
): Promise<{ diasSimulados: number }> {
  await paso('asegurarMundo', () => asegurarMundoDePartida(prisma, saveId));
  const marcaNoticias = await marcaDeNoticias(prisma, saveId);
  const { dias: diasSimulados, desde } = await paso('poblacion', () => prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avance|${saveId}`}))`;
      // CR-52: linajes del canon y el del personaje (una vez por partida), bajo el mismo candado.
      await asegurarLinajes(tx, saveId, fictionalMinutes);
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
  ));
  if (diasSimulados > 0) {
    // Economía de las facciones de la partida: idempotente por sus propios marcadores de día y
    // semana (con transacción por facción), así que va fuera de la de arriba.
    const dia = diaDeFiccion(fictionalMinutes);
    const { worldId } = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
    const resultado = { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 };
    await paso('producirFacciones', () => producirFacciones(prisma, worldId, { saveId, origenSlug: { not: null } }, dia, resultado));
    await paso('decaerRelaciones', () => decaerRelaciones(prisma, { saveId }, dia, resultado));
    await paso('expediciones', () => avanzarExpedicionesDePartida(prisma, worldId, saveId, dia, random));
    // La agenda lleva sus propias transacciones y avanza por umbrales de tiempo (no por día).
    await paso('agenda', () => avanzarAgendaDePartida(prisma, saveId));
    // REI-118: la felicidad de cada súbdito sigue a la del Reino; la población son los súbditos.
    await paso('subditos', () => prisma.$transaction((tx) => avanzarSubditos(tx, saveId, diasSimulados, fictionalMinutes)));
    // CR-12: el narrador de fondo, una vez por cada día simulado (cada día lo reclama una sola llamada,
    // la que lo simuló arriba).
    for (let d = desde; d < desde + diasSimulados; d++) {
      await paso('narrarDia', () => narrarDia(prisma, saveId, d, random));
      // CR-34: decisiones de las facciones del mundo de la partida (gastan el mismo presupuesto).
      await paso('decidirFacciones', () => decidirFacciones(prisma, saveId, d, random));
      // CR-40: avisos vencidos fuera y tablones de avisos rellenos con misiones del mundo de la partida.
      await paso('renovarTablones', () => renovarTablones(prisma, saveId, d, random));
      // CR-13 13b: edad de los nacidos en la partida y muerte de viejo.
      await paso('envejecerDia', () => envejecerDia(prisma, saveId, d, random));
      // CR-47: caravanas del Reino (salen las órdenes que toque, comercian al llegar, vuelven).
      await paso('comercio', () => avanzarComercio(prisma, saveId, d, random));
      // CR-32: cada semana, los informantes pasan lo que saben (o los descubren).
      await paso('informantes', () => prisma.$transaction((tx) => revisarInformantes(tx, { saveId, worldId, dia: d, random })));
      // CR-15: el compañero que lleva 3 días con la aprobación por los suelos se va (cada día simulado).
      await paso('marchasCompaneros', async () => {
        const ws = await prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
        await prisma.$transaction((tx) => revisarMarchas(tx, { saveId, fictionalMinutes: Math.min(ws?.fictionalMinutes ?? 0, (d + 1) * 1440 - 1) }));
      });
      // REI-119: los candidatos sin respuesta se van y, una vez por semana, llega uno nuevo.
      await paso('poblacionReino', async () => {
        const ws = await prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
        const ahora = Math.min(ws?.fictionalMinutes ?? 0, (d + 1) * 1440 - 1);
        await prisma.$transaction((tx) => revisarLlegadas(tx, saveId, ahora, random));
        // REI-120: una vez por semana, parejas nuevas y crías.
        await prisma.$transaction((tx) => revisarFamilias(tx, saveId, ahora, random));
        // REI-121: muertes de viejo y de hambre; con el Reino triste, una salida por semana.
        await prisma.$transaction((tx) => revisarSalidas(tx, saveId, ahora, random));
      });
    }
    // CR-14: etiquetas de relación (AMIGO_DE / ENEMIGO_DE) según la reputación del final del día.
    await paso('etiquetasReputacion', async () => {
      const ws = await prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
      await prisma.$transaction((tx) => revisarEtiquetasDeReputacion(tx, { saveId, worldId, fictionalMinutes: ws?.fictionalMinutes ?? 0 }));
    });

  }
  // CR-10: reacciones de lo que haya pasado en el turno o en estos días; CR-11: consecuencias que
  // toquen ahora (días, región), y otra vuelta de reacciones por lo que hayan registrado.
  await paso('reacciones', () => procesarReacciones(prisma, saveId, random));
  if ((await paso('consecuencias', () => evaluarConsecuencias(prisma, saveId, {}, random))).disparadas > 0) await paso('reacciones', () => procesarReacciones(prisma, saveId, random));
  // CR-18 (18b): lo que llega solo (≥ 7 o de una aliada) a la región donde está el personaje; antes
  // del resumen, para que lo que llega al final de un viaje entre en él.
  await paso('difundir', () => difundir(prisma, saveId));
  // CR-12 (12d) / UX-31: varios días de golpe (viaje, descanso largo) → un solo resumen en «El mundo».
  if (diasSimulados >= 2) await paso('agruparNoticias', () => agruparNoticias(prisma, saveId, marcaNoticias));
  // CR-40 (40e): misiones del motor exploradas, objetivos caídos o plazos vencidos.
  await paso('revisarMisiones', () => revisarMisiones(prisma, saveId));
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

/// Espera a que acabe el trabajo de fondo de todas las partidas (para los tests con base real, que
/// borran su partida nada más terminar).
export async function esperarTodoElFondo(): Promise<void> {
  while (fondoPorPartida.size > 0) await Promise.all([...fondoPorPartida.values()]);
}

/// Tras cada POST correcto a una partida (`/saves/:id/...`): moverse por la zona, descansar,
/// recolectar, cazar, el modo dinámico… cualquier acción que mueva el reloj sin pasar por el turno
/// narrado avanza también el mundo de la partida. Nunca rompe la respuesta (va tras enviarla).
export function registrarAvanceTrasAcciones(app: FastifyInstance, prisma: PrismaClient): void {
  // UX-29: ninguna acción de la partida empieza mientras su trabajo de fondo (p. ej. el día que cruzó
  // el turno anterior) sigue escribiendo; así nunca se pisan ni se bloquean en la base.
  // También al borrarla: un borrado en cascada a la vez que el avance del día se bloquea en Postgres.
  app.addHook('preHandler', async (request) => {
    if (request.method === 'GET' || !request.routeOptions.url?.startsWith('/saves/:id')) return;
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
