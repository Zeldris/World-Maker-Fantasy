// Cadenas (CR-12 paso 12b, hito 0.2 — roadmap-cronista.md § 7.3): sucesos de varios pasos con
// estado, estilo CK3 (tensión → escaramuzas → guerra…). Cada paso se cruza cuando vence su plazo
// (`intervaloDias` de ficción desde el anterior) y, al cruzarlo:
//
// - su texto va al canal «El mundo» y a los hechos del Narrador (`sessionFacts`);
// - registra sus sucesos en el Libro (origen `MUNDO`);
// - aplica sus efectos de la lista cerrada (`efectos.ts`).
//
// El estado de cada cadena vive en `WorldState.agenda` (una `AgendaEntry` por cadena, la misma forma
// que tenía la agenda Serhu antes de ser cadena, así que las partidas en curso siguen sin migrar).
// Una cadena que deja de tener sentido (cae una de las partes, `sigueViva`) se corta: queda en su
// paso, con `cortadaEn`, y la jugadora se entera por su texto de cierre.
//
// La primera cadena es el conflicto Serhu (`worldAgenda.ts`, `CADENA_CONFLICTO_SERHU`). Las cadenas
// que arrancan a mitad de partida (una guerra que nace de una escaramuza…) llegarán con el narrador
// de fondo como candidatos que siembran una entrada nueva.
import type { Prisma, PrismaClient } from '@prisma/client';
import { appendSessionFacts, loadSessionFacts } from '../worldFacts.js';
import { aplicarEfectos, type Efecto } from './efectos.js';
import { registrarSuceso, type NuevoSuceso } from './sucesos.js';

type Tx = Prisma.TransactionClient;

/// Estado de una cadena en `WorldState.agenda`.
export interface AgendaEntry {
  id: string;
  title: string;
  stage: number;
  maxStage: number;
  /// `WorldState.fictionalMinutes` a partir del cual el siguiente paso puede cruzarse.
  nextStageAtMinutes: number;
  /// Minuto de ficción en que se cortó (ya no avanza).
  cortadaEn?: number;
}

export type SucesoDePaso = Omit<NuevoSuceso, 'saveId' | 'fictionalMinutes' | 'origen'>;

export interface PasoCadena {
  /// Hecho de mundo del paso (canal «El mundo» y `sessionFacts`). El paso 0 es el de partida y es
  /// silencioso.
  texto: string;
  sucesos: SucesoDePaso[];
  efectos: Efecto[];
}

export interface CtxCadena {
  db: PrismaClient | Tx;
  saveId: string;
}

export interface Cadena {
  id: string;
  titulo: string;
  intervaloDias: number;
  /// Índice = paso; el 0 es el estado de partida.
  pasos: PasoCadena[];
  /// Partidas en las que corre (filtro de `Save`).
  aplicaA: Prisma.SaveWhereInput;
  /// Si devuelve un texto, la cadena se corta con él (p. ej. «cae el agresor»).
  motivoDeCorte?: (ctx: CtxCadena) => Promise<string | null>;
  /// Tras avanzar (o cada día, aunque no avance): ajustes idempotentes del mundo según el paso.
  sincronizar?: (prisma: PrismaClient, saveId: string, paso: number) => Promise<void>;
}

const DIA = 24 * 60;

export function parseAgenda(raw: Prisma.JsonValue | null | undefined): AgendaEntry[] {
  return (raw as AgendaEntry[] | null) ?? [];
}

export function entradaInicial(cadena: Cadena, fictionalMinutes: number): AgendaEntry {
  return { id: cadena.id, title: cadena.titulo, stage: 0, maxStage: cadena.pasos.length - 1, nextStageAtMinutes: fictionalMinutes + cadena.intervaloDias * DIA };
}

