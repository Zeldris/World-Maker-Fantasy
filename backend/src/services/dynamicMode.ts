import type { PrismaClient, Temperamento, ZonePointTipo } from '@prisma/client';
import { sourceDisplayNameFor } from '../scripts/worldCatalog.js';

/// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — mini-flujo acotado que el
/// JUEGO ofrece al final de un turno normal (nunca lo interrumpe). El motor decide determinista
/// CUÁNDO ofrecerlo y QUÉ candidato es — el LLM solo narra la vuelta ya elegida, nunca decide
/// libremente que "toca algo" (mismo principio que el resto de "Mundo determinista").
///
/// Candidatos: `ZonePoint` con quien tiene sentido "interactuar" — NPC con nombre propio, fauna
/// genérica, y (2026-09-08, "Ver qué hay en la zona") RECURSO real de catálogo. EDIFICIO queda
/// fuera a propósito (no inicia nada por sí mismo). Nunca sustituye combate: si el mini-flujo
/// deriva en pelea, se sale de este modo y se entra al sistema de combate normal como siempre
/// (decisión de las vueltas, no de este selector).
///
/// RECURSO es estructuralmente distinto de NPC/FAUNA (2026-09-08) — no hay conversación de vueltas
/// que tener con una veta de mineral: se resuelve en una sola llamada (narración breve + tirada +
/// recolección real, reutilizando `resolverRecoleccion`/`gatheringRollFor`/`applyGatheringRoll` de
/// recolectar.ts) — nunca pasa por `pendingDynamicMode`/`narrarVueltaModoDinamico`, tiene su propia
/// ruta (`dynamicModeRecurso.ts`).

export type DynamicModeTipo = 'NPC' | 'FAUNA' | 'RECURSO';

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
  // de hostilidad todavía admite una interacción pacífica real. RECURSO siempre tiene
  // `temperamento: null` (inerte, sin catálogo Npc que lo resuelva) — nunca se descarta por este
  // filtro, `null !== 'AGRESIVO'` ya es `true`.
  //
  // Gistera Koh excluida a propósito (2026-09-09, bug real jugando en vivo — Álvaro: "ya no
  // estamos usando los mensajes deterministas... no hay conversación... y qué tiene que ver el
  // tótem con ella") — su encuentro es un guion determinista propio de apertura (3 pasos fijos,
  // ver `narrarVueltaGistera` más abajo), nunca debe competir con prosa libre del LLM ni con el
  // sorteo genérico de probabilidad/proximidad de cualquier otro candidato. Este filtro cubre el
  // camino ambiental (`turnResolution.ts`, ya protegido aparte por `gisteraEnEscena` mientras
  // sigue en escena, pero esa protección deja de aplicar tras `gisteraSeHaMarchado`) — la
  // colisión de celda en Zona (`zona.ts` § `detectarEncuentroEnCelda`) tiene su propio guard
  // equivalente, no pasa por esta función.
  const candidatos = zonePoints.filter(
    (p) => (p.tipo === 'NPC' || p.tipo === 'FAUNA' || p.tipo === 'RECURSO') && p.cantidad > 0 && p.temperamento !== 'AGRESIVO' && p.targetSlug !== 'gistera-koh',
  );
  if (candidatos.length === 0) return null;
  if (random() >= PROBABILIDAD_OFERTA) return null;

  const elegido = candidatos[Math.floor(random() * candidatos.length)];
  return { tipo: elegido.tipo as DynamicModeTipo, targetSlug: elegido.targetSlug };
}

/// Nombre legible del candidato — NPC resuelve contra `Npc.name` (identidad única), FAUNA/RECURSO
/// (2026-09-08) contra `sourceDisplayNameFor` (catálogo de caza/recolección, `harvestSourceDisplayName`
/// cubre ambos por `sourceSlug` sin distinguir fauna de mineral/planta) — mismo criterio ya
/// establecido en `zonePoints.ts`.
export async function dynamicModeCandidateNameFor(prisma: Pick<PrismaClient, 'npc'>, candidato: DynamicModeCandidato): Promise<string> {
  if (candidato.tipo === 'FAUNA' || candidato.tipo === 'RECURSO') return sourceDisplayNameFor(candidato.targetSlug);
  const npc = await prisma.npc.findFirst({ where: { slug: candidato.targetSlug }, select: { name: true } });
  return npc?.name ?? candidato.targetSlug;
}

