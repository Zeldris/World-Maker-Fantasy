import { saludBandFor } from './death.js';
import type { AttributeBlock } from './dice.js';
import type { CondicionFisica } from '@prisma/client';

/// Petición explícita de la usuaria (2026-07-20/21): que el modelo local reciba SIEMPRE, en cada
/// prompt (clasificar y narrar), una plantilla fija con hora/posición/atributos/condición — para
/// que nunca tenga que "adivinar" ni cometer erratas de continuidad sobre el estado real de la
/// partida. `estadoPartida` es opcional porque en classify a veces no hay ubicación resuelta
/// todavía (personaje recién creado, sin currentLocationId).
///
/// Movido de `routes/turn.ts` a su propio servicio (auditoría 2026-07-24, "revisa todo bien bien"
/// — checklist 2026-07-23, punto pendiente "contexto de narración diferida más pobre que el turno
/// en vivo"): antes vivía privado en `turn.ts`, así que `worldTick.ts` (resolución diferida de
/// tránsitos extendida/larga) nunca podía reutilizarlo y construía un resumen mucho más pobre a
/// mano — sin ubicación/atributos/condición física — para el mismo `narrateAction` que sí recibe
/// todo eso en el turno síncrono. Un viaje/descanso largo real resuelto en diferido narraba con
/// menos contexto que cualquier otro turno, sin ninguna razón para la diferencia.
export function characterSummaryFor(
  save: { characterName: string; characterArchetype: string; characterOrigin: string; characterMotivation: string },
  estadoPartida?: {
    timeLabel: string;
    locationName: string | null;
    region: string | null;
    level: number;
    attributes: AttributeBlock;
    condicionFisica: CondicionFisica;
  },
): string {
  const base = `${save.characterName}, ${save.characterArchetype}. ${save.characterOrigin} ${save.characterMotivation}`;
  if (!estadoPartida) return base;
  const { timeLabel, locationName, region, level, attributes, condicionFisica } = estadoPartida;
  const attrsTxt = (['fuerza', 'destreza', 'sigilo', 'voluntad', 'carisma', 'arcano'] as const)
    .map((a) => `${a} ${attributes[a]}`)
    .join(', ');
  return `${base}
ESTADO DE LA PARTIDA (hechos mecánicos reales, nunca los contradigas): ${timeLabel}. Ubicación: ${locationName ?? 'sin resolver todavía'}${region ? ` (${region})` : ''}. Nivel ${level}. Atributos: ${attrsTxt}. Condición física: ${saludBandFor(condicionFisica)}.`;
}
