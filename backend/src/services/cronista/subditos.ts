// Súbditos como personas (REI-118, hito 0.3 — Fase C, decisiones Q1-Q3 y Q7 de la usuaria del
// 2026-10-06). Cada poblador del Reino es un súbdito con nombre, pueblo, edad, padres, linaje y
// felicidad; la población del Reino es cuántos súbditos activos hay. Solo los crea el motor (llegadas,
// `REI-119`; crías, `REI-120`): el narrador ya no. Compañeros y súbditos comparten un único cupo de
// camas (el de los edificios con plazas). Los adultos trabajan, o hacen de soldado o vigía; los niños
// no trabajan ni combaten hasta su madurez.
import type { Prisma } from '@prisma/client';
import { companionSlotsForRecipeKey } from '../construction.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { edadEnAnios, esAdulto } from './edades.js';
import { apellidoDe, fundarLinaje, nombreConLinaje, unirALinaje } from './linajes.js';
import { generarNombre, generarRastro, nombreLibre, type Genero } from './nombres.js';

type Tx = Prisma.TransactionClient;

export const ROLES_SUBDITO = ['trabajador', 'soldado', 'vigia'] as const;
export type RolSubdito = (typeof ROLES_SUBDITO)[number];
export const PUEBLOS = ['orcos', 'goirntes', 'nabieus', 'faerus'] as const;
/// Cuánto se acerca cada día la felicidad de un súbdito a la del Reino.
export const PASO_FELICIDAD_DIA = 5;

/// Puro: el rol del motor de un súbdito (los narrados antes del 0.3 tenían rol libre).
export function rolDeSubdito(role: string): RolSubdito | 'visitante' {
  const r = role.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/vigia|centinela|atalaya/.test(r)) return 'vigia';
  if (/soldad|guerrer|guardia/.test(r)) return 'soldado';
  if (/visitante|viajero|huesped|forastero/.test(r)) return 'visitante';
  return 'trabajador';
}

export interface SubditoParaCuenta {
  role: string;
  pueblo: string | null;
  nacidoEn: number | null;
}

/// Puro: un súbdito es adulto si su edad pasa la madurez de su pueblo (los de antes del 0.3, sí).
export function esAdultoSubdito(s: Pick<SubditoParaCuenta, 'pueblo' | 'nacidoEn'>, ahora: number): boolean {
  return s.nacidoEn == null || esAdulto(s.pueblo ?? 'orcos', edadEnAnios(s.nacidoEn, ahora));
}

/// Puro: las cifras del Reino que salen de sus súbditos activos. Los niños comen pero no trabajan.
export function cifrasDePoblacion(subditos: SubditoParaCuenta[], ahora: number): { poblacion: number; trabajadores: number; soldados: number; visitantes: number } {
  let trabajadores = 0;
  let soldados = 0;
  let visitantes = 0;
  for (const s of subditos) {
    const rol = rolDeSubdito(s.role);
    if (rol === 'visitante') visitantes++;
    else if (!esAdultoSubdito(s, ahora)) continue;
    else if (rol === 'trabajador') trabajadores++;
    else soldados++;
  }
  return { poblacion: subditos.length, trabajadores, soldados, visitantes };
}

/// Puro: la felicidad de un súbdito se acerca a la del Reino `PASO_FELICIDAD_DIA` por día.
export function felicidadHacia(actual: number, reino: number, dias: number): number {
  const paso = PASO_FELICIDAD_DIA * Math.max(0, dias);
  return actual < reino ? Math.min(reino, actual + paso) : Math.max(reino, actual - paso);
}

// ─────────────────────────── Con base de datos ───────────────────────────

/// Q2: un único cupo de camas para compañeros (salvo el del Domador) y súbditos activos.
export async function cupoDeCamas(tx: Tx, saveId: string): Promise<{ total: number; companeros: number; subditos: number; libres: number }> {
  const [companeros, subditos, edificios] = await Promise.all([
    tx.companion.count({ where: { saveId, esSlotDomador: false } }),
    tx.subject.count({ where: { saveId, estado: 'ACTIVO' } }),
    tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true } }),
  ]);
  const total = edificios.reduce((s, b) => s + companionSlotsForRecipeKey(b.recipeKey), 0);
  return { total, companeros, subditos, libres: Math.max(0, total - companeros - subditos) };
}

/// La población del Reino (y de cada territorio) = sus súbditos activos. Idempotente.
export async function recalcularPoblacion(tx: Tx, saveId: string, ahora: number): Promise<void> {
  const subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { role: true, pueblo: true, nacidoEn: true, territoryId: true } });
  const ownerKey = ownerKeyFor({ saveId });
  if (await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { id: true } })) {
    await tx.kingdomStats.update({ where: { ownerKey }, data: cifrasDePoblacion(subditos, ahora) });
  }
  const territorios = await tx.territory.findMany({ where: { saveId }, select: { id: true, control: true, population: true } });
  for (const t of territorios) {
    const n = t.control === 'PERDIDO' ? 0 : subditos.filter((s) => s.territoryId === t.id).length;
    if (n !== t.population) await tx.territory.update({ where: { id: t.id }, data: { population: n } });
  }
}

/// Un día (o varios) de los súbditos: su felicidad se acerca a la del Reino y la población se recalcula.
export async function avanzarSubditos(tx: Tx, saveId: string, dias: number, ahora: number): Promise<void> {
  const reino = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { felicidad: true } });
  if (reino && dias > 0) {
    const subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, felicidad: true } });
    for (const s of subditos) {
      const f = felicidadHacia(s.felicidad, reino.felicidad, dias);
      if (f !== s.felicidad) await tx.subject.update({ where: { id: s.id }, data: { felicidad: f } });
    }
  }
  await recalcularPoblacion(tx, saveId, ahora);
}

