import { describe, it, expect, vi, beforeEach } from 'vitest';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-21): este archivo no tenía ningún test pese
/// a llevar lógica de negocio real y sensible — sanitización de contenido explícito antes de
/// mandar cualquier prompt a un generador de imágenes externo (`sanitizePrompt`, vía
/// `buildNegativePrompt` y el saneado final de `generateImagePrompt`) y el marcado explícito de
/// sexo (`ensureSexExplicit`, no exportada, cubierta indirectamente a través de
/// `generateImagePrompt`). `completeWithFallback` se mockea (mismo patrón que
/// liveTeacherCapture.test.ts/orchestrator.test.ts) para no depender de red/LLM real.
const completeWithFallback = vi.fn();
vi.mock('../lib/aiProviders/orchestrator.js', () => ({
  completeWithFallback: (...args: unknown[]) => completeWithFallback(...args),
}));

const { generateImagePrompt } = await import('./imagePromptGenerator.js');

describe('generateImagePrompt', () => {
  beforeEach(() => {
    completeWithFallback.mockReset();
  });

  it('sanea contenido explícito devuelto por el LLM antes de entregarlo (nunca sangre/desnudez tal cual)', async () => {
    completeWithFallback.mockResolvedValue({
      text: 'A warrior with visible blood and an open wound, bare chest, standing over a corpse.',
      provider: 'groq:llama-3.3-70b',
    });

    const { prompt } = await generateImagePrompt('npc', 'Gorhorn', 'Guerrero orco.', 'thumbnail');

    expect(prompt).not.toMatch(/\bblood\b/i);
    expect(prompt).not.toMatch(/\bwound\b/i);
    expect(prompt).not.toMatch(/\bcorpse\b/i);
    expect(prompt).toContain('dark stains');
    expect(prompt).toContain('scar');
  });

  it('pasa el proveedor devuelto por completeWithFallback tal cual', async () => {
    completeWithFallback.mockResolvedValue({ text: 'a plain scene', provider: 'cerebras:llama-3.3-70b' });

    const { provider } = await generateImagePrompt('location', 'La Hondonada', 'Un valle.', 'banner');

    expect(provider).toBe('cerebras:llama-3.3-70b');
  });

  it('manda al LLM el nombre, el lore en español y el perfil de tamaño correcto', async () => {
    completeWithFallback.mockResolvedValue({ text: 'prompt', provider: 'x' });

    await generateImagePrompt('fauna', 'Corredor de Cauce', 'Un corredor de llanura veloz.', 'banner');

    const userContent = completeWithFallback.mock.calls[0][1] as string;
    expect(userContent).toContain('Corredor de Cauce');
    expect(userContent).toContain('Un corredor de llanura veloz.');
    expect(userContent).toContain('Wide panoramic framing');
  });

  // Bug real (2026-08-27, auditoría de calidad de prompts): `buildPrompt` calculaba estilo/tono/
  // encuadre pero nunca llegaba al LLM — `userContent` solo mandaba Type/Name/Lore/Profile en
  // bruto. Estas 3 comprueban que el borrador estructurado (con su estilo/tono/encuadre reales)
  // viaja de verdad dentro de `userContent`, no solo las 4 líneas sueltas de arriba.
  it('el borrador estructurado (con el estilo real del tipo de entidad) viaja dentro de userContent', async () => {
    completeWithFallback.mockResolvedValue({ text: 'prompt', provider: 'x' });

    await generateImagePrompt('faction', 'Clan Serhu', 'Clan orco de las Llanuras.', 'thumbnail');

    const userContent = completeWithFallback.mock.calls[0][1] as string;
    // Estilo real de 'faction' (ENTITY_TYPE_STYLE) — icono plano, nunca fotorrealista.
    expect(userContent).toContain('Bold flat icon illustration');
    expect(userContent).toContain('never photorealistic');
  });

  it('el tono inferido del lore (p.ej. volcánico) también viaja dentro del borrador estructurado', async () => {
    completeWithFallback.mockResolvedValue({ text: 'prompt', provider: 'x' });

    await generateImagePrompt('location', 'Grietas de Ceniza', 'Un páramo volcánico cubierto de ceniza.', 'banner');

    const userContent = completeWithFallback.mock.calls[0][1] as string;
    expect(userContent).toContain('ash-choked air');
    expect(userContent).toContain('volcanic haze');
  });

  // CFG-39 (usuaria, 2026-10-24): reglas de FLUX sacadas del banco del múrgol
  // (docs/arquitectura/reutilizables/01-generacion-imagenes-local.md). El código las hace cumplir
  // sobre la salida del LLM, no solo se las pide.
  describe('reglas de FLUX (CFG-39)', () => {
    const CIERRE = 'No text, no signature, no watermark.';

    it('quita píxeles, resoluciones y proporciones aunque el LLM las escriba', async () => {
      completeWithFallback.mockResolvedValue({
        text: 'Cinematic wildlife photograph. A huge beast on red plains, wide 2.5:1 aspect ratio, 1920x768px, 1024 x 1024 pixels.',
        provider: 'x',
      });

      const { prompt } = await generateImagePrompt('fauna', 'Múrgol', 'Rumiante.', 'banner');

      expect(prompt).not.toMatch(/\d+\s*[x×]\s*\d+|px\b|pixels|aspect ratio|\d:\d/i);
      expect(prompt).toContain('A huge beast on red plains');
    });

    it('acaba siempre con la línea de cierre, una sola vez', async () => {
      completeWithFallback.mockResolvedValue({ text: 'A calm meadow at dawn, no text, no signature, no watermark', provider: 'x' });

      const { prompt } = await generateImagePrompt('location', 'La Hondonada', 'Un valle.', 'banner');

      expect(prompt.endsWith(CIERRE)).toBe(true);
      expect(prompt.match(/no watermark/gi)?.length).toBe(1);
    });

    it('no añade listas negativas al prompt', async () => {
      completeWithFallback.mockResolvedValue({ text: 'A warrior at dusk.', provider: 'x' });

      const { prompt } = await generateImagePrompt('npc', 'Gorhorn', 'Guerrero orco.', 'thumbnail');

      expect(prompt).toBe(`A warrior at dusk. ${CIERRE}`);
    });

    it('el borrador va en orden estilo → sujeto → encuadre → luz → acabado → cierre, sin píxeles', async () => {
      completeWithFallback.mockResolvedValue({ text: 'p', provider: 'x' });

      await generateImagePrompt('fauna', 'Múrgol', 'Rumiante lanudo de las llanuras.', 'banner');

      const userContent = completeWithFallback.mock.calls[0][1] as string;
      const borrador = userContent.slice(userContent.indexOf('Draft:'));
      const orden = ['Cinematic wildlife photograph', 'Múrgol', 'Wide panoramic framing', 'Light:', 'Shot on a full-frame camera', CIERRE];
      const posiciones = orden.map((t) => borrador.indexOf(t));
      expect(posiciones.every((p) => p >= 0)).toBe(true);
      expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
      expect(userContent).not.toMatch(/\d{3,4}\s*x\s*\d{3,4}|px\b|aspect ratio/i);
    });

    it('el borrador siempre trae una luz explícita, también sin tono en el lore', async () => {
      completeWithFallback.mockResolvedValue({ text: 'p', provider: 'x' });

      await generateImagePrompt('item', 'Hacha', 'Un hacha de guerra.', 'thumbnail');

      const userContent = completeWithFallback.mock.calls[0][1] as string;
      expect(userContent).toMatch(/Light: \S+/);
    });

    it('el system prompt pide lenguaje natural, sin comparaciones, sin píxeles ni negativos', async () => {
      completeWithFallback.mockResolvedValue({ text: 'p', provider: 'x' });

      await generateImagePrompt('fauna', 'Múrgol', 'Rumiante.', 'banner');

      const system = completeWithFallback.mock.calls[0][0] as string;
      expect(system).toMatch(/natural English sentences/);
      expect(system).toMatch(/never compare/i);
      expect(system).toMatch(/no pixel sizes/i);
      expect(system).toMatch(/no lists of things to avoid/i);
      // Primera imagen de CFG-39: «like a worn wool sweater» le puso un jersey y «not like a goat's» lo hizo cabra.
      expect(system).toMatch(/never from clothing or man-made objects/i);
      expect(system).toMatch(/never write what it is not/i);
      expect(system).toMatch(/never with numbers/i);
      expect(system).toContain(CIERRE);
    });
  });
});
