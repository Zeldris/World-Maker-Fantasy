import type { Prisma } from '@prisma/client';

/// Fase D del hito 0.1 — «El mundo vivo, visible» (docs/producto/plan-roadmap-0.1.md). Las expediciones
/// de facción y sus choques ya ocurrían de verdad en el tick de fondo (`factionExpeditions.ts`), pero la
/// jugadora no se enteraba de nada. Aquí se convierten en noticias del canal "El mundo" de cada partida.
///
/// - Texto determinista escrito a mano, cero IA (mismo criterio que `stageFactFor`/`STAGE_FACTS`).
/// - Las expediciones son del MUNDO (compartidas por todas las partidas), el registro es de cada
///   PARTIDA: `difundirNoticias` reparte cada noticia a las partidas cuyo personaje podría saberlo —
///   está en esa región o tiene reputación con alguna de las facciones implicadas
///   (`WorldState.factionsStatus`) — y nunca a una partida cuyo reloj aún no ha llegado a ese día.
/// - Cuando exista el Libro de Sucesos (roadmap-cronista.md, CR-1…CR-4) estas noticias pasarán a ser
///   sucesos; el reparto por conocimiento es el mismo concepto que `Conocimiento` allí.

export interface NoticiaMundo {
  /// Facciones implicadas (nombres tal cual en `Faction.name`/`factionsStatus`).
  facciones: string[];
  /// Región donde ocurre (`Location.region`); null si no tiene lugar concreto.
  region: string | null;
  texto: string;
  /// Día de ficción del mundo en que ocurre.
  dia: number;
}

/// Une una lista en castellano: "a", "a y b", "a, b y c".
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/// "3 de Liquen de roca y 1 de Cola de coracelo" — agrupado por nombre, en orden de aparición.
export function resumenBotin(items: { name: string; cantidad: number }[]): string {
  const porNombre = new Map<string, number>();
  for (const i of items) porNombre.set(i.name, (porNombre.get(i.name) ?? 0) + i.cantidad);
  return enumerar([...porNombre.entries()].map(([nombre, n]) => `${n} de ${nombre}`));
}

function bajas(n: number, de: string): string {
  if (n <= 0) return '';
  return n === 1 ? ` Uno de ${de} no vuelve.` : ` ${n} de ${de} no vuelven.`;
}

export function textoExpedicionDeVuelta(faccion: string, lugar: string, botin: { name: string; cantidad: number }[]): string | null {
  if (botin.length === 0) return null;
  return `Los recolectores de ${faccion} regresan de ${lugar} con ${resumenBotin(botin)}.`;
}

export interface DatosAsalto {
  faccion: string;
  lugar: string;
  /// Facción que asalta; null si la carga se perdió sin nadie concreto detrás.
  hostil: string | null;
  carga: 'perdida' | 'salva';
  /// 'sin-guardias' | 'sin-atacante' cuando no hubo combate.
  motivo?: string;
  muertesPropias: number;
  muertesHostiles: number;
}

export function textoAsalto(d: DatosAsalto): string {
  if (d.carga === 'salva') {
    return `Los guardias de ${d.faccion} rechazan un asalto de ${d.hostil ?? 'desconocidos'} cerca de ${d.lugar}.${bajas(d.muertesPropias, 'los guardias')}${bajas(d.muertesHostiles, 'los asaltantes')}`;
  }
  if (!d.hostil || d.motivo === 'sin-atacante') {
    return `Una expedición de ${d.faccion} abandona su carga cerca de ${d.lugar} y vuelve con las manos vacías.`;
  }
  if (d.motivo === 'sin-guardias') {
    return `Gente de ${d.hostil} sorprende a una expedición de ${d.faccion} sin escolta cerca de ${d.lugar} y se queda con su carga.`;
  }
  return `Guerreros de ${d.hostil} asaltan a una expedición de ${d.faccion} cerca de ${d.lugar} y se quedan con la carga.${bajas(d.muertesPropias, 'los guardias')}${bajas(d.muertesHostiles, 'los asaltantes')}`;
}

export interface ContextoPersonaje {
  region: string | null;
  faccionesConocidas: Set<string>;
}

/// Solo lo que el personaje podría saber: algo de su región, o de una facción con la que tiene reputación.
export function personajePuedeSaberlo(ctx: ContextoPersonaje, noticia: NoticiaMundo): boolean {
  if (noticia.region && ctx.region === noticia.region) return true;
  return noticia.facciones.some((f) => ctx.faccionesConocidas.has(f));
}

/// Reparte las noticias del mundo `worldId` a las partidas en curso que puedan saberlo. Devuelve cuántas
/// entradas de registro creó.
export async function difundirNoticias(tx: Prisma.TransactionClient, worldId: string, noticias: NoticiaMundo[]): Promise<number> {
  if (noticias.length === 0) return 0;
  const partidas = await tx.save.findMany({
    where: { worldId, endedAt: null, worldState: { isNot: null } },
    select: {
      id: true,
      currentLocation: { select: { region: true } },
      worldState: { select: { fictionalMinutes: true, fictionalDateLabel: true, factionsStatus: true } },
    },
  });
  const entradas: Prisma.LogEntryCreateManyInput[] = [];
  for (const p of partidas) {
    const ws = p.worldState!;
    const diaPartida = Math.floor(ws.fictionalMinutes / 1440);
    const ctx: ContextoPersonaje = {
      region: p.currentLocation?.region ?? null,
      faccionesConocidas: new Set(Object.keys((ws.factionsStatus as Record<string, number> | null) ?? {})),
    };
    for (const n of noticias) {
      if (n.dia > diaPartida || !personajePuedeSaberlo(ctx, n)) continue;
      entradas.push({ saveId: p.id, channel: 'WORLD', text: n.texto, timeLabel: ws.fictionalDateLabel, fictionalMinutes: ws.fictionalMinutes, isSystemMessage: true });
    }
  }
  if (entradas.length > 0) await tx.logEntry.createMany({ data: entradas });
  return entradas.length;
}
