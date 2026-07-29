import type { CondicionFisica, Dificultad, AbilityEffect } from '@prisma/client';

/// Muerte, respawn y condición física (docs/14-combate-y-muerte.md § 1, § 4) — todo determinista,
/// sin IA: el modelo nunca decide si el fin de partida se dispara ni qué susurra la Entidad,
/// igual que nunca decide si una tirada tiene éxito (mismo espíritu que progression.ts).

const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO'];

/// Malus mecánico por condición física en combate (2026-07-29, "cómo es posible que alguien
/// incapacitado reaccione igual" — hasta ahora `condicionFisica` no afectaba ninguna tirada, solo
/// paraba a quien ya había caído). Se resta al valor CRUDO del atributo antes del multiplicador
/// de tipo (combatExchange.ts), para cualquiera de los dos lados y cualquier rol (atacar o
/// defender) — HERIDO se nota poco, GRAVE cuesta de verdad. INCAPACITADO/MUERTO no tiran (ya
/// paran de actuar antes de llegar aquí), el valor es irrelevante pero se define por completitud.
const CONDICION_MALUS: Record<CondicionFisica, number> = {
  ILESO: 0,
  HERIDO: 2,
  GRAVE: 5,
  INCAPACITADO: 0,
  MUERTO: 0,
};

export function condicionMalus(condicion: CondicionFisica): number {
  return CONDICION_MALUS[condicion];
}

/// Techo real de mejora este turno (2026-07-29, reglas de curación: "si descansas o comes solo
/// puedes volver a Herido... si usas material médico sí puedes curarte a Ileso... si sales de un
/// combate Incapacitado, tendrás que usar objetos específicos"). Sin causa real (ni descanso
/// válido ni objeto médico), no hay mejora posible — cierra el hueco de que el modelo mejorara la
/// condición "porque sí" narrativamente, sin que nada en el turno lo justificara.
export function healCeilingFor(current: CondicionFisica, restSucceeds: boolean, medicalCuraHasta: CondicionFisica | null): CondicionFisica {
  if (medicalCuraHasta) return medicalCuraHasta; // el objeto manda, rompe el tope incluso desde INCAPACITADO
  if (restSucceeds && current !== 'INCAPACITADO' && current !== 'MUERTO') return 'HERIDO';
  return current; // sin causa real (ni descanso ni objeto), no se permite ninguna mejora
}

/// Aplica la propuesta de condición física del Narrador con las reglas de § 1: empeorar fuera de
/// combate nunca se acepta; en combate empeora como mucho un escalón por turno (nunca "de ILESO a
/// MUERTO" de golpe). Mejorar (2026-07-29) ya no se acepta sin más — se topa en `healCeiling`
/// (ver healCeilingFor arriba), así que sin descanso válido ni objeto médico la condición se queda
/// igual por mucho que el modelo narre una mejora sin causa real.
export function nextCondicionFisica(
  current: CondicionFisica,
  proposed: CondicionFisica | null | undefined,
  enCombate: boolean,
  healCeiling: CondicionFisica,
): CondicionFisica {
  if (!proposed) return current;
  const currentIdx = CONDICION_ORDER.indexOf(current);
  const proposedIdx = CONDICION_ORDER.indexOf(proposed);
  if (proposedIdx <= currentIdx) {
    const ceilingIdx = CONDICION_ORDER.indexOf(healCeiling);
    return CONDICION_ORDER[Math.max(proposedIdx, ceilingIdx)];
  }
  if (!enCombate) return current; // fuera de combate, el modelo nunca la empeora
  const maxIdx = Math.min(currentIdx + 1, CONDICION_ORDER.length - 1);
  return CONDICION_ORDER[Math.min(proposedIdx, maxIdx)];
}

/// Un escalón peor que `current` (tope en MUERTO) — usado por el contraataque determinista del
/// NPC en combate (turnResolution.ts): si el jugador falla la tirada de esquivar/bloquear, esto
/// es lo mínimo que debería pasar, independientemente de lo que proponga el modelo.
export function oneStepWorseThan(current: CondicionFisica): CondicionFisica {
  const idx = CONDICION_ORDER.indexOf(current);
  return CONDICION_ORDER[Math.min(idx + 1, CONDICION_ORDER.length - 1)];
}

/// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2): REMATE solo
/// aporta el golpe de gracia si el NPC objetivo YA está GRAVE/INCAPACITADO — contra uno sano se
/// comporta como un ATAQUE normal (un escalón), sin penalizar probarlo pronto en la pelea.
export function nextCondicionForAttack(effect: AbilityEffect | null | undefined, current: CondicionFisica): CondicionFisica {
  if (effect === 'REMATE' && (current === 'GRAVE' || current === 'INCAPACITADO')) return 'MUERTO';
  return oneStepWorseThan(current);
}

