import { describe, it, expect, vi } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
  ollamaGenerateStream: vi.fn(),
}));
const registrarLlamada = vi.fn();
vi.mock('../lib/iaRegistro.js', () => ({ registrarLlamada: (...args: unknown[]) => registrarLlamada(...args) }));

describe('QA-510: las filas rechazo del registro llevan prompt_chars', () => {
  it('cada rechazo apunta los caracteres del prompt de su intento (el reintento es más largo: lleva el motivo)', async () => {
    ollamaGenerate.mockReset();
    registrarLlamada.mockReset();
    const mala = JSON.stringify({ narration: 'Gorhorn mira the river con calma.', newFacts: [] });
    ollamaGenerate.mockResolvedValueOnce({ text: mala }).mockResolvedValueOnce({ text: mala }).mockResolvedValue({ text: JSON.stringify({ narration: 'Gorhorn otea el paso.', newFacts: [] }) });
    const { narrateAction } = await import('./narrador.js');
    await narrateAction({ worldFacts: ['Hecho A.'], characterSummary: 'Gorhorn, orco.', characterName: 'Gorhorn', action: 'Miro el paso' } as unknown as Parameters<typeof narrateAction>[0]);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    const filas = registrarLlamada.mock.calls.map((c) => c[0] as { evento: string; intento: number; promptChars?: number });
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ evento: 'rechazo', intento: 1, promptChars: prompts[0]!.length + 1 });
    expect(filas[1]).toMatchObject({ evento: 'rechazo', intento: 2, promptChars: prompts[1]!.length + 1 });
    expect(filas[1]!.promptChars).toBeGreaterThan(filas[0]!.promptChars!);
  });
});
