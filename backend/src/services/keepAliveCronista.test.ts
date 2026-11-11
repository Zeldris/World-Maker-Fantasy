import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/// QA-308: keep_alive y num_ctx son del modelo cargado; todas las llamadas al Cronista usan el mismo valor (30m),
/// o Ollama lo recarga tras 5 min sin uso (6-7 s por turno). `clasificar` y `narrar_respaldo` viven en narrador.ts.
describe('keep_alive del Cronista (QA-308)', () => {
  it('vale 30m por defecto (sin OLLAMA_KEEP_ALIVE_CRONISTA) y respeta la variable si existe', async () => {
    const previo = process.env.OLLAMA_KEEP_ALIVE_CRONISTA;
    try {
      delete process.env.OLLAMA_KEEP_ALIVE_CRONISTA;
      vi.resetModules();
      expect((await import('../config/env.js')).env.ollamaKeepAliveCronista).toBe('30m');
      process.env.OLLAMA_KEEP_ALIVE_CRONISTA = '2h';
      vi.resetModules();
      expect((await import('../config/env.js')).env.ollamaKeepAliveCronista).toBe('2h');
    } finally {
      if (previo === undefined) delete process.env.OLLAMA_KEEP_ALIVE_CRONISTA;
      else process.env.OLLAMA_KEEP_ALIVE_CRONISTA = previo;
      vi.resetModules();
    }
  });

  it('clasificar y narrar_respaldo mandan la constante del Cronista, no un literal', () => {
    const fuente = readFileSync(new URL('./narrador.ts', import.meta.url), 'utf8');
    const bloques = fuente.split('ollamaGenerate({').slice(1).map((b) => b.slice(0, b.indexOf('});')));
    const cronista = bloques.filter((b) => b.includes('env.ollamaModelCronista'));
    expect(cronista.length).toBeGreaterThanOrEqual(2);
    for (const b of cronista) expect(b).toContain('keepAlive: env.ollamaKeepAliveCronista');
  });
});
