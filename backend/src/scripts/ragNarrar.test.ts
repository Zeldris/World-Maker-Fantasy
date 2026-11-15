import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../lib/embeddings.js', () => ({ embed: vi.fn(), toVectorLiteral: vi.fn() }));

const { armarPromptNarrador, leerNarracion, MAX_LORE_CHARS } = await import('./ragNarrar.js');
const { buildNarrationPrompt } = await import('../services/narrador.js');
const { formatLoreForPrompt, isWeaklyGrounded } = await import('../services/retrieval.js');

const trozo = (title: string, text: string, distance: number) => ({ title, text, distance });
const largo = 'x'.repeat(700);
const trozos = [trozo('Primero', 'Texto uno. Con dos frases.', 0.3), trozo('Segundo', largo, 0.5), trozo('Tercero', largo, 0.6), trozo('Cuarto', 'no entra', 0.7)];

describe('armarPromptNarrador (QA-359)', () => {
  it('el lore del prompt es el de `devueltos` recortado por el tope, en su orden: «título: texto»', () => {
    const { prompt, lore } = armarPromptNarrador(trozos, 'Miro alrededor');
    expect(lore.map((l) => l.titulo)).toEqual(['Primero', 'Segundo']);
    expect(lore[0]).toEqual({ titulo: 'Primero', texto: 'Texto uno. Con dos frases.' });
    const posiciones = lore.map((l) => prompt.indexOf(`${l.titulo}: ${l.texto}`));
    expect(posiciones.every((p) => p >= 0)).toBe(true);
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
    expect(prompt).not.toContain('Tercero: ');
    expect(prompt).not.toContain('Cuarto: ');
    // y es lo mismo que formatLoreForPrompt (lo que usa el juego)
    expect(lore.map((l) => `${l.titulo}: ${l.texto}`)).toEqual(formatLoreForPrompt(trozos));
    expect(lore.reduce((n, l) => n + l.titulo.length + 2 + l.texto.length, 0)).toBeLessThanOrEqual(MAX_LORE_CHARS);
  });

  it('el primer trozo siempre entra aunque sea más largo que el tope', () => {
    const { lore } = armarPromptNarrador([trozo('Enorme', 'y'.repeat(MAX_LORE_CHARS * 2), 0.2)], 'a');
    expect(lore).toHaveLength(1);
  });

  it('poco anclado según la distancia del primero (umbral 0,75); sin trozos, también', () => {
    expect(armarPromptNarrador([trozo('A', 't', 0.75)], 'a').pocoAnclado).toBe(false);
    expect(armarPromptNarrador([trozo('A', 't', 0.76)], 'a').pocoAnclado).toBe(true);
    expect(armarPromptNarrador([trozo('A', 't', 0.1), trozo('B', 't', 0.99)], 'a').pocoAnclado).toBe(false);
    expect(armarPromptNarrador([], 'a').pocoAnclado).toBe(true);
    expect(armarPromptNarrador([], 'a').pocoAnclado).toBe(isWeaklyGrounded([]));
  });

  it('el prompt es el que arma el juego con ese contexto mínimo (byte a byte)', () => {
    const esperado = buildNarrationPrompt({
      worldFacts: [],
      characterSummary: '',
      action: 'Miro alrededor',
      backgroundLore: formatLoreForPrompt(trozos),
      weaklyGrounded: false,
    });
    const r = armarPromptNarrador(trozos, 'Miro alrededor');
    expect(r.prompt).toBe(esperado.prompt);
    expect(r.format).toEqual(esperado.format);
    expect(r.prompt).toContain('ACCIÓN DEL JUGADOR:\n"Miro alrededor"');
  });
});

describe('leerNarracion (QA-359)', () => {
  it('el campo narration del JSON; si no parsea o no lo trae, el texto crudo y json_valido false', () => {
    expect(leerNarracion('{"narration":"Hola."}')).toEqual({ texto: 'Hola.', json_valido: true });
    expect(leerNarracion('{"narration":"Cortada')).toEqual({ texto: '{"narration":"Cortada', json_valido: false });
    expect(leerNarracion('{"otra":1}')).toEqual({ texto: '{"otra":1}', json_valido: false });
  });
});
