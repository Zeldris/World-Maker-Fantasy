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
  ollamaModelCronista: process.env.OLLAMA_MODEL_CRONISTA ?? 'llama3.2:latest',
  ollamaModelEmbeddings: process.env.OLLAMA_MODEL_EMBEDDINGS ?? 'nomic-embed-text',
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE ?? '5m',

  worldTickIntervalMinutes: Number(process.env.WORLD_TICK_INTERVAL_MINUTES ?? 20),
};
