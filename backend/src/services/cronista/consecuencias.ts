// Consecuencias aplazadas (CR-11, hito 0.2 — roadmap-cronista.md § 7.2). Un suceso deja algo
// pendiente (efecto `programarConsecuencia`) y, cuando se cumple su disparo, la regla decide qué pasa
// con efectos de la lista cerrada. Si al dispararse ya no tiene sentido (el NPC murió…), o caduca sin
// dispararse, queda como `CONSECUENCIA_PERDIDA` (solo se ve en Admin).
//
// `evaluarConsecuencias` se llama al cerrar el turno, el día y cada acción (`avanceDiario.ts`):
// caduca lo vencido y dispara lo que toque por días o por estar en una región. El encuentro con un
// NPC lo dispara quien lo detecta (`npcIds` del momento) y el disparo por suceso, la cola de
// reacciones al procesar cada suceso (`dispararPorSuceso`).
import type { Consecuencia, Prisma, PrismaClient } from '@prisma/client';
import { slugify } from '../../lib/slugify.js';
import { aplicarEfectos, CUALQUIERA_SALVO_ORIGEN, type CtxEfecto, type Disparo, type Efecto } from './efectos.js';
import { ejecutarReaccion, REACCIONES } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';

type Tx = Prisma.TransactionClient;

export interface CtxConsecuencia {
  tx: Tx;
  saveId: string;
  worldId: string;
  fictionalMinutes: number;
  consecuencia: Consecuencia;
  random: () => number;
}

export interface ReglaConsecuencia {
  id: string;
  /// Efectos al dispararse; `null` = ya no tiene sentido (se pierde).
  alDisparar: (ctx: CtxConsecuencia) => Promise<Efecto[] | null>;
}

/// Reglas por id. Las del juego se añaden con `registrarRegla` desde su propio módulo.
export const REGLAS = new Map<string, ReglaConsecuencia>();

export function registrarRegla(regla: ReglaConsecuencia): void {
  REGLAS.set(regla.id, regla);
}

/// Reacción que no cupo en el tope de cascada (CR-10): se ejecuta al día siguiente sobre el mismo suceso.
registrarRegla({
  id: 'REACCION_APLAZADA',
  alDisparar: async (ctx) => {
    const { sucesoId, reaccionId } = ctx.consecuencia.datos as { sucesoId: string; reaccionId: string };
    const reaccion = REACCIONES.find((r) => r.id === reaccionId);
    const suceso = await ctx.tx.suceso.findUnique({
      where: { id: sucesoId },
      select: { id: true, tipo: true, saveId: true, fictionalMinutes: true, regionSlug: true, nivelCascada: true, actores: true },
    });
    if (!reaccion || !suceso) return null;
    // Nueva cascada desde cero: el día siguiente es otro momento. Si ya no se cumple, se pierde.
    const enCola = { ...suceso, nivelCascada: 0 };
    if (!(await reaccion.condicion({ tx: ctx.tx, worldId: ctx.worldId, suceso: enCola, random: ctx.random }))) return null;
    await ejecutarReaccion(ctx.tx, ctx.worldId, enCola, reaccion, ctx.random);
    return [];
  },
});

/// Región actual de la partida (slug), para los disparos `LLEGAR_REGION`.
async function regionActual(db: PrismaClient | Tx, saveId: string): Promise<string | null> {
  const save = await db.save.findUnique({ where: { id: saveId }, select: { currentLocation: { select: { region: true } } } });
  return save?.currentLocation ? slugify(save.currentLocation.region) : null;
}

/// ¿Se cumple el disparo en este momento? (el día ya se ha comprobado con `desdeDia`).
export function seCumple(c: Pick<Consecuencia, 'tipoDisparo' | 'disparo' | 'npcId'>, region: string | null, npcIds: string[]): boolean {
  const d = c.disparo as unknown as Disparo;
  switch (d.tipo) {
    case 'DIAS':
      return true;
    case 'LLEGAR_REGION':
      if (!region) return false;
      return d.regionSlug === CUALQUIERA_SALVO_ORIGEN ? region !== d.origenSlug : region === d.regionSlug;
    case 'ENCUENTRO_NPC':
      return npcIds.includes(d.npcId);
    case 'SUCESO':
      return false; // los dispara la cola de reacciones (`dispararPorSuceso`)
  }
}

