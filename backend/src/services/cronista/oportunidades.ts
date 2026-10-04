// Oportunidades con plazo (CR-12 paso 12d, hito 0.2 — decisiones de la usuaria en la ronda 2 y en
// la Q14 de CR-12). Algunos sucesos de fondo dejan algo que hacer durante unos días en un lugar
// concreto, solo con mecánicas que ya existen:
//
// - **Campo de batalla** (tras una escaramuza, 3 días): un caído de una de las facciones (se saquea
//   como cualquier cadáver de la zona) y un herido de la otra (menú de NPC: «Ayudar», rematar o
//   capturarlo).
// - **Caravana** (2 días): un guardia de la facción que la lleva pasa por un lugar de su región. Si
//   la jugadora lo vence o lo mata, se queda con la carga (`CARAVANA_ASALTADA`); la reputación con
//   la facción ya baja sola por atacar a uno de los suyos.
// - **Encargo de materiales** (tras un incendio o una crecida, 5 días): alguien de la facción pide
//   madera o piedra junto al edificio dañado. Entregársela (entrega de objetos a un NPC) repara el
//   edificio y da reputación (`ENCARGO_MATERIALES`).
//
// Los puntos de zona se retiran al cumplirse el plazo (`OPORTUNIDAD_CIERRA`); si nadie va, la
// oportunidad se pierde sin más. Quien hace de caído, herido, guardia o encargado es un NPC PLANTILLA
// de esa facción (hoy solo Serhu, Helsig y la Concordia tienen): sin plantilla no hay oportunidad.
import type { Prisma } from '@prisma/client';
import { applyFactionRepDelta, parseFactionsStatus, REGION_OWNING_FACTIONS } from '../reputation.js';
import { LIENZO_ALTO, LIENZO_ANCHO } from '../zonaPosicion.js';
import { aplicarEfecto, type CtxEfecto, type Efecto } from './efectos.js';
import type { CtxConsecuencia, ReglaConsecuencia } from './consecuencias.js';

type Tx = Prisma.TransactionClient;

export const PLAZO_CAMPO_BATALLA = 3;
export const PLAZO_CARAVANA = 2;
export const PLAZO_ENCARGO = 5;
/// Carga de una caravana asaltada (goirnos).
export const BOTIN_CARAVANA_MIN = 40;
export const BOTIN_CARAVANA_MAX = 90;
/// Reputación con la facción por traer los materiales que pedía.
export const REPUTACION_ENCARGO = 80;
/// Lo que vale como «materiales» para una reparación (categoría del catálogo).
export const CATEGORIAS_MATERIALES = ['madera', 'piedra'];

export interface CtxOportunidad {
  tx: Tx;
  saveId: string;
  worldId: string;
  fictionalMinutes: number;
  random: () => number;
  /// Suceso que la abre (queda como causa de lo que registre).
  causa?: string | null;
}

const elegir = <T>(lista: T[], random: () => number): T | null => (lista.length === 0 ? null : lista[Math.floor(random() * lista.length)]!);

/// NPC PLANTILLA de una facción (por nombre), si tiene.
async function plantillasDe(tx: Tx, worldId: string, faccion: string) {
  return tx.npc.findMany({ where: { worldId, kind: 'PLANTILLA', faction: faccion, muertoEnMundo: false }, select: { id: true, slug: true, name: true }, orderBy: { slug: 'asc' } });
}

/// Un lugar de una región donde la facción tiene tierras (`REGION_OWNING_FACTIONS`).
async function lugarDe(tx: Tx, worldId: string, faccion: string, random: () => number) {
  const regiones = Object.entries(REGION_OWNING_FACTIONS).filter(([, duenas]) => duenas.includes(faccion)).map(([r]) => r);
  if (regiones.length === 0) return null;
  const lugares = await tx.location.findMany({ where: { worldId, region: { in: regiones } }, select: { id: true, name: true, region: true }, orderBy: { slug: 'asc' } });
  return elegir(lugares, random);
}

/// Posición en el lienzo de zona, lejos de los bordes.
function posicion(random: () => number) {
  const margen = 80;
  return { x: Math.round(margen + random() * (LIENZO_ANCHO - 2 * margen)), y: Math.round(margen + random() * (LIENZO_ALTO - 2 * margen)) };
}

