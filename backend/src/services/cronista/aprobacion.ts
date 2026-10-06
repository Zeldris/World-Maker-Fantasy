// Aprobación de compañeros (CR-15, hito 0.3 — roadmap-cronista.md § 8.2 y decisiones Q1-Q3 y Q9 de
// la Fase 4). Cada compañero con mente tiene valores (piedad, honor…) con peso −2..+2; cada suceso
// del personaje tiene un vector de valores; la aprobación sube o baja por su producto (0-100, empieza
// en 50). Como en Baldur's Gate 3, se ve en el registro («Kaila frunce el ceño») y como barra con
// etiqueta en la ficha. Los animales no tienen aprobación: tienen felicidad.
import type { Prisma } from '@prisma/client';
import type { Efecto } from './efectos.js';
import { registrarSuceso } from './sucesos.js';
import type { Reaccion, SucesoEnCola } from './reacciones.js';
import { muertesDeRendidos } from './rendidos.js';

type Tx = Prisma.TransactionClient;

export const VALORES = ['piedad', 'honor', 'codicia', 'lealtad_clan', 'crueldad', 'prudencia'] as const;
export type Valor = (typeof VALORES)[number];
export type Valores = Partial<Record<Valor, number>>;

export const APROBACION_MIN = 0;
export const APROBACION_MAX = 100;
export const APROBACION_INICIAL = 50;
/// Umbrales (Q1).
export const APROBACION_AVISO = 30;
export const APROBACION_NO_COMBATE = 20;
export const APROBACION_AVISO_MARCHA = 15;
export const APROBACION_SE_VA = 10;
export const DIAS_PARA_IRSE = 3;
export const APROBACION_CONFIANZA = 80;

/// Q9: valores por pueblo para los compañeros nuevos (propuesta de lore para Álvaro).
export const VALORES_POR_PUEBLO: Record<string, Valores> = {
  orcos: { lealtad_clan: 2, honor: 1, piedad: -1 },
  goirntes: { codicia: 1, prudencia: 1, honor: 1 },
  nabieus: { prudencia: 2, piedad: 1 },
  faerus: { piedad: 1, prudencia: 1, crueldad: -1 },
};
const VALORES_SIN_PUEBLO: Valores = { honor: 1, piedad: 1 };

/// Palabras de la personalidad de catálogo que matizan los valores del pueblo.
const MATICES: { patron: RegExp; valor: Valor; delta: number }[] = [
  { patron: /cruel|despiadad|sanguinari/i, valor: 'crueldad', delta: 1 },
  { patron: /compasiv|piados|bondados|amable/i, valor: 'piedad', delta: 1 },
  { patron: /leal/i, valor: 'lealtad_clan', delta: 1 },
  { patron: /cobard|prudent|cautel|desconfiad/i, valor: 'prudencia', delta: 1 },
  { patron: /codici|avar|ambicios/i, valor: 'codicia', delta: 1 },
  { patron: /honor|honest|recto/i, valor: 'honor', delta: 1 },
];

/// Puro: los valores de un compañero a partir de su pueblo y su personalidad (3-5, peso −2..+2).
export function valoresIniciales(raza: string | null | undefined, personalidad = ''): Valores {
  const v: Valores = { ...(raza && VALORES_POR_PUEBLO[raza] ? VALORES_POR_PUEBLO[raza] : VALORES_SIN_PUEBLO) };
  for (const m of MATICES) if (m.patron.test(personalidad)) v[m.valor] = (v[m.valor] ?? 0) + m.delta;
  const limpios = Object.entries(v)
    .map(([k, p]) => [k, Math.max(-2, Math.min(2, p ?? 0))] as const)
    .filter(([, p]) => p !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5);
  return Object.fromEntries(limpios);
}

/// Qué toca cada suceso del personaje en los valores (§ 8.2). `MUERTE_DE_RENDIDO` es una
/// `MUERTE_CAUSADA` de alguien que ya estaba rendido.
export const VECTORES: Record<string, Valores> = {
  PERDON_CONCEDIDO: { piedad: 2, crueldad: -2 },
  MUERTE_DE_RENDIDO: { piedad: -2, crueldad: 2, honor: -1 },
  MUERTE_CAUSADA: { crueldad: 1 },
  CAPTURA: { crueldad: 1, piedad: -1 },
  PROMESA_CUMPLIDA: { honor: 2 },
  PROMESA_ROTA: { honor: -2, lealtad_clan: -1 },
  ROBO: { honor: -1, codicia: 2 },
  REGALO: { codicia: -1, piedad: 1 },
  AYUDA_PRESTADA: { piedad: 1, lealtad_clan: 1 },
  MISION_COMPLETADA: { honor: 1 },
  MISION_ABANDONADA: { honor: -1, prudencia: 1 },
};

