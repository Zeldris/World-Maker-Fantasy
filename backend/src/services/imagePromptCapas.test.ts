import { describe, it, expect, vi, beforeEach } from 'vitest';

/// IMG-54, paso 6: el banner sale de la plantilla por capas. `montarHibrida` tiene que dar el mismo texto que
/// `prompts_hibrida` de image-generator/scripts/capas.py; los esperados están pegados de correr
/// `python3 image-generator/scripts/capas.py <ficha> --hibrida`.
const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({ ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args) }));

const { montarHibrida, validarCapas, generarCapas, parsearCapas, systemCapas, recortarCorto } = await import('./imagePromptCapas.js');
const { generateImagePrompt } = await import('./imagePromptGenerator.js');

const HULKI_CAPAS = {
  "tamano": "Crouched she is about three of her own heads tall counting the crest, her shoulders two and a half heads wide and her long arms hanging to her knees: lean and hunched, yet with the broad, worn shoulders of someone who has carried prey all her life.",
  "forma": "She looks like a bear standing on its hind legs, only leaner, longer in the arm and more hunched. Her muzzle is short and broad under a heavy brow, and dense fur covers her whole body. Thin overlapping leaves like a willow's grow straight out of her skin along the crown, nape and forearms and rise into a ragged crest above her head; along the forearms they are curled at the tips. Her knuckles are thick and calloused.",
  "viste": "Her only gear is a plaited fibre cord wrapped around her waist and wrists. She wears no tunic and no sandals.",
  "entorno": "Behind her rise huge trunks wrapped in moss and dotted with small mushrooms; deeper back, small platform huts joined by rope bridges hang among the branches, each with a few small windows, in clear, perfectly still air. The closed canopy overhead hides the sky.",
  "color": "Her muzzle has gone silver-grey with age and her eyes glow a soft violet. The dense fur is in the ochre and olive tones of bark and moss; the leaves are olive with dry ochre edges, faded at the tips. The trunks are black, wrapped in green moss, with pale blue-green glowing mushrooms; the planks are weathered brown, and the hut windows glow amber.",
  "paleta": "ochre, olive and moss green with accents of pale blue-green glow",
  "corto": "A single very old, lean female forest beast crouched on bent hind legs on a wooden platform, full length from slightly below, filling the left of the frame. Dim green light filters through the closed canopy, with thin shafts from the upper left on her shoulders. Thin overlapping willow leaves grow straight out of her skin along the crown, nape and forearms and rise into a ragged crest above her head. She looks like a bear standing on its hind legs, only leaner, with long arms hanging to her knees and a short broad muzzle. Fur ochre and olive, muzzle silver-grey, eyes soft violet."
};
const HULKI_ESPERADO =
  "A film still shot on Kodak Vision3 film with a 35mm lens, natural grain, a real actor in realistic prosthetic makeup on location. A single very old, lean female forest beast crouched on bent hind legs on a wooden platform, full length from slightly below, filling the left of the frame. Dim green light filters through the closed canopy, with thin shafts from the upper left on her shoulders. Thin overlapping willow leaves grow straight out of her skin along the crown, nape and forearms and rise into a ragged crest above her head. She looks like a bear standing on its hind legs, only leaner, with long arms hanging to her knees and a short broad muzzle. Fur ochre and olive, muzzle silver-grey, eyes soft violet. Crouched she is about three of her own heads tall counting the crest, her shoulders two and a half heads wide and her long arms hanging to her knees: lean and hunched, yet with the broad, worn shoulders of someone who has carried prey all her life. She looks like a bear standing on its hind legs, only leaner, longer in the arm and more hunched. Her muzzle is short and broad under a heavy brow, and dense fur covers her whole body. Thin overlapping leaves like a willow's grow straight out of her skin along the crown, nape and forearms and rise into a ragged crest above her head; along the forearms they are curled at the tips. Her knuckles are thick and calloused. Her only gear is a plaited fibre cord wrapped around her waist and wrists. She wears no tunic and no sandals. Behind her rise huge trunks wrapped in moss and dotted with small mushrooms; deeper back, small platform huts joined by rope bridges hang among the branches, each with a few small windows, in clear, perfectly still air. The closed canopy overhead hides the sky. Her muzzle has gone silver-grey with age and her eyes glow a soft violet. The dense fur is in the ochre and olive tones of bark and moss; the leaves are olive with dry ochre edges, faded at the tips. The trunks are black, wrapped in green moss, with pale blue-green glowing mushrooms; the planks are weathered brown, and the hut windows glow amber. A limited, muted palette of ochre, olive and moss green with accents of pale blue-green glow. The image is completely textless.";

