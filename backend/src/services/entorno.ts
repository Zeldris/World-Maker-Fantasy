/// Panel "El mundo" (v1, ver conversación de producto): describe el entorno inmediato del
/// personaje (clima, luz, posición del sol, sonidos) a intervalos regulares — puramente
/// descriptivo. Antes también podía proponer un "evento" que apilaba una pregunta ("¿Qué haces?")
/// en el chat de PERSONAJE — quitado a petición explícita de la usuaria (2026-07-23, "revisar
/// partida": "el sondeo ambiental solo tiene que lanzarse en el chat de mundo... no tiene que
/// preguntar que hace, solo exponer que hay a tu alrededor").
///
/// Reescrito a plantillas deterministas (auditoría 2026-07-24, "revisa todo bien bien" — punto A
/// del roadmap de reducir dependencia de la IA local): esto es ambientación puramente descriptiva
/// sobre un puñado de hechos ya limitados (región, hora del día), el caso ideal para sustituir por
/// una banca de fragmentos pre-escritos combinados al azar — cero llamada a Ollama, cero latencia,
/// cero riesgo de alucinación (el bug real del 2026-07-24: el modelo llegó a narrar en chino a
/// medio párrafo), y más grounded que la prosa libre anterior porque solo cita fauna/terreno real
/// del catálogo, nunca inventa nada nuevo. Sustituye tanto la llamada a `ollamaGenerate` como el
/// RAG de lore que la alimentaba (`retrieveLore` en la ruta) — ya no hace falta ninguno de los dos.

export interface SurroundingsContext {
  region: string | null;
  timeLabel: string;
}

export interface SurroundingsResult {
  description: string;
}

type FranjaHoraria = 'madrugada' | 'manana' | 'mediodia' | 'tarde' | 'atardecer' | 'noche';

function franjaHorariaFor(hour: number): FranjaHoraria {
  if (hour < 6) return 'madrugada';
  if (hour < 11) return 'manana';
  if (hour < 13) return 'mediodia';
  if (hour < 18) return 'tarde';
  if (hour < 20) return 'atardecer';
  return 'noche';
}

/// "Día N, HH:MM" (worldClock.ts) — con fallback al mediodía si algún día el formato cambiara o
/// llegara el placeholder antiguo ("Día 1, mañana") de una partida muy vieja sin WorldState todavía.
function hourFromTimeLabel(timeLabel: string): number {
  const match = timeLabel.match(/(\d{2}):(\d{2})/);
  return match ? Number(match[1]) : 12;
}

interface RegionBank {
  terreno: string[];
  porFranja: Record<FranjaHoraria, string[]>;
  fauna: string[];
}

