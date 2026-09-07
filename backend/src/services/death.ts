import type { CondicionFisica, Dificultad, AbilityEffect } from '@prisma/client';

/// Muerte, respawn y condición física (docs/14-combate-y-muerte.md § 1, § 4) — todo determinista,
/// sin IA: el modelo nunca decide si el fin de partida se dispara ni qué susurra la Entidad,
/// igual que nunca decide si una tirada tiene éxito (mismo espíritu que progression.ts).

const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO'];

/// Deuda técnica cerrada (auditoría 2026-09-01): el mismo literal `['ILESO', 'HERIDO', 'GRAVE']`
/// ("el NPC sigue en pie y puede interactuar — no está CONVALECIENTE ni MUERTO") estaba copiado 3
/// veces entre `routes/saves/aprenderOficio.ts` y `routes/saves/entrega.ts`. Único punto de
/// verdad ahora, derivado de `CONDICION_ORDER` para no poder desincronizarse de él.
export const CONDICIONES_INTERACTUABLE: CondicionFisica[] = CONDICION_ORDER.slice(0, 3);

/// Malus mecánico por condición física en combate (2026-07-29, "cómo es posible que alguien
/// convaleciente reaccione igual" — hasta ahora `condicionFisica` no afectaba ninguna tirada, solo
/// paraba a quien ya había caído). Se resta al valor CRUDO del atributo antes del multiplicador
/// de tipo (combatExchange.ts), para cualquiera de los dos lados y cualquier rol (atacar o
/// defender) — HERIDO se nota poco, GRAVE cuesta de verdad.
///
/// Bug real jugando en vivo (2026-07-31, "he ganado la batalla estando yo convaleciente y el
/// enemigo herido"): el comentario original de aquí asumía que un jugador CONVALECIENTE "ya para
/// de actuar antes de llegar aquí" — falso, nada en turnResolution.ts detiene al jugador (a
/// diferencia del NPC, que sí queda excluido del intercambio si está CONVALECIENTE/MUERTO, ver
/// `npcParaIntercambio.condicionFisica !== 'CONVALECIENTE'`). Con malus 0 (igual que ILESO), un
/// jugador convaleciente seguía peleando exactamente igual de bien que uno sano — así terminó
/// "ganando" un combate donde en realidad los dos habían caído a la vez. Decisión explícita de la
/// usuaria: sigue pudiendo intentarlo, pero MUY penalizado — no un tope duro (eso lo pidió para
/// otra cosa), un malus real. MUERTO se queda en 0: no llega a pelear otro turno (ver
/// `finDePartida`/respawn en turnResolution.ts), el valor es irrelevante ahí.
/// Recuperación/desaparición por tiempo (docs/19-post-combate-y-recompensas-mision.md pieza 2,
/// 2026-08-13, decisión explícita de la usuaria) — puro: dado cuándo cambió por última vez
/// `condicionFisica` (`NpcState.condicionFisicaSinceMinutes`, en minutos de FICCIÓN, no reales) y
/// el minuto de ficción actual, decide si toca revertir/despachar. La escritura real en DB vive en
/// turnResolution.ts (necesita `tx`), esto solo decide el "¿toca ya?".
const RECOVERY_CONVALECIENTE_MINUTES = 6 * 60;
const DESPAWN_MUERTO_MINUTES = 48 * 60;

/// CONVALECIENTE sin decapitar durante 6h de ficción → se recupera a HERIDO (no GRAVE ni ILESO —
/// decisión explícita de la usuaria, corrige la primera propuesta de este mismo documento).
export function npcRecoversFromConvaleciente(sinceMinutes: number | null, nowMinutes: number): boolean {
  if (sinceMinutes === null) return false;
  return nowMinutes - sinceMinutes >= RECOVERY_CONVALECIENTE_MINUTES;
}

/// MUERTO durante 48h de ficción → el cadáver desaparece del mundo (se borra su NpcState — mismo
/// espíritu que el resto del modelo, donde una fila de NPC `PLANTILLA` ya es "un encuentro
/// concreto", no un registro permanente; para `PRINCIPAL` equivale a que el mundo haya seguido su
/// curso con el cuerpo, sin dejarlo eternamente saqueable/decapitable en el mismo sitio).
export function npcCorpseShouldDespawn(sinceMinutes: number | null, nowMinutes: number): boolean {
  if (sinceMinutes === null) return false;
  return nowMinutes - sinceMinutes >= DESPAWN_MUERTO_MINUTES;
}

