import { describe, it, expect, vi, beforeEach } from 'vitest';

/// Cobertura nueva (auditoría 2026-07-22): este archivo tenía 0% de test pese a ser la lógica de
/// fallback entre proveedores cloud + Ollama local — un fallo silencioso aquí (p. ej. no probar
/// el siguiente proveedor, o no caer a Ollama cuando todos fallan) deja la generación de prompts
/// de imagen completamente rota sin que nada lo avise. Cada cliente cloud se mockea por separado
/// (misma interfaz `AiClient`, ver aiClient.ts) para poder controlar `disponible()`/`complete()`
/// de forma determinista, en vez de depender de si hay API keys reales configuradas.
vi.mock('./cerebrasClient.js', () => ({ cerebrasClient: { disponible: vi.fn(), complete: vi.fn(), getModelId: () => 'cerebras' } }));
vi.mock('./mistralClient.js', () => ({ mistralClient: { disponible: vi.fn(), complete: vi.fn(), getModelId: () => 'mistral' } }));
vi.mock('./sambanovaClient.js', () => ({ sambanovaClient: { disponible: vi.fn(), complete: vi.fn(), getModelId: () => 'sambanova' } }));
vi.mock('./cloudflareClient.js', () => ({ cloudflareClient: { disponible: vi.fn(), complete: vi.fn(), getModelId: () => 'cloudflare' } }));
vi.mock('../ollama.js', () => ({ ollamaGenerate: vi.fn() }));

const { cerebrasClient } = await import('./cerebrasClient.js');
const { mistralClient } = await import('./mistralClient.js');
const { sambanovaClient } = await import('./sambanovaClient.js');
const { cloudflareClient } = await import('./cloudflareClient.js');
const { ollamaGenerate } = await import('../ollama.js');
const { completeWithFallback } = await import('./orchestrator.js');

function reset(client: { disponible: ReturnType<typeof vi.fn>; complete: ReturnType<typeof vi.fn> }, disponible: boolean) {
  client.disponible.mockReset().mockReturnValue(disponible);
  client.complete.mockReset();
}

describe('completeWithFallback', () => {
  beforeEach(() => {
    reset(cerebrasClient as never, false);
    reset(mistralClient as never, false);
    reset(sambanovaClient as never, false);
    reset(cloudflareClient as never, false);
    vi.mocked(ollamaGenerate).mockReset();
  });

  it('usa el primer proveedor disponible que responde sin fallar', async () => {
    reset(cerebrasClient as never, true);
    (cerebrasClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue('  respuesta de cerebras  ');

    const result = await completeWithFallback('system', 'user', 100);

    expect(result).toEqual({ text: 'respuesta de cerebras', provider: 'cerebras' });
    expect(cerebrasClient.complete).toHaveBeenCalledWith('system', 'user', 100);
    expect(ollamaGenerate).not.toHaveBeenCalled();
  });

  it('salta los proveedores sin API key configurada (disponible() === false)', async () => {
    reset(cerebrasClient as never, false);
    reset(mistralClient as never, true);
    (mistralClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue('respuesta de mistral');

    const result = await completeWithFallback('system', 'user', 100);

    expect(result.provider).toBe('mistral');
    expect(cerebrasClient.complete).not.toHaveBeenCalled();
  });

  it('si un proveedor disponible falla, reintenta con el siguiente de la rotación', async () => {
    reset(cerebrasClient as never, true);
    reset(mistralClient as never, true);
    (cerebrasClient.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('rate limit'));
    (mistralClient.complete as ReturnType<typeof vi.fn>).mockResolvedValue('respuesta de mistral');

    const result = await completeWithFallback('system', 'user', 100);

    expect(result.provider).toBe('mistral');
    expect(cerebrasClient.complete).toHaveBeenCalledTimes(1);
    expect(mistralClient.complete).toHaveBeenCalledTimes(1);
  });

  it('cae a Ollama local si ningún proveedor cloud tiene API key', async () => {
    vi.mocked(ollamaGenerate).mockResolvedValue({ text: '  respuesta de ollama  ', raw: {} } as never);

    const result = await completeWithFallback('system', 'user', 100);

    expect(result.text).toBe('respuesta de ollama');
    expect(result.provider).toContain('ollama:');
  });

  it('cae a Ollama local si TODOS los proveedores disponibles fallan', async () => {
    reset(cerebrasClient as never, true);
    reset(mistralClient as never, true);
    (cerebrasClient.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
    (mistralClient.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
    vi.mocked(ollamaGenerate).mockResolvedValue({ text: 'respuesta de ollama', raw: {} } as never);

    const result = await completeWithFallback('system', 'user', 100);

    expect(result.provider).toContain('ollama:');
    expect(cerebrasClient.complete).toHaveBeenCalledTimes(1);
    expect(mistralClient.complete).toHaveBeenCalledTimes(1);
  });
});
