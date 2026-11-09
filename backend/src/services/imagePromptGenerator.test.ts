import { describe, it, expect, vi, beforeEach } from 'vitest';

/// IMG-50: el prompt lo escribe el modelo local (Ollama) y el código pone las partes fijas de `mundo.json`.
const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({ ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args) }));

const { generateImagePrompt, validarPrompt, limpiarCuerpo, colaFija, encuadreFijo, cargarMundo } = await import('./imagePromptGenerator.js');

const CUERPO =
  'A lean red canine with the build of a maned wolf, only gaunter and wilder, its legs twice the length of its body. A crest of rust-red fur runs from the brow down to the shoulders. It stands in profile with the head turned three-quarters to the camera, both eyes and both ears showing. Dry straw-yellow grass covers the ground, low scrub fills the middle distance and volcanic peaks rise far off in a warm haze. Warm light comes low from the left.';

describe('IMG-50 — generateImagePrompt con el modelo local', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
    delete process.env.IMAGE_PROMPT_MODEL;
    // IMG-54, paso 6: estos tests son del camino del párrafo (pautas v5.3); la plantilla por capas se prueba en imagePromptCapas.test.ts.
    process.env.IMAGE_PROMPT_PLANTILLA = 'v53';
  });

  it('al modelo le llega «animal», no el nombre interno «fauna»', async () => {
    ollamaGenerate.mockResolvedValue({ text: CUERPO, raw: {} });
    await generateImagePrompt('fauna', 'Múrgol', 'Ganado lanudo, el macho.', 'banner');
    expect(ollamaGenerate.mock.calls[0][0].prompt).toContain('Kind: animal, male');
  });

  it('las reglas dan la forma de las frases sin contenido que el modelo pueda copiar a otro animal', async () => {
    // Prueba real con el múrgol (2026-11-07): un animal lanudo y voluminoso salió «a maned wolf» de patas largas.
    ollamaGenerate.mockResolvedValue({ text: CUERPO, raw: {} });
    await generateImagePrompt('fauna', 'Múrgol', 'Ganado lanudo y voluminoso.', 'banner');
    const { system } = ollamaGenerate.mock.calls[0][0];
    for (const copiado of ['maned wolf', 'gaunter', 'twice the length', 'bone grey', 'rust-red', 'from the brow']) {
      expect(system).not.toContain(copiado);
    }
    expect(system).toContain('Everything about the subject comes from its lore');
  });

  it('en ningún tipo quedan en las reglas ejemplos que el modelo copia tal cual', async () => {
    // IMG-50, paso 3: «warm light low from the left» en 4 de 4 prompts, y la capa de la pauta de npc en un Goirnte.
    ollamaGenerate.mockResolvedValue({ text: CUERPO, raw: {} });
    for (const tipo of ['fauna', 'flora', 'location', 'item', 'npc', 'raza', 'personaje'] as const) {
      ollamaGenerate.mockClear();
      await generateImagePrompt(tipo, 'Sujeto', 'x', 'banner');
      const { system } = ollamaGenerate.mock.calls[0][0];
      for (const copiado of ['warm light low', 'a soft even glow', 'heavy-set', 'seven heads', 'three heads', 'hide cape', 'laced at the chest']) {
        expect(system).not.toContain(copiado);
      }
      expect(system).toContain('Write only what the eye sees');
      expect(system).toContain('the plain English word for the common noun');
    }
  });

  it('«grows from the skin» solo llega a criaturas y personas', async () => {
    // Paso 3: «dull metallic grey growing from the skin» en un hacha de hierro.
    ollamaGenerate.mockResolvedValue({ text: CUERPO, raw: {} });
    const sistemaDe = async (tipo: 'fauna' | 'raza' | 'npc' | 'item' | 'flora' | 'location') => {
      ollamaGenerate.mockClear();
      await generateImagePrompt(tipo, 'Sujeto', 'x', 'banner');
      return ollamaGenerate.mock.calls[0][0].system as string;
    };
    for (const tipo of ['fauna', 'raza', 'npc'] as const) expect(await sistemaDe(tipo)).toContain('grows from the skin');
    for (const tipo of ['item', 'flora', 'location'] as const) expect(await sistemaDe(tipo)).not.toContain('grows from the skin');
  });

  it('llama a Ollama con el modelo de OpenCode, lo descarga al acabar y monta encuadre + cuerpo + estilo fotorreal en el banner', async () => {
    ollamaGenerate.mockResolvedValue({ text: CUERPO, raw: {} });
    const { prompt, provider } = await generateImagePrompt('fauna', 'Aullador Rojo', 'Lobo de las llanuras.', 'banner', { region: 'Llanuras del Viento Rojo' });
    const opciones = ollamaGenerate.mock.calls[0][0];
    expect(opciones).toMatchObject({ model: 'qwen35-9b-32k', keepAlive: '0', numCtx: 32768, tarea: 'image-prompt' });
    expect(provider).toBe('ollama:qwen35-9b-32k');
    const mundo = cargarMundo();
    expect(prompt.startsWith(mundo.encuadres.fotorreal)).toBe(true);
    expect(prompt).toContain(CUERPO);
    expect(prompt).toContain('Style: photorealistic fantasy matte painting');
    expect(prompt).toMatch(/35mm lens\. The image is completely textless\.$/);
    // Fotorreal (IMG-16) va sin preámbulo.
    expect(prompt).not.toContain(mundo.preambulo.dia);
    // El modelo recibe el lore y el paisaje de la región, y se le prohíbe el nombre propio.
    expect(opciones.prompt).toContain('Lobo de las llanuras.');
    expect(opciones.prompt).toContain('a vast red clay steppe');
    expect(opciones.prompt).toContain('never write this name');
  });

  it('el icono lleva el estilo al óleo y el preámbulo del momento, y la noche se deduce del lore', async () => {
    ollamaGenerate.mockResolvedValue({ text: 'A tall stone tower stands on a dark plain under a soft, even pearly glow.', raw: {} });
    const { prompt } = await generateImagePrompt('location', 'Torre', 'Es de noche: la torre vigila.', 'icono', { conMomento: true });
    const mundo = cargarMundo();
    expect(prompt).toContain('Oil painting with visible brushstrokes');
    expect(prompt.endsWith(mundo.preambulo.noche)).toBe(true);
  });

  it('IMAGE_PROMPT_MODEL cambia el modelo', async () => {
    process.env.IMAGE_PROMPT_MODEL = 'otro:7b';
    ollamaGenerate.mockResolvedValue({ text: CUERPO, raw: {} });
    const { provider } = await generateImagePrompt('fauna', 'Aullador', 'x', 'banner');
    expect(ollamaGenerate.mock.calls[0][0].model).toBe('otro:7b');
    expect(provider).toBe('ollama:otro:7b');
  });

  it('si el cuerpo rompe una regla, reintenta una vez diciéndole al modelo qué rompió', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({ text: 'The Aullador Rojo howls under the moon, with no fear.', raw: {} })
      .mockResolvedValueOnce({ text: CUERPO, raw: {} });
    const { prompt } = await generateImagePrompt('fauna', 'Aullador Rojo', 'x', 'banner');
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
    const segunda = ollamaGenerate.mock.calls[1][0];
    expect(segunda.intento).toBe(2);
    expect(segunda.prompt).toMatch(/«moon»/);
    expect(segunda.prompt).toMatch(/negation «no»/);
    expect(segunda.prompt).toMatch(/proper name «Aullador Rojo»/);
    expect(prompt).toContain(CUERPO);
  });

  it('si el reintento también falla, lanza el error con los motivos', async () => {
    ollamaGenerate.mockResolvedValue({ text: 'A wolf under the moonlight.', raw: {} });
    await expect(generateImagePrompt('fauna', 'Aullador', 'x', 'banner')).rejects.toThrow(/moonlight/);
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });
});

