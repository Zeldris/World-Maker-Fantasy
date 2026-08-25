import type { CondicionFisica } from '@prisma/client';

/// Grupo 3 § Combate múltiple (2026-08-25, diseño completo en docs/rpgtarkor/combate-multiple.md)
/// — Fase A: piezas puras (iniciativa N-way, emparejamiento/retargeting por Inteligencia,
/// partición en sub-combates 4v4). Deliberadamente SEPARADO de `combatExchange.ts`: la tirada
/// pairwise (`resolveExchange`/`resolveIndependentExchange`) se queda intacta y se sigue
/// reutilizando tal cual, esto solo decide QUIÉN tira cuándo y CONTRA QUIÉN — nunca reimplementa
/// la mecánica de un intercambio en sí.

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — Iniciativa individual real (generaliza rollInitiative de 2 lados a N combatientes)
// ═══════════════════════════════════════════════════════════════════════════

export type Bando = 'JUGADOR' | 'ENEMIGO';

export interface CombatienteIniciativa {
  participantId: string;
  bando: Bando;
  destreza: number;
}

export interface IniciativaEntry {
  participantId: string;
  bando: Bando;
  roll: number;
  result: number;
}

/// Cada combatiente tira su propia iniciativa (d20 + mitad de Destreza, misma fórmula que
/// `contestValue` en combatExchange.ts) — se ordenan todos en una única cola, empate lo gana
/// mayor Destreza cruda, empate total lo gana quien apareciera antes en `combatientes` (orden
/// estable, nunca aleatorio de más).
export function rollInitiativeMultiple(combatientes: CombatienteIniciativa[], random: () => number = Math.random): IniciativaEntry[] {
  const entries = combatientes.map((c) => {
    const roll = Math.floor(random() * 20) + 1;
    return { participantId: c.participantId, bando: c.bando, destreza: c.destreza, roll, result: roll + Math.floor(c.destreza / 2) };
  });
  return entries
    .slice()
    .sort((a, b) => b.result - a.result || b.destreza - a.destreza)
    .map(({ participantId, bando, roll, result }) => ({ participantId, bando, roll, result }));
}

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — Quién ataca a quién: emparejamiento/retargeting por turno, según Inteligencia
// ═══════════════════════════════════════════════════════════════════════════

/// Mismo umbral que `SUERTE_VENTAJA_UMBRAL` (dice.ts) — cifra de partida, ajustable jugando, no
/// un cierre definitivo. Inteligencia ALTA = objetivo inteligente (remata al más herido);
/// Inteligencia BAJA = aleatorio entre los vivos del bando contrario.
export const INTELIGENCIA_TACTICA_UMBRAL = 12;

/// Orden de "cuánto le queda" — MUERTO/CONVALECIENTE ya no son objetivo válido (fuera de
/// combate, mismo criterio que el resto del motor: solo esos dos estados son saqueables/
/// rematables, nunca atacables de nuevo).
const ORDEN_CONDICION: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO'];

export interface ObjetivoCandidato {
  participantId: string;
  condicionFisica: CondicionFisica;
}

export function objetivosValidos(candidatos: ObjetivoCandidato[]): ObjetivoCandidato[] {
  return candidatos.filter((c) => c.condicionFisica !== 'CONVALECIENTE' && c.condicionFisica !== 'MUERTO');
}

/// Elige el objetivo de un ataque — `null` si no queda nadie vivo en el bando contrario (el
/// combate para ese bando ya terminó). Inteligencia alta prioriza rematar (mayor `ORDEN_CONDICION`,
/// más cerca de caer); empate entre igual de heridos se rompe por orden de aparición en
/// `candidatos`, nunca aleatorio de más — solo Inteligencia baja tira dado de verdad.
export function elegirObjetivo(inteligenciaAtacante: number, candidatos: ObjetivoCandidato[], random: () => number = Math.random): string | null {
  const vivos = objetivosValidos(candidatos);
  if (vivos.length === 0) return null;
  if (inteligenciaAtacante < INTELIGENCIA_TACTICA_UMBRAL) {
    return vivos[Math.floor(random() * vivos.length)].participantId;
  }
  const masHerido = vivos.reduce((peor, actual) =>
    ORDEN_CONDICION.indexOf(actual.condicionFisica) > ORDEN_CONDICION.indexOf(peor.condicionFisica) ? actual : peor,
  );
  return masHerido.participantId;
}

