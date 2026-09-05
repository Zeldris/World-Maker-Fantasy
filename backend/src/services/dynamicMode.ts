import type { PrismaClient, Temperamento, ZonePointTipo } from '@prisma/client';
import { sourceDisplayNameFor } from '../scripts/worldCatalog.js';

/// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — mini-flujo acotado que el
/// JUEGO ofrece al final de un turno normal (nunca lo interrumpe). El motor decide determinista
/// CUÁNDO ofrecerlo y QUÉ candidato es — el LLM solo narra la vuelta ya elegida, nunca decide
/// libremente que "toca algo" (mismo principio que el resto de "Mundo determinista").
///
/// Candidatos: solo `ZonePoint` con quien tiene sentido "interactuar" — NPC con nombre propio y
/// fauna genérica. RECURSO/EDIFICIO quedan fuera a propósito (no inician nada por sí mismos).
/// Nunca sustituye combate: si el mini-flujo deriva en pelea, se sale de este modo y se entra al
/// sistema de combate normal como siempre (decisión de las vueltas, no de este selector).

export type DynamicModeTipo = 'NPC' | 'FAUNA';

export interface DynamicModeCandidato {
  tipo: DynamicModeTipo;
  targetSlug: string;
}

interface ZonePointCandidateRow {
  tipo: ZonePointTipo;
  targetSlug: string;
  cantidad: number;
  /// Ver el filtro de `decideOfertaModoDinamico` más abajo (bug real, investigación 2026-09-05 a
  /// raíz del hallazgo "Kirelon sobrerrepresentado": el kirelon-arenoso NO tiene un peso de
  /// aparición mal calibrado — tiene `temperamento: 'AGRESIVO'` en el catálogo, y el modo dinámico
  /// nunca miraba el temperamento de ningún candidato. Confirmado con datos reales en Postgres: 7
  /// fichas de fauna AGRESIVA (`cruzavientos`/`ferike`/`kirelon-arenoso`/`lebude`/`miruina`/
  /// `rondador-de-brasas`/`towrgu`) ya sembradas con `ZonePoint` activos estaban igual de expuestas
  /// — el problema nunca fue específico de un animal, es que el filtro de candidatos no existía).
  /// El caller (`turnResolution.ts`) resuelve esto contra `Npc.temperamento` real antes de llamar
  /// aquí — null si no se pudo resolver ningún `Npc` para ese `targetSlug` (nunca debería pasar en
  /// la práctica, toda fauna/NPC con `ZonePoint` tiene fila `Npc`, pero un `null` se trata como "no
  /// descartar" para no bloquear la oferta entera por un dato ausente).
  temperamento: Temperamento | null;
}

/// Probabilidad de ofrecer el modo dinámico EN CADA TURNO donde hay al menos un candidato —
/// cifra de partida (evita que aparezca en el 100% de los turnos, sensación de saturación; ni en
/// un % tan bajo que nunca se vea). Ajustable jugando, mismo criterio que el resto de números de
/// este proyecto. Bajada de 0.35→0.2 (2026-08-27, bug real jugando en vivo: "interactuar me está
/// saliendo en la gran mayoría de turnos" — junto con el cooldown de abajo, que faltaba del todo.
const PROBABILIDAD_OFERTA = 0.2;

/// Cooldown real entre ofertas (2026-08-27, mismo bug de arriba): sin esto, la probabilidad se
/// evaluaba en CADA turno sin memoria de la última vez — varios turnos seguidos en la misma zona
/// con candidatos activos acumulaban probabilidad real de forma indistinguible de "casi siempre".
/// Comparado contra `Save.lastDynamicModeOfferAtMinutes` (mismo criterio "en vivo contra el
/// reloj de ficción" que el resto del proyecto, nunca un contador que decrece).
export const COOLDOWN_MODO_DINAMICO_MINUTOS = 45;

