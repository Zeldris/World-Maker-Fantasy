// Partidas del Reino (CR-63 paso 63d, hito 0.3 — decisiones Q3 y Q7 de la ronda de detalle): lo que
// usa el panel «Partidas» de Reino. Una partida sale del Ayuntamiento con 1-4 grupos de 4 (tus
// grupos de combate 2+ y súbditos con el rol «cazador»), a cazar o capturar una especie en un lugar
// que conoces, de una vez o con orden permanente; se puede parar, hacer volver o cambiar de destino.
import type { Prisma } from '@prisma/client';
import { MAX_COMBATIENTES_POR_BANDO } from './combateMultiple.js';
import { esAdultoSubdito, rolDeSubdito, subditosSinArma } from './cronista/subditos.js';
import { prepararCaptura } from './partidasCaptura.js';
import { crearViajero, enlacesDelMundo, rutaMasCorta, TIPOS_SIN_DUENO, type OrdenViajero } from './viajeros.js';

type Tx = Prisma.TransactionClient;

export const MAX_GRUPOS_PARTIDA = 4;
export const MAX_MIEMBROS_PARTIDA = MAX_GRUPOS_PARTIDA * MAX_COMBATIENTES_POR_BANDO;
export const TIPOS_PARTIDA = ['CAZA', 'CAPTURA'] as const;
export type TipoPartida = (typeof TIPOS_PARTIDA)[number];

const enMarcha = { estado: { not: 'TERMINADO' } };
/// P283: las partidas que volvieron se ven esta cantidad de días y luego salen de la lista.
export const DIAS_VISIBLE_VUELTA = 7;

/// De dónde salen: el lugar del Ayuntamiento (o, sin él, el de cualquier edificio del Reino).
export async function origenDelReino(tx: Tx, saveId: string): Promise<{ id: string; name: string } | null> {
  const edificio = (await tx.building.findFirst({ where: { saveId, status: 'ACTIVO', recipeKey: 'ayuntamiento', locationId: { not: null } }, select: { location: { select: { id: true, name: true } } } }))
    ?? (await tx.building.findFirst({ where: { saveId, status: 'ACTIVO', locationId: { not: null } }, orderBy: { createdAt: 'asc' }, select: { location: { select: { id: true, name: true } } } }));
  return edificio?.location ?? null;
}

/// Quién está fuera ahora con alguna partida (CR-50 lo reusa para los ataques a campamentos).
export async function ocupados(tx: Tx, saveId: string) {
  const m = await tx.viajeroMiembro.findMany({ where: { viajero: { saveId, ...enMarcha } }, select: { companionId: true, subjectId: true } });
  return { companions: new Set(m.map((x) => x.companionId).filter(Boolean)), subjects: new Set(m.map((x) => x.subjectId).filter(Boolean)) };
}

/// Quién puede salir y adónde.
export async function opcionesDePartida(tx: Tx, saveId: string, ahora: number) {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const origen = await origenDelReino(tx, saveId);
  const fuera = await ocupados(tx, saveId);
  const subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true }, orderBy: { createdAt: 'asc' } });
  // Q3 (P281): adulto y con arma, como un soldado. Los que no tienen arma salen en la lista, marcados.
  const sinArma = await subditosSinArma(tx, saveId, ahora);
  const aptos = subditos.filter((s) => rolDeSubdito(s.role) === 'cazador' && esAdultoSubdito(s, ahora));
  const cazadores = aptos.filter((s) => !fuera.subjects.has(s.id)).map((s) => ({ id: s.id, name: s.name, sinArma: sinArma.has(s.id) }));
  // P283: los que están fuera con una partida (para decir «volverán» y no «no tienes cazadores»).
  const cazadoresFuera = aptos.filter((s) => fuera.subjects.has(s.id)).map((s) => s.name);
  const [companeros, nombres] = await Promise.all([
    tx.companion.findMany({ where: { saveId, tipo: 'NPC', rolReino: null, combatGroupSlotIndex: { gt: 0 }, condicionFisica: { notIn: ['MUERTO', 'CONVALECIENTE'] } }, select: { id: true, name: true, combatGroupSlotIndex: true }, orderBy: [{ combatGroupSlotIndex: 'asc' }, { createdAt: 'asc' }] }),
    tx.combatGroup.findMany({ where: { saveId }, select: { slotIndex: true, name: true } }),
  ]);
  const grupos = [...new Set(companeros.map((c) => c.combatGroupSlotIndex))].map((slot) => ({
    slotIndex: slot,
    nombre: nombres.find((n) => n.slotIndex === slot)?.name ?? `Grupo ${slot + 1}`,
    companeros: companeros.filter((c) => c.combatGroupSlotIndex === slot && !fuera.companions.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
  })).filter((g) => g.companeros.length > 0);
  // Destinos: lugares que conoces con fauna a la vista y camino desde el Reino. P313: un punto agotado
  // se queda (con `cantidad` 0) para que la lista diga «sin presas por ahora»; vuelve a tener con el tiempo.
  const visitados = await tx.locationVisit.findMany({ where: { saveId }, select: { locationId: true } });
  const enlaces = await enlacesDelMundo(tx, save.worldId);
  const puntos = await tx.zonePoint.findMany({ where: { saveId, tipo: 'FAUNA', locationId: { in: visitados.map((v) => v.locationId) } }, select: { locationId: true, targetSlug: true, cantidad: true } });
  const fauna = await tx.npc.findMany({ where: { worldId: save.worldId, saveId: null, slug: { in: [...new Set(puntos.map((p) => p.targetSlug))] } }, select: { slug: true, name: true, capturablePct: true } });
  const lugares = await tx.location.findMany({ where: { id: { in: [...new Set(puntos.map((p) => p.locationId))] } }, select: { id: true, name: true, region: true }, orderBy: { name: 'asc' } });
  const destinos = lugares
    .filter((l) => origen && rutaMasCorta(enlaces, origen.id, l.id) !== null)
    .map((l) => {
      const porEspecie = new Map<string, number>();
      for (const p of puntos.filter((x) => x.locationId === l.id)) porEspecie.set(p.targetSlug, (porEspecie.get(p.targetSlug) ?? 0) + p.cantidad);
      return {
        ...l,
        especies: [...porEspecie].map(([slug, cantidad]) => {
          const f = fauna.find((x) => x.slug === slug);
          return { slug, name: f?.name ?? slug, cantidad, capturable: (f?.capturablePct ?? 0) > 0 };
        }),
      };
    });
  return { origen, cazadores, cazadoresFuera, grupos, destinos };
}