/// Guion determinista del encuentro de apertura con Gistera Koh (2026-09-09, bug real jugando en
/// vivo — Álvaro: "ya no estamos usando los mensajes deterministas... es imposible saber que estoy
/// aceptando... no hay conversación... y qué tiene que ver el tótem con ella") — reemplaza por
/// completo el paso por `narrarVueltaModoDinamico` (LLM) para este NPC concreto: 3 pasos fijos,
/// texto revisado y aprobado por Álvaro palabra por palabra, CERO riesgo de alucinación (el bug
/// original — "su tótem Maktor" atribuido a Gistera en vez de a Gorhorn — es estructuralmente
/// imposible aquí, no hay generación). Caso especial reconocido explícitamente por el propio
/// Álvaro como único ("esto es un caso único de los NPC con nombre propio") — no se generaliza a
/// un mecanismo nuevo para NPC deterministas en general, sería sobre-ingeniería para una sola
/// instancia hoy.
///
/// 3 vueltas, nunca 4 (a diferencia del máximo genérico `MAX_VUELTAS_MODO_DINAMICO`): 1 avistamiento
/// sin nombre → 2 presentación + oferta → 3 despedida (solo si aceptó; rechazar/retirarse cierran
/// en la propia vuelta 1 o 2, sin llegar a una vuelta 3). El nombre real ("Gistera Koh") no debe
/// mostrarse en la UI hasta la vuelta 2 — el caller (dynamicMode.ts, ruta) es responsable de asignar
/// un `targetName` oculto en la oferta/tarjeta previa a abrir el modal.
export type RespuestaGistera = 'acercarse' | 'observar' | 'retirarse' | 'aceptar' | 'preguntar' | 'rechazar';

/// Nombre oculto genérico (2026-09-09, generalizado a petición de Álvaro: "esta lógica se debe
/// aplicar a todos los que tienen nombre propio" — nació acotado a Gistera Koh, pero el criterio
/// real ya existía en el proyecto desde el hallazgo 34 (2026-09-07): cualquier `Npc.kind ===
/// 'PRINCIPAL'` (nombre propio) no descubierto todavía (`DiscoveredEntity`) se muestra oculto en
/// vez de revelar su identidad — `GET /zona` y la Enciclopedia ya lo aplicaban así; el hueco real
/// era que la COLISIÓN de Zona (`detectarEncuentroEnCelda`, zona.ts) nunca consultaba
/// `DiscoveredEntity`, revelando `Npc.name` sin condición. Mismo texto usado en la tarjeta de
/// oferta previa (`pendingDynamicModeOffer`) y en la colisión — un NPC/fauna genérico (`kind !==
/// 'PRINCIPAL'`) nunca usa esta constante, su "nombre" ya es de especie/rol, no un spoiler.
export const NOMBRE_OCULTO_GENERICO = 'Alguien';

/// P28 (QA-27): cara a cara, «Alguien» se leía como un nombre propio («Alguien no parece dispuesto
/// a dejarte pasar») cuando la imagen ya enseña quién es. Con raza conocida se nombra por ella, en
/// singular y con su género («Orco desconocido», «Orca desconocida»), sin revelar el nombre real.
const RAZA_SINGULAR: Record<string, [string, string]> = {
  orcos: ['Orco', 'Orca'],
  goirntes: ['Goirnte', 'Goirnte'],
  nabieus: ['Nabieus', 'Nabieus'],
  faerus: ['Faerus', 'Faerus'],
};

export function nombreOcultoPorRaza(raza: string | null | undefined, genero: string | null | undefined): string {
  const par = raza ? RAZA_SINGULAR[raza] : undefined;
  if (!par) return NOMBRE_OCULTO_GENERICO;
  return genero === 'F' ? `${par[1]} desconocida` : `${par[0]} desconocido`;
}

