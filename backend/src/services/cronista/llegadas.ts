// Llegadas de súbditos (REI-119, hito 0.3 — Fase C, decisión Q4 de la usuaria del 2026-10-06, como
// en Medieval Dynasty y Bellwright). Una vez por semana, si el Reino tiene cama libre, comida, agua y
// felicidad ≥ 40, llega un candidato de la población de un pueblo de su región (o de una vecina): se
// descuenta de ella. Espera en una tarjeta del Reino; aceptarlo lo hace súbdito (suceso
// `LLEGADA_POBLADORES`); rechazarlo, o no responder en 2 días, lo devuelve a su pueblo.
import type { Prisma } from '@prisma/client';
import { ownerKeyFor } from '../reinoOwner.js';
import { registrarSuceso } from './sucesos.js';
import { cicloVital, MINUTOS_POR_ANIO } from './edades.js';
import { regionesVecinas } from './regiones.js';
import { stripRegionArticle } from '../population.js';
import { crearSubdito, cupoDeCamas, recalcularPoblacion, regionDelReino } from './subditos.js';
import { equiparAlta } from './economiaReino.js';

type Tx = Prisma.TransactionClient;

export const DIAS_ENTRE_LLEGADAS = 7;
export const DIAS_PARA_RESPONDER = 2;
export const FELICIDAD_PARA_LLEGADAS = 40;

/// Un requisito para que llegue alguien, con su estado y su cifra (P220b: la lista entera se enseña en
/// Reino › Súbditos, como el checklist de requisitos de X4: Foundations).
export interface RequisitoLlegada {
  clave: 'cama' | 'comida' | 'agua' | 'felicidad';
  nombre: string;
  cumple: boolean;
  /// La cifra que se muestra junto al estado («0/2», «12», «55, mínimo 40»).
  cifra: string;
  /// Por qué no llega nadie si no se cumple.
  motivo: string;
}

type EntradaLlegada = { camasLibres: number; camasTotales?: number; comida: number; bebida: number; felicidad: number; candidatoEsperando: boolean };

/// Puro: todos los requisitos de llegada con su estado (única fuente de los umbrales).
export function requisitosDeLlegada(r: EntradaLlegada): RequisitoLlegada[] {
  const cama = r.camasTotales != null ? `${Math.max(0, r.camasTotales - r.camasLibres)}/${r.camasTotales}` : `${r.camasLibres} libres`;
  return [
    { clave: 'cama', nombre: 'Cama libre', cumple: r.camasLibres > 0, cifra: cama, motivo: 'No hay cama libre.' },
    { clave: 'comida', nombre: 'Comida', cumple: r.comida > 0, cifra: String(r.comida), motivo: 'No hay comida.' },
    { clave: 'agua', nombre: 'Agua', cumple: r.bebida > 0, cifra: String(r.bebida), motivo: 'No hay agua.' },
    {
      clave: 'felicidad', nombre: 'Felicidad', cumple: r.felicidad >= FELICIDAD_PARA_LLEGADAS, cifra: `${r.felicidad}, mínimo ${FELICIDAD_PARA_LLEGADAS}`,
      motivo: `El Reino no da buena fama: la felicidad está por debajo de ${FELICIDAD_PARA_LLEGADAS}.`,
    },
  ];
}

/// Puro: por qué no llega nadie esta semana (o null si puede llegar alguien).
export function motivoSinLlegada(r: EntradaLlegada): string | null {
  if (r.candidatoEsperando) return 'Ya hay alguien esperando respuesta.';
  return requisitosDeLlegada(r).find((q) => !q.cumple)?.motivo ?? null;
}

/// Puro: el pueblo de quien llega, al azar según cuántos son (solo pueblos con gente).
export function elegirPorPeso<T extends { poblacion: number }>(filas: T[], random: () => number): T | null {
  const total = filas.reduce((s, f) => s + Math.max(0, f.poblacion), 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const f of filas) {
    r -= Math.max(0, f.poblacion);
    if (r < 0) return f;
  }
  return filas[filas.length - 1]!;
}