export interface PeticionPartida {
  tipo: string;
  especie: string;
  destinoLocationId: string;
  companionIds?: string[];
  subjectIds?: string[];
  permanente?: boolean;
}

/// Q3/Q7: lanza una partida del Reino.
export async function lanzarPartida(tx: Tx, saveId: string, p: PeticionPartida, ahora: number): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  if (!(TIPOS_PARTIDA as readonly string[]).includes(p.tipo)) return { ok: false, motivo: `Tipo de partida desconocido: ${p.tipo}` };
  const op = await opcionesDePartida(tx, saveId, ahora);
  if (!op.origen) return { ok: false, motivo: 'Tu Reino no tiene ningún edificio desde el que salir.' };
  const destino = op.destinos.find((d) => d.id === p.destinoLocationId);
  if (!destino) return { ok: false, motivo: 'No conoces ese lugar o no hay camino hasta él.' };
  const especie = destino.especies.find((e) => e.slug === p.especie);
  if (!especie) return { ok: false, motivo: 'No has visto esa especie allí.' };
  if (especie.cantidad <= 0) return { ok: false, motivo: `No quedan presas de ${especie.name} en ${destino.name} por ahora.` };
  if (p.tipo === 'CAPTURA' && !especie.capturable) return { ok: false, motivo: `${especie.name} no se deja capturar.` };
  const libresComp = new Set(op.grupos.flatMap((g) => g.companeros.map((c) => c.id)));
  const libresSub = new Set(op.cazadores.map((c) => c.id));
  const desarmados = op.cazadores.filter((c) => c.sinArma && (p.subjectIds ?? []).includes(c.id));
  if (desarmados.length > 0) return { ok: false, motivo: `${desarmados.map((c) => c.name).join(', ')} no ${desarmados.length === 1 ? 'tiene' : 'tienen'} arma: un cazador sale armado como un soldado.` };
  const companionIds = [...new Set(p.companionIds ?? [])];
  const subjectIds = [...new Set(p.subjectIds ?? [])];
  if (companionIds.some((id) => !libresComp.has(id)) || subjectIds.some((id) => !libresSub.has(id))) return { ok: false, motivo: 'Alguno de los que eliges no puede salir ahora.' };
  const total = companionIds.length + subjectIds.length;
  if (total === 0) return { ok: false, motivo: 'Elige quién va en la partida.' };
  if (total > MAX_MIEMBROS_PARTIDA) return { ok: false, motivo: `Una partida lleva como mucho ${MAX_MIEMBROS_PARTIDA} (${MAX_GRUPOS_PARTIDA} grupos de ${MAX_COMBATIENTES_POR_BANDO}).` };
  let carga: Prisma.InputJsonValue | null = null;
  if (p.tipo === 'CAPTURA') {
    const prep = await prepararCaptura(tx, saveId, p.especie);
    if (!prep.ok) return prep;
    carga = { cuerdas: prep.cuerdas };
  }
  const orden: OrdenViajero | null = p.permanente ? { repetir: true } : null;
  return crearViajero(tx, {
    saveId, tipo: p.tipo, objetivo: p.especie, origenLocationId: op.origen.id, destinoLocationId: destino.id, dia: Math.floor(ahora / 1440),
    orden: orden as Prisma.InputJsonValue | null, carga,
    miembros: [...companionIds.map((companionId) => ({ companionId, rol: 'cazador' })), ...subjectIds.map((subjectId) => ({ subjectId, rol: 'cazador' }))],
  });
}