function ctxEfecto(ctx: CtxOportunidad): CtxEfecto {
  return { tx: ctx.tx, saveId: ctx.saveId, worldId: ctx.worldId, fictionalMinutes: ctx.fictionalMinutes, origen: 'MOTOR', causas: ctx.causa ? [ctx.causa] : [], random: ctx.random };
}

/// Pone un NPC en el lugar con su punto de zona; devuelve el id del punto.
async function ponerNpc(ctx: CtxOportunidad, npc: { id: string; slug: string }, locationId: string, condicion: 'MUERTO' | 'GRAVE' | 'ILESO', label?: string) {
  const c = ctxEfecto(ctx);
  await aplicarEfecto(c, { tipo: 'situarNpc', npcId: npc.id, locationId, condicion });
  const { x, y } = posicion(ctx.random);
  const r = await aplicarEfecto(c, { tipo: 'crearPuntoZona', locationId, puntoTipo: 'NPC', targetSlug: npc.slug, x, y, ...(label ? { label } : {}) });
  return r.id ?? null;
}

/// Retira los puntos cuando vence el plazo.
async function cerrarEn(ctx: CtxOportunidad, plazo: number, puntos: (string | null)[]) {
  await aplicarEfecto(ctxEfecto(ctx), {
    tipo: 'programarConsecuencia', regla: 'OPORTUNIDAD_CIERRA', disparo: { tipo: 'DIAS', min: plazo, max: plazo },
    datos: { puntos: puntos.filter((p): p is string => !!p) }, caducaDias: plazo + 30,
  });
}

/// Tras una escaramuza entre `atacante` y `atacada`: un caído y un herido en tierras de la atacada.
/// Devuelve la pista para la noticia, o null si no hay quien haga de caído y de herido.
export async function abrirCampoDeBatalla(ctx: CtxOportunidad, atacante: string, atacada: string): Promise<string | null> {
  const [deA, deB] = await Promise.all([plantillasDe(ctx.tx, ctx.worldId, atacante), plantillasDe(ctx.tx, ctx.worldId, atacada)]);
  const caido = elegir(deB, ctx.random) ?? elegir(deA, ctx.random);
  const herido = elegir(deA.filter((n) => n.id !== caido?.id), ctx.random) ?? elegir(deB.filter((n) => n.id !== caido?.id), ctx.random);
  const lugar = (await lugarDe(ctx.tx, ctx.worldId, atacada, ctx.random)) ?? (await lugarDe(ctx.tx, ctx.worldId, atacante, ctx.random));
  if (!caido || !herido || !lugar) return null;
  const puntos = [await ponerNpc(ctx, caido, lugar.id, 'MUERTO'), await ponerNpc(ctx, herido, lugar.id, 'GRAVE')];
  await cerrarEn(ctx, PLAZO_CAMPO_BATALLA, puntos);
  return `Dicen que en ${lugar.name} aún quedan caídos y algún herido del choque.`;
}

/// Una caravana de `desde` pasa por un lugar de su región con un guardia.
export async function abrirCaravana(ctx: CtxOportunidad, desde: string, hacia: string): Promise<string | null> {
  for (const faccion of [desde, hacia]) {
    const guardia = elegir(await plantillasDe(ctx.tx, ctx.worldId, faccion), ctx.random);
    const lugar = await lugarDe(ctx.tx, ctx.worldId, faccion, ctx.random);
    if (!guardia || !lugar) continue;
    const punto = await ponerNpc(ctx, guardia, lugar.id, 'ILESO', `Caravana de ${faccion}`);
    await aplicarEfecto(ctxEfecto(ctx), {
      tipo: 'programarConsecuencia', regla: 'CARAVANA_ASALTADA', disparo: { tipo: 'SUCESO', tipos: ['MUERTE_CAUSADA', 'COMBATE_GANADO'], npcId: guardia.id },
      datos: { faccion, punto }, caducaDias: PLAZO_CARAVANA, npcId: guardia.id,
    });
    await cerrarEn(ctx, PLAZO_CARAVANA, [punto]);
    return `La caravana pasará por ${lugar.name} en los próximos días.`;
  }
  return null;
}

