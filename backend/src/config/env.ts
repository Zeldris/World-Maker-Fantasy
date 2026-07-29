function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (revisa tu .env, ver .env.example)`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required('DATABASE_URL'),

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  ollamaModelNarrador: process.env.OLLAMA_MODEL_NARRADOR ?? 'tarkor-narrador',
  ollamaModelCronista: process.env.OLLAMA_MODEL_CRONISTA ?? 'qwen2.5:1.5b-instruct',
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
};
