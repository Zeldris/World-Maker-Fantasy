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
import { CELL_SIZE_PX } from '../zonaPosicion.js';
import { aplicarEfectos, CUALQUIERA_SALVO_ORIGEN, type CtxEfecto, type Disparo, type Efecto } from './efectos.js';
import { ejecutarReaccion, REACCIONES } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';
import { REGLAS_DEL_JUEGO } from './reglasConsecuencias.js';

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
  /// Limpieza al caducar sin dispararse (p. ej. retirar un punto de zona).
  alCaducar?: (ctx: CtxConsecuencia) => Promise<Efecto[]>;
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
      select: { id: true, tipo: true, saveId: true, fictionalMinutes: true, regionSlug: true, locationId: true, nivelCascada: true, actores: true },
    });
    if (!reaccion || !suceso) return null;
    // Nueva cascada desde cero: el día siguiente es otro momento. Si ya no se cumple, se pierde.
    const enCola = { ...suceso, nivelCascada: 0 };
    if (!(await reaccion.condicion({ tx: ctx.tx, worldId: ctx.worldId, suceso: enCola, random: ctx.random }))) return null;
    await ejecutarReaccion(ctx.tx, ctx.worldId, enCola, reaccion, ctx.random);
    return [];
  },
});

for (const regla of REGLAS_DEL_JUEGO) registrarRegla(regla);

/// Región actual de la partida (slug), para los disparos `LLEGAR_REGION`.
async function regionActual(db: PrismaClient | Tx, saveId: string): Promise<string | null> {
  const save = await db.save.findUnique({ where: { id: saveId }, select: { currentLocation: { select: { region: true } } } });
  return save?.currentLocation ? slugify(save.currentLocation.region) : null;
}

/// Distancia (px del lienzo de zona) a la que la jugadora «se cruza» con un NPC: celda y media.
export const RADIO_ENCUENTRO_PX = CELL_SIZE_PX * 1.5;

/// NPC con un punto activo de la partida en su lugar actual, a menos de `RADIO_ENCUENTRO_PX` de ella.
async function npcsCercanos(db: PrismaClient, saveId: string): Promise<string[]> {
  const save = await db.save.findUnique({ where: { id: saveId }, select: { worldId: true, currentLocationId: true, zonaPosX: true, zonaPosY: true } });
  if (!save?.currentLocationId || save.zonaPosX === null || save.zonaPosY === null) return [];
  const puntos = await db.zonePoint.findMany({ where: { saveId, locationId: save.currentLocationId, activo: true, tipo: { in: ['NPC', 'FAUNA'] } }, select: { x: true, y: true, targetSlug: true } });
  const cerca = puntos.filter((p) => Math.hypot(p.x - save.zonaPosX!, p.y - save.zonaPosY!) <= RADIO_ENCUENTRO_PX).map((p) => p.targetSlug);
  if (cerca.length === 0) return [];
  return (await db.npc.findMany({ where: { worldId: save.worldId, slug: { in: cerca } }, select: { id: true } })).map((n) => n.id);
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
      if (claim.count === 0) return;
      await perder(tx, c, 'CADUCADA', minutos);
      const alCaducar = REGLAS.get(c.regla)?.alCaducar;
      if (alCaducar) {
        const efectos = await alCaducar({ tx, saveId, worldId: save.worldId, fictionalMinutes: minutos, consecuencia: c, random });
        await aplicarEfectos({ tx, saveId, worldId: save.worldId, fictionalMinutes: minutos, origen: 'MOTOR', random }, efectos);
      }
    });
  }

  const region = await regionActual(prisma, saveId);
  const npcIds = [...(momento.npcIds ?? []), ...(await npcsCercanos(prisma, saveId))];
  const candidatas = await prisma.consecuencia.findMany({
    where: { saveId, estado: 'PENDIENTE', tipoDisparo: { not: 'SUCESO' }, desdeDia: { lte: dia } },
    orderBy: { createdAt: 'asc' },
  });
  let disparadas = 0;
  for (const c of candidatas) {
    if (!seCumple(c, region, npcIds)) continue;
    if (await prisma.$transaction((tx) => disparar(tx, save.worldId, c, minutos, random))) disparadas++;
  }
  return { disparadas, caducadas: vencidas.length };
}

/// ¿Este suceso cumple el disparo `SUCESO`? Tipo, y si lo pide, que pase en ese lugar, que el NPC
/// salga en él (CR-12: el guardia de una caravana, el encargado de una reparación) y que el objeto
/// sea de alguna de las categorías (`datos.objeto.categoria`, p. ej. un `REGALO` de madera o piedra).
export function cumpleDisparoSuceso(
  d: Extract<Disparo, { tipo: 'SUCESO' }>,
  suceso: { tipo: string; locationId?: string | null; actores?: { entidadTipo: string; entidadId: string }[]; datos?: unknown },
): boolean {
  if (!d.tipos.includes(suceso.tipo as never)) return false;
  // Las plantillas se comparten entre lugares: el guardia de esta caravana es el de ESTE sitio.
  if (d.locationId && suceso.locationId !== d.locationId) return false;
  if (d.npcId && !(suceso.actores ?? []).some((a) => a.entidadTipo === 'NPC' && a.entidadId === d.npcId)) return false;
  if (d.categorias) {
    const categoria = (suceso.datos as { objeto?: { categoria?: string } } | null)?.objeto?.categoria;
    if (!categoria || !d.categorias.includes(categoria)) return false;
  }
  return true;
}

/// Disparo `SUCESO`: lo llama la cola de reacciones por cada suceso que procesa.
export async function dispararPorSuceso(
  tx: Tx,
  worldId: string,
  suceso: { id?: string; saveId: string; tipo: string; fictionalMinutes: number; locationId?: string | null; actores?: { entidadTipo: string; entidadId: string }[] },
  random: () => number,
): Promise<void> {
  const dia = Math.floor(suceso.fictionalMinutes / 1440);
  const pendientes = await tx.consecuencia.findMany({ where: { saveId: suceso.saveId, estado: 'PENDIENTE', tipoDisparo: 'SUCESO', desdeDia: { lte: dia } } });
  if (pendientes.length === 0) return;
  // Los datos solo hacen falta si alguna pide categoría.
  const datos = pendientes.some((c) => (c.disparo as unknown as Disparo & { categorias?: string[] }).categorias) && suceso.id
    ? (await tx.suceso.findUnique({ where: { id: suceso.id }, select: { datos: true } }))?.datos
    : undefined;
  for (const c of pendientes) {
    const d = c.disparo as unknown as Disparo;
    if (d.tipo === 'SUCESO' && cumpleDisparoSuceso(d, { ...suceso, datos })) await disparar(tx, worldId, c, suceso.fictionalMinutes, random);
  }
}