const CONDICION_MALUS: Record<CondicionFisica, number> = {
  ILESO: 0,
  HERIDO: 2,
  GRAVE: 5,
  CONVALECIENTE: 10,
  MUERTO: 0,
};

export function condicionMalus(condicion: CondicionFisica): number {
  return CONDICION_MALUS[condicion];
}

/// Techo real de mejora este turno (2026-07-29, reglas de curación: "si descansas o comes solo
/// puedes volver a Herido... si usas material médico sí puedes curarte a Ileso... si sales de un
/// combate Convaleciente, tendrás que usar objetos específicos"). Sin causa real (ni descanso ni
/// objeto médico), no hay mejora posible — cierra el hueco de que el modelo mejorara la condición
/// "porque sí" narrativamente, sin que nada en el turno lo justificara.
///
/// Dos escalones de descanso (auditoría 2026-08-11, "la descripción de Descansar promete curar en
/// cualquier sitio pero la mecánica solo curaba en refugio/asentamiento" — aclarado con la
/// usuaria): `restAttempted` (el jugador intentó descansar, EN CUALQUIER SITIO, con éxito
/// mecánico) topa como mucho en GRAVE — un vivac improvisado ayuda, pero poco. `restInValidLocation`
/// (además, el sitio es un refugio/asentamiento real) topa en HERIDO — sigue sin bastar desde
/// CONVALECIENTE, que necesita objeto médico sí o sí, pero SÍ mejora a GRAVE igual que el descanso
/// improvisado (antes no hacía nada en absoluto). `restInValidLocation` implica `restAttempted`
/// (nunca al revés) — es el mismo caller quien garantiza esa relación (turnResolution.ts).
///
/// Bug real (auditoría 2026-07-30): las ramas de abajo devolvían su techo sin comprobar antes si
/// `current` ya estaba MEJOR que ese techo — un personaje ya ILESO que usaba un objeto médico
/// débil (tope HERIDO) se veía "curado" hasta HERIDO por `nextCondicionFisica` (que solo sabe
/// tomar lo PEOR entre la propuesta y el techo), empeorando de verdad a alguien que no tenía nada
/// que curar. El techo nunca puede ser peor que la condición actual — como mucho, igual de bueno.
///
/// Descansar YA NO cura condición física (2026-09-06, hallazgo 11 de la sesión de pruebas,
/// decisión explícita de la usuaria) — las dos ramas de descanso ("refugio cura hasta HERIDO",
/// "cualquier sitio cura hasta GRAVE") se quitaron por completo; sin objeto médico, el techo es
/// siempre `current` (sin mejora). La única vía de curar condición fuera de combate es "Curar" con
/// objetos médicos reales (`applySequentialHeals` más abajo, siempre con este techo).
export function healCeilingFor(
  current: CondicionFisica,
  medicalCuraHasta: CondicionFisica | null,
  // Primeros auxilios (2026-08-13, petición explícita: "quiero unas profesiones... que sea
  // primeros-auxilios que tenga pocas recetas de objetos básicos con los que te puedes curar pero
  // solo objetos tipo mejoran el estado en el que estas... mejora al siguiente"): con esto en
  // `true`, el objeto YA NO rompe el tope de golpe hasta `medicalCuraHasta` — como mucho sube UN
  // escalón desde `current`, y `medicalCuraHasta` pasa a ser el tope de ESE escalón (así un
  // objeto de tier bajo, usado desde muy mal, nunca cura más lejos de lo que le tocaría a un
  // objeto de tier bajo usado en su punto exacto). Objetos normales (alquimista y superiores,
  // `curaUnPaso: false`) siguen rompiendo el tope de golpe, sin cambios.
  medicalCuraUnPaso = false,
): CondicionFisica {
  const currentIdx = CONDICION_ORDER.indexOf(current);
  let ceiling: CondicionFisica = current;
  if (medicalCuraHasta) {
    if (medicalCuraUnPaso) {
      // CONDICION_ORDER va de mejor a peor (ILESO=0 primero), así que "un escalón mejor" es
      // RESTAR uno al índice. El resultado real es el MAYOR de los dos índices (el peor de los
      // dos) — nunca mejor que un escalón por encima de `current`, y nunca mejor que el propio
      // tope del objeto (`medicalIdx`), lo que gane primero.
      const medicalIdx = CONDICION_ORDER.indexOf(medicalCuraHasta);
      ceiling = CONDICION_ORDER[Math.max(currentIdx - 1, medicalIdx)];
    } else {
      ceiling = medicalCuraHasta; // el objeto manda, rompe el tope incluso desde CONVALECIENTE
    }
  }
  const ceilingIdx = CONDICION_ORDER.indexOf(ceiling);
  return CONDICION_ORDER[Math.min(currentIdx, ceilingIdx)];
}