/// Puro: cuánto cambia la aprobación y el valor que más pesó (para la frase).
export function deltaDeAprobacion(valores: Valores, vector: Valores): { delta: number; motivo: Valor | null } {
  let delta = 0;
  let motivo: Valor | null = null;
  let mayor = 0;
  for (const [k, peso] of Object.entries(vector) as [Valor, number][]) {
    const aporte = peso * (valores[k] ?? 0);
    delta += aporte;
    if (Math.abs(aporte) > mayor) {
      mayor = Math.abs(aporte);
      motivo = k;
    }
  }
  return { delta, motivo };
}

/// Q3: la etiqueta de la barra (sin el número).
export function etiquetaDeAprobacion(aprobacion: number): 'Hostil' | 'Distante' | 'Neutral' | 'Afín' | 'Leal' {
  if (aprobacion < 20) return 'Hostil';
  if (aprobacion < 40) return 'Distante';
  if (aprobacion < 60) return 'Neutral';
  if (aprobacion < APROBACION_CONFIANZA) return 'Afín';
  return 'Leal';
}

const FRASES: Record<Valor, [string, string]> = {
  piedad: ['asiente en silencio', 'aparta la mirada'],
  honor: ['te mira con respeto', 'frunce el ceño'],
  codicia: ['sonríe de medio lado', 'chasquea la lengua'],
  lealtad_clan: ['se lleva el puño al pecho', 'escupe a un lado'],
  crueldad: ['enseña los dientes, satisfecho', 'tuerce el gesto'],
  prudencia: ['respira aliviado', 'menea la cabeza'],
};

/// Puro: la línea del registro («Kaila frunce el ceño.»).
export function fraseDeAprobacion(nombre: string, motivo: Valor, delta: number): string {
  return `${nombre} ${FRASES[motivo][delta > 0 ? 0 : 1]}.`;
}

/// Tipo efectivo del suceso para los vectores (una muerte de rendido pesa distinto).
async function tipoParaVector(tx: Tx, s: SucesoEnCola): Promise<string> {
  if (s.tipo !== 'MUERTE_CAUSADA') return s.tipo;
  const victima = s.actores.find((a) => a.entidadTipo === 'NPC' && a.papel === 'VICTIMA')?.entidadId;
  if (!victima) return s.tipo;
  // Cazar no es crueldad; y la fauna y los NPC genéricos comparten ficha entre ejemplares, así que
  // «rendido» solo se sabe de verdad de alguien con nombre.
  const v = await tx.npc.findUnique({ where: { id: victima }, select: { raza: true, kind: true } });
  if (!v?.raza) return 'CAZA';
  if (v.kind !== 'PRINCIPAL') return s.tipo;
  const previos = await tx.suceso.findMany({
    where: { saveId: s.saveId, tipo: 'COMBATE_GANADO', fictionalMinutes: { lte: s.fictionalMinutes }, actores: { some: { entidadTipo: 'NPC', papel: 'VICTIMA', entidadId: victima } } },
    select: { fictionalMinutes: true },
  });
  const rendido = muertesDeRendidos([
    ...previos.map((p) => ({ tipo: 'COMBATE_GANADO', minuto: p.fictionalMinutes, victima })),
    { tipo: 'MUERTE_CAUSADA', minuto: s.fictionalMinutes, victima },
  ]) > 0;
  return rendido ? 'MUERTE_DE_RENDIDO' : s.tipo;
}

/// Q1: filtro de Prisma de los compañeros que entran a combate — los animales siempre; una persona
/// con la aprobación por debajo de `APROBACION_NO_COMBATE` se niega a pelear a tu lado.
export const companeroDispuestoACombatir = { OR: [{ tipo: 'FAUNA' as const }, { aprobacion: { gte: APROBACION_NO_COMBATE } }] };

/// Compañeros con mente que van con el personaje (no los trabajadores del Reino), vivos.
export async function companerosConMente(tx: Tx, saveId: string) {
  return tx.companion.findMany({
    where: { saveId, tipo: 'NPC', rolReino: null, condicionFisica: { not: 'MUERTO' } },
    select: { id: true, name: true, valores: true, aprobacion: true, sourceSlug: true },
  });
}

/// Valores del compañero; si aún no tiene (creado antes de CR-15), los siembra.
export async function valoresDe(tx: Tx, saveId: string, c: { id: string; valores: unknown; sourceSlug: string | null }): Promise<Valores> {
  const guardados = (c.valores ?? {}) as Valores;
  if (Object.keys(guardados).length > 0) return guardados;
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const npc = c.sourceSlug ? await tx.npc.findFirst({ where: { worldId: save.worldId, slug: c.sourceSlug }, select: { raza: true, personality: true } }) : null;
  const valores = valoresIniciales(npc?.raza, npc?.personality ?? '');
  await tx.companion.update({ where: { id: c.id }, data: { valores } });
  return valores;
}