/// Puro: cuántos pasos cruza una entrada dado el reloj, y su estado resultante. Puede cruzar varios
/// a la vez (un viaje largo) y nunca pasa de `maxStage` ni avanza si está cortada.
export function advanceEntry(entry: AgendaEntry, fictionalMinutes: number, intervaloDias = 7): { entry: AgendaEntry; stagesCrossed: number } {
  let current = entry;
  let stagesCrossed = 0;
  while (current.cortadaEn === undefined && current.stage < current.maxStage && fictionalMinutes >= current.nextStageAtMinutes) {
    current = { ...current, stage: current.stage + 1, nextStageAtMinutes: current.nextStageAtMinutes + intervaloDias * DIA };
    stagesCrossed += 1;
  }
  return { entry: current, stagesCrossed };
}

const SELECT_ESTADO = { id: true, saveId: true, agenda: true, fictionalMinutes: true, fictionalDateLabel: true, save: { select: { worldId: true } } } as const;

/// Avanza una cadena en una partida. Siembra su entrada si no está (partidas anteriores a ella).
export async function avanzarCadena(prisma: PrismaClient, saveId: string, cadena: Cadena): Promise<{ advanced: boolean; stagesCrossed: number }> {
  const state = await prisma.worldState.findFirst({ where: { saveId, save: cadena.aplicaA }, select: SELECT_ESTADO });
  if (!state) return { advanced: false, stagesCrossed: 0 };

  const agenda = parseAgenda(state.agenda);
  const previa = agenda.find((e) => e.id === cadena.id);
  let entrada = previa ?? entradaInicial(cadena, state.fictionalMinutes);
  let needsWrite = !previa;
  const textos: string[] = [];

  if (entrada.cortadaEn !== undefined) return { advanced: false, stagesCrossed: 0 };
  const corte = previa && cadena.motivoDeCorte ? await cadena.motivoDeCorte({ db: prisma, saveId }) : null;
  let cruzados: number[] = [];
  if (corte) {
    entrada = { ...entrada, cortadaEn: state.fictionalMinutes };
    textos.push(corte);
    needsWrite = true;
  } else {
    const { entry, stagesCrossed } = advanceEntry(entrada, state.fictionalMinutes, cadena.intervaloDias);
    cruzados = Array.from({ length: stagesCrossed }, (_, i) => entrada.stage + 1 + i);
    for (const p of cruzados) if (cadena.pasos[p]?.texto) textos.push(cadena.pasos[p]!.texto);
    if (stagesCrossed > 0) needsWrite = true;
    entrada = entry;
    await cadena.sincronizar?.(prisma, saveId, entrada.stage);
  }
  if (!needsWrite) return { advanced: false, stagesCrossed: 0 };

  const nuevaAgenda = previa ? agenda.map((e) => (e.id === cadena.id ? entrada : e)) : [...agenda, entrada];
  await prisma.$transaction(async (tx) => {
    await tx.worldState.update({ where: { id: state.id }, data: { agenda: nuevaAgenda as unknown as Prisma.InputJsonValue } });
    for (const p of cruzados) {
      const paso = cadena.pasos[p]!;
      const causas: string[] = [];
      for (const suceso of paso.sucesos) {
        causas.push(await registrarSuceso(tx, { ...suceso, saveId, fictionalMinutes: state.fictionalMinutes, origen: 'MUNDO' }));
      }
      await aplicarEfectos({ tx, saveId, worldId: state.save.worldId, fictionalMinutes: state.fictionalMinutes, origen: 'MUNDO', causas }, paso.efectos);
    }
    // Lo mismo que sabe el Narrador, visible en «El mundo».
    for (const text of textos) {
      await tx.logEntry.create({ data: { saveId, channel: 'WORLD', text, timeLabel: state.fictionalDateLabel, fictionalMinutes: state.fictionalMinutes } });
    }
  });
  if (textos.length > 0) await appendSessionFacts(saveId, await loadSessionFacts(saveId), textos);
  return { advanced: true, stagesCrossed: cruzados.length };
}
