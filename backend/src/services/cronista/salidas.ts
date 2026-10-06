// Salidas y muerte de los súbditos (REI-121, hito 0.3 — Fase C, decisión Q6 de la usuaria del
// 2026-10-06). Con la felicidad del Reino 7 días seguidos por los suelos, cada semana se va el
// súbdito más descontento (con sus crías) y vuelve a la población de su pueblo. Los súbditos mueren de
// viejos (la misma regla que los NPC, `CR-13`) y de hambre; la muerte en combate llegará con la
// defensa del Reino (`CR-37`).
import type { Prisma } from '@prisma/client';
import { ownerKeyFor } from '../reinoOwner.js';
import { DIAS_PARA_REBELION } from '../kingdomTick.js';
import { edadEnAnios, esAdulto, probMuerteDeViejoPorDia } from './edades.js';
import { puebloDeFila } from './llegadas.js';
import { registrarSuceso } from './sucesos.js';
import { stripRegionArticle } from '../population.js';
import { recalcularPoblacion, regionDelReino } from './subditos.js';

type Tx = Prisma.TransactionClient;

export const DIAS_ENTRE_SALIDAS = 7;
/// Días seguidos de felicidad baja (≤ 20) para que empiecen a irse: los mismos que la rebelión.
export const DIAS_TRISTES_PARA_IRSE = DIAS_PARA_REBELION;
/// Provisional (se revisa en la ronda de economía de la Fase D): con hambruna (3 días seguidos sin
/// comida), cada día puede morir de hambre un súbdito.
export const DIAS_HAMBRE_PARA_MORIR = 3;
export const PROB_MUERTE_HAMBRE_DIA = 0.1;

interface SubditoVital {
  id: string;
  name: string;
  pueblo: string | null;
  nacidoEn: number | null;
  felicidad: number;
  madreId: string | null;
  padreId: string | null;
  poblacionOrigenId: string | null;
}

const edad = (s: SubditoVital, ahora: number) => (s.nacidoEn == null ? null : edadEnAnios(s.nacidoEn, ahora));

/// Puro: quién se va primero (el más descontento de los adultos; a igualdad, el que llegó antes).
export function quienSeVa<T extends SubditoVital>(subditos: T[], ahora: number): T | null {
  const adultos = subditos.filter((s) => s.nacidoEn == null || esAdulto(s.pueblo, edad(s, ahora)!));
  return adultos.reduce<T | null>((peor, s) => (!peor || s.felicidad < peor.felicidad ? s : peor), null);
}

/// Puro: a quién se lleva el hambre (las crías primero, luego el de más edad).
export function victimaDelHambre<T extends SubditoVital>(subditos: T[], ahora: number): T | null {
  const crias = subditos.filter((s) => s.nacidoEn != null && !esAdulto(s.pueblo, edad(s, ahora)!));
  if (crias.length) return crias.reduce((a, b) => (a.nacidoEn! > b.nacidoEn! ? a : b));
  const conEdad = subditos.filter((s) => s.nacidoEn != null);
  return conEdad.length ? conEdad.reduce((a, b) => (a.nacidoEn! < b.nacidoEn! ? a : b)) : subditos[0] ?? null;
}

async function morir(tx: Tx, saveId: string, s: SubditoVital, causa: 'vejez' | 'hambre', ahora: number) {
  await tx.subject.update({ where: { id: s.id }, data: { estado: 'MUERTO', hastaMinutes: ahora, notes: causa === 'vejez' ? 'Murió de viejo.' : 'Murió de hambre.' } });
  await registrarSuceso(tx, {
    saveId, tipo: 'MUERTE_NPC', fictionalMinutes: ahora, origen: 'MUNDO',
    actores: [{ entidadTipo: 'SUBDITO', entidadId: s.id, papel: 'VICTIMA' }],
    datos: { npc: s.name, causa: causa === 'vejez' ? 'de viejo' : 'de hambre' },
  });
}

