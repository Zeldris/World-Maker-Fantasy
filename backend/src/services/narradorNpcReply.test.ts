import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
  ollamaGenerateStream: vi.fn(),
}));

const { generateNpcReply, npcConoceNombreDelJugador } = await import('./narrador.js');

describe('generateNpcReply (fase 1 hacia main, P327)', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ reply: '«¿Qué quieres?»' }) });
  });

  it('con el nombre oculto, el prompt no lleva el nombre real ni el de pila', async () => {
    await generateNpcReply({
      npc: { name: 'Ugrak Tuerto', nombreVisible: 'Orco desconocido', role: 'guardián del paso', personality: 'Ugrak es callado.', bio: 'Ugrak Tuerto guarda el paso.' },
      characterName: 'Gorhorn',
      action: 'Hola, ¿quién eres?',
      sessionFacts: [],
    });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).toContain('PERSONAJE QUE ERES: Orco desconocido');
    expect(prompt).not.toMatch(/Ugrak/);
  });

  it('sin nombre oculto, el prompt lleva su nombre', async () => {
    await generateNpcReply({ npc: { name: 'Ugrak Tuerto', role: 'guardián', personality: '', bio: '' }, characterName: 'Gorhorn', action: 'Hola', sessionFacts: [] });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).toContain('PERSONAJE QUE ERES: Ugrak Tuerto');
  });
});

describe('generateNpcReply y el nombre del jugador (QA-289 fila 2, P266)', () => {
  const npc = { name: 'Ulkha Ketg', role: 'cazadora', personality: '', bio: '' };
  beforeEach(() => {
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ reply: '«¿Qué quieres?»' }) });
  });

  it('sin presentarse, el prompt no lleva el nombre del jugador ni en los hechos ni en la acción', async () => {
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Hola, ¿cazas por aquí?', sessionFacts: ['Gorhorn llega al Paso de los Pilares Rotos.'] });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).not.toMatch(/Gorhorn/);
    expect(prompt).toContain('el forastero llega al Paso');
    expect(prompt).toContain('no sabes cómo se llama');
  });

  it('si se presenta (en la acción o en un hecho que vio), el prompt lleva su nombre', async () => {
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Soy Gorhorn, del clan Maktor.', sessionFacts: [] });
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Hola otra vez', sessionFacts: ['Gorhorn le dice su nombre a Ulkha Ketg.'] });
    for (const call of ollamaGenerate.mock.calls) expect((call[0] as { prompt: string }).prompt).toContain('Gorhorn te acaba de decir');
  });

  it('npcConoceNombreDelJugador: nombrarlo no basta; hace falta presentarse', () => {
    expect(npcConoceNombreDelJugador('Gorhorn', 'Gorhorn saluda', ['Gorhorn camina hacia el norte.'])).toBe(false);
    expect(npcConoceNombreDelJugador('Gorhorn', 'Me llamo Gorhorn', [])).toBe(true);
    expect(npcConoceNombreDelJugador('Gorhorn', 'Hola', ['Gorhorn se presenta ante la cazadora.'])).toBe(true);
    expect(npcConoceNombreDelJugador('Gorhorn', 'Soy Gorhornix', [])).toBe(false);
  });
});
