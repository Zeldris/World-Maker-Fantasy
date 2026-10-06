// Factura de equipo (CR-58, hito 0.3 — Fase D, decisiones Q25-Q27 de la usuaria del 2026-10-06).
// Cada persona cuesta, además de su sueldo y su comida, su equipo: al darla de alta y su desgaste
// semanal. Con el taller del oficio y un trabajador asignado el equipo se fabrica en casa (materiales
// por la mitad de su valor, 0 Goirnos); si no, se compra a precio de mercado.
//
// Cifras derivadas por Claude (revisables): 1 unidad de material por cada 5 Goirnos de valor; si el
// desgaste de una semana no se paga, se rompe la parte del equipo que dura una semana (1/4 de las
// herramientas, que duran 4 semanas, y 1/6 de las armas, que duran 6).
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/// Valores medios del catálogo (arma 18, armadura o ropa 16, herramienta 7) y su duración en semanas.
export const EQUIPO = {
  herramienta: { valor: 7, semanas: 4, taller: ['herreria', 'carpinteria'] },
  arma: { valor: 18, semanas: 6, taller: ['herreria'] },
  armadura: { valor: 16, semanas: 8, taller: ['peleteria', 'sastreria', 'curtiduria'] },
} as const;
export type PiezaEquipo = keyof typeof EQUIPO;
export const GOIRNOS_POR_MATERIAL = 5;

/// Puro: la familia de taller de un edificio (`herreria-obrador` → herreria).
export const familiaDeTaller = (recipeKey: string | null) => (recipeKey ?? '').split('-')[0]!;

/// Puro: qué piezas se fabrican en casa con estos talleres (con trabajador).
export function piezasEnCasa(talleres: Set<string>): Set<PiezaEquipo> {
  return new Set((Object.keys(EQUIPO) as PiezaEquipo[]).filter((p) => EQUIPO[p].taller.some((t) => talleres.has(t))));
}

/// Puro: coste de unas piezas (Goirnos si se compran; materiales si se fabrican).
export function costeDePiezas(piezas: Partial<Record<PiezaEquipo, number>>, enCasa: Set<PiezaEquipo>): { goirnos: number; materiales: number } {
  let goirnos = 0;
  let valorEnCasa = 0;
  for (const [pieza, valor] of Object.entries(piezas) as [PiezaEquipo, number][]) {
    if (enCasa.has(pieza)) valorEnCasa += valor;
    else goirnos += valor;
  }
  return { goirnos: Math.round(goirnos), materiales: Math.ceil(valorEnCasa / 2 / GOIRNOS_POR_MATERIAL) };
}

/// Puro: el desgaste de una semana (valor por pieza / semanas que dura).
export function desgasteSemanal(c: { trabajadores: number; soldados: number }): Record<PiezaEquipo, number> {
  return {
    herramienta: (c.trabajadores * EQUIPO.herramienta.valor) / EQUIPO.herramienta.semanas,
    arma: (c.soldados * EQUIPO.arma.valor) / EQUIPO.arma.semanas,
    armadura: (c.soldados * EQUIPO.armadura.valor) / EQUIPO.armadura.semanas,
  };
}

/// Puro: el equipo de alta de alguien que pasa a un rol (un soldado que era trabajador ya tiene herramienta).
export function equipoDeAlta(rol: 'trabajador' | 'soldado'): Partial<Record<PiezaEquipo, number>> {
  return rol === 'trabajador' ? { herramienta: EQUIPO.herramienta.valor } : { arma: EQUIPO.arma.valor, armadura: EQUIPO.armadura.valor };
}

/// Puro: si el desgaste de una semana no se paga, cuánto equipo se rompe.
export function roturaSinPagar(c: { trabajadores: number; soldados: number }): { sinHerramienta: number; sinArma: number } {
  return { sinHerramienta: Math.ceil(c.trabajadores / EQUIPO.herramienta.semanas), sinArma: Math.ceil(c.soldados / EQUIPO.arma.semanas) };
}

/// Talleres del Reino con al menos un trabajador asignado (familias: herreria, peleteria…).
export async function talleresDelReino(tx: Tx, saveId: string): Promise<Set<string>> {
  const edificios = await tx.building.findMany({ where: { saveId, status: 'ACTIVO', trabajadores: { some: {} } }, select: { recipeKey: true } });
  return new Set(edificios.map((b) => familiaDeTaller(b.recipeKey)));
}

/// Gasta `n` materiales (objetos de tipo RECURSO) del Almacén del Reino; devuelve si había bastantes.
export async function gastarMateriales(tx: Tx, saveId: string, n: number): Promise<boolean> {
  if (n <= 0) return true;
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const recursos = (await tx.itemCatalog.findMany({ where: { worldId: save.worldId, tipo: 'RECURSO' }, select: { slug: true } })).map((r) => r.slug);
  const filas = await tx.almacenItem.findMany({ where: { saveId, catalogSlug: { in: recursos } }, orderBy: { createdAt: 'asc' }, take: n, select: { id: true } });
  if (filas.length < n) return false;
  await tx.almacenItem.deleteMany({ where: { id: { in: filas.map((f) => f.id) } } });
  return true;
}