/// Varios usos de objeto médico en el mismo turno (petición explícita, 2026-08-18: panel "Curar"
/// con cantidad + varios objetos a la vez, en vez de uno solo) — pliega `healCeilingFor` SIN
/// MODIFICARLA sobre una lista ORDENADA de usos, siempre con `restAttempted`/`restInValidLocation`
/// en `false` (este camino es solo objetos, nunca "descansar"). El ORDEN importa de verdad para
/// los objetos `curaUnPaso` (verificado a mano): desde CONVALECIENTE, un objeto de tope GRAVE
/// seguido de uno de tope ILESO deja en HERIDO; el mismo par al revés deja en GRAVE — usar primero
/// el objeto más débil "gasta" menos margen del más fuerte. El caller decide el orden (mismo orden
/// en que la jugadora seleccionó cada objeto en el panel).
export function applySequentialHeals(current: CondicionFisica, uses: { curaHasta: CondicionFisica; curaUnPaso: boolean }[]): CondicionFisica {
  let condicion = current;
  for (const use of uses) {
    condicion = healCeilingFor(condicion, use.curaHasta, use.curaUnPaso);
  }
  return condicion;
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
  const currentIdx = CONDICION_ORDER.indexOf(current);
  // Bug real jugando en vivo (2026-07-31, "descansar no curó nada"): sin propuesta del modelo,
  // esto devolvía `current` sin más — un descanso/objeto médico válido (healCeiling ya mejor que
  // current) solo curaba de verdad si el modelo, ADEMÁS de narrar la curación en prosa, se
  // acordaba de rellenar el campo "condicionFisica" del JSON. Un pequeño porcentaje de turnos no
  // lo rellenaba, y la curación narrada quedaba sin ningún efecto mecánico — mismo patrón que el
  // resto de esta sesión: la causa determinista (restSucceeds/medicalCuraHasta, ya resuelta en
  // healCeilingFor) tiene que bastar por sí sola, sin depender de que el modelo la confirme.
  if (!proposed) {
    const ceilingIdx = CONDICION_ORDER.indexOf(healCeiling);
    return CONDICION_ORDER[Math.min(currentIdx, ceilingIdx)];
  }
  const proposedIdx = CONDICION_ORDER.indexOf(proposed);
  // Bug real jugando en vivo (2026-08-26, batida de pruebas: "curarme/descansar falla en silencio
  // ~50% de las veces"): cuando el modelo REPITE la condición actual en vez de omitir el campo
  // (`proposedIdx === currentIdx`, ni mejora ni empeora — sin información real, igual que
  // `!proposed` arriba), esto caía en la misma rama que una mejora real propuesta por el modelo
  // (`proposedIdx < currentIdx`) y aplicaba `Math.max(proposedIdx, ceilingIdx)` — con
  // `proposedIdx === currentIdx`, eso siempre "gana" sobre un techo mejor (`ceilingIdx` más bajo),
  // descartando la curación real aunque el objeto/descanso ya se hubiera consumido. Ahora ese caso
  // se trata igual que `!proposed` (`Math.min`, deja ganar al techo real). Cuando el modelo SÍ
  // propone una mejora genuina (`proposedIdx < currentIdx`), `Math.max` sigue siendo el correcto:
  // evita que la narración cure de más allá del techo mecánico real.
  if (proposedIdx === currentIdx) {
    const ceilingIdx = CONDICION_ORDER.indexOf(healCeiling);
    return CONDICION_ORDER[Math.min(currentIdx, ceilingIdx)];
  }
  if (proposedIdx < currentIdx) {
    const ceilingIdx = CONDICION_ORDER.indexOf(healCeiling);
    return CONDICION_ORDER[Math.max(proposedIdx, ceilingIdx)];
  }
  // Bug real jugando en vivo (2026-08-28, "descansar en refugio nunca cura desde CONVALECIENTE"):
  // fuera de combate, el modelo nunca la empeora — pero `return current` a secas también
  // descartaba el techo de curación real (`healCeiling`) cuando el modelo proponía un empeoramiento
  // narrativo (p. ej. un encuentro real merodeando durante el descanso hace que narre "sigue en
  // peligro" con una condición peor). Mismo patrón que los dos bugs ya documentados arriba en esta
  // función — el descanso/objeto médico ya se consumió de verdad, así que el techo tiene que ganar
  // igual, sin depender de qué proponga el modelo.
  if (!enCombate) {
    const ceilingIdx = CONDICION_ORDER.indexOf(healCeiling);
    return CONDICION_ORDER[Math.min(currentIdx, ceilingIdx)];
  }
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

/// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2, fusionada en LETAL
/// el 2026-08-15 — sustituye a REMATE, que exigía que el objetivo ya estuviera GRAVE/CONVALECIENTE):
/// LETAL mata de un golpe a CUALQUIER rival que reciba el golpe, sin condición previa sobre su
/// condición física actual — confirmado explícitamente con la usuaria.
export function nextCondicionForAttack(effects: AbilityEffect[], current: CondicionFisica): CondicionFisica {
  if (effects.includes('LETAL')) return 'MUERTO';
  return oneStepWorseThan(current);
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
  CONVALECIENTE: 25,
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
///
/// Muerte permanente, botón Aceptar/Reintentar (2026-08-31, petición explícita) — separado de
/// `awakensText` (antes era un único texto con la ubicación de respawn ya decidida): en el
/// instante de morir, el motor todavía no sabe si el jugador va a reaparecer en su punto de
/// guardado o si la partida entera va a reiniciarse (`POST /saves/:id/death/resolve` lo decide
/// con el estado REAL en ese momento) — el susurro solo narra el instante de la muerte en sí y
/// deja pendiente la resolución, nunca inventa un destino que aún no es seguro.
export function whisperText(characterName: string, avisoUltimaVez: boolean): string {
  const base = `Todo se apaga en un frío total, y entre la nada una voz que no es de este mundo susurra a ${characterName}: "Aún no ha llegado tu momento...".`;
  return avisoUltimaVez
    ? `${base} La voz se demora un instante más de lo normal, como una advertencia — no habrá una próxima vez.`
    : base;
}

/// Texto de reaparición tras resolver una muerte pendiente (`POST /saves/:id/death/resolve`) — ya
/// con el destino real decidido (punto de guardado, o el inicio de la partida si tocó reiniciar
/// del todo). `esReinicioTotal` cambia el matiz: "vuelve a" (mismo progreso, solo reposicionado)
/// frente a "todo era un sueño" (coherente con reiniciar la partida entera, decisión explícita de
/// la usuaria: "si no hay punto de guardado volvera al inicio... como que te despiertas de una
/// pesadilla").
export function awakensText(characterName: string, respawnLocationName: string, esReinicioTotal: boolean): string {
  if (esReinicioTotal) {
    return `${characterName} despierta de golpe, sobresaltado — todo lo vivido no fue más que una pesadilla. Se encuentra de nuevo en ${respawnLocationName}, como el primer día.`;
  }
  return `${characterName} despierta de golpe, como de una pesadilla, en ${respawnLocationName}.`;
}

/// § 4.1: un Location solo cuenta como punto de descanso válido si es refugio o asentamiento —
/// nunca un hito o cruce de paso.
export function isValidRestLocationKind(kind: string): boolean {
  return kind === 'refugio' || kind === 'asentamiento';
}
