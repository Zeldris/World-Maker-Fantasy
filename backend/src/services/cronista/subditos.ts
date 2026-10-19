// Súbditos como personas (REI-118, hito 0.3 — Fase C, decisiones Q1-Q3 y Q7 de la usuaria del
// 2026-10-06). Cada poblador del Reino es un súbdito con nombre, pueblo, edad, padres, linaje y
// felicidad; la población del Reino es cuántos súbditos activos hay. Solo los crea el motor (llegadas,
// `REI-119`; crías, `REI-120`): el narrador ya no. Compañeros y súbditos comparten un único cupo de
// camas (el de los edificios con plazas). Los adultos trabajan, o hacen de soldado o vigía; los niños
// no trabajan ni combaten hasta su madurez.
import type { Prisma } from '@prisma/client';
import { companionSlotsForRecipeKey, esAyuntamientoRecipeKey } from '../construction.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { edadEnAnios, esAdulto } from './edades.js';
import { apellidoDe, fundarLinaje, nombreConLinaje, unirALinaje } from './linajes.js';
import { generarNombre, generarRastro, nombreLibre, type Genero } from './nombres.js';
import { esTarea, TAREA_POR_DEFECTO, TAREAS, type Tarea } from './comidaOficios.js';

type Tx = Prisma.TransactionClient;

/// CR-63 (Q3): «cazador» sale con las partidas de caza y captura; no trabaja en casa y lleva arma.
export const ROLES_SUBDITO = ['trabajador', 'soldado', 'vigia', 'cazador'] as const;
export type RolSubdito = (typeof ROLES_SUBDITO)[number];
export const PUEBLOS = ['orcos', 'goirntes', 'nabieus', 'faerus'] as const;
/// Cuánto se acerca cada día la felicidad de un súbdito a la del Reino.
export const PASO_FELICIDAD_DIA = 5;

/// Puro: el rol del motor de un súbdito (los narrados antes del 0.3 tenían rol libre).
export function rolDeSubdito(role: string): RolSubdito | 'visitante' {
  const r = role.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/vigia|centinela|atalaya/.test(r)) return 'vigia';
  if (/cazador|trampero/.test(r)) return 'cazador';
  if (/soldad|guerrer|guardia/.test(r)) return 'soldado';
  if (/visitante|viajero|huesped|forastero/.test(r)) return 'visitante';
  return 'trabajador';
}

export interface SubditoParaCuenta {
  role: string;
  pueblo: string | null;
  nacidoEn: number | null;
  /// CR-65 (Q6): en la milicia, un trabajador no produce.
  enMilicia?: boolean;
}

/// Puro: un súbdito es adulto si su edad pasa la madurez de su pueblo (los de antes del 0.3, sí).
export function esAdultoSubdito(s: Pick<SubditoParaCuenta, 'pueblo' | 'nacidoEn'>, ahora: number): boolean {
  return s.nacidoEn == null || esAdulto(s.pueblo ?? 'orcos', edadEnAnios(s.nacidoEn, ahora));
}

/// Puro: las cifras del Reino que salen de sus súbditos activos. Los niños comen pero no trabajan.
/// `poblacion` son los civiles: el consumo diario (`tickKingdomOneDay`) suma aparte soldados y
/// visitantes, así que cada súbdito come una vez. El total de súbditos es poblacion + soldados + visitantes.
export function cifrasDePoblacion(subditos: SubditoParaCuenta[], ahora: number): { poblacion: number; trabajadores: number; soldados: number; visitantes: number } {
  let trabajadores = 0;
  let soldados = 0;
  let visitantes = 0;
  for (const s of subditos) {
    const rol = rolDeSubdito(s.role);
    if (rol === 'visitante') visitantes++;
    else if (!esAdultoSubdito(s, ahora)) continue;
    else if (rol === 'trabajador') trabajadores += s.enMilicia ? 0 : 1;
    // CR-63: el cazador no trabaja en casa ni defiende; come como un civil.
    else if (rol === 'cazador') continue;
    else soldados++;
  }
  return { poblacion: subditos.length - soldados - visitantes, trabajadores, soldados, visitantes };
}

/// Puro (CR-61, 61c): cuántos trabajadores adultos hay en cada tarea (sin tarea, recolector).
export function tareasDelReino(subditos: (SubditoParaCuenta & { tarea: string | null })[], ahora: number): Record<Tarea, number> {
  const r = Object.fromEntries(TAREAS.map((t) => [t, 0])) as Record<Tarea, number>;
  for (const s of subditos) {
    if (rolDeSubdito(s.role) !== 'trabajador' || !esAdultoSubdito(s, ahora) || s.enMilicia) continue;
    r[esTarea(s.tarea) ? s.tarea : TAREA_POR_DEFECTO]++;
  }
  return r;
}

