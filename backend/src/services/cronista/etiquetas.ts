// Etiquetas ganadas (CR-14, hito 0.3 — roadmap-cronista.md § 8.1 y decisiones de la Fase 4, Q4).
// Reglas que se evalúan como reacciones (CR-10) tras cada suceso con el personaje como autor, y
// las de relación con las facciones (AMIGO_DE / ENEMIGO_DE), que se revisan una vez al día.
// Una regla solo propone `anadirEtiqueta`/`quitarEtiqueta`; el efecto registra su suceso.
import type { Prisma } from '@prisma/client';
import { slugify } from '../../lib/slugify.js';
import { FACTION_REP_MAX, parseFactionsStatus } from '../reputation.js';
import { aplicarEfectos, type Efecto } from './efectos.js';
import type { CtxReaccion, Reaccion, SucesoEnCola } from './reacciones.js';

type Tx = Prisma.TransactionClient;

/// Umbrales decididos por la usuaria (Q4, 2026-10-06).
export const UMBRAL_CLEMENTE = 3;
export const UMBRAL_CARNICERO = 5;
export const UMBRAL_CAZADOR_TEMIDO = 10;
export const UMBRAL_ROMPE_JURAMENTOS = 2;
export const UMBRAL_SALVADOR = 3;
/// Reputación de facción: banda alta (≥ 4/5 del máximo) → amigo; banda baja (< 1/5) → enemigo.
export const REP_AMIGO = (FACTION_REP_MAX * 4) / 5;
export const REP_ENEMIGO = FACTION_REP_MAX / 5;
/// Un rendido es alguien que ya habías dejado convaleciente (COMBATE_GANADO) en el último día.
const VENTANA_RENDIDO_MIN = 1440;

/// Efectos mecánicos (Q4): lo que suman o restan a las tiradas sociales.
export const BONO_CLEMENTE_RENDIDO = 1;
export const MALUS_CARNICERO_PERSUADIR = -2;
export const MALUS_ROMPE_JURAMENTOS_PACTAR = -2;

const autor = (s: SucesoEnCola) => s.actores.find((a) => a.entidadTipo === 'PERSONAJE' && a.papel === 'AUTOR')?.entidadId ?? null;
const victima = (s: SucesoEnCola) => s.actores.find((a) => a.entidadTipo === 'NPC' && a.papel === 'VICTIMA')?.entidadId ?? null;

/// Cuántos sucesos de `tipo` tiene el personaje como autor en la partida.
async function cuentaDelPersonaje(tx: Tx, saveId: string, tipo: string): Promise<number> {
  return tx.suceso.count({ where: { saveId, tipo, actores: { some: { entidadTipo: 'PERSONAJE', papel: 'AUTOR' } } } });
}

/// Muertes causadas por el personaje, con su víctima y su minuto.
async function muertesDelPersonaje(tx: Tx, saveId: string) {
  const sucesos = await tx.suceso.findMany({
    where: { saveId, tipo: { in: ['MUERTE_CAUSADA', 'COMBATE_GANADO'] }, actores: { some: { entidadTipo: 'PERSONAJE', papel: 'AUTOR' } } },
    select: { tipo: true, fictionalMinutes: true, actores: { where: { entidadTipo: 'NPC', papel: 'VICTIMA' }, select: { entidadId: true } } },
    orderBy: { fictionalMinutes: 'asc' },
  });
  return sucesos.map((s) => ({ tipo: s.tipo, minuto: s.fictionalMinutes, victima: s.actores[0]?.entidadId ?? null }));
}

/// Puro: cuántas de las muertes fueron de rendidos (el mismo NPC quedó convaleciente ante ti hace
/// menos de un día).
export function muertesDeRendidos(sucesos: { tipo: string; minuto: number; victima: string | null }[]): number {
  let n = 0;
  for (const m of sucesos) {
    if (m.tipo !== 'MUERTE_CAUSADA' || !m.victima) continue;
    if (sucesos.some((g) => g.tipo === 'COMBATE_GANADO' && g.victima === m.victima && g.minuto <= m.minuto && m.minuto - g.minuto <= VENTANA_RENDIDO_MIN)) n++;
  }
  return n;
}