/// La más severa de dos propuestas de condición física — para combinar la señal determinista
/// del contraataque con la propuesta narrativa del modelo sin que se sumen (nextCondicionFisica
/// ya limita a un escalón por turno independientemente de cuál de las dos sea peor).
export function worseCondicion(a: CondicionFisica | null | undefined, b: CondicionFisica | null | undefined): CondicionFisica | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return CONDICION_ORDER.indexOf(a) >= CONDICION_ORDER.indexOf(b) ? a : b;
}

/// Auxiliar de nextCondicionFisica — true si el Narrador propuso empeorar la condición, aunque
/// nextCondicionFisica() acabe rechazándolo por estar fuera de combate. Se usa como señal de que
/// "esto se puso violento de verdad" para la red de seguridad de `combateIniciado` (ver
/// turnResolution.ts) — el modelo a veces narra un enfrentamiento real pero olvida marcar el
/// campo aparte; su propia propuesta de condición física ya delata que hubo daño real.
export function isCondicionDowngrade(current: CondicionFisica, proposed: CondicionFisica | null | undefined): boolean {
  if (!proposed) return false;
  return CONDICION_ORDER.indexOf(proposed) > CONDICION_ORDER.indexOf(current);
}

/// Salud/PV visible (2026-07-19, instrucción explícita de la usuaria) — v1 conservador: se
/// DERIVA de `condicionFisica`, no reemplaza el motor de combate ya calibrado (roadmap 3, Fable:
/// "no ahora" a daño variable — recalibraría contraataque/TTK justo tras estabilizarlo). Un
/// número/barra visible en vez de solo una etiqueta.
const SALUD_POR_CONDICION: Record<CondicionFisica, number> = {
  ILESO: 100,
  HERIDO: 75,
  GRAVE: 50,
  INCAPACITADO: 25,
  MUERTO: 0,
};

export function saludForCondicion(condicion: CondicionFisica): number {
  return SALUD_POR_CONDICION[condicion];
}

/// Banda textual para el prompt de narración (roadmap 3, Fable: mitiga la incoherencia
/// "el narrador dice 'un rasguño' mientras la barra cae 25 puntos" — nunca se le da el número
/// exacto al modelo, solo esta banda, coherente con lo que ya va a narrar vía condicionFisica).
export function saludBandFor(condicion: CondicionFisica): string {
  const salud = saludForCondicion(condicion);
  if (condicion === 'MUERTO') return `muerto (${salud}/100)`;
  return `${condicion.toLowerCase()}, ~${salud}/100`;
}

/// § 4.2: límite de muertes antes del fin de partida real, según la dificultad elegida al crear
/// la partida. NOVATO no tiene límite — la Entidad siempre responde.
export function limiteMuertes(dificultad: Dificultad): number {
  if (dificultad === 'AVANZADO') return 2;
  if (dificultad === 'MEDIO') return 4;
  return Infinity; // NOVATO
}

export interface DeathOutcome {
  deathCount: number;
  finDePartida: boolean;
  avisoUltimaVez: boolean;
}

/// § 4.3: decide qué pasa al llegar a MUERTO, sin tocar la base de datos — el caller persiste.
export function resolveDeathOutcome(dificultad: Dificultad, deathCountBefore: number): DeathOutcome {
  const deathCount = deathCountBefore + 1;
  const limite = limiteMuertes(dificultad);
  const finDePartida = dificultad !== 'NOVATO' && deathCount >= limite;
  const avisoUltimaVez = !finDePartida && dificultad !== 'NOVATO' && deathCount === limite - 1;
  return { deathCount, finDePartida, avisoUltimaVez };
}

/// § 4.3 paso 5: el susurro de la Entidad Desconocida — determinista, nunca generado por el
/// modelo grande (docs/rpgtarkor/genesis.md: la misma Entidad que le susurra dudas a Tarkor).
export function whisperText(characterName: string, respawnLocationName: string, avisoUltimaVez: boolean): string {
  const base = `Todo se apaga en un frío total, y entre la nada una voz que no es de este mundo susurra: "Aún no ha llegado tu momento...". ${characterName} despierta de golpe, como de una pesadilla, en ${respawnLocationName}.`;
  return avisoUltimaVez
    ? `${base} La voz se demora un instante más de lo normal, como una advertencia — no habrá una próxima vez.`
    : base;
}

/// § 4.1: un Location solo cuenta como punto de descanso válido si es refugio o asentamiento —
/// nunca un hito o cruce de paso.
export function isValidRestLocationKind(kind: string): boolean {
  return kind === 'refugio' || kind === 'asentamiento';
}
