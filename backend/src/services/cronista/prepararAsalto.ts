// P295 (2026-11-03): paso de preparación `asalto:<facción>`, SOLO con funciones del juego (QA-151): un ejército de esa
// facción sale contra la Capital del Reino como el de `guerraReino.ts#lanzarEjercitosContraElReino` (viajero `ASALTO`
// creado con `crearViajero`; los soldados que salen dejan de estar en casa) y se corre la vigilancia del día
// (`defensaReino.ts#vigilarDelReino`, la del avance diario): la Torre de vigía lo avista y escribe el aviso en el diario
// del Reino. El asalto queda EN MARCHA, sin resolver: «Llamar a la milicia» (Reino › Defensa) sigue disponible hasta
// que se avance el día. Si la jugadora no está en la Capital, la milicia se arma sola (Q6) y no hay botón que pulsar.
import type { PrismaClient } from '@prisma/client';
import { asentamientosDelReino, planMilicia, TIPO_ASALTO, vigilarDelReino } from '../defensaReino.js';
import { faccionDelReino } from '../guerraReino.js';
import { crearViajero, enlacesDelMundo, lugaresATramos } from '../viajeros.js';

export type ResultadoAsalto = { quien: string; van: number; tramos: number; origen: string; avisado: boolean; milicia: string | null; jugadoraEnCapital: boolean } | { error: string };

/// Soldados que salen como mucho (un ejército pequeño: lo que importa es la alerta, no la batalla).
export const SOLDADOS_DEL_ASALTO = 6;

export async function lanzarAsaltoAlReino(prisma: PrismaClient, { saveId, faccionSlug }: { saveId: string; faccionSlug: string }): Promise<ResultadoAsalto> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { error: `asalto: no hay partida ${saveId} con reloj.` };
  const dia = Math.floor(save.worldState.fictionalMinutes / 1440);
  const f = await prisma.faction.findFirst({
    where: { saveId, origenSlug: faccionSlug, disueltaEn: null },
    select: { id: true, name: true, kingdomStats: { select: { id: true, soldados: true } }, buildings: { where: { locationId: { not: null } }, select: { locationId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 } },
  });
  if (!f) return { error: `asalto: no hay facción «${faccionSlug}» (origenSlug) en la partida.` };
  if (await faccionDelReino(prisma, saveId).then((r) => r?.id === f.id)) return { error: 'asalto: esa facción es el propio Reino.' };
  const van = Math.min(SOLDADOS_DEL_ASALTO, f.kingdomStats?.soldados ?? 0);
  if (!f.kingdomStats || van < 1) return { error: `asalto: ${f.name} no tiene soldados que mandar.` };
  const enMarcha = await prisma.viajero.findFirst({ where: { saveId, factionId: f.id, tipo: TIPO_ASALTO, estado: { not: 'TERMINADO' } }, select: { id: true } });
  if (enMarcha) return { error: `asalto: ${f.name} ya tiene un ejército en marcha.` };

  const r = await prisma.$transaction(async (tx) => {
    const asentamientos = await asentamientosDelReino(tx, saveId);
    const capital = asentamientos.find((a) => a.capital);
    if (!capital) return { error: 'asalto: el Reino no tiene Capital (Ayuntamiento).' } as const;
    if (capital.efecto.radioTramos <= 0) return { error: 'asalto: la Capital no tiene Torre de vigía en pie: nadie avistaría el asalto (dar-reino edificio:torre-vigia).' } as const;
    const alcance = lugaresATramos(await enlacesDelMundo(tx, save.worldId), capital.locationId, capital.efecto.radioTramos);
    // Sale de su casa si la Torre la alcanza; si no, de lo más lejano que la Torre ve (el ejército ya va de camino).
    const casa = f.buildings[0]?.locationId;
    const origen = casa && alcance.has(casa) && casa !== capital.locationId ? casa : [...alcance].filter(([id]) => id !== capital.locationId).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    if (!origen) return { error: 'asalto: no hay ningún lugar al alcance de la Torre desde el que pueda venir.' } as const;
    const motivo = `${f.name} ha reunido ${f.kingdomStats!.soldados} soldados y la guerra está encendida.`;
    const v = await crearViajero(tx, { saveId, factionId: f.id, tipo: TIPO_ASALTO, origenLocationId: origen, destinoLocationId: capital.locationId, dia, carga: { motivo }, miembros: [{ genericos: van, rol: 'soldado' }] });
    if (!v.ok) return { error: `asalto: ${v.motivo}` } as const;
    await tx.kingdomStats.update({ where: { id: f.kingdomStats!.id }, data: { soldados: { decrement: van } } });
    const lugar = await tx.location.findUnique({ where: { id: origen }, select: { name: true } });
    return { capital, origen: lugar?.name ?? origen, tramos: alcance.get(origen)!, viajeroId: v.id } as const;
  });
  if ('error' in r) return { error: String(r.error) };
  const avisados = await vigilarDelReino(prisma, saveId, dia);
  const milicia = (await prisma.$transaction((tx) => planMilicia(tx, saveId, r.capital.id, dia * 1440))).motivo;
  return { quien: f.name, van, tramos: r.tramos, origen: r.origen, avisado: avisados > 0, milicia, jugadoraEnCapital: save.currentLocationId === r.capital.locationId };
}