async function perder(tx: Tx, c: Consecuencia, estado: 'CADUCADA' | 'DISPARADA', fictionalMinutes: number): Promise<void> {
  await tx.consecuencia.update({ where: { id: c.id }, data: { estado, resueltaEn: fictionalMinutes } });
  await registrarSuceso(tx, {
    saveId: c.saveId, tipo: 'CONSECUENCIA_PERDIDA', fictionalMinutes, origen: 'MOTOR',
    actores: [], datos: { regla: c.regla }, causas: c.origenSucesoId ? [c.origenSucesoId] : [],
  });
}

/// Dispara una consecuencia (con reclamo atómico) y aplica lo que diga su regla.
async function disparar(tx: Tx, worldId: string, c: Consecuencia, fictionalMinutes: number, random: () => number): Promise<boolean> {
  const claim = await tx.consecuencia.updateMany({ where: { id: c.id, estado: 'PENDIENTE' }, data: { estado: 'DISPARADA', resueltaEn: fictionalMinutes } });
  if (claim.count === 0) return false;
  const regla = REGLAS.get(c.regla);
  const ctx: CtxConsecuencia = { tx, saveId: c.saveId, worldId, fictionalMinutes, consecuencia: c, random };
  const efectos = regla ? await regla.alDisparar(ctx) : null;
  if (efectos === null) {
    await perder(tx, c, 'DISPARADA', fictionalMinutes);
    return false;
  }
  const ctxEfecto: CtxEfecto = { tx, saveId: c.saveId, worldId, fictionalMinutes, origen: 'MOTOR', causas: c.origenSucesoId ? [c.origenSucesoId] : [], random };
  await aplicarEfectos(ctxEfecto, efectos);
  return true;
}

/// Caduca lo vencido y dispara lo que toque ahora en la partida. Devuelve cuántas se dispararon.
export async function evaluarConsecuencias(
  prisma: PrismaClient,
  saveId: string,
  momento: { npcIds?: string[] } = {},
  random: () => number = Math.random,
): Promise<{ disparadas: number; caducadas: number }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { disparadas: 0, caducadas: 0 };
  const minutos = save.worldState.fictionalMinutes;
  const dia = Math.floor(minutos / 1440);

  const vencidas = await prisma.consecuencia.findMany({ where: { saveId, estado: 'PENDIENTE', caducaEn: { lte: minutos } } });
  for (const c of vencidas) {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.consecuencia.updateMany({ where: { id: c.id, estado: 'PENDIENTE' }, data: { estado: 'CADUCADA' } });
      if (claim.count > 0) await perder(tx, c, 'CADUCADA', minutos);
    });
  }

  const region = await regionActual(prisma, saveId);
  const candidatas = await prisma.consecuencia.findMany({
    where: { saveId, estado: 'PENDIENTE', tipoDisparo: { not: 'SUCESO' }, desdeDia: { lte: dia } },
    orderBy: { createdAt: 'asc' },
  });
  let disparadas = 0;
  for (const c of candidatas) {
    if (!seCumple(c, region, momento.npcIds ?? [])) continue;
    if (await prisma.$transaction((tx) => disparar(tx, save.worldId, c, minutos, random))) disparadas++;
  }
  return { disparadas, caducadas: vencidas.length };
}

/// Disparo `SUCESO`: lo llama la cola de reacciones por cada suceso que procesa.
export async function dispararPorSuceso(tx: Tx, worldId: string, suceso: { saveId: string; tipo: string; fictionalMinutes: number }, random: () => number): Promise<void> {
  const dia = Math.floor(suceso.fictionalMinutes / 1440);
  const pendientes = await tx.consecuencia.findMany({ where: { saveId: suceso.saveId, estado: 'PENDIENTE', tipoDisparo: 'SUCESO', desdeDia: { lte: dia } } });
  for (const c of pendientes) {
    const d = c.disparo as unknown as Disparo;
    if (d.tipo === 'SUCESO' && d.tipos.includes(suceso.tipo as never)) await disparar(tx, worldId, c, suceso.fictionalMinutes, random);
  }
}