/// Pueblo jugable de una fila de población (`orcos-llanuras` → orcos).
export const puebloDeFila = (targetSlug: string) => (targetSlug.startsWith('orcos') ? 'orcos' : targetSlug);

/// Las filas de población de los pueblos que viven en una región (si no hay, en las vecinas).
async function pueblosDeLaRegion(tx: Tx, saveId: string, region: string) {
  const filas = await tx.worldPopulation.findMany({ where: { saveId, targetType: 'RAZA', poblacion: { gt: 0 } }, select: { id: true, targetSlug: true, label: true, poblacion: true, distribucion: true } });
  const en = (r: string) => filas.filter((f) => Object.keys((f.distribucion ?? {}) as Record<string, number>).some((k) => stripRegionArticle(k) === stripRegionArticle(r)));
  const aqui = en(region);
  return aqui.length ? aqui : regionesVecinas(region).flatMap(en);
}

/// El Reino de la jugadora (facción propia) y su región (la del primer territorio en pie).
async function reinoDe(tx: Tx, saveId: string) {
  const [faccion, territorio, stats] = await Promise.all([
    tx.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { slug: true, name: true } }),
    regionDelReino(tx, saveId),
    tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { comida: true, bebida: true, felicidad: true, ultimaLlegada: true } }),
  ]);
  return faccion && territorio && stats ? { ...faccion, region: territorio, stats } : null;
}

/// Devuelve a su pueblo a un candidato que no se queda y borra su rastro (el linaje que fundó al
/// llegar, si queda vacío).
async function devolver(tx: Tx, saveId: string, subjectId: string) {
  const s = await tx.subject.findFirst({ where: { id: subjectId, saveId, estado: 'CANDIDATO' }, select: { id: true, poblacionOrigenId: true } });
  if (!s) return false;
  if (s.poblacionOrigenId) await tx.worldPopulation.updateMany({ where: { id: s.poblacionOrigenId }, data: { poblacion: { increment: 1 } } });
  const m = await tx.linajeMiembro.findFirst({ where: { saveId, entidadTipo: 'SUBDITO', entidadId: s.id }, select: { linajeId: true } });
  await tx.linajeMiembro.deleteMany({ where: { saveId, entidadTipo: 'SUBDITO', entidadId: s.id } });
  if (m && (await tx.linajeMiembro.count({ where: { linajeId: m.linajeId } })) === 0) await tx.linaje.delete({ where: { id: m.linajeId } });
  await tx.subject.delete({ where: { id: s.id } });
  return true;
}

/// Un día del Reino: se marchan los candidatos sin respuesta y, si toca (una vez por semana), llega uno.
export async function revisarLlegadas(tx: Tx, saveId: string, ahora: number, random: () => number): Promise<{ llegado: string | null; marchados: number }> {
  let marchados = 0;
  for (const c of await tx.subject.findMany({ where: { saveId, estado: 'CANDIDATO', hastaMinutes: { lte: ahora } }, select: { id: true } })) {
    if (await devolver(tx, saveId, c.id)) marchados++;
  }
  const reino = await reinoDe(tx, saveId);
  if (!reino) return { llegado: null, marchados };
  const { ultimaLlegada, ...stats } = reino.stats;
  if (ultimaLlegada != null && ahora - ultimaLlegada < DIAS_ENTRE_LLEGADAS * 1440) return { llegado: null, marchados };
  const motivo = motivoSinLlegada({
    camasLibres: (await cupoDeCamas(tx, saveId)).libresSubditos, ...stats,
    candidatoEsperando: (await tx.subject.count({ where: { saveId, estado: 'CANDIDATO' } })) > 0,
  });
  if (motivo) return { llegado: null, marchados };
  const fila = elegirPorPeso(await pueblosDeLaRegion(tx, saveId, reino.region), random);
  if (!fila) return { llegado: null, marchados };
  const { count } = await tx.worldPopulation.updateMany({ where: { id: fila.id, poblacion: { gt: 0 } }, data: { poblacion: { decrement: 1 } } });
  if (count === 0) return { llegado: null, marchados };
  const pueblo = puebloDeFila(fila.targetSlug);
  const { madurez } = cicloVital(pueblo);
  const edad = madurez + Math.floor(random() * 15);
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const s = await crearSubdito(tx, {
    saveId, worldId: save.worldId, pueblo, nacidoEn: ahora - edad * MINUTOS_POR_ANIO - Math.floor(random() * MINUTOS_POR_ANIO), origen: 'LLEGADA',
    estado: 'CANDIDATO', hastaMinutes: ahora + DIAS_PARA_RESPONDER * 1440, ahora, random,
  });
  // De dónde viene (para devolverlo si no se queda y para la tarjeta).
  await tx.subject.update({ where: { id: s.id }, data: { poblacionOrigenId: fila.id } });
  await tx.kingdomStats.update({ where: { ownerKey: ownerKeyFor({ saveId }) }, data: { ultimaLlegada: ahora } });
  return { llegado: s.id, marchados };
}