/// Q7/Q9: órdenes a una partida tuya en marcha.
export async function ordenarPartida(tx: Tx, saveId: string, id: string, accion: string, destinoLocationId?: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const v = await tx.viajero.findFirst({ where: { id, saveId, factionId: null, tipo: { notIn: TIPOS_SIN_DUENO }, ...enMarcha } });
  if (!v) return { ok: false, motivo: 'Esa partida no está en marcha.' };
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const enlaces = await enlacesDelMundo(tx, worldId);
  if (accion === 'parar') {
    await tx.viajero.update({ where: { id }, data: { orden: { repetir: false } } });
    return { ok: true };
  }
  if (accion === 'volver') {
    if (v.estado === 'VUELTA') return { ok: true };
    await tx.viajero.update({ where: { id }, data: { estado: 'VUELTA', orden: { repetir: false }, ruta: rutaMasCorta(enlaces, v.ubicacionLocationId, v.origenLocationId) ?? [], minutosEnTramo: 0 } });
    return { ok: true };
  }
  if (accion === 'destino' && destinoLocationId) {
    if (v.estado !== 'IDA') return { ok: false, motivo: 'Solo se cambia el destino de una partida que aún va de camino.' };
    // Las mismas reglas que al lanzarla: un lugar que conoces y donde has visto su presa.
    const [visitado, presa] = await Promise.all([
      tx.locationVisit.findFirst({ where: { saveId, locationId: destinoLocationId }, select: { id: true } }),
      tx.zonePoint.findFirst({ where: { saveId, locationId: destinoLocationId, tipo: 'FAUNA', targetSlug: v.objetivo ?? '', activo: true, cantidad: { gt: 0 } }, select: { id: true } }),
    ]);
    if (!visitado) return { ok: false, motivo: 'No conoces ese lugar.' };
    if (!presa) return { ok: false, motivo: 'No has visto su presa allí.' };
    const ruta = rutaMasCorta(enlaces, v.ubicacionLocationId, destinoLocationId);
    if (!ruta) return { ok: false, motivo: 'No hay camino hasta allí.' };
    await tx.viajero.update({ where: { id }, data: { destinoLocationId, ruta, minutosEnTramo: 0 } });
    return { ok: true };
  }
  return { ok: false, motivo: `Orden desconocida: ${accion}` };
}

/// Para el panel: las partidas del Reino en marcha y las 5 últimas que volvieron.
export async function partidasDelReino(tx: Tx, saveId: string) {
  const hoy = Math.floor(((await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? 0) / 1440);
  const filas = [
    ...(await tx.viajero.findMany({ where: { saveId, factionId: null, tipo: { notIn: TIPOS_SIN_DUENO }, ...enMarcha }, orderBy: { createdAt: 'asc' }, include: { miembros: { include: { companion: { select: { name: true } }, subject: { select: { name: true } } } }, ubicacion: { select: { name: true } }, destino: { select: { name: true } } } })),
    ...(await tx.viajero.findMany({ where: { saveId, factionId: null, tipo: { notIn: TIPOS_SIN_DUENO }, estado: 'TERMINADO', ultimoDia: { gte: hoy - DIAS_VISIBLE_VUELTA } }, orderBy: { updatedAt: 'desc' }, take: 5, include: { miembros: { include: { companion: { select: { name: true } }, subject: { select: { name: true } } } }, ubicacion: { select: { name: true } }, destino: { select: { name: true } } } })),
  ];
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const fauna = new Map((await tx.npc.findMany({ where: { worldId, saveId: null, slug: { in: filas.map((f) => f.objetivo ?? '') } }, select: { slug: true, name: true } })).map((f) => [f.slug, f.name]));
  return filas.map((f) => ({
    id: f.id, tipo: f.tipo, estado: f.estado, especie: f.objetivo, especieNombre: fauna.get(f.objetivo ?? '') ?? f.objetivo,
    ubicacion: f.ubicacion.name, destino: f.destino.name, permanente: !!(f.orden as OrdenViajero | null)?.repetir,
    miembros: f.miembros.map((m) => m.companion?.name ?? m.subject?.name ?? `${m.genericos} cazadores`),
    carga: f.carga as { piezas?: number; capturados?: number; resumen?: string } | null,
    /// P283: el día en que volvió a casa.
    vueltaDia: f.estado === 'TERMINADO' ? f.ultimoDia : null,
  }));
}
