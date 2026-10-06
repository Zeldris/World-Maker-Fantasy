// Parejas y crías de los súbditos (REI-120, hito 0.3 — Fase C, decisión Q5 de la usuaria del
// 2026-10-06, como en Medieval Dynasty). Cada semana, dos adultos del mismo pueblo sin pareja y con
// felicidad ≥ 70 pueden emparejarse (20 %). Con cama libre, una pareja en edad fértil tiene una cría
// según su pueblo (orcos 15 %, Goirntes 10 %, Nabieus 8 %, Faerus 4 % por semana), como mucho 2. La
// cría hereda el linaje que le toca (CR-52) y no trabaja ni combate hasta su madurez (`subditos.ts`).
import type { Prisma } from '@prisma/client';
import { ownerKeyFor } from '../reinoOwner.js';
import { edadEnAnios, esAdulto, esFertil } from './edades.js';
import { linajeParaNacido } from './linajes.js';
import { registrarSuceso } from './sucesos.js';
import { crearSubdito, cupoDeCamas } from './subditos.js';

type Tx = Prisma.TransactionClient;

export const DIAS_ENTRE_REVISIONES = 7;
export const FELICIDAD_PARA_PAREJA = 70;
export const PROB_PAREJA_SEMANA = 0.2;
export const MAX_CRIAS_POR_PAREJA = 2;
export const PROB_CRIA_SEMANA: Record<string, number> = { orcos: 0.15, goirntes: 0.1, nabieus: 0.08, faerus: 0.04 };

export interface SubditoFamilia {
  id: string;
  pueblo: string | null;
  genero: string | null;
  nacidoEn: number | null;
  felicidad: number;
  parejaId: string | null;
}

const edad = (s: SubditoFamilia, ahora: number) => (s.nacidoEn == null ? null : edadEnAnios(s.nacidoEn, ahora));

/// Puro: las parejas que pueden formarse esta semana (por orden: cada uno, con el primero libre).
export function posiblesParejas(subditos: SubditoFamilia[], ahora: number): [madre: SubditoFamilia, padre: SubditoFamilia][] {
  const listo = (s: SubditoFamilia) =>
    !!s.pueblo && !s.parejaId && s.felicidad >= FELICIDAD_PARA_PAREJA && (s.nacidoEn == null || esAdulto(s.pueblo, edad(s, ahora)!));
  const libres = subditos.filter(listo);
  const usados = new Set<string>();
  const out: [SubditoFamilia, SubditoFamilia][] = [];
  for (const m of libres.filter((s) => s.genero === 'F')) {
    const p = libres.find((s) => s.genero === 'M' && s.pueblo === m.pueblo && !usados.has(s.id));
    if (!p) continue;
    usados.add(p.id);
    out.push([m, p]);
  }
  return out;
}

/// Puro: si una pareja puede tener crías (edad fértil, sin pasar del tope). Sin edad conocida, sí.
export function puedeCriar(madre: SubditoFamilia, padre: SubditoFamilia, crias: number, ahora: number): boolean {
  if (crias >= MAX_CRIAS_POR_PAREJA || !madre.pueblo) return false;
  const fertil = (s: SubditoFamilia) => s.nacidoEn == null || esFertil(s.pueblo, edad(s, ahora)!);
  return fertil(madre) && fertil(padre);
}

/// Una semana de las familias del Reino: parejas nuevas y crías. Idempotente por semana.
export async function revisarFamilias(tx: Tx, saveId: string, ahora: number, random: () => number): Promise<{ parejas: number; crias: string[] }> {
  const ownerKey = ownerKeyFor({ saveId });
  const stats = await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { ultimaRevisionFamilias: true } });
  if (!stats || (stats.ultimaRevisionFamilias != null && ahora - stats.ultimaRevisionFamilias < DIAS_ENTRE_REVISIONES * 1440)) return { parejas: 0, crias: [] };
  await tx.kingdomStats.update({ where: { ownerKey }, data: { ultimaRevisionFamilias: ahora } });

  const sel = { id: true, name: true, pueblo: true, genero: true, nacidoEn: true, felicidad: true, parejaId: true, crias: true } as const;
  let subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, orderBy: { createdAt: 'asc' }, select: sel });
  // Quien perdió a su pareja (se fue o murió) vuelve a estar libre.
  const activos = new Set(subditos.map((s) => s.id));
  for (const s of subditos.filter((x) => x.parejaId && !activos.has(x.parejaId))) await tx.subject.update({ where: { id: s.id }, data: { parejaId: null } });

  let parejas = 0;
  for (const [m, p] of posiblesParejas(subditos.map((s) => ({ ...s, parejaId: s.parejaId && activos.has(s.parejaId) ? s.parejaId : null })), ahora)) {
    if (random() >= PROB_PAREJA_SEMANA) continue;
    await tx.subject.update({ where: { id: m.id }, data: { parejaId: p.id, crias: 0 } });
    await tx.subject.update({ where: { id: p.id }, data: { parejaId: m.id, crias: 0 } });
    parejas++;
  }

  subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, orderBy: { createdAt: 'asc' }, select: sel });
  const porId = new Map(subditos.map((s) => [s.id, s]));
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const crias: string[] = [];
  for (const madre of subditos.filter((s) => s.genero === 'F' && s.parejaId)) {
    const padre = porId.get(madre.parejaId!);
    if (!padre || !madre.pueblo || !puedeCriar(madre, padre, madre.crias, ahora)) continue;
    if (random() >= (PROB_CRIA_SEMANA[madre.pueblo] ?? 0.08)) continue;
    if ((await cupoDeCamas(tx, saveId)).libres <= 0) break;
    const linaje = await linajeParaNacido(tx, { saveId, pueblo: madre.pueblo, madreId: madre.id, padreId: padre.id, ahora, random, entidadTipo: 'SUBDITO' });
    const cria = await crearSubdito(tx, { saveId, worldId, pueblo: madre.pueblo, nacidoEn: ahora, origen: 'NACIDO', padreId: padre.id, madreId: madre.id, linajeId: linaje.id, felicidad: madre.felicidad, ahora, random });
    await tx.subject.updateMany({ where: { id: { in: [madre.id, padre.id] } }, data: { crias: { increment: 1 } } });
    madre.crias++;
    const genero = (await tx.subject.findUniqueOrThrow({ where: { id: cria.id }, select: { genero: true } })).genero === 'F' ? 'F' : 'M';
    await registrarSuceso(tx, {
      saveId, tipo: 'NACIMIENTO_NOTABLE', fictionalMinutes: ahora, origen: 'MUNDO',
      actores: [
        { entidadTipo: 'SUBDITO', entidadId: cria.id, papel: 'AUTOR' },
        { entidadTipo: 'SUBDITO', entidadId: madre.id, papel: 'AFECTADO' },
        { entidadTipo: 'SUBDITO', entidadId: padre.id, papel: 'AFECTADO' },
        { entidadTipo: 'LINAJE', entidadId: linaje.id, papel: 'BENEFICIARIO' },
      ],
      datos: { nacido: cria.name, genero, padres: `${padre.name} y ${madre.name}` },
    });
    crias.push(cria.id);
  }
  return { parejas, crias };
}