describe('IMG-50 — validarPrompt (reglas 3, 4, 5, 7 y 9 de la plantilla)', () => {
  const base = { nombre: 'Ash', momento: 'dia' as const, perfil: 'banner' as const };

  it('las partes fijas de cada perfil y momento pasan solas', () => {
    const mundo = cargarMundo();
    for (const perfil of ['banner', 'thumbnail', 'icono', 'mapa'] as const) {
      for (const momento of ['dia', 'noche'] as const) {
        const fijo = `${encuadreFijo(mundo, perfil)} ${colaFija(mundo, perfil, 'fauna', momento)}`;
        expect(validarPrompt(fijo, { ...base, perfil, momento })).toEqual([]);
      }
    }
  });

  it('el nombre salta como palabra entera, sin distinguir mayúsculas', () => {
    expect(validarPrompt('a field of ashes', base)).toEqual([]);
    expect(validarPrompt('the ash stands', base)[0]).toMatch(/proper name «Ash»/);
  });

  it('los nombres de razas y regiones saltan, también calcados al inglés, y sus palabras sueltas no', () => {
    // Paso 3: «A male Goirnte» y «hints of the Red Wind Plains» pasaban el validador.
    for (const nombre of ['A male Goirnte stands', 'two Nabieus', 'hints of the Red Wind Plains', 'the Meseta del Orden', 'a frozen crystal range']) {
      expect(validarPrompt(nombre, base)[0]).toMatch(/nombre propio del mundo/);
    }
    for (const paisaje of ['a vast red clay steppe', 'fine red dust on the wind', 'a dense swamp of tangled trunks', 'terraces in strict order']) {
      expect(validarPrompt(paisaje, base)).toEqual([]);
    }
  });

  it('las estrellas de día y el sol de noche no casan con el momento', () => {
    expect(validarPrompt('bright stars overhead', base)[0]).toMatch(/«stars».*dia/);
    expect(validarPrompt('warm sunlight', { ...base, momento: 'noche' })[0]).toMatch(/«sunlight».*noche/);
  });

  it('pasarse del máximo de palabras es error; quedarse corto, no', () => {
    expect(validarPrompt('word '.repeat(521), base)[0]).toMatch(/more than the maximum of 520/);
    expect(validarPrompt('word '.repeat(321), { ...base, perfil: 'icono' })[0]).toMatch(/maximum of 320/);
    expect(validarPrompt('short', base)).toEqual([]);
  });
});

describe('IMG-50 — limpiarCuerpo', () => {
  it('quita comillas, etiquetas, medidas y las partes fijas que repita el modelo, y sanea lo explícito', () => {
    const sucio = '"Subject: A wolf with blood on its fur, 16:9 aspect ratio, 1024x576 px. The image is completely textless. Style: oil painting."';
    expect(limpiarCuerpo(sucio)).toBe('A wolf with dark stains on its fur.');
  });
});