// Única región con núcleo jugable real hoy (Gorhorn) — banca amplia y grounded en el catálogo real
// (worldCatalog.ts): arena/polvo rojo, juncos rojizos de las charcas estacionales, Cruzavientos,
// Corredores de Cauce, Gargantúa de Ceniza, Múrgol.
const LLANURAS_DEL_VIENTO_ROJO: RegionBank = {
  terreno: [
    'La arena roja se extiende bajo sus pies, con polvo fino levantándose a cada paso.',
    'El viento arrastra volutas bajas de polvo rojo sobre la llanura abierta.',
    'La tierra agrietada por el sol cruje bajo las botas, roja hasta donde alcanza la vista.',
    'A lo lejos, los juncos rojizos de alguna charca estacional se doblan con el viento.',
    'El suelo de arcilla endurecida resuena hueco con cada paso sobre la llanura.',
  ],
  porFranja: {
    madrugada: [
      'El cielo apenas clarea, gris y frío, con las últimas estrellas todavía visibles.',
      'El frío de la madrugada se pega a la piel — todavía falta un rato para que el sol caliente algo.',
    ],
    manana: [
      'El sol de la mañana pega bajo y de lado, alargando cada sombra sobre la arena.',
      'La luz de la mañana es todavía suave, sin el peso del calor que traerá el resto del día.',
    ],
    mediodia: [
      'El sol cae casi a plomo, sin apenas una sombra que valga la pena buscar.',
      'El calor del mediodía aprieta de verdad — el aire tiembla sobre la arena en el horizonte.',
    ],
    tarde: [
      'El calor de la tarde tiembla sobre la arena, deformando el horizonte a lo lejos.',
      'La luz de la tarde tiñe la arena de un rojo todavía más intenso que de costumbre.',
    ],
    atardecer: [
      'El cielo se tiñe de un naranja profundo, casi del mismo color que la propia arena.',
      'El sol se hunde despacio en el horizonte, dejando el cielo rasgado de rojo y violeta.',
    ],
    noche: [
      'Las estrellas cubren un cielo despejado, sin ninguna luz que las opaque.',
      'La noche trae un frío seco muy distinto al calor del día — el silencio pesa sobre la llanura.',
    ],
  },
  fauna: [
    'Un Cruzavientos traza círculos altos, aprovechando alguna corriente de aire caliente.',
    'A lo lejos, un pequeño grupo de Corredores de Cauce cruza corriendo, levantando su propia estela de polvo.',
    'Se oye, lejano y grave, lo que podría ser el bramido de una Gargantúa de Ceniza.',
    'Un rebaño de Múrgol pasta tranquilo no muy lejos, ajeno a todo lo demás.',
    'El silencio solo lo rompe el viento — ni rastro de fauna cerca, por ahora.',
  ],
};

// Regiones fuera del núcleo jugable actual (solo Llanuras/Gorhorn, "alcance v1") — banca más
// ligera pero igual de grounded en el lore ya establecido de cada una, para cuando algún día se
// abran. Nunca se inventa nada que no esté ya en la documentación del mundo.
const OTRAS_REGIONES: Record<string, RegionBank> = {
  'Cristal Helado': {
    terreno: ['El hielo cruje bajo cada paso, azulado allí donde el sol logra atravesarlo.'],
    porFranja: {
      madrugada: ['El frío de la madrugada corta como un filo, incluso a través de las pieles.'],
      manana: ['La luz de la mañana se refracta en mil destellos sobre el hielo.'],
      mediodia: ['El sol de mediodía apenas calienta nada aquí — el frío nunca cede del todo.'],
      tarde: ['El viento helado de la tarde no da tregua.'],
      atardecer: ['El cielo se tiñe de un azul casi blanco mientras cae la tarde.'],
      noche: ['La noche trae un frío todavía más duro, bajo un cielo despejado y helado.'],
    },
    fauna: ['El silencio del hielo apenas se rompe, salvo por el propio viento.'],
  },
  'Ciénaga Troncal': {
    terreno: ['El terreno cenagoso se hunde ligeramente con cada paso, húmedo y denso.'],
    porFranja: {
      madrugada: ['Una niebla espesa cubre la ciénaga a esta hora, apenas se ve más allá de unos pasos.'],
      manana: ['La humedad de la mañana se pega a la piel, densa y pesada.'],
      mediodia: ['El calor húmedo del mediodía hace que el aire mismo pese.'],
      tarde: ['El aire de la tarde sigue cargado de humedad, sin apenas viento que lo mueva.'],
      atardecer: ['La luz del atardecer apenas atraviesa la densa vegetación de la ciénaga.'],
      noche: ['La noche en la ciénaga trae sonidos propios, húmedos y constantes.'],
    },
    fauna: ['Algo se mueve entre la vegetación cenagosa, sin llegar a mostrarse del todo.'],
  },
  'El Margen Silencioso': {
    terreno: ['El bosque se cierra en torno al camino, denso y silencioso.'],
    porFranja: {
      madrugada: ['La luz apenas se filtra entre las copas a esta hora.'],
      manana: ['Un silencio espeso cubre el bosque esta mañana.'],
      mediodia: ['La luz del mediodía apenas llega al suelo, filtrada por las copas.'],
      tarde: ['Las sombras se alargan entre los árboles según avanza la tarde.'],
      atardecer: ['El bosque se oscurece antes de tiempo bajo la espesura de las copas.'],
      noche: ['El Margen Silencioso hace honor a su nombre bajo la noche cerrada.'],
    },
    fauna: ['El silencio del bosque solo lo rompe, de cuando en cuando, un crujido lejano.'],
  },
  'La Meseta del Orden': {
    terreno: ['La meseta se extiende llana y ordenada, marcada por la mano de la Concordia de Hierro.'],
    porFranja: {
      madrugada: ['El aire frío de la madrugada cubre la meseta en calma.'],
      manana: ['La luz de la mañana ilumina la meseta con claridad.'],
      mediodia: ['El sol de mediodía cae de lleno sobre la meseta abierta.'],
      tarde: ['La tarde avanza tranquila sobre la meseta.'],
      atardecer: ['El atardecer tiñe la meseta de tonos cálidos.'],
      noche: ['La noche cubre la meseta en un silencio ordenado, casi vigilado.'],
    },
    fauna: ['Apenas se oye nada fuera de lo que la propia Concordia de Hierro ha dispuesto aquí.'],
  },
};

