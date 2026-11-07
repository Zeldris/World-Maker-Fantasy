import { describe, it, expect, vi, beforeEach } from 'vitest';

/// IMG-50: la cola de prompts, en serie, sin duplicar y esperando al generador de imágenes.
const upsert = vi.fn();
vi.mock('../lib/prisma.js', () => ({ prisma: { imagePrompt: { upsert: (...a: unknown[]) => upsert(...a) } } }));
const retrieveLore = vi.fn();
vi.mock('./retrieval.js', () => ({ retrieveLore: (...a: unknown[]) => retrieveLore(...a) }));
const generateImagePrompt = vi.fn();
vi.mock('./imagePromptGenerator.js', () => ({ generateImagePrompt: (...a: unknown[]) => generateImagePrompt(...a) }));

const { encolarImagePrompt, estadoImagePrompt, configurarColaParaTests, colaVacia, formatearLoreRelacionado } = await import('./imagePromptCola.js');

const trabajo = (slug: string) => ({
  worldId: 'w1',
  entityType: 'fauna' as const,
  entitySlug: slug,
  sizeProfile: 'banner' as const,
  name: 'Aullador',
  loreContext: 'Un lobo.',
});

describe('IMG-50 — cola de prompts de imagen', () => {
  beforeEach(() => {
    configurarColaParaTests({ vaciar: true, generadorOcupado: async () => false, sondeoMs: 1 });
    upsert.mockReset().mockResolvedValue({});
    retrieveLore.mockReset().mockResolvedValue([
      { title: 'Aullador', text: 'el propio', distance: 0.1 },
      { title: 'Llanuras', text: 'polvo rojo', distance: 0.3 },
    ]);
    generateImagePrompt.mockReset();
  });

  it('genera de uno en uno, guarda el prompt y deja el estado listo', async () => {
    let enCurso = 0;
    let maximo = 0;
    generateImagePrompt.mockImplementation(async () => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await new Promise((r) => setTimeout(r, 10));
      enCurso--;
      return { prompt: 'p', provider: 'ollama:m' };
    });
    expect(encolarImagePrompt(trabajo('a')).estado).toBe('en_cola');
    expect(encolarImagePrompt(trabajo('b'))).toMatchObject({ estado: 'en_cola', posicion: 2 });
    await colaVacia();
    expect(maximo).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0].update).toEqual({ prompt: 'p', provider: 'ollama:m' });
    expect(estadoImagePrompt(trabajo('b'))).toEqual({ estado: 'listo', prompt: 'p', provider: 'ollama:m' });
  });

  it('pasa al generador el lore relacionado, sin el fragmento de la propia entidad', async () => {
    generateImagePrompt.mockResolvedValue({ prompt: 'p', provider: 'm' });
    encolarImagePrompt(trabajo('a'));
    await colaVacia();
    expect(retrieveLore).toHaveBeenCalledWith(expect.stringContaining('Aullador'), 'w1', 6);
    expect(generateImagePrompt.mock.calls[0][4].loreRelacionado).toEqual(['Llanuras: polvo rojo']);
  });

  it('si el RAG falla, el prompt sale igual sin lore relacionado', async () => {
    retrieveLore.mockRejectedValue(new Error('sin pgvector'));
    generateImagePrompt.mockResolvedValue({ prompt: 'p', provider: 'm' });
    encolarImagePrompt(trabajo('a'));
    await colaVacia();
    expect(generateImagePrompt.mock.calls[0][4].loreRelacionado).toEqual([]);
    expect(estadoImagePrompt(trabajo('a'))?.estado).toBe('listo');
  });

  it('no duplica un trabajo que ya está en cola', async () => {
    generateImagePrompt.mockResolvedValue({ prompt: 'p', provider: 'm' });
    encolarImagePrompt(trabajo('a'));
    encolarImagePrompt(trabajo('a'));
    await colaVacia();
    expect(generateImagePrompt).toHaveBeenCalledTimes(1);
  });

  it('un fallo del modelo deja el estado en error con el motivo, y la cola sigue', async () => {
    generateImagePrompt.mockRejectedValueOnce(new Error('usa «moon»')).mockResolvedValueOnce({ prompt: 'p', provider: 'm' });
    encolarImagePrompt(trabajo('a'));
    encolarImagePrompt(trabajo('b'));
    await colaVacia();
    expect(estadoImagePrompt(trabajo('a'))).toEqual({ estado: 'error', error: 'usa «moon»' });
    expect(estadoImagePrompt(trabajo('b'))?.estado).toBe('listo');
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('espera mientras el generador de imágenes está ocupado', async () => {
    let ocupado = 3;
    configurarColaParaTests({ generadorOcupado: async () => ocupado-- > 0 });
    generateImagePrompt.mockResolvedValue({ prompt: 'p', provider: 'm' });
    encolarImagePrompt(trabajo('a'));
    await new Promise((r) => setTimeout(r, 0));
    expect(generateImagePrompt).not.toHaveBeenCalled();
    await colaVacia();
    expect(ocupado).toBe(-1);
    expect(generateImagePrompt).toHaveBeenCalledTimes(1);
  });

  it('el lore relacionado tiene un tope de caracteres', () => {
    const largo = Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, text: 'x'.repeat(1000), distance: 0.2 }));
    expect(formatearLoreRelacionado(largo, 'otro').join('').length).toBeLessThanOrEqual(6000);
  });
});