const etiqueta = (clave: string, texto: string): Efecto => ({ tipo: 'anadirEtiqueta', clave, texto });

export const REACCIONES_ETIQUETAS: Reaccion[] = [
  {
    id: 'ETIQUETA_VERDUGO',
    escucha: ['MUERTE_CAUSADA'],
    prioridad: 50,
    condicion: async (ctx) => {
      const v = victima(ctx.suceso);
      return !!autor(ctx.suceso) && !!v && (await ctx.tx.npc.count({ where: { id: v, kind: 'PRINCIPAL' } })) > 0;
    },
    efectos: async (ctx) => {
      const npc = await ctx.tx.npc.findUniqueOrThrow({ where: { id: victima(ctx.suceso)! }, select: { slug: true, name: true } });
      return [etiqueta(`VERDUGO_DE:${npc.slug}`, `Verdugo de ${npc.name}`)];
    },
  },
  {
    id: 'ETIQUETA_CARNICERO',
    escucha: ['MUERTE_CAUSADA'],
    prioridad: 50,
    condicion: async (ctx) => !!autor(ctx.suceso) && muertesDeRendidos(await muertesDelPersonaje(ctx.tx, ctx.suceso.saveId)) >= UMBRAL_CARNICERO,
    efectos: async () => [etiqueta('CARNICERO', 'Carnicero')],
  },
  {
    id: 'ETIQUETA_CAZADOR_TEMIDO',
    escucha: ['MUERTE_CAUSADA'],
    prioridad: 50,
    condicion: async (ctx) => {
      if (!autor(ctx.suceso)) return false;
      const muertes = (await muertesDelPersonaje(ctx.tx, ctx.suceso.saveId)).filter((m) => m.tipo === 'MUERTE_CAUSADA' && m.victima);
      if (muertes.length < UMBRAL_CAZADOR_TEMIDO) return false;
      const peligrosas = new Set(
        (await ctx.tx.npc.findMany({ where: { id: { in: [...new Set(muertes.map((m) => m.victima!))] }, faunaCategoria: { not: null }, temperamento: 'AGRESIVO' }, select: { id: true } })).map((n) => n.id),
      );
      return muertes.filter((m) => peligrosas.has(m.victima!)).length >= UMBRAL_CAZADOR_TEMIDO;
    },
    efectos: async () => [etiqueta('CAZADOR_TEMIDO', 'Cazador temido')],
  },
  {
    id: 'ETIQUETA_CLEMENTE',
    escucha: ['PERDON_CONCEDIDO'],
    prioridad: 50,
    condicion: async (ctx) => !!autor(ctx.suceso) && (await cuentaDelPersonaje(ctx.tx, ctx.suceso.saveId, 'PERDON_CONCEDIDO')) >= UMBRAL_CLEMENTE,
    efectos: async () => [etiqueta('CLEMENTE', 'Clemente')],
  },
  {
    id: 'ETIQUETA_ROMPE_JURAMENTOS',
    escucha: ['PROMESA_ROTA'],
    prioridad: 50,
    condicion: async (ctx) => !!autor(ctx.suceso) && (await cuentaDelPersonaje(ctx.tx, ctx.suceso.saveId, 'PROMESA_ROTA')) >= UMBRAL_ROMPE_JURAMENTOS,
    efectos: async () => [etiqueta('ROMPE_JURAMENTOS', 'Rompejuramentos')],
  },
  {
    id: 'ETIQUETA_FUNDADOR',
    escucha: ['REINO_FUNDADO'],
    prioridad: 50,
    condicion: async (ctx) => !!autor(ctx.suceso),
    efectos: async () => [etiqueta('FUNDADOR', 'Fundador')],
  },
  {
    // «Resolver una crisis local»: ayudar o cumplir misiones 3 veces en la misma región.
    id: 'ETIQUETA_SALVADOR',
    escucha: ['AYUDA_PRESTADA', 'MISION_COMPLETADA'],
    prioridad: 50,
    condicion: async (ctx) => !!autor(ctx.suceso) && !!(await salvadorDe(ctx)),
    efectos: async (ctx) => {
      const region = (await salvadorDe(ctx))!;
      return [etiqueta(`SALVADOR_DE:${slugify(region)}`, `Salvador de ${region}`)];
    },
  },
];

