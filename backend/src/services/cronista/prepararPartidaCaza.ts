// QA-298 (P338, P339): paso de preparación `partida-caza:<presa>:<n>[:permanente]`, SOLO con funciones del juego (QA-151).
// Deja una partida de caza del Reino en VUELTA, ya en casa y a punto de volver con n piezas de esa presa: al avanzar el día se
// resuelve por el camino normal (`diaDeViajero` → `descargarCaza`: el aviso «La partida de caza vuelve con…», las piezas en el
// Almacén y, con orden permanente, `antesDeRepetir`: el corte de P338 con el Desolladero dañado). No hay dado que fijar: lo
// único aleatorio de una caza es la pelea al llegar, y aquí se sustituye por su resultado (la carga), como la deja `TRABAJOS.CAZA.alLlegar`.
// Si ya hay una partida de caza del Reino en marcha tras esa presa, es esa (con su orden permanente tal cual); si no, se lanza una
// con `lanzarPartida` (la del panel: pide un destino donde se haya visto la presa y cazadores libres con arma).
// QA-299 (P439): con `heridos` (`partida-caza:<presa>:heridos=<h>[:permanente]`) la partida vuelve sin piezas y con h heridos: el
// aviso es el que escribe el juego al volver de pelear sin abatir (`resumenDeCaza`, la misma función que `cazarEnDestino`), con h
// fijos en vez de los que salgan del dado; los compañeros de la partida quedan HERIDOS de verdad. El aviso se escribe ya, al preparar
// (el juego lo escribe al llegar al destino, que aquí ya pasó), y al avanzar el día la partida llega a casa sin piezas.
import type { Prisma, PrismaClient } from '@prisma/client';
import { lanzarPartida, opcionesDePartida } from '../partidasReino.js';
import { avisoDelReino, cazadoresDe, peor, resumenDeCaza, type CargaCaza } from '../partidasCaza.js';

export type ResultadoPartidaCaza = { nombre: string; piezas: number; heridos: number; nueva: boolean; permanente: boolean; destino: string } | { error: string };

export async function prepararPartidaCaza(prisma: PrismaClient, { saveId, especie, piezas, permanente = false, heridos = 0 }: { saveId: string; especie: string; piezas: number; permanente?: boolean; heridos?: number }): Promise<ResultadoPartidaCaza> {
  if (heridos > 0 ? piezas !== 0 || !Number.isInteger(heridos) : !Number.isInteger(piezas) || piezas < 1) return { error: heridos > 0 ? 'partida-caza: con heridos no hay piezas (n = 0).' : `partida-caza: n tiene que ser un entero de 1 o más (llegó ${piezas}).` };
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, endedAt: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { error: `partida-caza: no hay partida ${saveId} con reloj.` };
  if (save.endedAt) return { error: 'partida-caza: la partida ha terminado.' };
  const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: especie }, select: { name: true } });
  if (!npc) return { error: `partida-caza: no hay presa ${especie}.` };
  const ahora = save.worldState.fictionalMinutes;
  const dia = Math.floor(ahora / 1440);

  try {
    return await prisma.$transaction(async (tx) => {
    let nueva = false;
    let v = await tx.viajero.findFirst({ where: { saveId, factionId: null, tipo: 'CAZA', objetivo: especie, estado: { not: 'TERMINADO' } }, orderBy: { createdAt: 'asc' } });
    if (!v) {
      const op = await opcionesDePartida(tx, saveId, ahora);
      const destino = op.destinos.find((d) => d.especies.some((e) => e.slug === especie && e.cantidad > 0));
      if (!destino) return { error: `partida-caza: ningún lugar conocido tiene presas de ${npc.name} (hay que haberlas visto).` };
      const libre = op.cazadores.find((c) => !c.sinArma);
      const compa = op.grupos.flatMap((g) => g.companeros)[0];
      if (!libre && !compa) return { error: 'partida-caza: no hay cazadores libres con arma ni compañeros en un grupo 2+ (escenario.sh preparar subditos:<pueblo>:<n>:cazador).' };
      const r = await lanzarPartida(tx, saveId, { tipo: 'CAZA', especie, destinoLocationId: destino.id, ...(libre ? { subjectIds: [libre.id] } : { companionIds: [compa!.id] }), permanente }, ahora);
      if (!r.ok) return { error: `partida-caza: ${r.motivo}` };
      v = await tx.viajero.findUniqueOrThrow({ where: { id: r.id } });
      nueva = true;
    }
    let resumen = `La partida de caza abate ${piezas} ${npc.name}.`;
    if (heridos > 0) {
      const cazadores = await cazadoresDe(tx, await tx.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } }), save.worldId);
      if (heridos > cazadores.length) throw new ErrorPreparar(`partida-caza: la partida solo tiene ${cazadores.length} cazador${cazadores.length === 1 ? '' : 'es'}: no pueden salir ${heridos} heridos.`);
      for (const h of cazadores.slice(0, heridos)) {
        if (!h.companionId) continue;
        const antes = (await tx.companion.findUniqueOrThrow({ where: { id: h.companionId }, select: { condicionFisica: true } })).condicionFisica;
        await tx.companion.update({ where: { id: h.companionId }, data: { condicionFisica: peor(antes, 'HERIDO') } });
      }
      const desarmados = cazadores.filter((h) => h.c.attributeBonus === 0 && !h.companionId).length;
      const lugar = await tx.location.findUniqueOrThrow({ where: { id: v.destinoLocationId }, select: { name: true } });
      resumen = resumenDeCaza({ quien: 'La partida de caza', nombre: npc.name, lugar: lugar.name, encuentros: 1, piezas: 0, capturados: 0, heridos, caidos: 0, muertos: 0, desarmados });
      await avisoDelReino(tx, saveId, resumen);
    }
    // Ya en casa y de vuelta: sin ruta, el avance del día la termina (`diaDeViajero`) y descarga.
    const carga: CargaCaza = { especie, piezas, diaCaza: dia, resumen };
    const orden = permanente && !nueva ? { repetir: true } : undefined;
    await tx.viajero.update({
      where: { id: v.id },
      data: { estado: 'VUELTA', ubicacionLocationId: v.origenLocationId, ruta: [], minutosEnTramo: 0, ultimoDia: dia, carga: carga as unknown as Prisma.InputJsonValue, ...(orden ? { orden } : {}) },
    });
    const destino = await tx.location.findUnique({ where: { id: v.destinoLocationId }, select: { name: true } });
    return { nombre: npc.name, piezas, heridos, nueva, permanente: !!((orden ?? (v.orden as { repetir?: boolean } | null))?.repetir), destino: destino?.name ?? v.destinoLocationId };
    });
  } catch (e) {
    if (e instanceof ErrorPreparar) return { error: e.message };
    throw e;
  }
}

/// Un rechazo con el viajero ya tocado: se lanza dentro de la transacción para que se deshaga lo hecho.
class ErrorPreparar extends Error {}