/// Puro — decide si ofrecer el modo dinámico este turno y con quién, a partir de los `ZonePoint`
/// YA recalculados (Pieza 3) de la Location actual. `random` inyectable para tests (mismo patrón
/// que `rollGathering`, dice.ts). Nunca ofrece si ya hay un modo dinámico en curso (el caller es
/// responsable de no llamar a esto con `pendingDynamicMode` no nulo) ni si no hay candidatos. El
/// nombre legible del candidato se resuelve aparte (`dynamicModeCandidateNameFor`, mismo criterio
/// que `zonePointsSummaryFor` — esta función es pura, sin Prisma).
export function decideOfertaModoDinamico(zonePoints: ZonePointCandidateRow[], random: () => number = Math.random): DynamicModeCandidato | null {
  // AGRESIVO excluido a propósito (ver comentario de `ZonePointCandidateRow.temperamento`) — "casi
  // cualquier interacción deriva en combate" (definición de catálogo, schema.prisma) es justo lo
  // opuesto al espíritu de este modo ("mini-interacción puntual", nunca sustituye combate): ofrecer
  // "Observarlo/Ofrecerle comida/Ignorarlo" contra un depredador que ataca casi seguro es
  // incoherente con su propia ficha. AMIGABLE/INOFENSIVO/CAUTELOSO sí encajan — el resto del rango
  // de hostilidad todavía admite una interacción pacífica real.
  const candidatos = zonePoints.filter((p) => (p.tipo === 'NPC' || p.tipo === 'FAUNA') && p.cantidad > 0 && p.temperamento !== 'AGRESIVO');
  if (candidatos.length === 0) return null;
  if (random() >= PROBABILIDAD_OFERTA) return null;

  const elegido = candidatos[Math.floor(random() * candidatos.length)];
  return { tipo: elegido.tipo as DynamicModeTipo, targetSlug: elegido.targetSlug };
}

/// Nombre legible del candidato — NPC resuelve contra `Npc.name` (identidad única), FAUNA contra
/// `sourceDisplayNameFor` (catálogo de caza) — mismo criterio ya establecido en `zonePoints.ts`.
export async function dynamicModeCandidateNameFor(prisma: Pick<PrismaClient, 'npc'>, candidato: DynamicModeCandidato): Promise<string> {
  if (candidato.tipo === 'FAUNA') return sourceDisplayNameFor(candidato.targetSlug);
  const npc = await prisma.npc.findFirst({ where: { slug: candidato.targetSlug }, select: { name: true } });
  return npc?.name ?? candidato.targetSlug;
}

/// Máximo de vueltas antes de forzar el cierre del modo dinámico (evita que una conversación se
/// alargue indefinidamente si el jugador nunca decide nada claro) — cifra de partida.
export const MAX_VUELTAS_MODO_DINAMICO = 4;

/// Minutos de ficción fijos por vuelta dentro del modo dinámico (decisión explícita de la usuaria:
/// "debe sentirse fluido, la escala no debe ser tan diferente entre tiempo de juego y real") —
/// NUNCA la escala comprimida normal del resto del juego, mismo patrón de "avance por cifra fija"
/// que `minutosRecoleccionFor` (recolectar.ts).
export const MINUTOS_POR_VUELTA_MODO_DINAMICO = 2;

/// Estado persistido en `Save.pendingDynamicMode` mientras el modo dinámico está en curso — null
/// si no hay ninguna interacción activa. `vuelta` empieza en 1 al ofrecerse, avanza en cada
/// respuesta del jugador hasta `MAX_VUELTAS_MODO_DINAMICO` o hasta que el motor detecta cierre.
/// `narration`/`opciones` (checklist frontend 2026-08-27, A.3) — última vuelta YA narrada, para que
/// `GET /saves/:id` pueda reconstruir el modal exactamente como estaba tras un F5/reconexión, sin
/// volver a llamar al LLM (mismo criterio que `combateIniciado`: reconstruido a partir de lo
/// persistido, nunca recalculado en la recarga).
export interface PendingDynamicMode {
  tipo: DynamicModeTipo;
  targetSlug: string;
  targetName: string;
  vuelta: number;
  iniciadoAtMinutes: number;
  narration: string;
  opciones: string[];
  /// Contexto real (2026-08-27, bug real "hay que darle mucho más contenido determinista para que
  /// no invente") — resuelto UNA vez en la primera vuelta y persistido aquí para que las vueltas
  /// siguientes (`/responder`) lo reutilicen sin re-consultar Prisma cada vez. `targetBio` null si
  /// el candidato no tiene fila de catálogo con bio (p.ej. algo de fauna sin Npc propio);
  /// `locationContext` null si el jugador no tenía `currentLocationId` resuelto.
  targetBio: string | null;
  locationContext: { name: string; description: string } | null;
}
