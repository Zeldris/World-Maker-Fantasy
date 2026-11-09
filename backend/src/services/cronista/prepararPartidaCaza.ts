// QA-298 (P338, P339): paso de preparación `partida-caza:<presa>:<n>[:permanente]`, SOLO con funciones del juego (QA-151).
// Deja una partida de caza del Reino en VUELTA, ya en casa y a punto de volver con n piezas de esa presa: al avanzar el día se
// resuelve por el camino normal (`diaDeViajero` → `descargarCaza`: el aviso «La partida de caza vuelve con…», las piezas en el
// Almacén y, con orden permanente, `antesDeRepetir`: el corte de P338 con el Desolladero dañado). No hay dado que fijar: lo
// único aleatorio de una caza es la pelea al llegar, y aquí se sustituye por su resultado (la carga), como la deja `TRABAJOS.CAZA.alLlegar`.
// Si ya hay una partida de caza del Reino en marcha tras esa presa, es esa (con su orden permanente tal cual); si no, se lanza una
// con `lanzarPartida` (la del panel: pide un destino donde se haya visto la presa y cazadores libres con arma).
import type { Prisma, PrismaClient } from '@prisma/client';
import { lanzarPartida, opcionesDePartida } from '../partidasReino.js';
import type { CargaCaza } from '../partidasCaza.js';

export type ResultadoPartidaCaza = { nombre: string; piezas: number; nueva: boolean; permanente: boolean; destino: string } | { error: string };

export async function prepararPartidaCaza(prisma: PrismaClient, { saveId, especie, piezas, permanente = false }: { saveId: string; especie: string; piezas: number; permanente?: boolean }): Promise<ResultadoPartidaCaza> {
  if (!Number.isInteger(piezas) || piezas < 1) return { error: `partida-caza: n tiene que ser un entero de 1 o más (llegó ${piezas}).` };
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, endedAt: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { error: `partida-caza: no hay partida ${saveId} con reloj.` };
  if (save.endedAt) return { error: 'partida-caza: la partida ha terminado.' };
  const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: especie }, select: { name: true } });
  if (!npc) return { error: `partida-caza: no hay presa ${especie}.` };
  const ahora = save.worldState.fictionalMinutes;
  const dia = Math.floor(ahora / 1440);

  return prisma.$transaction(async (tx) => {
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
    // Ya en casa y de vuelta: sin ruta, el avance del día la termina (`diaDeViajero`) y descarga.
    const carga: CargaCaza = { especie, piezas, diaCaza: dia, resumen: `La partida de caza abate ${piezas} ${npc.name}.` };
    const orden = permanente && !nueva ? { repetir: true } : undefined;
    await tx.viajero.update({
      where: { id: v.id },
      data: { estado: 'VUELTA', ubicacionLocationId: v.origenLocationId, ruta: [], minutosEnTramo: 0, ultimoDia: dia, carga: carga as unknown as Prisma.InputJsonValue, ...(orden ? { orden } : {}) },
    });
    const destino = await tx.location.findUnique({ where: { id: v.destinoLocationId }, select: { name: true } });
    return { nombre: npc.name, piezas, nueva, permanente: !!((orden ?? (v.orden as { repetir?: boolean } | null))?.repetir), destino: destino?.name ?? v.destinoLocationId };
  });
}