/// Tras un incendio o una crecida que daña un edificio de `faccion` en `locationId`: alguien de la
/// facción pide materiales para repararlo.
export async function abrirEncargo(ctx: CtxOportunidad, faccion: string, buildingId: string, locationId: string, lugar: string): Promise<string | null> {
  const encargado = elegir(await plantillasDe(ctx.tx, ctx.worldId, faccion), ctx.random);
  if (!encargado) return null;
  const punto = await ponerNpc(ctx, encargado, locationId, 'ILESO', 'Pide materiales');
  await aplicarEfecto(ctxEfecto(ctx), {
    tipo: 'programarConsecuencia', regla: 'ENCARGO_MATERIALES', disparo: { tipo: 'SUCESO', tipos: ['REGALO'], npcId: encargado.id, categorias: CATEGORIAS_MATERIALES },
    datos: { faccion, buildingId, punto, encargado: encargado.name }, caducaDias: PLAZO_ENCARGO, npcId: encargado.id,
  });
  await cerrarEn(ctx, PLAZO_ENCARGO, [punto]);
  return `En ${lugar} buscan madera o piedra para reparar lo dañado.`;
}

// ─────────────────────────── Reglas ───────────────────────────

export const OPORTUNIDAD_CIERRA: ReglaConsecuencia = {
  id: 'OPORTUNIDAD_CIERRA',
  alDisparar: async (ctx: CtxConsecuencia) => {
    const { puntos } = ctx.consecuencia.datos as { puntos: string[] };
    return puntos.map((zonePointId) => ({ tipo: 'retirarPuntoZona' as const, zonePointId }));
  },
};

export const CARAVANA_ASALTADA: ReglaConsecuencia = {
  id: 'CARAVANA_ASALTADA',
  alDisparar: async (ctx: CtxConsecuencia) => {
    const { faccion, punto } = ctx.consecuencia.datos as { faccion: string; punto: string | null };
    const goirnos = BOTIN_CARAVANA_MIN + Math.floor(ctx.random() * (BOTIN_CARAVANA_MAX - BOTIN_CARAVANA_MIN + 1));
    const efectos: Efecto[] = [{ tipo: 'botinAlJugador', goirnos, mensaje: `Te quedas con la carga de la caravana de ${faccion}: ${goirnos} goirnos.` }];
    if (punto) efectos.push({ tipo: 'retirarPuntoZona', zonePointId: punto });
    return efectos;
  },
};

export const ENCARGO_MATERIALES: ReglaConsecuencia = {
  id: 'ENCARGO_MATERIALES',
  alDisparar: async (ctx: CtxConsecuencia) => {
    const { faccion, buildingId, punto, encargado } = ctx.consecuencia.datos as { faccion: string; buildingId: string; punto: string | null; encargado: string };
    const ws = await ctx.tx.worldState.findUnique({ where: { saveId: ctx.saveId }, select: { factionsStatus: true, fictionalDateLabel: true } });
    await ctx.tx.worldState.update({ where: { saveId: ctx.saveId }, data: { factionsStatus: applyFactionRepDelta(parseFactionsStatus(ws?.factionsStatus), faccion, REPUTACION_ENCARGO) } });
    await ctx.tx.logEntry.create({
      data: {
        saveId: ctx.saveId, channel: 'CHARACTER', isSystemMessage: true, fictionalMinutes: ctx.fictionalMinutes, timeLabel: ws?.fictionalDateLabel ?? '',
        text: `${encargado}: «Con esto podremos levantarlo otra vez. En ${faccion} no lo olvidaremos.»`,
      },
    });
    const efectos: Efecto[] = [{ tipo: 'repararEdificio', buildingId }];
    if (punto) efectos.push({ tipo: 'retirarPuntoZona', zonePointId: punto });
    return efectos;
  },
};

export const REGLAS_OPORTUNIDADES: ReglaConsecuencia[] = [OPORTUNIDAD_CIERRA, CARAVANA_ASALTADA, ENCARGO_MATERIALES];
