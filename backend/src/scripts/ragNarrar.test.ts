import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../lib/embeddings.js', () => ({ embed: vi.fn(), toVectorLiteral: vi.fn() }));

const { armarPromptNarrador, FRASE_LORE_AL_FINAL, leerNarracion, MAX_LORE_CHARS, trozoMasCercano, trozosDelFragmento } = await import('./ragNarrar.js');
const { CONFIG_RAG_POR_DEFECTO } = await import('../lib/ragConfig.js');
const { loreChunks } = await import('./loreChunks.js');
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

/// Líneas que están en uno de los prompts y no en el otro.
const lineasDistintas = (a: string, b: string) => {
  const la = a.split('\n');
  const lb = b.split('\n');
  return [...la.filter((l) => !lb.includes(l)), ...lb.filter((l) => !la.includes(l))];
};

describe('mandos del narrador (QA-360)', () => {
  const sin = armarPromptNarrador(trozos, 'Miro alrededor');

  it('sin mandos (o con todos a su valor de siempre), el prompt es el mismo byte a byte', () => {
    expect(armarPromptNarrador(trozos, 'Miro alrededor', {}).prompt).toBe(sin.prompt);
    expect(armarPromptNarrador(trozos, 'Miro alrededor', { maxLoreChars: MAX_LORE_CHARS, loreAlFinal: false, umbralAnclado: 0.75 })).toEqual(sin);
  });

  it('--max-lore-chars: solo cambia el lore que entra', () => {
    const r = armarPromptNarrador(trozos, 'Miro alrededor', { maxLoreChars: 700 });
    expect(r.lore.map((l) => l.titulo)).toEqual(['Primero']);
    expect(lineasDistintas(sin.prompt, r.prompt)).toEqual([`- Segundo: ${largo}`]);
    const ancho = armarPromptNarrador(trozos, 'Miro alrededor', { maxLoreChars: 100_000 });
    expect(ancho.lore).toHaveLength(4);
    expect(lineasDistintas(sin.prompt, ancho.prompt)).toEqual([`- Tercero: ${largo}`, '- Cuarto: no entra']);
  });

  it('--lore-al-final: el bloque pasa a justo antes de la acción, con su frase; el resto, igual', () => {
    const r = armarPromptNarrador(trozos, 'Miro alrededor', { loreAlFinal: true });
    const bloque = sin.prompt.slice(sin.prompt.indexOf('CONOCIMIENTO DE FONDO DEL MUNDO'), sin.prompt.indexOf('\nRecuerda LORE Y PRESENCIA'));
    expect(r.prompt).toContain(`${bloque}\n${FRASE_LORE_AL_FINAL}\n\nACCIÓN DEL JUGADOR:\n"Miro alrededor"`);
    expect(r.prompt.indexOf('CONOCIMIENTO DE FONDO DEL MUNDO')).toBeGreaterThan(r.prompt.indexOf('HECHOS DEL MUNDO'));
    expect(r.prompt.match(/CONOCIMIENTO DE FONDO DEL MUNDO \(/g)).toHaveLength(1);
    // Quitado el bloque y la frase de su nuevo sitio, y el bloque del viejo, es el mismo prompt.
    const viejo = sin.prompt.replace(`\n\n${bloque}`, '');
    expect(r.prompt.replace(`${bloque}\n${FRASE_LORE_AL_FINAL}\n\n`, '')).toBe(viejo);
    expect(r.lore).toEqual(sin.lore);
  });

  it('--umbral-anclado: solo cambia el párrafo de anclaje, y poco_anclado', () => {
    const r = armarPromptNarrador(trozos, 'Miro alrededor', { umbralAnclado: 0.2 });
    expect(sin.pocoAnclado).toBe(false);
    expect(r.pocoAnclado).toBe(true);
    const distintas = lineasDistintas(sin.prompt, r.prompt);
    expect(distintas).toHaveLength(2);
    expect(distintas.some((l) => l.startsWith('No tenemos hechos específicos'))).toBe(true);
    expect(distintas.some((l) => l.startsWith('Recuerda LORE Y PRESENCIA'))).toBe(true);
    expect(r.lore).toEqual(sin.lore);
    expect(armarPromptNarrador(trozos, 'Miro alrededor', { umbralAnclado: 0.3 }).pocoAnclado).toBe(false);
  });
});

describe('--lore-trozo (QA-360)', () => {
  it('elige el trozo de menor distancia coseno a la consulta, el primero si empatan; null sin trozos', () => {
    const c = [
      { trozo: 'lejos', vector: [0, 1] },
      { trozo: 'cerca', vector: [1, 0.1] },
      { trozo: 'igual', vector: [1, 0.1] },
    ];
    expect(trozoMasCercano(c, [1, 0])).toBe('cerca');
    expect(trozoMasCercano([], [1, 0])).toBeNull();
  });

  it('reconstruye los trozos del fragmento como reindex-lore: el crudo y el texto embebido con título', () => {
    const chunk = loreChunks.find((c) => c.text.length > 800)!;
    const t = trozosDelFragmento(CONFIG_RAG_POR_DEFECTO, chunk.title);
    expect(t.length).toBeGreaterThan(1);
    for (const x of t) {
      expect(x.embebido).toBe(`${chunk.title}\n${x.trozo}`);
      expect(chunk.text).toContain(x.trozo.slice(0, 40));
    }
    expect(trozosDelFragmento(CONFIG_RAG_POR_DEFECTO, 'no existe')).toEqual([]);
  });

  it('con el trozo en el prompt entra el trozo, no el fragmento entero', () => {
    const entero = 'Frase uno. '.repeat(10);
    const r = armarPromptNarrador([trozo('T', 'Frase uno.', 0.2)], 'a');
    expect(r.prompt).toContain('T: Frase uno.\n');
    expect(r.prompt).not.toContain(entero);
  });
});
