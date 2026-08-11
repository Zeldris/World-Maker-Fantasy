import { describe, it, expect, vi, beforeEach } from 'vitest';

/// Cobertura nueva (2026-08-11, captura en vivo de pares DPO — plan "IA local propia", fase 2):
/// `completeCloudOnly`/`prisma` se mockean (misma línea que orchestrator.test.ts/
/// chapterSummary.test.ts) — `modelfileSystemPrompt.js`/`distillationValidation.js` se dejan
/// correr de verdad (funciones puras, sin red ni DB, mismo criterio que ya usa
/// compare-narrador-models.ts) para probar la integración real de principio a fin, no solo que se
/// llamen los mocks correctos.
const completeCloudOnly = vi.fn();
vi.mock('../lib/aiProviders/orchestrator.js', () => ({ completeCloudOnly: (...args: unknown[]) => completeCloudOnly(...args) }));

const create = vi.fn();
vi.mock('../lib/prisma.js', () => ({ prisma: { liveTeacherCapture: { create: (...args: unknown[]) => create(...args) } } }));

const { env } = await import('../config/env.js');
const { captureLiveTeacherExample } = await import('./liveTeacherCapture.js');

const baseCtx = {
  worldFacts: ['UBICACIÓN ACTUAL: La Hondonada del Eco.'],
  characterSummary: 'Gorhorn, guerrero. Nivel 1.',
  action: 'Exploro la zona con cuidado.',
  npcSlugsInScene: [] as string[],
};

const baseParams = {
  saveId: 'save-1',
  worldId: 'world-1',
  ctx: baseCtx,
  localNarration: { narration: 'Gorhorn explora la zona con cuidado.', newFacts: [] },
  localModel: 'tarkor-narrador',
};

function validCloudJson() {
  return JSON.stringify({ narration: 'Una figura se mueve entre las rocas rojizas.', newFacts: [] });
}

describe('captureLiveTeacherExample', () => {
  beforeEach(() => {
    completeCloudOnly.mockReset();
    create.mockReset().mockResolvedValue({});
    env.liveTeacherCaptureEnabled = true;
    env.liveTeacherCaptureSampleRate = 1; // determinista: siempre captura, salvo que un test diga lo contrario
    vi.spyOn(Math, 'random').mockReturnValue(0); // 0 < sampleRate siempre, salvo el propio test de muestreo
  });

  it('con la flag apagada, nunca llama a completeCloudOnly ni escribe en la BD', async () => {
    env.liveTeacherCaptureEnabled = false;

    await captureLiveTeacherExample(baseParams);

    expect(completeCloudOnly).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('respeta el muestreo — con Math.random() por encima de sampleRate, se salta el turno', async () => {
    env.liveTeacherCaptureSampleRate = 0.3;
    (Math.random as ReturnType<typeof vi.fn>).mockReturnValue(0.5);

    await captureLiveTeacherExample(baseParams);

    expect(completeCloudOnly).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('si completeCloudOnly devuelve null (todos los proveedores fallaron), no escribe nada', async () => {
    completeCloudOnly.mockResolvedValue(null);

    await captureLiveTeacherExample(baseParams);

    expect(create).not.toHaveBeenCalled();
  });

  it('JSON mal formado del profesor cloud se guarda como fila inválida, con motivo', async () => {
    completeCloudOnly.mockResolvedValue({ text: 'esto no es JSON', provider: 'groq:llama-3.3-70b' });

    await captureLiveTeacherExample(baseParams);

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.cloudValid).toBe(false);
    expect(data.cloudRejectReason).toBe('JSON mal formado');
  });

  it('JSON válido pero que dispara un detector (anacronismo) se guarda como fila inválida', async () => {
    const withAnachronism = JSON.stringify({ narration: 'Huele a pólvora en el aire.', newFacts: [] });
    completeCloudOnly.mockResolvedValue({ text: withAnachronism, provider: 'groq:llama-3.3-70b' });

    await captureLiveTeacherExample(baseParams);

    const data = create.mock.calls[0][0].data;
    expect(data.cloudValid).toBe(false);
    expect(data.cloudRejectReason).toContain('anacronismo');
  });

  it('JSON válido que pasa todos los filtros se guarda como fila válida, con la salida local intacta', async () => {
    completeCloudOnly.mockResolvedValue({ text: validCloudJson(), provider: 'groq:llama-3.3-70b' });

    await captureLiveTeacherExample(baseParams);

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.cloudValid).toBe(true);
    expect(data.cloudRejectReason).toBeNull();
    expect(data.cloudProvider).toBe('groq:llama-3.3-70b');
    expect(data.localNarrationJson).toEqual(baseParams.localNarration);
    expect(data.localModel).toBe('tarkor-narrador');
    expect(data.saveId).toBe('save-1');
    expect(data.worldId).toBe('world-1');
  });

  it('un fallo al escribir en la BD nunca se propaga hacia fuera', async () => {
    completeCloudOnly.mockResolvedValue({ text: validCloudJson(), provider: 'groq:llama-3.3-70b' });
    create.mockRejectedValue(new Error('conexión perdida'));

    await expect(captureLiveTeacherExample(baseParams)).resolves.toBeUndefined();
  });
});