export const REACCIONES_APROBACION: Reaccion[] = [
  {
    id: 'APROBACION_COMPANEROS',
    escucha: Object.keys(VECTORES).filter((t) => t !== 'MUERTE_DE_RENDIDO') as Reaccion['escucha'],
    prioridad: 60,
    condicion: async (ctx) =>
      ctx.suceso.actores.some((a) => a.entidadTipo === 'PERSONAJE' && a.papel === 'AUTOR') && (await companerosConMente(ctx.tx, ctx.suceso.saveId)).length > 0,
    efectos: async (ctx) => {
      const vector = VECTORES[await tipoParaVector(ctx.tx, ctx.suceso)] ?? {};
      const efectos: Efecto[] = [];
      for (const c of await companerosConMente(ctx.tx, ctx.suceso.saveId)) {
        const { delta, motivo } = deltaDeAprobacion(await valoresDe(ctx.tx, ctx.suceso.saveId, c), vector);
        if (delta !== 0 && motivo) efectos.push({ tipo: 'cambiarAprobacion', companionId: c.id, delta, motivo });
      }
      return efectos;
    },
  },
];

/// Aplica un cambio de aprobación ya calculado (lo usa el efecto `cambiarAprobacion`). Devuelve la
/// aprobación nueva, o null si no cambió.
export async function aplicarCambioAprobacion(
  tx: Tx,
  p: { saveId: string; companionId: string; delta: number; motivo: Valor; fictionalMinutes: number },
): Promise<number | null> {
  const c = await tx.companion.findFirst({ where: { id: p.companionId, saveId: p.saveId }, select: { name: true, aprobacion: true } });
  if (!c) return null;
  const nueva = Math.max(APROBACION_MIN, Math.min(APROBACION_MAX, c.aprobacion + p.delta));
  if (nueva === c.aprobacion) return null;
  await tx.companion.update({ where: { id: p.companionId }, data: { aprobacion: nueva } });
  const ws = await tx.worldState.findUnique({ where: { saveId: p.saveId }, select: { fictionalDateLabel: true } });
  const avisos: string[] = [fraseDeAprobacion(c.name, p.motivo, p.delta)];
  // Q1: avisos al cruzar hacia abajo.
  if (c.aprobacion >= APROBACION_AVISO && nueva < APROBACION_AVISO) avisos.push(`${c.name} empieza a dudar de seguirte.`);
  if (c.aprobacion >= APROBACION_NO_COMBATE && nueva < APROBACION_NO_COMBATE) avisos.push(`${c.name} ya no peleará a tu lado mientras sigas así.`);
  if (c.aprobacion >= APROBACION_AVISO_MARCHA && nueva < APROBACION_AVISO_MARCHA) avisos.push(`${c.name} habla de marcharse. Si nada cambia, lo hará.`);
  for (const text of avisos) {
    await tx.logEntry.create({
      data: { saveId: p.saveId, channel: 'CHARACTER', isSystemMessage: true, text, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes: p.fictionalMinutes },
    });
  }
  return nueva;
}

/// Q1, una vez al día: quien lleva 3 días seguidos con la aprobación por debajo de 10 se va (sus
/// cosas vuelven al personaje). Devuelve los nombres de los que se han ido.
export async function revisarMarchas(tx: Tx, p: { saveId: string; fictionalMinutes: number }): Promise<string[]> {
  const companeros = await tx.companion.findMany({
    where: { saveId: p.saveId, tipo: 'NPC', rolReino: null, condicionFisica: { not: 'MUERTO' }, OR: [{ aprobacion: { lt: APROBACION_SE_VA } }, { aprobacionBajaDesde: { not: null } }] },
    select: { id: true, name: true, aprobacion: true, aprobacionBajaDesde: true },
  });
  const idos: string[] = [];
  const save = await tx.save.findUniqueOrThrow({ where: { id: p.saveId }, select: { characterName: true } });
  for (const c of companeros) {
    if (c.aprobacion >= APROBACION_SE_VA) {
      await tx.companion.update({ where: { id: c.id }, data: { aprobacionBajaDesde: null } });
      continue;
    }
    if (c.aprobacionBajaDesde === null) {
      await tx.companion.update({ where: { id: c.id }, data: { aprobacionBajaDesde: p.fictionalMinutes } });
      continue;
    }
    if (p.fictionalMinutes - c.aprobacionBajaDesde < DIAS_PARA_IRSE * 1440) continue;
    // Sus cosas vuelven a la bolsa del personaje, sin equipar (el hueco de equipo era del compañero).
    await tx.inventoryItem.updateMany({ where: { companionId: c.id }, data: { companionId: null, slot: null } });
    await tx.companion.delete({ where: { id: c.id } });
    await registrarSuceso(tx, {
      saveId: p.saveId, tipo: 'COMPANERO_SE_VA', fictionalMinutes: p.fictionalMinutes, origen: 'MOTOR',
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: p.saveId, papel: 'AFECTADO' }, { entidadTipo: 'COMPANERO', entidadId: c.id, papel: 'AUTOR' }],
      datos: { personaje: save.characterName, companero: c.name },
    });
    const ws = await tx.worldState.findUnique({ where: { saveId: p.saveId }, select: { fictionalDateLabel: true } });
    await tx.logEntry.create({
      data: { saveId: p.saveId, channel: 'CHARACTER', isSystemMessage: true, text: `${c.name} recoge sus cosas y se marcha. No volverá a seguirte.`, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes: p.fictionalMinutes },
    });
    idos.push(c.name);
  }
  return idos;
}