/// Vuelve a la población de su pueblo (la de la que salió o, si nació en el Reino, la de su pueblo).
export async function volverASuPueblo(tx: Tx, saveId: string, s: SubditoVital) {
  if (s.poblacionOrigenId) {
    await tx.worldPopulation.updateMany({ where: { id: s.poblacionOrigenId }, data: { poblacion: { increment: 1 } } });
    return;
  }
  if (!s.pueblo) return;
  // Si su pueblo vive en varias regiones (los clanes orcos), a la de la región del Reino.
  const region = await regionDelReino(tx, saveId);
  const filas = (await tx.worldPopulation.findMany({ where: { saveId, targetType: 'RAZA' }, orderBy: { targetSlug: 'asc' }, select: { id: true, targetSlug: true, distribucion: true } }))
    .filter((f) => puebloDeFila(f.targetSlug) === s.pueblo);
  const fila = filas.find((f) => !!region && Object.keys((f.distribucion ?? {}) as Record<string, number>).some((k) => stripRegionArticle(k) === stripRegionArticle(region))) ?? filas[0];
  if (fila) await tx.worldPopulation.update({ where: { id: fila.id }, data: { poblacion: { increment: 1 } } });
}

/// Un día de los súbditos: muertes de viejo y de hambre y, con el Reino triste, una salida por semana.
export async function revisarSalidas(tx: Tx, saveId: string, ahora: number, random: () => number): Promise<{ muertos: string[]; idos: string[] }> {
  const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { diasFelicidadBaja: true, diasHambre: true } });
  const sel = { id: true, name: true, pueblo: true, nacidoEn: true, felicidad: true, madreId: true, padreId: true, poblacionOrigenId: true } as const;
  let vivos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, orderBy: { createdAt: 'asc' }, select: sel });
  const muertos: string[] = [];
  for (const s of vivos) {
    const e = edad(s, ahora);
    if (e != null && random() < probMuerteDeViejoPorDia(s.pueblo, e)) {
      await morir(tx, saveId, s, 'vejez', ahora);
      muertos.push(s.id);
    }
  }
  vivos = vivos.filter((s) => !muertos.includes(s.id));
  if (stats && stats.diasHambre >= DIAS_HAMBRE_PARA_MORIR && vivos.length && random() < PROB_MUERTE_HAMBRE_DIA) {
    const v = victimaDelHambre(vivos, ahora)!;
    await morir(tx, saveId, v, 'hambre', ahora);
    muertos.push(v.id);
    vivos = vivos.filter((s) => s.id !== v.id);
  }

  const idos: string[] = [];
  if (stats && stats.diasFelicidadBaja >= DIAS_TRISTES_PARA_IRSE) {
    const ultima = await tx.subject.findFirst({ where: { saveId, estado: 'SE_FUE' }, orderBy: { hastaMinutes: 'desc' }, select: { hastaMinutes: true } });
    if (ultima?.hastaMinutes == null || ahora - ultima.hastaMinutes >= DIAS_ENTRE_SALIDAS * 1440) {
      const quien = quienSeVa(vivos, ahora);
      if (quien) {
        // Se lleva a sus crías.
        const suyos = vivos.filter((s) => s.id === quien.id || ((s.madreId === quien.id || s.padreId === quien.id) && s.nacidoEn != null && !esAdulto(s.pueblo, edad(s, ahora)!)));
        for (const s of suyos) {
          await tx.subject.update({ where: { id: s.id }, data: { estado: 'SE_FUE', hastaMinutes: ahora, parejaId: null } });
          await volverASuPueblo(tx, saveId, s);
          idos.push(s.id);
        }
      }
    }
  }
  if (muertos.length || idos.length) await recalcularPoblacion(tx, saveId, ahora);
  return { muertos, idos };
}

/// Para la tarjeta de `REI-54`: quién se fue o murió en los últimos días.
export async function salidasRecientes(tx: Tx, saveId: string, ahora: number, dias = 7) {
  const filas = await tx.subject.findMany({
    where: { saveId, estado: { in: ['SE_FUE', 'MUERTO'] }, hastaMinutes: { gte: ahora - dias * 1440 } },
    orderBy: { hastaMinutes: 'desc' }, select: { id: true, name: true, estado: true, notes: true, hastaMinutes: true },
  });
  return filas.map((f) => ({ id: f.id, name: f.name, estado: f.estado as 'SE_FUE' | 'MUERTO', motivo: f.estado === 'MUERTO' || f.notes.startsWith('Desertó') ? f.notes : 'Se fue: el Reino no le da para vivir contento.', cuando: f.hastaMinutes }));
}