/// Redecide el emparejamiento de TODO un bando de una vez (llamado tras cada baja, §2: "el
/// emparejamiento se redecide en cada turno individual") — cada atacante vivo de `atacantes`
/// recibe un objetivo válido de `defensores`, o `null` si ya no queda ninguno.
export function retargetBando(
  atacantes: { participantId: string; inteligencia: number }[],
  defensores: ObjetivoCandidato[],
  random: () => number = Math.random,
): Record<string, string | null> {
  const resultado: Record<string, string | null> = {};
  for (const atacante of atacantes) {
    resultado[atacante.participantId] = elegirObjetivo(atacante.inteligencia, defensores, random);
  }
  return resultado;
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — Bandos y tope de combatientes: 4 vs. 4 máximo, partición de encuentros grandes
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_COMBATIENTES_POR_BANDO = 4;

export interface CombatienteParticion {
  participantId: string;
  bando: Bando;
  /// true = es LA jugadora en persona (nunca más de uno) — decide qué sub-combate resultante es
  /// `jugable` (§3/§4: "solo UNO de esos sub-combates es jugable en directo, el que te incluye").
  esJugador?: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/// Parte un enfrentamiento en sub-combates de máximo 4 vs. 4 (§3). Caso real más común: un bando
/// (la party de la jugadora) ya cabe en 4 y el otro (un grupo grande de enemigos) no — cada
/// fragmento del bando grande se enfrenta al bando pequeño ENTERO, repetido tantas veces como
/// fragmentos salgan. Si los DOS bandos superan 4 a la vez (una batalla de verdad, ejército
/// contra ejército — el ejemplo "12 vs 12" del propio doc), se emparejan fragmento a fragmento
/// por índice, envolviendo cíclicamente el lado más corto si el número de fragmentos no coincide
/// — simplificación consciente y documentada: el doc no especifica el emparejamiento exacto para
/// el caso simétrico, esta es la lectura más simple que no dispara ningún error ni deja a nadie
/// sin combate asignado.
export function particionarEnSubCombates(combatientes: CombatienteParticion[]): CombatienteParticion[][] {
  const jugador = combatientes.filter((c) => c.bando === 'JUGADOR');
  const enemigo = combatientes.filter((c) => c.bando === 'ENEMIGO');
  const fragmentosJugador = chunk(jugador, MAX_COMBATIENTES_POR_BANDO);
  const fragmentosEnemigo = chunk(enemigo, MAX_COMBATIENTES_POR_BANDO);
  if (fragmentosJugador.length === 0 || fragmentosEnemigo.length === 0) return [];

  const totalSubCombates = Math.max(fragmentosJugador.length, fragmentosEnemigo.length);
  const subCombates: CombatienteParticion[][] = [];
  for (let i = 0; i < totalSubCombates; i++) {
    const ladoJugador = fragmentosJugador[i % fragmentosJugador.length];
    const ladoEnemigo = fragmentosEnemigo[i % fragmentosEnemigo.length];
    subCombates.push([...ladoJugador, ...ladoEnemigo]);
  }
  return subCombates;
}

/// Cuál de los sub-combates resultantes de `particionarEnSubCombates` es el jugable en directo —
/// el que contiene a la propia jugadora; el resto se resuelven deterministas (§3/§4). `null` si
/// ninguno la incluye (combate íntegramente autónomo, p. ej. Reino defendiéndose sin ella
/// presente, §4 — todos los sub-combates resultantes son deterministas en ese caso).
export function subCombateJugable(subCombates: CombatienteParticion[][]): number | null {
  const index = subCombates.findIndex((sc) => sc.some((c) => c.esJugador));
  return index === -1 ? null : index;
}