const SIN_UBICACION: RegionBank = {
  terreno: ['El terreno alrededor no tiene nada que llame especialmente la atención ahora mismo.'],
  porFranja: {
    madrugada: ['La madrugada está fría y en calma.'],
    manana: ['La mañana avanza tranquila.'],
    mediodia: ['El sol está alto, en pleno mediodía.'],
    tarde: ['La tarde transcurre sin sobresaltos.'],
    atardecer: ['El día empieza a caer.'],
    noche: ['La noche ha cerrado del todo.'],
  },
  fauna: [],
};

function bankFor(region: string | null): RegionBank {
  if (!region) return SIN_UBICACION;
  if (region === 'Las Llanuras del Viento Rojo') return LLANURAS_DEL_VIENTO_ROJO;
  return OTRAS_REGIONES[region] ?? SIN_UBICACION;
}

function pick<T>(items: T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}

const MAX_INTENTOS_ANTIRREPETICION = 5;

/// Bug real jugando en vivo (revisión de partida 2026-08-08): con solo 2 frases por franja horaria
/// y una tirada `random()` independiente en cada llamada, repetir la misma frase 3 de cada 4 veces
/// es simplemente lo esperable estadísticamente — no hay memoria de "qué se mostró la última vez",
/// a diferencia de la narración de combate (que sí tiene anti-repetición con reintento, ver
/// `tarkor_antirepeticion_reintento_2026-07-31`). `previousDescription` (el texto del último
/// `LogEntry` de canal MUNDO, ya lo tenía a mano `routes/entorno.ts`) permite volver a tirar unas
/// pocas veces si sale idéntico al de la vez anterior — barato (nunca llama a Ollama, es solo
/// re-tirar el propio dado determinista), y con bancas de 2-5 frases 5 intentos prácticamente
/// garantizan una frase distinta sin arriesgarse a un bucle infinito si algún día la banca se queda
/// en 1 sola frase.
export function generateSurroundings(
  ctx: SurroundingsContext,
  random: () => number = Math.random,
  previousDescription?: string | null,
): SurroundingsResult {
  const bank = bankFor(ctx.region);
  const franja = franjaHorariaFor(hourFromTimeLabel(ctx.timeLabel));
  let description = '';
  for (let intento = 0; intento < MAX_INTENTOS_ANTIRREPETICION; intento++) {
    const parts = [pick(bank.terreno, random), pick(bank.porFranja[franja], random)];
    // Mención de fauna/sonido solo 1 de cada 2 veces — que no salga SIEMPRE un animal de por medio
    // es parte de lo que hace creíble la ambientación (mismo criterio que el resto del motor: nunca
    // forzar una señal en todos los turnos si en la vida real no siempre habría algo que ver/oír).
    if (bank.fauna.length > 0 && random() < 0.5) parts.push(pick(bank.fauna, random));
    description = parts.filter((p): p is string => !!p).join(' ');
    if (description !== previousDescription) break;
  }
  return { description };
}
