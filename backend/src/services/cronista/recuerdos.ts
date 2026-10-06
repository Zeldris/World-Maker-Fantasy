// Recuerdos de NPC y supervivientes (CR-16, hito 0.3 — roadmap-cronista.md § 8.3 y decisión Q5 de la
// Fase 4, estilo Némesis de Shadow of Mordor). Quien vive algo con el personaje lo recuerda: el
// implicado y los testigos. Cada recuerdo tiene un sentimiento −10..+10 que se desvanece con el tiempo,
// salvo los de un suceso de importancia ≥ 6. Si el total baja de −8, el NPC es hostil contigo. Quien
// sobrevive a un combate contigo (huye o lo perdonas) o te vence gana un nivel (con tope) y un título.
import type { Prisma, Temperamento } from '@prisma/client';
import type { Efecto } from './efectos.js';
import type { Reaccion, SucesoEnCola } from './reacciones.js';

type Tx = Prisma.TransactionClient;

export const MEDIA_VIDA_RECUERDO_DIAS = 30;
export const IMPORTANCIA_PERMANENTE = 6;
export const UMBRAL_RENCOR = -8;
export const TOPE_NIVELES_GANADOS = 3;

/// Puro: cuánto pesa hoy un recuerdo (los leves se desvanecen a la mitad cada 30 días).
export function sentimientoActual(r: { sentimiento: number; importancia: number; desdeMinutes: number }, ahora: number): number {
  if (r.importancia >= IMPORTANCIA_PERMANENTE) return r.sentimiento;
  const dias = Math.max(0, ahora - r.desdeMinutes) / 1440;
  return r.sentimiento * Math.pow(0.5, dias / MEDIA_VIDA_RECUERDO_DIAS);
}

/// Puro: lo que siente un NPC por el personaje, sumando sus recuerdos.
export function sentimientoTotal(recuerdos: { sentimiento: number; importancia: number; desdeMinutes: number }[], ahora: number): number {
  return recuerdos.reduce((t, r) => t + sentimientoActual(r, ahora), 0);
}

/// Puro: con rencor, el temperamento sube como mínimo a AGRESIVO.
export function conRencor(t: Temperamento, rencor: boolean): Temperamento {
  return rencor && t !== 'ENEMIGO' ? 'AGRESIVO' : t;
}

/// NPC (de `npcIds`) que guardan rencor al personaje ahora mismo.
export async function npcsConRencor(tx: Tx | Prisma.TransactionClient, saveId: string, npcIds: string[], ahora: number): Promise<Set<string>> {
  if (npcIds.length === 0) return new Set();
  const recuerdos = await tx.recuerdo.findMany({
    where: { saveId, npcId: { in: npcIds }, sobreTipo: 'PERSONAJE' },
    select: { npcId: true, sentimiento: true, importancia: true, desdeMinutes: true },
  });
  const porNpc = new Map<string, typeof recuerdos>();
  for (const r of recuerdos) porNpc.set(r.npcId, [...(porNpc.get(r.npcId) ?? []), r]);
  return new Set([...porNpc.entries()].filter(([, rs]) => sentimientoTotal(rs, ahora) < UMBRAL_RENCOR).map(([id]) => id));
}

// ─────────────────────────── Efectos ───────────────────────────

/// Efecto `anadirRecuerdo`: el NPC recuerda al personaje por el suceso que lo causa.
export async function aplicarRecuerdo(
  tx: Tx,
  p: { saveId: string; npcId: string; sentimiento: number; sucesoId: string | null; fictionalMinutes: number },
): Promise<boolean> {
  if (!p.sucesoId || p.sentimiento === 0) return false;
  const suceso = await tx.suceso.findUnique({ where: { id: p.sucesoId }, select: { importancia: true } });
  await tx.recuerdo.create({
    data: {
      saveId: p.saveId, npcId: p.npcId, sobreTipo: 'PERSONAJE', sobreId: p.saveId, sucesoId: p.sucesoId,
      sentimiento: Math.max(-10, Math.min(10, p.sentimiento)), importancia: suceso?.importancia ?? 1, desdeMinutes: p.fictionalMinutes,
    },
  });
  return true;
}

/// Efecto `ganarNivelNpc`: sube un nivel en esta partida (con tope) y, si se da, gana el título.
export async function aplicarNivelGanado(tx: Tx, p: { saveId: string; npcId: string; titulo?: string }): Promise<boolean> {
  const npc = await tx.npc.findUnique({ where: { id: p.npcId }, select: { kind: true } });
  if (!npc) return false;
  const scope = '';
  const estado = await tx.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: p.saveId, npcId: p.npcId, scope } }, select: { nivelesGanados: true, titulo: true } });
  const niveles = Math.min(TOPE_NIVELES_GANADOS, (estado?.nivelesGanados ?? 0) + 1);
  const titulo = estado?.titulo ?? p.titulo ?? null;
  if (estado && niveles === estado.nivelesGanados && titulo === estado.titulo) return false;
  await tx.npcState.upsert({
    where: { saveId_npcId_scope: { saveId: p.saveId, npcId: p.npcId, scope } },
    create: { saveId: p.saveId, npcId: p.npcId, scope, nivelesGanados: niveles, titulo },
    update: { nivelesGanados: niveles, titulo },
  });
  return true;
}