/// Puro: la felicidad de un súbdito se acerca a la del Reino `PASO_FELICIDAD_DIA` por día.
export function felicidadHacia(actual: number, reino: number, dias: number): number {
  const paso = PASO_FELICIDAD_DIA * Math.max(0, dias);
  return actual < reino ? Math.min(reino, actual + paso) : Math.max(reino, actual - paso);
}

// ─────────────────────────── Con base de datos ───────────────────────────

/// P220a (decisión de la usuaria, 2026-10-19): el Ayuntamiento da 2 camas TEMPORALES, solo para súbditos
/// (nunca para compañeros). Un súbdito alojado ahí solo sirve como parte del Reino: sin cama permanente
/// no hay compañero que ocupe su sitio, y en cuanto hay una cama de verdad pasa a ella.
export const CAMAS_TEMPORALES_AYUNTAMIENTO = 2;

export interface CupoDeCamas {
  /** Camas permanentes (construcciones). */
  total: number;
  companeros: number;
  subditos: number;
  /** Camas permanentes libres: las únicas que usan los compañeros. */
  libres: number;
  /** Camas temporales del Ayuntamiento (solo súbditos): 0 sin Ayuntamiento en pie. */
  temporales: number;
  /** Súbditos que no caben en una cama permanente y viven en las temporales. */
  enAyuntamiento: number;
  /** Camas libres para un súbdito: permanentes libres + temporales libres. */
  libresSubditos: number;
}

/// Puro: reparte las camas. Los súbditos ocupan primero las temporales del Ayuntamiento (solo suyas) y el
/// resto las permanentes que dejan los compañeros, así no quitan cama a un compañero mientras quede una temporal.
export function repartirCamas(total: number, companeros: number, subditos: number, temporales: number): CupoDeCamas {
  const enAyuntamiento = Math.min(subditos, temporales);
  const enPermanentes = Math.min(subditos - enAyuntamiento, Math.max(0, total - companeros));
  const libres = Math.max(0, total - companeros - enPermanentes);
  return { total, companeros, subditos, temporales, enAyuntamiento, libres, libresSubditos: libres + (temporales - enAyuntamiento) };
}

/// Q2: un único cupo de camas para compañeros (salvo el del Domador) y súbditos activos.
export async function cupoDeCamas(tx: Tx, saveId: string): Promise<CupoDeCamas> {
  const [companeros, subditos, edificios] = await Promise.all([
    tx.companion.count({ where: { saveId, esSlotDomador: false } }),
    tx.subject.count({ where: { saveId, estado: 'ACTIVO' } }),
    tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true } }),
  ]);
  const total = edificios.reduce((s, b) => s + companionSlotsForRecipeKey(b.recipeKey), 0);
  const hayAyuntamiento = edificios.some((b) => esAyuntamientoRecipeKey(b.recipeKey));
  return repartirCamas(total, companeros, subditos, hayAyuntamiento ? CAMAS_TEMPORALES_AYUNTAMIENTO : 0);
}

/// La población del Reino (y de cada territorio) = sus súbditos activos. Idempotente.
export async function recalcularPoblacion(tx: Tx, saveId: string, ahora: number): Promise<void> {
  const subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { role: true, pueblo: true, nacidoEn: true, territoryId: true, enMilicia: true } });
  const ownerKey = ownerKeyFor({ saveId });
  const k = await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { sinHerramienta: true, sinArma: true } });
  if (k) {
    const cifras = cifrasDePoblacion(subditos, ahora);
    // CR-58: el equipo que falta nunca pasa de la gente que hay (quien se va, muere o cambia de rol).
    await tx.kingdomStats.update({ where: { ownerKey }, data: { ...cifras, sinHerramienta: Math.min(k.sinHerramienta, cifras.trabajadores), sinArma: Math.min(k.sinArma, cifras.soldados) } });
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

/// La región del Reino: la del primer territorio que siga en pie (llegadas y salidas).
export async function regionDelReino(tx: Tx, saveId: string): Promise<string | null> {
  return (await tx.territory.findFirst({ where: { saveId, control: { not: 'PERDIDO' } }, orderBy: { acquiredAt: 'asc' }, select: { region: true } }))?.region ?? null;
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
    /// REI-119: quien llega espera como CANDIDATO (no cuenta ni ocupa cama) hasta `hastaMinutes`.
    estado?: 'ACTIVO' | 'CANDIDATO'; hastaMinutes?: number;
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
    // Si su apellido ya es de una familia del Reino o del mundo, funda una con un nombre nuevo.
    if (apellido) {
      linaje = (await fundarLinaje(tx, { saveId: p.saveId, pueblo: p.pueblo, desdeMinutes: p.ahora, random: p.random, nombre: apellido, soloNuevo: true }))
        ?? (await fundarLinaje(tx, { saveId: p.saveId, pueblo: p.pueblo, desdeMinutes: p.ahora, random: p.random }));
    }
  }
  const name = nombreLibre(linaje ? (linaje.tipo === 'RASTRO' ? propio : nombreConLinaje(propio, linaje)) : generado, usados);
  const reino = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId: p.saveId }) }, select: { felicidad: true } });
  const s = await tx.subject.create({
    data: {
      saveId: p.saveId, territoryId: await territorioDeAcogida(tx, p.saveId, [p.padreId ?? null, p.madreId ?? null]),
      name, role: 'trabajador', notes: '', pueblo: p.pueblo, genero, nacidoEn: p.nacidoEn,
      padreId: p.padreId ?? null, madreId: p.madreId ?? null, felicidad: p.felicidad ?? reino?.felicidad ?? 60,
      estado: p.estado ?? 'ACTIVO', origen: p.origen, desdeMinutes: p.ahora, hastaMinutes: p.hastaMinutes ?? null,
    },
  });
  if (linaje) await unirALinaje(tx, { saveId: p.saveId, linajeId: linaje.id, entidadTipo: 'SUBDITO', entidadId: s.id, desdeMinutes: p.ahora });
  await recalcularPoblacion(tx, p.saveId, p.ahora);
  return { id: s.id, name, linajeId: linaje?.id ?? null };
}

