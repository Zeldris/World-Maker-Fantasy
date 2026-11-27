import { afterEach, describe, expect, it, vi } from 'vitest';

describe('env', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sin OLLAMA_MODEL_EMBEDDINGS, los hechos del mundo usan el mismo modelo que el lore: bge-m3 (QA-523)', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://x@localhost/x');
    vi.stubEnv('OLLAMA_MODEL_EMBEDDINGS', undefined);
    vi.resetModules();
    const { env } = await import('./env.js');
    const { configRag } = await import('../lib/ragConfig.js');
    expect(env.ollamaModelEmbeddings).toBe('bge-m3');
    expect(configRag({}).modelo).toBe(env.ollamaModelEmbeddings);
  });
});
