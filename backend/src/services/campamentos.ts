// CR-50 (hito 0.3, Fase E, paso 50a): campamentos de bandidos con base de datos — aparición (Q2) y
// refuerzos (Q3). Reglas y semillas en `cronista/campamentosBandidos.ts`. Cada campamento tiene su
// punto en el mapa de zona (tipo NPC, con la `cantidad` de su banda), así que atacarlo en vivo usa el
// combate de varios de `CR-49` sin nada más.
import type { Prisma, PrismaClient } from '@prisma/client';
import { elegirOcupante, genteInicial, ocupanteDe, refuerzos, regionesConCampamentos, tocaCampamento } from './cronista/campamentosBandidos.js';
import { posicionEnZona } from './viajerosCruce.js';

type Tx = Prisma.TransactionClient;

/// Lugares de una región donde puede asentarse un campamento: con camino, sin asentamiento (ni de
/// facción ni del Reino) y sin otro campamento activo; si hay alternativa, no el último que cayó.
async function lugaresLibres(tx: Tx, saveId: string, worldId: string, region: string, evitar: string | null): Promise<string[]> {
  const lugares = await tx.location.findMany({
    where: {
      worldId, region,
      OR: [{ linksFrom: { some: {} } }, { linksTo: { some: {} } }],
      zonePoints: { none: { tipo: 'EDIFICIO', OR: [{ saveId: null }, { saveId }] } },
      buildings: { none: { OR: [{ saveId }, { faction: { saveId } }] } },
      campamentos: { none: { saveId, estado: 'ACTIVO' } },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const ids = lugares.map((l) => l.id);
  return ids.length > 1 && evitar ? ids.filter((id) => id !== evitar) : ids;
}

/// Un campamento nuevo en `region` (si tiene ocupantes y sitio).
async function levantarCampamento(tx: Tx, saveId: string, worldId: string, region: string, dia: number, evitar: string | null, random: () => number): Promise<string | null> {
  const ocupante = elegirOcupante(region, random);
  if (!ocupante) return null;
  const libres = await lugaresLibres(tx, saveId, worldId, region, evitar);
  if (libres.length === 0) return null;
  const locationId = libres[Math.floor(random() * libres.length)]!;
  const gente = genteInicial(random);
  const c = await tx.campamento.create({
    data: { saveId, locationId, region, ocupante: ocupante.slug, cabecilla: ocupante.cabecilla, gente, tope: gente, creadoDia: dia, ultimoRefuerzoDia: dia },
  });
  const { x, y } = posicionEnZona(c.id);
  const punto = await tx.zonePoint.create({ data: { saveId, locationId, tipo: 'NPC', targetSlug: ocupante.npcSlug, label: ocupante.grupo, cantidad: gente + 1, x, y } });
  await tx.campamento.update({ where: { id: c.id }, data: { zonePointId: punto.id } });
  return c.id;
}

/// El punto del mapa de zona sigue a la gente del campamento (más el cabecilla).
export async function sincronizarPunto(tx: Tx, c: { zonePointId: string | null; gente: number; estado: string }): Promise<void> {
  if (!c.zonePointId) return;
  await tx.zonePoint.updateMany({ where: { id: c.zonePointId }, data: c.estado === 'ACTIVO' ? { cantidad: c.gente + 1, activo: true } : { activo: false } });
}

/// Un día de los campamentos de la partida: los que faltan aparecen y los que hay reciben refuerzos.
/// Devuelve cuántos aparecen.
export async function revisarCampamentos(prisma: PrismaClient, saveId: string, dia: number, random: () => number): Promise<number> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  let nuevos = 0;
  for (const region of regionesConCampamentos()) {
    await prisma.$transaction(async (tx) => {
      const activo = await tx.campamento.findFirst({ where: { saveId, region, estado: 'ACTIVO' } });
      if (activo) {
        const r = refuerzos(activo, dia);
        if (r.gente !== activo.gente || r.ultimoRefuerzoDia !== activo.ultimoRefuerzoDia) {
          await tx.campamento.update({ where: { id: activo.id }, data: r });
          await sincronizarPunto(tx, { ...activo, ...r });
        }
        return;
      }
      const ultimo = await tx.campamento.findFirst({ where: { saveId, region, estado: 'DESTRUIDO' }, orderBy: { caidoDia: 'desc' }, select: { caidoDia: true, locationId: true } });
      if (!tocaCampamento(dia, ultimo?.caidoDia ?? null)) return;
      if (await levantarCampamento(tx, saveId, save.worldId, region, dia, ultimo?.locationId ?? null, random)) nuevos++;
    });
  }
  return nuevos;
}

/// Los campamentos activos de la partida, con lo que se sabe de ellos.
export async function campamentosActivos(tx: Tx, saveId: string) {
  const filas = await tx.campamento.findMany({ where: { saveId, estado: 'ACTIVO' }, include: { location: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'asc' } });
  return filas.map((c) => ({ ...c, grupo: ocupanteDe(c.ocupante)?.grupo ?? 'Bandidos', npcSlug: ocupanteDe(c.ocupante)?.npcSlug ?? null }));
}
