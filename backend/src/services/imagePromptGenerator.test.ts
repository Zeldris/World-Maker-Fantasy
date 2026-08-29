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

const { generateImagePrompt, buildNegativePrompt } = await import('./imagePromptGenerator.js');

describe('buildNegativePrompt', () => {
  it('incluye el negativo específico de estilo hiperrealista para npc/item/fauna/raza/personaje/construccion/crafteo', () => {
    for (const entityType of ['npc', 'item', 'fauna', 'raza', 'personaje', 'construccion', 'crafteo'] as const) {
      expect(buildNegativePrompt(entityType)).toContain('cartoon, 3d render, watercolor');
    }
  });

  it('usa el negativo "painterly" para location/historia (estilo pictórico, nunca fotorrealista)', () => {
    for (const entityType of ['location', 'historia'] as const) {
      const negative = buildNegativePrompt(entityType);
      expect(negative).toContain('photorealistic, hyperrealistic, flat, vector');
    }
  });

  it('usa el negativo "dark fantasy illustration" para ability', () => {
    expect(buildNegativePrompt('ability')).toContain('cartoon, bright, colorful, cheerful');
  });

  it('usa el negativo "flat icon" para faction, nunca fotorrealista de verdad', () => {
    const negative = buildNegativePrompt('faction');
    expect(negative).toContain('photorealistic, hyperdetailed, shadow, gradient, 3d');
  });

  it('siempre incluye la base común de anatomía/calidad, sin importar el tipo', () => {
    expect(buildNegativePrompt('npc')).toContain('deformed, bad anatomy, disfigured');
  });
});

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
    expect(prompt).toContain('no explicit gore');
  });

  it('no duplica el bloque de seguridad si el LLM ya lo incluyó', async () => {
    completeWithFallback.mockResolvedValue({
      text: 'A calm scene, no explicit gore, no nudity, no open wounds, no graphic violence, no anatomical detail, no sexual content',
      provider: 'groq:llama-3.3-70b',
    });

    const { prompt } = await generateImagePrompt('item', 'Hacha', 'Un hacha de guerra.', 'thumbnail');

    expect(prompt.match(/no explicit gore/g)?.length).toBe(1);
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
    expect(userContent).toContain('1920x768px');
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
    expect(userContent).toContain('bold flat icon illustration');
    expect(userContent).toContain('NEVER photorealistic');
  });

  it('el tono inferido del lore (p.ej. volcánico) también viaja dentro del borrador estructurado', async () => {
    completeWithFallback.mockResolvedValue({ text: 'prompt', provider: 'x' });

    await generateImagePrompt('location', 'Grietas de Ceniza', 'Un páramo volcánico cubierto de ceniza.', 'banner');

    const userContent = completeWithFallback.mock.calls[0][1] as string;
    expect(userContent).toContain('ash-choked air');
    expect(userContent).toContain('volcanic haze');
  });

  it('las dimensiones exactas del perfil viajan dentro del borrador estructurado, no solo en la línea "Profile"', async () => {
    completeWithFallback.mockResolvedValue({ text: 'prompt', provider: 'x' });

    await generateImagePrompt('npc', 'Gorhorn', 'Guerrero orco.', 'thumbnail');

    const userContent = completeWithFallback.mock.calls[0][1] as string;
    // Aparece dos veces: una en la línea "Profile:" de siempre, otra dentro del borrador.
    expect(userContent.match(/1024x1024px/g)?.length).toBe(2);
  });
});
