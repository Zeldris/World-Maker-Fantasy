import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

/// QA-308: keep_alive y num_ctx son del modelo cargado; todas las llamadas al Cronista usan el mismo valor (30m),
/// o Ollama lo recarga tras 5 min sin uso (6-7 s por turno). `clasificar` y `narrar_respaldo` viven en narrador.ts.
describe('keep_alive del Cronista (QA-308)', () => {
  it('vale 30m por defecto', () => {
    expect(env.ollamaKeepAliveCronista).toBe(process.env.OLLAMA_KEEP_ALIVE_CRONISTA ?? '30m');
  });

  it('clasificar y narrar_respaldo mandan la constante del Cronista, no un literal', () => {
    const fuente = readFileSync(new URL('./narrador.ts', import.meta.url), 'utf8');
    const bloques = fuente.split('ollamaGenerate({').slice(1).map((b) => b.slice(0, b.indexOf('});')));
    const cronista = bloques.filter((b) => b.includes('env.ollamaModelCronista'));
    expect(cronista.length).toBeGreaterThanOrEqual(2);
    for (const b of cronista) expect(b).toContain('keepAlive: env.ollamaKeepAliveCronista');
  });
});