/// Q7: cambia el rol de un súbdito adulto. Devuelve el motivo si no se puede.
export async function cambiarRolSubdito(tx: Tx, saveId: string, subjectId: string, rol: string, ahora: number): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!(ROLES_SUBDITO as readonly string[]).includes(rol)) return { ok: false, motivo: `Rol desconocido: ${rol}` };
  const s = await tx.subject.findFirst({ where: { id: subjectId, saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true } });
  if (!s) return { ok: false, motivo: 'No hay ningún súbdito así en tu Reino.' };
  if (!esAdultoSubdito(s, ahora)) return { ok: false, motivo: `${s.name} aún es una cría: no trabaja ni combate hasta hacerse mayor.` };
  const antes = rolDeSubdito(s.role);
  await tx.subject.update({ where: { id: s.id }, data: { role: rol } });
  await recalcularPoblacion(tx, saveId, ahora);
  // CR-58: quien pasa a soldado, vigía o cazador necesita arma (quien vuelve a trabajar ya tiene su herramienta).
  if (rol !== 'trabajador' && (antes === 'trabajador' || antes === 'visitante')) {
    const { equiparAlta } = await import('./economiaReino.js');
    await equiparAlta(tx, saveId, rol === 'cazador' ? 'cazador' : 'soldado');
  }
  return { ok: true };
}

/// CR-61 (61c): cambia la tarea de un súbdito trabajador adulto.
export async function cambiarTareaSubdito(tx: Tx, saveId: string, subjectId: string, tarea: string, ahora: number): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!esTarea(tarea)) return { ok: false, motivo: `Tarea desconocida: ${tarea}` };
  const s = await tx.subject.findFirst({ where: { id: subjectId, saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true } });
  if (!s) return { ok: false, motivo: 'No hay ningún súbdito así en tu Reino.' };
  if (!esAdultoSubdito(s, ahora)) return { ok: false, motivo: `${s.name} aún es una cría: no trabaja hasta hacerse mayor.` };
  if (rolDeSubdito(s.role) !== 'trabajador') return { ok: false, motivo: `${s.name} no es trabajador: cámbiale antes el rol.` };
  await tx.subject.update({ where: { id: s.id }, data: { tarea } });
  return { ok: true };
}

/// Para la vista: edad y linaje de cada súbdito activo.
/// `ids`: esos súbditos en vez de los activos (los candidatos que esperan, REI-119).
export async function datosDeSubditos(tx: Tx, saveId: string, ahora: number, ids?: string[]) {
  const subditos = await tx.subject.findMany({ where: ids ? { saveId, id: { in: ids } } : { saveId, estado: 'ACTIVO' }, orderBy: { createdAt: 'asc' } });
  const miembros = await tx.linajeMiembro.findMany({ where: { saveId, entidadTipo: 'SUBDITO', entidadId: { in: subditos.map((s) => s.id) } }, select: { entidadId: true, linaje: { select: { nombre: true, tipo: true } } } });
  const linajePor = new Map(miembros.map((m) => [m.entidadId, m.linaje]));
  const nombrePor = new Map((await tx.subject.findMany({ where: { saveId, id: { in: subditos.map((s) => s.parejaId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  return subditos.map((s) => ({
    id: s.id, name: s.name, role: s.role, rol: rolDeSubdito(s.role), pueblo: s.pueblo, genero: s.genero,
    edad: s.nacidoEn == null ? null : edadEnAnios(s.nacidoEn, ahora), adulto: esAdultoSubdito(s, ahora),
    felicidad: s.felicidad, origen: s.origen, territoryId: s.territoryId, linaje: linajePor.get(s.id) ?? null,
    pareja: s.parejaId ? nombrePor.get(s.parejaId) ?? null : null, crias: s.crias,
    tarea: esTarea(s.tarea) ? s.tarea : TAREA_POR_DEFECTO,
  }));
}