const MANADEROS_CAPAS = {
  "forma": "Dense clumps of tall reeds with seed heads like cattails stand along every bank and in the shallows, reaching twice the height of the low banks, and threads of algae float in the clear water at their feet. Small dragonflies hover over the water, and the mud between the pools is split into fine, curling plates.",
  "entorno": "On the far horizon, sandstone buttes and flat-topped mesas, about an eighth of the image tall, rise out of a warm haze under a wide, high sky with long thin bands of cloud; fine dust hangs in the far air, softening the distant shapes into layers.",
  "color": "The reeds are reddish with dark seed heads; the algae bright green; the water clear, mirroring the sky; the mud red; the dragonflies red; the buttes and mesas red sandstone; the sky amber and orange over a golden haze.",
  "paleta": "reddish reeds, bright algae green and amber sky",
  "corto": "A chain of shallow, still pools across a flat plain, human eye height, the horizon a third of the way up. A wide foreground pool edged with cracked mud fills the lower third; far pools shrink to thin slivers. Low warm light rakes in from the right through a golden haze, setting the reed tips aglow. The water is perfectly still and mirrors the amber sky. Dense clumps of tall reeds with dark seed heads like cattails stand along every bank, twice the height of the banks, with bright green algae at their feet. Far away, red sandstone buttes in haze."
};
const MANADEROS_ESPERADO =
  "A landscape photograph shot on large-format film, natural grain. A chain of shallow, still pools across a flat plain, human eye height, the horizon a third of the way up. A wide foreground pool edged with cracked mud fills the lower third; far pools shrink to thin slivers. Low warm light rakes in from the right through a golden haze, setting the reed tips aglow. The water is perfectly still and mirrors the amber sky. Dense clumps of tall reeds with dark seed heads like cattails stand along every bank, twice the height of the banks, with bright green algae at their feet. Far away, red sandstone buttes in haze. Dense clumps of tall reeds with seed heads like cattails stand along every bank and in the shallows, reaching twice the height of the low banks, and threads of algae float in the clear water at their feet. Small dragonflies hover over the water, and the mud between the pools is split into fine, curling plates. On the far horizon, sandstone buttes and flat-topped mesas, about an eighth of the image tall, rise out of a warm haze under a wide, high sky with long thin bands of cloud; fine dust hangs in the far air, softening the distant shapes into layers. The reeds are reddish with dark seed heads; the algae bright green; the water clear, mirroring the sky; the mud red; the dragonflies red; the buttes and mesas red sandstone; the sky amber and orange over a golden haze. A limited, muted palette of reddish reeds, bright algae green and amber sky. The image is completely textless.";
const CAPAS_BUENAS = {
  corto:
    'A single heavy beast in full side profile, filling the left of the frame. Low light from the right leaves the far side in shadow. Long curved horns like a ram. Fur brown, horns grey.',
  sujeto: 'A single heavy beast in full side profile.',
  luz: 'Low light from the right, the far side in shadow.',
  tamano: 'It stands twice as tall as the reeds around it.',
  forma: 'The body of a bison on the legs of a horse, with long curved horns like a ram.',
  viste: '',
  entorno: 'Flat ground, scattered reeds, a low ridge on the horizon.',
  color: 'Fur matted brown with dried mud, horns grey and chipped.',
  repetir: '',
  paleta: 'brown, grey and straw with one accent of amber',
};

const JSON_BUENO = JSON.stringify(CAPAS_BUENAS);

describe('IMG-54 — montarHibrida', () => {
  it('da el mismo texto que capas.py --hibrida (npc: Hulki)', () => {
    expect(montarHibrida('npc', HULKI_CAPAS)).toBe(HULKI_ESPERADO);
  });

  it('da el mismo texto que capas.py --hibrida (lugar: Manaderos), con el tipo del backend «zona»', () => {
    expect(montarHibrida('zona', MANADEROS_CAPAS)).toBe(MANADEROS_ESPERADO);
  });

  it('un tipo sin plantilla falla', () => {
    expect(() => montarHibrida('faction', CAPAS_BUENAS)).toThrow(/no tiene el tipo/);
  });
});

describe('IMG-54 — validarCapas', () => {
  const nombre = 'Múrgol';

  it('un bloque bueno no tiene motivos', () => {
    expect(validarCapas(CAPAS_BUENAS, { nombre })).toEqual([]);
  });

  it('rechaza «walrus» porque curva los colmillos', () => {
    const motivos = validarCapas({ ...CAPAS_BUENAS, forma: 'The head of a walrus on the body of a bison.' }, { nombre });
    expect(motivos.join(' ')).toMatch(/«walrus»/);
  });

  it('rechaza un corto de 121 palabras y acepta uno de 120', () => {
    const con = (n: number) => ({ ...CAPAS_BUENAS, corto: Array.from({ length: n }, () => 'word').join(' ') });
    expect(validarCapas(con(121), { nombre }).join(' ')).toMatch(/121 words/);
    expect(validarCapas(con(120), { nombre })).toEqual([]);
  });

  it('admite el color fuera de «color» (la híbrida es foto desde P1) y la negación', () => {
    expect(validarCapas({ ...CAPAS_BUENAS, entorno: 'Flat ground with yellow tufts.' }, { nombre })).toEqual([]);
    expect(validarCapas({ ...CAPAS_BUENAS, forma: 'A long body. No spires, no castles.' }, { nombre })).toEqual([]);
  });

  it('rechaza el nombre propio y las vetadas de mundo.json', () => {
    expect(validarCapas({ ...CAPAS_BUENAS, entorno: 'The Múrgol grazes on flat ground.' }, { nombre }).join(' ')).toMatch(/proper name «Múrgol»/);
    expect(validarCapas({ ...CAPAS_BUENAS, entorno: 'Flat ground under a moonlit sky.' }, { nombre }).join(' ')).toMatch(/moonlit/);
  });

  it('pide las claves obligatorias y que sea un objeto', () => {
    const { paleta: _paleta, ...sinPaleta } = CAPAS_BUENAS;
    expect(validarCapas(sinPaleta, { nombre }).join(' ')).toMatch(/lacks the key "paleta"/);
    expect(validarCapas('texto', { nombre })).toEqual(['is not a JSON object']);
  });
});

