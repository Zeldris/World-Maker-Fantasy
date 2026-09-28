function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (revisa tu .env, ver .env.example)`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required('DATABASE_URL'),

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  ollamaModelNarrador: process.env.OLLAMA_MODEL_NARRADOR ?? 'tarkor-narrador-llama31',
  ollamaModelCronista: process.env.OLLAMA_MODEL_CRONISTA ?? 'qwen2.5:1.5b-instruct',
  /// Modelo propio para "Sugerir" (petición explícita, 2026-08-21: "el 4b solo para sugerencias no
  /// puede ser una opción?") — separado a propósito de `ollamaModelNarrador`, que sigue siendo el
  /// único que narra turnos reales. Verificado en vivo el mismo día contra la partida real: calidad
  /// comparable al 7B en esta tarea concreta, con `think: false` (ollama.ts) evitando que el modo
  /// de razonamiento de la familia qwen3.5 se coma el timeout entero sin responder.
  ollamaModelSugerencias: process.env.OLLAMA_MODEL_SUGERENCIAS ?? 'qwen3.5:4b',
  ollamaModelEmbeddings: process.env.OLLAMA_MODEL_EMBEDDINGS ?? 'nomic-embed-text',
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE ?? '5m',

  // El .env real de la usuaria ya lo tenía bajado a 2 (roadmap 2026-07-20/21) — este default de
  // código solo importa para un checkout nuevo sin `.env` todavía, así que se alinea al mismo
  // valor ya validado en vez de quedarse en el 20 original de `.env.example` (auditoría 2026-07-24).
  worldTickIntervalMinutes: Number(process.env.WORLD_TICK_INTERVAL_MINUTES ?? 2),

  /// Compresión de tiempo para acciones extendida/larga (hallazgo del roadmap 2026-07-19: con el
  /// grafo real de docs/12, un viaje interno normal ya son 83-248 min de ficción, y `busyUntil`
  /// los mapeaba 1:1 a minutos REALES — bloqueaba la partida esas mismas horas de verdad,
  /// haciendo matemáticamente imposible una sesión fluida de 1h que incluya un solo viaje.
  /// Por defecto 1h de ficción = 3 min reales (ratio 20). Solo afecta cuánto se espera de
  /// verdad — el reloj ficticio (worldClock.ts) sigue avanzando el total real de minutos de
  /// ficción, sin comprimir.
  fictionMinutesPerRealMinute: Number(process.env.FICTION_MINUTES_PER_REAL_MINUTE ?? 20),

  /// Techo duro de espera real para una acción extendida/larga (roadmap 2026-07-20, Fable —
  /// "control de acciones"): red de seguridad de producto independiente de la causa del fallo.
  /// Antes de esto, un fallo de clasificación (el Cronista devolviendo una duración disparatada,
  /// sea cual sea el motivo) podía dejar a la jugadora atascada horas reales sin ningún límite —
  /// pasó de verdad jugando (3,6h reales por una simple ronda de exploración). 30 min como punto
  /// de partida, ajustable sin tocar código.
  transitMaxRealMinutes: Number(process.env.TRANSIT_MAX_REAL_MINUTES ?? 30),

  /// Espera real de un VIAJE (no de otras acciones largas) por número de tramos cruzados, no por
  /// `minutosBase` de ficción acumulado (petición explícita, 2026-08-31: "minimo tiempo de viaje 1
  /// min... cada punto suma segundos... hasta un maximo de 5mins" — con el grafo real, un solo
  /// tramo largo, hasta 360 min de ficción, ya daba 18 min reales con la fórmula vieja de
  /// `fictionMinutesPerRealMinute`, sin llegar nunca a tocar `transitMaxRealMinutes` — la espera
  /// real de un viaje tenía que depender de CUÁNTAS zonas se cruzan, no de lo narrativamente largo
  /// que sea un tramo). Solo gobierna la espera real — `minutosBase`/`fictionalMinutes` del viaje
  /// siguen intactos para la banda de tirada y el reloj de ficción (ver travel.ts).
  travelSegundosPrimerTramo: Number(process.env.TRAVEL_SEGUNDOS_PRIMER_TRAMO ?? 60),
  travelSegundosPorTramoExtra: Number(process.env.TRAVEL_SEGUNDOS_POR_TRAMO_EXTRA ?? 30),
  travelSegundosMaximos: Number(process.env.TRAVEL_SEGUNDOS_MAXIMOS ?? 5 * 60),

  /// Eventos de viaje interactivos (2026-08-05, petición explícita: "que las esperas entre los
  /// movimientos de zonas sean más dinámicas"): probabilidad, por CADA nodo intermedio de un
  /// viaje extendida/larga, de que ese tramo interrumpa el viaje con un encuentro real (ver
  /// travelInterruption.ts). Un viaje de más tramos tiene más tiradas independientes, no una
  /// probabilidad mayor por tramo — así "más largo = más posibilidades" sale solo. Valor inicial
  /// conservador, ajustable sin tocar código.
  travelInterruptionProbabilityPerSegment: Number(process.env.TRAVEL_INTERRUPTION_PROBABILITY_PER_SEGMENT ?? 0.18),

  /// Grupo 3 § Mundo determinista, Capa 2 (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25) —
  /// mismo criterio que la de arriba pero para acciones largas SIN desplazamiento (descansar,
  /// construir, crafteo): probabilidad, por cada bloque de tiempo de la acción, de que algo real
  /// (fauna/NPC ya sembrado como `ZonePoint`, Capa 1) interrumpa — solo puede disparar en zonas con
  /// `ZonePoint` real, hoy únicamente La Hondonada del Eco, ver stationaryInterruption.ts.
  stationaryInterruptionProbabilityPerChunk: Number(process.env.STATIONARY_INTERRUPTION_PROBABILITY_PER_CHUNK ?? 0.18),

  /// API de prompts de imagen (checklist 2026-07-21/22, punto 7): rotación con failover entre
  /// proveedores cloud gratuitos (mismo patrón que AiOrchestrator de VeriNews_AI), con Ollama
  /// como último fallback local si ninguno tiene clave o todos fallan — la funcionalidad nunca
  /// depende de tener claves configuradas. Claves propias de Tarkor, NUNCA las mismas que
  /// VeriNews_AI (cuota reservada para esa app, instrucción explícita de la usuaria 2026-07-21).
  cerebrasApiKey: process.env.CEREBRAS_API_KEY ?? '',
  cerebrasModel: process.env.CEREBRAS_MODEL ?? 'gpt-oss-120b',
  mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
  mistralModel: process.env.MISTRAL_MODEL ?? 'mistral-large-latest',
  sambanovaApiKey: process.env.SAMBANOVA_API_KEY ?? '',
  sambanovaModel: process.env.SAMBANOVA_MODEL ?? 'DeepSeek-V3.1',
  /// Cloudflare Workers AI cuelga las rutas del account id, no solo de la API key.
  cloudflareApiKey: process.env.CLOUDFLARE_API_KEY ?? '',
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
  cloudflareModel: process.env.CLOUDFLARE_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  /// Gemini (2026-08-07, plan "IA local propia") — API propia (no OpenAI-compatible, formato
  /// generateContent de Google), añadida a la rotación tanto de prompts de imagen como del script
  /// de destilación. Soporta responseSchema (JSON forzado por schema de verdad, no solo "modo
  /// JSON" instruido) — el único proveedor de la rotación con esa garantía aparte de Ollama local.
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  // 'gemini-flash-latest' en vez de fijar una versión (probado en vivo, 2026-08-07: la cuenta
  // recién creada de la usuaria no tenía acceso a 'gemini-2.5-flash' — "no longer available to
  // new users" — pese a aparecer listado; el alias -latest evita depender de qué versión concreta
  // esté disponible para una clave nueva en cada momento).
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
  /// Groq (2026-08-07) — OpenAI-compatible, aloja modelos open-weight (Llama 3.3 70B) a velocidad
  /// muy alta con tier gratuito generoso. Buen candidato para ampliar la rotación sin depender
  /// tanto de la cuota de Mistral/SambaNova.
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',

  /// Captura en vivo para el pipeline DPO (plan "IA local propia", fase 2 — pares de preferencia
  /// chosen/rejected, en paralelo al pipeline SFT existente) — apagado por defecto: nunca se llama
  /// a un proveedor cloud durante partidas reales salvo que se active explícitamente (consume la
  /// MISMA cuota gratuita compartida con generate-distillation-dataset.ts).
  liveTeacherCaptureEnabled: (process.env.LIVE_TEACHER_CAPTURE_ENABLED ?? 'false') === 'true',
  /// Fracción de turnos narrados por el modelo local que además disparan una captura en segundo
  /// plano (0 a 1). 0.3 por defecto: suficiente densidad de pares DPO sin agotar la cuota gratuita
  /// de los proveedores cloud en una sesión larga de juego.
  liveTeacherCaptureSampleRate: Number(process.env.LIVE_TEACHER_CAPTURE_SAMPLE_RATE ?? 0.3),
};