// ─────────────────────────── Reacciones ───────────────────────────

const npcsCon = (s: SucesoEnCola, papel: string) => s.actores.filter((a) => a.entidadTipo === 'NPC' && a.papel === papel).map((a) => a.entidadId);
const delPersonaje = (s: SucesoEnCola) => s.actores.some((a) => a.entidadTipo === 'PERSONAJE' && a.papel === 'AUTOR');

/// Qué recuerda cada papel de cada suceso del personaje (sentimiento).
const RECUERDOS: { tipo: string; papel: string; sentimiento: number }[] = [
  { tipo: 'MUERTE_CAUSADA', papel: 'TESTIGO', sentimiento: -6 },
  { tipo: 'PERDON_CONCEDIDO', papel: 'BENEFICIARIO', sentimiento: 5 },
  { tipo: 'COMBATE_GANADO', papel: 'VICTIMA', sentimiento: -3 },
  { tipo: 'HUIDA_DE_NPC', papel: 'AFECTADO', sentimiento: -4 },
  { tipo: 'CAPTURA', papel: 'VICTIMA', sentimiento: -5 },
  { tipo: 'AYUDA_PRESTADA', papel: 'BENEFICIARIO', sentimiento: 3 },
  { tipo: 'REGALO', papel: 'BENEFICIARIO', sentimiento: 2 },
  { tipo: 'ROBO', papel: 'VICTIMA', sentimiento: -4 },
  // CR-32: insistir en que se una o te informe y que no le convenza le sienta un poco mal.
  { tipo: 'RECLUTAMIENTO_FALLIDO', papel: 'AFECTADO', sentimiento: -1 },
];

export const REACCIONES_RECUERDOS: Reaccion[] = [
  {
    id: 'RECUERDOS_DE_NPC',
    escucha: [...new Set(RECUERDOS.map((r) => r.tipo))] as Reaccion['escucha'],
    prioridad: 40,
    condicion: async (ctx) => delPersonaje(ctx.suceso) && RECUERDOS.some((r) => r.tipo === ctx.suceso.tipo && npcsCon(ctx.suceso, r.papel).length > 0),
    // Solo recuerdan los NPC con nombre: la fauna y los genéricos comparten ficha entre ejemplares y el
    // rencor de uno se contagiaría a todos los de su especie.
    efectos: async (ctx) => {
      const propuestos = RECUERDOS.filter((r) => r.tipo === ctx.suceso.tipo).flatMap((r) => npcsCon(ctx.suceso, r.papel).map((npcId) => ({ npcId, sentimiento: r.sentimiento })));
      const conNombre = new Set((await ctx.tx.npc.findMany({ where: { id: { in: propuestos.map((p) => p.npcId) }, kind: 'PRINCIPAL' }, select: { id: true } })).map((n) => n.id));
      return propuestos.filter((p) => conNombre.has(p.npcId)).map((p): Efecto => ({ tipo: 'anadirRecuerdo', npcId: p.npcId, sentimiento: p.sentimiento }));
    },
  },
  {
    // Q5: sobrevivir a la jugadora (huir o ser perdonado) o vencerla hace subir al NPC con nombre.
    id: 'SUPERVIVIENTE',
    escucha: ['HUIDA_DE_NPC', 'PERDON_CONCEDIDO', 'COMBATE_PERDIDO'],
    prioridad: 45,
    condicion: async (ctx) => !!(await supervivienteDe(ctx.tx, ctx.suceso)),
    efectos: async (ctx) => {
      const npcId = (await supervivienteDe(ctx.tx, ctx.suceso))!;
      const save = await ctx.tx.save.findUniqueOrThrow({ where: { id: ctx.suceso.saveId }, select: { characterName: true } });
      const titulo = ctx.suceso.tipo === 'COMBATE_PERDIDO' ? `Vencedor de ${save.characterName}` : `Superviviente de ${save.characterName}`;
      return [{ tipo: 'ganarNivelNpc', npcId, titulo }];
    },
  },
];

/// El NPC con nombre que sobrevive (o vence) en este suceso, si lo hay.
async function supervivienteDe(tx: Tx, s: SucesoEnCola): Promise<string | null> {
  const id =
    s.tipo === 'COMBATE_PERDIDO' ? npcsCon(s, 'AUTOR')[0] : s.tipo === 'HUIDA_DE_NPC' ? npcsCon(s, 'AFECTADO')[0] : npcsCon(s, 'BENEFICIARIO')[0];
  if (!id) return null;
  return (await tx.npc.count({ where: { id, kind: 'PRINCIPAL' } })) > 0 ? id : null;
}