describe('IMG-54 — parsearCapas', () => {
  it('tolera  y texto alrededor', () => {
    expect(parsearCapas('Here you go:\n```json\n{"a": "b"}\n```\nDone.')).toEqual({ a: 'b' });
    expect(parsearCapas('sin json')).toBeNull();
    expect(parsearCapas('{roto')).toBeNull();
  });
});

describe('IMG-54 — system prompt', () => {
  it('no trae ejemplos copiables ni nombres de fantasía, y «viste» solo en personas', () => {
    const fauna = systemCapas('fauna');
    for (const copiado of ['walrus', 'bear', 'willow', 'sabre', 'rust']) expect(fauna).not.toContain(copiado);
    expect(fauna).toContain('leave "viste" as ""');
    expect(systemCapas('npc')).not.toContain('leave "viste" as ""');
  });
});

describe('IMG-54 — generarCapas', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
    delete process.env.IMAGE_PROMPT_MODEL;
    delete process.env.IMAGE_PROMPT_PLANTILLA;
  });

  it('reintenta tras un JSON roto y monta el prompt híbrido', async () => {
    ollamaGenerate.mockResolvedValueOnce({ text: '{"corto": "A beast', raw: {} }).mockResolvedValueOnce({ text: '```json\n' + JSON_BUENO + '\n```', raw: {} });
    const { capas, prompt, provider } = await generarCapas('fauna', 'Múrgol', 'Ganado lanudo, el macho.', { region: 'Llanuras del Viento Rojo' });
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
    expect(ollamaGenerate.mock.calls[0][0]).toMatchObject({ keepAlive: '0', numCtx: 32768 });
    expect(ollamaGenerate.mock.calls[0][0].prompt).toContain('Kind: animal, male');
    expect(ollamaGenerate.mock.calls[1][0].prompt).toContain('not valid JSON');
    expect(capas.corto).toBe(CAPAS_BUENAS.corto);
    expect(prompt).toBe(montarHibrida('fauna', CAPAS_BUENAS));
    expect(prompt.startsWith('A wildlife photograph of a real animal taken with a long lens. A single heavy beast')).toBe(true);
    expect(provider).toBe('ollama:qwen35-9b-32k');
  });

  it('reintenta con los motivos si rompe una regla y falla si el segundo intento también', async () => {
    const malo = JSON.stringify({ ...CAPAS_BUENAS, forma: 'The head of a walrus.' });
    ollamaGenerate.mockResolvedValue({ text: malo, raw: {} });
    await expect(generarCapas('fauna', 'Múrgol', 'x')).rejects.toThrow(/walrus/);
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
    expect(ollamaGenerate.mock.calls[1][0].prompt).toContain('«walrus»');
  });

  it('generateImagePrompt usa las capas en el banner de estos tipos y el párrafo en el resto', async () => {
    ollamaGenerate.mockResolvedValue({ text: JSON_BUENO, raw: {} });
    const { prompt } = await generateImagePrompt('crafteo', 'Cuerda', 'x', 'banner');
    expect(prompt).toBe(montarHibrida('item', CAPAS_BUENAS));
    ollamaGenerate.mockClear();
    ollamaGenerate.mockResolvedValue({ text: 'A rope of braided fibre lies coiled on a flat stone.', raw: {} });
    await generateImagePrompt('crafteo', 'Cuerda', 'x', 'thumbnail');
    expect(ollamaGenerate.mock.calls[0][0].system).toContain('descriptive body of a prompt');
    ollamaGenerate.mockClear();
    process.env.IMAGE_PROMPT_PLANTILLA = 'v53';
    await generateImagePrompt('crafteo', 'Cuerda', 'x', 'banner');
    expect(ollamaGenerate.mock.calls[0][0].system).toContain('descriptive body of a prompt');
  });
});

describe('IMG-54 — recortarCorto', () => {
  it('quita frases del final hasta caber en el tope, y no toca un corto que cabe', () => {
    const largo = { ...CAPAS_BUENAS, corto: 'One two three. Four five. Six seven eight.' };
    expect(recortarCorto(largo, 5).corto).toBe('One two three. Four five.');
    expect(recortarCorto(CAPAS_BUENAS)).toBe(CAPAS_BUENAS);
  });
});