/// El territorio donde vive un súbdito nuevo: el de sus padres o el primero que siga en pie.
async function territorioDeAcogida(tx: Tx, saveId: string, padres: (string | null)[]): Promise<string | null> {
  const ids = padres.filter((p): p is string => !!p);
  if (ids.length) {
    const deUnPadre = await tx.subject.findFirst({ where: { id: { in: ids }, saveId, territoryId: { not: null } }, select: { territoryId: true } });
    if (deUnPadre?.territoryId) return deUnPadre.territoryId;
  }
  return (await tx.territory.findFirst({ where: { saveId, control: { not: 'PERDIDO' } }, orderBy: { acquiredAt: 'asc' }, select: { id: true } }))?.id ?? null;
}

/// Crea un súbdito (lo llaman las llegadas y los nacimientos) con su nombre y su linaje: el que se
/// le pase (cría) o el de su apellido / un rastro nuevo (quien llega de fuera).
export async function crearSubdito(
  tx: Tx,
  p: {
    saveId: string; worldId: string; pueblo: string; genero?: Genero; nacidoEn: number; origen: 'LLEGADA' | 'NACIDO';
    padreId?: string | null; madreId?: string | null; linajeId?: string | null; felicidad?: number; ahora: number; random: () => number;
  },
): Promise<{ id: string; name: string; linajeId: string | null }> {
  const genero: Genero = p.genero ?? (p.random() < 0.5 ? 'F' : 'M');
  const usados = new Set(
    [
      ...(await tx.npc.findMany({ where: { worldId: p.worldId, OR: [{ saveId: null }, { saveId: p.saveId }] }, select: { name: true } })).map((n) => n.name),
      ...(await tx.subject.findMany({ where: { saveId: p.saveId }, select: { name: true } })).map((s) => s.name),
    ].map((n) => n.toLowerCase()),
  );
  const generado = generarNombre(p.pueblo, genero, p.random, usados);
  const propio = generado.split(' ')[0]!;
  let linaje = p.linajeId ? await tx.linaje.findUnique({ where: { id: p.linajeId } }) : null;
  if (!linaje) {
    const apellido = p.pueblo === 'faerus' ? generarRastro(p.random) : apellidoDe(generado, p.pueblo, null);
    if (apellido) linaje = await fundarLinaje(tx, { saveId: p.saveId, pueblo: p.pueblo, desdeMinutes: p.ahora, random: p.random, nombre: apellido });
  }
  const name = nombreLibre(linaje ? (linaje.tipo === 'RASTRO' ? propio : nombreConLinaje(propio, linaje)) : generado, usados);
  const reino = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId: p.saveId }) }, select: { felicidad: true } });
  const s = await tx.subject.create({
    data: {
      saveId: p.saveId, territoryId: await territorioDeAcogida(tx, p.saveId, [p.padreId ?? null, p.madreId ?? null]),
      name, role: 'trabajador', notes: '', pueblo: p.pueblo, genero, nacidoEn: p.nacidoEn,
      padreId: p.padreId ?? null, madreId: p.madreId ?? null, felicidad: p.felicidad ?? reino?.felicidad ?? 60,
      estado: 'ACTIVO', origen: p.origen, desdeMinutes: p.ahora,
    },
  });
  if (linaje) await unirALinaje(tx, { saveId: p.saveId, linajeId: linaje.id, entidadTipo: 'SUBDITO', entidadId: s.id, desdeMinutes: p.ahora });
  await recalcularPoblacion(tx, p.saveId, p.ahora);
  return { id: s.id, name, linajeId: linaje?.id ?? null };
}

/// Q7: cambia el rol de un súbdito adulto. Devuelve el motivo si no se puede.
export async function cambiarRolSubdito(tx: Tx, saveId: string, subjectId: string, rol: string, ahora: number): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!(ROLES_SUBDITO as readonly string[]).includes(rol)) return { ok: false, motivo: `Rol desconocido: ${rol}` };
  const s = await tx.subject.findFirst({ where: { id: subjectId, saveId, estado: 'ACTIVO' }, select: { id: true, name: true, pueblo: true, nacidoEn: true } });
  if (!s) return { ok: false, motivo: 'No hay ningún súbdito así en tu Reino.' };
  if (!esAdultoSubdito(s, ahora)) return { ok: false, motivo: `${s.name} aún es una cría: no trabaja ni combate hasta hacerse mayor.` };
  await tx.subject.update({ where: { id: s.id }, data: { role: rol } });
  await recalcularPoblacion(tx, saveId, ahora);
  return { ok: true };
}

/// Para la vista: edad y linaje de cada súbdito activo.
export async function datosDeSubditos(tx: Tx, saveId: string, ahora: number) {
  const subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, orderBy: { createdAt: 'asc' } });
  const miembros = await tx.linajeMiembro.findMany({ where: { saveId, entidadTipo: 'SUBDITO', entidadId: { in: subditos.map((s) => s.id) } }, select: { entidadId: true, linaje: { select: { nombre: true, tipo: true } } } });
  const linajePor = new Map(miembros.map((m) => [m.entidadId, m.linaje]));
  return subditos.map((s) => ({
    id: s.id, name: s.name, role: s.role, rol: rolDeSubdito(s.role), pueblo: s.pueblo, genero: s.genero,
    edad: s.nacidoEn == null ? null : edadEnAnios(s.nacidoEn, ahora), adulto: esAdultoSubdito(s, ahora),
    felicidad: s.felicidad, origen: s.origen, territoryId: s.territoryId, linaje: linajePor.get(s.id) ?? null,
  }));
}