/// P63 (QA-27): dentro de una frase, el nombre oculto por raza lleva artículo («el orco desconocido
/// no tiene intención…»), no se lee como nombre propio. Cualquier otro nombre pasa tal cual.
export function nombreEnFrase(nombre: string, alInicio = false): string {
  // «Alguien» (sin raza conocida) tampoco es un nombre propio: en minúscula a mitad de frase.
  if (nombre === NOMBRE_OCULTO_GENERICO) return alInicio ? nombre : nombre.toLowerCase();
  const m = /^(\S+) (desconocid([oa]))$/.exec(nombre);
  if (!m) return nombre;
  const articulo = m[3] === 'a' ? 'la' : 'el';
  const texto = `${articulo} ${m[1].toLowerCase()} ${m[2]}`;
  return alInicio ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

/// P90 (QA-27): un grupo de fauna se nombra como grupo («el grupo de 5 Kirelon Arenoso»), no como
/// un individuo sin artículo.
export function nombreDeEncuentro(nombre: string, cantidad?: number | null, alInicio = false): string {
  if (!cantidad || cantidad <= 1) return nombreEnFrase(nombre, alInicio);
  return `${alInicio ? 'El' : 'el'} grupo de ${cantidad} ${nombre}`;
}

/// «de el grupo…» → «del grupo…» (contracción obligatoria).
export function deNombre(nombreEnLaFrase: string): string {
  return nombreEnLaFrase.startsWith('el ') ? `del ${nombreEnLaFrase.slice(3)}` : `de ${nombreEnLaFrase}`;
}

/// Mismo shape que `DynamicModeTurnoOutput` (dynamicModeNarracion.ts) — definido aquí en vez de
/// importado de allí para no crear un ciclo (ese archivo ya importa `DynamicModeTipo` de este).
export interface GisteraTurnoOutput {
  narration: string;
  opciones: string[];
  cierra: boolean;
}

/// Mapeo texto exacto de la opción pulsada → respuesta tipada. Seguro porque las opciones son
/// texto FIJO controlado por este mismo módulo (`narrarVueltaGistera`, nunca generado por LLM) —
/// a diferencia del resto de modo dinámico, donde `opciones` es prosa libre del modelo y nunca
/// podría mapearse así de forma fiable.
const GISTERA_RESPUESTA_POR_OPCION: Record<string, RespuestaGistera> = {
  'Me acerco a ella': 'acercarse',
  'Observo con atención': 'observar',
  'Me retiro': 'retirarse',
  'Aceptar ayudarla': 'aceptar',
  'Preguntar más antes de decidir': 'preguntar',
  'Rechazar y seguir tu camino': 'rechazar',
};

export function respuestaGisteraDesdeOpcion(opcion: string): RespuestaGistera | null {
  return GISTERA_RESPUESTA_POR_OPCION[opcion] ?? null;
}

/// Colisión AGRESIVO/ENEMIGO en Zona, "quien ve a quién primero" con efecto MECÁNICO real
/// (2026-09-20, petición explícita de Álvaro: "que sea por tirada... si yo lo veo primero se abre
/// el interactuar dándome elegir combatir o huir... si me ve él, entro en combate directamente").
/// Solo se llama cuando `quienIniciaEncuentro` (zonaPosicion.ts) resolvió 'jugador' — el otro caso
/// ('npc') nunca pasa por aquí, el caller abre combate directo sin ofrecer nada que elegir. Texto
/// fijo determinista, sin LLM (mismo criterio que `narrarVueltaGistera`): es un único aviso
/// urgente, no una conversación con margen para prosa generada.
export const COMBATE_FORZADO_OPCION_COMBATIR = 'Combatir';
export const COMBATE_FORZADO_OPCION_HUIR = 'Huir';

export function narrarAperturaCombateForzado(targetName: string, cantidad?: number | null): GisteraTurnoOutput {
  return {
    narration: `Os encontráis y os miráis — ${nombreDeEncuentro(targetName, cantidad)} no tiene intención de dejarte pasar. Toca decidir ya: combatir o huir.`,
    opciones: [COMBATE_FORZADO_OPCION_COMBATIR, COMBATE_FORZADO_OPCION_HUIR],
    cierra: false,
  };
}

const GISTERA_TEXTO_PRESENTACION =
  'Con la respiración entrecortada, sin dejar de mirar hacia atrás, se presenta a toda prisa: «Soy Gistera Koh... del Clan Serhu, aunque ya no. No tengo tiempo para explicarte más — uno de los suyos me pisa los talones y quiere verme muerta. Llevas la marca de los Maktor, ¿verdad? Entonces sabes lo que es que un clan entero se vuelva contra los tuyos. ¿No quieres acabar con los Serhu? Empieza por el que me persigue — hazlo antes de que sea demasiado tarde.»';
const GISTERA_OPCIONES_PRESENTACION = ['Aceptar ayudarla', 'Preguntar más antes de decidir', 'Rechazar y seguir tu camino'];

/// Ramifica por `respuesta` (la opción que el jugador ya eligió), NUNCA solo por el número de
/// vuelta — "preguntar" recicla la presentación (misma vuelta lógica, no avanza a la 3), y
/// "aceptar"/"rechazar" ambos SALEN de la vuelta 2, pero a desenlaces distintos.
export function narrarVueltaGistera(vuelta: number, respuesta: RespuestaGistera | null): GisteraTurnoOutput {
  if (vuelta === 1) {
    return {
      narration:
        'Levantando polvo entre la hondonada ves a una orca de las llanuras corriendo, con la respiración entrecortada y sin dejar de mirar hacia atrás — algo, o alguien, la persigue.',
      opciones: ['Me acerco a ella', 'Observo con atención', 'Me retiro'],
      cierra: false,
    };
  }
  if (respuesta === 'retirarse') {
    return { narration: 'Decides no arriesgarte y te alejas — la figura sigue su carrera, ajena a ti, hasta perderse entre las rocas.', opciones: [], cierra: true };
  }
  if (respuesta === 'rechazar') {
    return {
      narration: 'Gistera aprieta la mandíbula, decepcionada pero sin insistir. «Entiendo. Cuídate, Gorhorn.» Retrocede hacia las sombras y desaparece de la vista.',
      opciones: [],
      cierra: true,
    };
  }
  if (respuesta === 'aceptar') {
    return {
      narration:
        'Gistera esboza un gesto de alivio que apenas dura un instante. «Gracias, Gorhorn. No puedo quedarme aquí más tiempo, pero si nos volvemos a ver, ¡te lo agradeceré como corresponde!» Se aleja a toda velocidad entre las rocas de la hondonada sin mirar atrás.',
      opciones: [],
      cierra: true,
    };
  }
  // 'observar' / 'acercarse' (vuelta 1→2) Y 'preguntar' (recicla la presentación, se queda en la
  // misma vuelta lógica) llevan las tres a este mismo texto — Gistera ya te ha visto en cuanto te
  // acercas o te quedas mirando, no hace falta una rama de vuelta extra solo para eso; "preguntar"
  // simplemente vuelve a presentar la oferta para que el jugador decida con calma.
  return { narration: GISTERA_TEXTO_PRESENTACION, opciones: GISTERA_OPCIONES_PRESENTACION, cierra: false };
}

/// Puro — compone el texto que se vuelca al `LogEntry` de personaje al cerrarse el modo dinámico
/// (Franja 0, 2026-09-08). Todas las vueltas narradas, concatenadas en orden (decisión explícita
/// de la usuaria: "todas las vueltas concatenadas" — conserva el detalle completo de la
/// conversación, coherente con cómo se lee el resto del log).
export function resumenModoDinamicoParaLog(historialNarracion: string[]): string {
  return historialNarracion.join('\n\n');
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
  /// Franja 0 (2026-09-08, "Interactuar" motor unificado de eventos de escena) — texto de CADA
  /// vuelta ya narrada, en orden, para poder volcar la conversación completa a un `LogEntry` al
  /// cerrarse (bug real: hasta ahora `pendingDynamicMode` solo guardaba la última vuelta, así que
  /// al cerrar el modal no quedaba ningún rastro legible de cómo se desarrolló). `narration` de
  /// arriba se mantiene igual (la vuelta EN CURSO, la que ve el modal) — este array es el
  /// historial acumulado, incluye esa misma vuelta como su último elemento.
  historialNarracion: string[];
  /// Contexto real (2026-08-27, bug real "hay que darle mucho más contenido determinista para que
  /// no invente") — resuelto UNA vez en la primera vuelta y persistido aquí para que las vueltas
  /// siguientes (`/responder`) lo reutilicen sin re-consultar Prisma cada vez. `targetBio` null si
  /// el candidato no tiene fila de catálogo con bio (p.ej. algo de fauna sin Npc propio);
  /// `locationContext` null si el jugador no tenía `currentLocationId` resuelto.
  targetBio: string | null;
  locationContext: { name: string; description: string } | null;
  /// Colisión AGRESIVO/ENEMIGO en Zona (2026-09-20, "todo debe saltar el interactuar, incluido un
  /// agresivo" — petición explícita de Álvaro tras confirmar que antes el Orco solo dejaba un aviso
  /// de texto sin abrir nada) — true cuando este encuentro puede desembocar en combate real desde
  /// el propio modal, sin depender de un turno de texto libre posterior. Solo se da cuando
  /// `quienInicia: 'jugador'` (el jugador lo vio primero, así que puede elegir combatir o huir —
  /// ver `narrarVueltaCombateForzado`); si el NPC/fauna vio primero al jugador, el combate se abre
  /// DIRECTAMENTE sin pasar por `pendingDynamicMode` en absoluto (nunca hay elección posible).
  combateForzado?: true;
  /// Agresivo en grupo (Fase 2, 2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — id/cantidad
  /// del `ZonePoint` colisionado, presentes solo cuando `combateForzado` viene de un grupo de
  /// FAUNA real (`cantidad > 1`, ver `dynamicModeOffer.zonePointId`/`cantidad`, zona.ts). Con
  /// `cantidad > 1`, elegir "Combatir" en `/responder` abre combate múltiple con todo el grupo vía
  /// `iniciarCaza` en vez del 1v1 clásico — "un agresivo que te corta el paso nunca se resuelve
  /// sigiloso".
  zonePointId?: string;
  cantidad?: number;
}