/// Región del suceso si el personaje ya ha ayudado o cumplido ahí `UMBRAL_SALVADOR` veces.
async function salvadorDe(ctx: CtxReaccion): Promise<string | null> {
  if (!ctx.suceso.locationId) return null;
  const lugar = await ctx.tx.location.findUnique({ where: { id: ctx.suceso.locationId }, select: { region: true } });
  if (!lugar?.region) return null;
  const lugares = (await ctx.tx.location.findMany({ where: { region: lugar.region }, select: { id: true } })).map((l) => l.id);
  const n = await ctx.tx.suceso.count({
    where: {
      saveId: ctx.suceso.saveId,
      tipo: { in: ['AYUDA_PRESTADA', 'MISION_COMPLETADA'] },
      locationId: { in: lugares },
      actores: { some: { entidadTipo: 'PERSONAJE', papel: 'AUTOR' } },
    },
  });
  return n >= UMBRAL_SALVADOR ? lugar.region : null;
}

/// Puro: qué etiquetas de relación tocan según la reputación con cada facción.
export function etiquetasDeReputacion(reputaciones: Record<string, number>): { clave: string; texto: string }[] {
  const out: { clave: string; texto: string }[] = [];
  for (const [faccion, valor] of Object.entries(reputaciones)) {
    if (valor >= REP_AMIGO) out.push({ clave: `AMIGO_DE:${slugify(faccion)}`, texto: `Amigo de ${faccion}` });
    else if (valor < REP_ENEMIGO) out.push({ clave: `ENEMIGO_DE:${slugify(faccion)}`, texto: `Enemigo de ${faccion}` });
  }
  return out;
}

/// Una vez al día: pone las etiquetas AMIGO_DE / ENEMIGO_DE que tocan y apaga las que ya no.
export async function revisarEtiquetasDeReputacion(tx: Tx, p: { saveId: string; worldId: string; fictionalMinutes: number }): Promise<void> {
  const ws = await tx.worldState.findUnique({ where: { saveId: p.saveId }, select: { factionsStatus: true } });
  const tocan = etiquetasDeReputacion(parseFactionsStatus(ws?.factionsStatus));
  const activas = await tx.etiqueta.findMany({
    where: { saveId: p.saveId, entidadTipo: 'PERSONAJE', activa: true, OR: [{ clave: { startsWith: 'AMIGO_DE:' } }, { clave: { startsWith: 'ENEMIGO_DE:' } }] },
    select: { clave: true },
  });
  const claves = new Set(tocan.map((t) => t.clave));
  const efectos: Efecto[] = [
    ...activas.filter((a) => !claves.has(a.clave)).map((a): Efecto => ({ tipo: 'quitarEtiqueta', clave: a.clave })),
    ...tocan.map((t) => etiqueta(t.clave, t.texto)),
  ];
  if (efectos.length === 0) return;
  await aplicarEfectos({ tx, saveId: p.saveId, worldId: p.worldId, fictionalMinutes: p.fictionalMinutes, origen: 'MOTOR' }, efectos);
}

/// Claves activas del personaje (para los efectos mecánicos y el narrador).
export async function etiquetasActivas(tx: Tx | Prisma.TransactionClient, saveId: string): Promise<Set<string>> {
  const filas = await tx.etiqueta.findMany({ where: { saveId, entidadTipo: 'PERSONAJE', activa: true }, select: { clave: true } });
  return new Set(filas.map((f) => f.clave));
}