/// La jugadora acepta o rechaza a quien espera en la puerta.
export async function responderLlegada(tx: Tx, saveId: string, subjectId: string, acepta: boolean, ahora: number): Promise<{ ok: true; name: string } | { ok: false; motivo: string }> {
  const s = await tx.subject.findFirst({ where: { id: subjectId, saveId, estado: 'CANDIDATO' }, select: { id: true, name: true, poblacionOrigenId: true, hastaMinutes: true } });
  if (!s) return { ok: false, motivo: 'Ya no hay nadie esperando.' };
  // Se cansó de esperar aunque el día aún no se haya simulado.
  if (s.hastaMinutes != null && s.hastaMinutes <= ahora) {
    await devolver(tx, saveId, s.id);
    return { ok: false, motivo: `${s.name} se cansó de esperar y se ha ido.` };
  }
  if (!acepta) {
    await devolver(tx, saveId, s.id);
    return { ok: true, name: s.name };
  }
  if ((await cupoDeCamas(tx, saveId)).libresSubditos <= 0) return { ok: false, motivo: 'No queda cama libre para alojarlo.' };
  const fila = s.poblacionOrigenId ? await tx.worldPopulation.findUnique({ where: { id: s.poblacionOrigenId }, select: { label: true } }) : null;
  await tx.subject.update({ where: { id: s.id }, data: { estado: 'ACTIVO', desdeMinutes: ahora, hastaMinutes: null, notes: fila ? `Llegó de ${fila.label}.` : '' } });
  await recalcularPoblacion(tx, saveId, ahora);
  // CR-58: su herramienta de trabajo.
  await equiparAlta(tx, saveId, 'trabajador');
  const reino = await tx.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { slug: true, name: true } });
  await registrarSuceso(tx, {
    saveId, tipo: 'LLEGADA_POBLADORES', fictionalMinutes: ahora, origen: 'JUGADOR',
    actores: [
      { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' },
      { entidadTipo: 'SUBDITO', entidadId: s.id, papel: 'BENEFICIARIO' },
      ...(reino ? [{ entidadTipo: 'FACCION' as const, entidadId: reino.slug, papel: 'BENEFICIARIO' as const }] : []),
    ],
    datos: { reino: reino?.name ?? 'tu Reino', cuantos: 1 },
  });
  return { ok: true, name: s.name };
}

/// Para la tarjeta: quien espera, de dónde viene y cuándo se irá.
export async function candidatosDeLlegada(tx: Tx, saveId: string) {
  const cs = await tx.subject.findMany({ where: { saveId, estado: 'CANDIDATO' }, orderBy: { desdeMinutes: 'asc' }, select: { id: true, poblacionOrigenId: true, hastaMinutes: true } });
  const filas = await tx.worldPopulation.findMany({ where: { id: { in: cs.map((c) => c.poblacionOrigenId).filter((x): x is string => !!x) } }, select: { id: true, label: true } });
  return cs.map((c) => ({ id: c.id, deDonde: filas.find((f) => f.id === c.poblacionOrigenId)?.label ?? null, hastaMinutes: c.hastaMinutes }));
}
