import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
}));
const filas = new Map<string, string>();
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    prefijoNarrador: {
      findUnique: async ({ where }: { where: { saveId: string } }) => (filas.has(where.saveId) ? { texto: filas.get(where.saveId) } : null),
      upsert: async ({ where, create }: { where: { saveId: string }; create: { texto: string } }) => filas.set(where.saveId, create.texto),
    },
  },
}));

const { guardarPrefijoNarrador, calentarNarradorDePartida, olvidarPrefijoEnCacheParaTests, tocaCalentar, INTERVALO_CALENTAR_MS } = await import('./calentarNarrador.js');
const { claimTurnInFlight, releaseTurnInFlight } = await import('./turnLock.js');
const { buildNarrationPrompt } = await import('./narrador.js');

const CTX = {
  characterSummary: 'Gorhorn, cazador del Clan Maktor.\nESTADO DE LA PARTIDA: día 3, 14:20.',
  worldFacts: ['Un cuervo grazna encima.', 'UBICACIÓN ACTUAL: Hondonada del Eco.', 'INVENTARIO ACTUAL: odre de agua.'],
  action: 'Miro alrededor',
};

describe('QA-339: prefijo estable del narrador', () => {
  it('QA-507: los bloques con nombre suman el prompt', () => {
    const { prompt, bloques } = buildNarrationPrompt(CTX);
    expect(bloques.map((x) => x.texto).join('')).toBe(prompt);
    expect(bloques.map((x) => x.nombre)).toEqual(expect.arrayContaining(['personaje', 'hechos', 'estado_partida', 'accion']));
  });

  it('es el principio del prompt y acaba en los hechos estables, sin estado, hechos del turno ni acción', () => {
    const { prompt, prefijoEstable } = buildNarrationPrompt(CTX);
    expect(prompt.startsWith(prefijoEstable)).toBe(true);
    expect(prefijoEstable).toContain('Gorhorn, cazador del Clan Maktor.');
    expect(prefijoEstable.endsWith('- UBICACIÓN ACTUAL: Hondonada del Eco.\n- INVENTARIO ACTUAL: odre de agua.')).toBe(true);
    expect(prefijoEstable).not.toContain('ESTADO DE LA PARTIDA');
    expect(prefijoEstable).not.toContain('cuervo');
  });

  it('un turno siguiente en la misma zona, con otra hora, otra acción y otros hechos, empieza igual', () => {
    const { prefijoEstable } = buildNarrationPrompt(CTX);
    const siguiente = buildNarrationPrompt({
      ...CTX,
      characterSummary: 'Gorhorn, cazador del Clan Maktor.\nESTADO DE LA PARTIDA: día 3, 14:40.',
      worldFacts: ['Algo se mueve entre las rocas.', ...CTX.worldFacts.slice(1)],
      action: 'Bebo del odre',
    });
    expect(siguiente.prompt.startsWith(prefijoEstable)).toBe(true);
  });

  it('QA-348: en combate llega hasta el último hecho de la escena, sin estado ni acción', () => {
    const { prompt, prefijoEstable } = buildNarrationPrompt({ ...CTX, enCombate: true });
    expect(prompt.startsWith(prefijoEstable)).toBe(true);
    expect(prefijoEstable).toContain('- Un cuervo grazna encima.');
    expect(prefijoEstable.endsWith('- Un cuervo grazna encima.')).toBe(true);
    expect(prefijoEstable).not.toContain('ESTADO DE LA PARTIDA');
    expect(prefijoEstable).not.toContain('Miro alrededor');
  });
});

describe('QA-339: calentar el narrador al abrir la partida', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset().mockResolvedValue({ text: '', raw: {} });
    filas.clear();
    olvidarPrefijoEnCacheParaTests();
  });

  it('manda el prefijo guardado con num_predict 1 y keep_alive 1h', async () => {
    filas.set('s1', 'PREFIJO-S1');
    expect(await calentarNarradorDePartida('s1')).toBe(true);
    expect(ollamaGenerate).toHaveBeenCalledTimes(1);
    expect(ollamaGenerate.mock.calls[0][0]).toMatchObject({ prompt: 'PREFIJO-S1', maxTokens: 1, keepAlive: '1h', tarea: 'calentar' });
  });

  it('no repite la misma partida en el intervalo corto, y sí otra partida', async () => {
    filas.set('s1', 'PREFIJO-S1');
    filas.set('s2', 'PREFIJO-S2');
    expect(await calentarNarradorDePartida('s1')).toBe(true);
    expect(await calentarNarradorDePartida('s1')).toBe(false);
    expect(await calentarNarradorDePartida('s2')).toBe(true);
    expect(ollamaGenerate.mock.calls.map((c) => c[0].prompt)).toEqual(['PREFIJO-S1', 'PREFIJO-S2']);
  });

  it('tras narrar no recalienta al recargar, pero sí con otro prefijo en la caché una vez pasado el intervalo', async () => {
    await guardarPrefijoNarrador('s1', 'PREFIJO-S1');
    expect(await calentarNarradorDePartida('s1')).toBe(false);
    expect(tocaCalentar('s1', Date.now() + INTERVALO_CALENTAR_MS + 1)).toBe(true);
  });

  it('con un turno en curso de esa partida no calienta', async () => {
    filas.set('s1', 'PREFIJO-S1');
    expect(claimTurnInFlight('s1')).toBe(true);
    try {
      expect(await calentarNarradorDePartida('s1')).toBe(false);
      expect(ollamaGenerate).not.toHaveBeenCalled();
    } finally {
      releaseTurnInFlight('s1');
    }
    expect(await calentarNarradorDePartida('s1')).toBe(true);
  });

  it('sin prefijo guardado (partida sin turnos narrados) no llama a Ollama', async () => {
    expect(await calentarNarradorDePartida('nueva')).toBe(false);
    expect(ollamaGenerate).not.toHaveBeenCalled();
  });

  it('si el calentamiento falla, el siguiente intento vuelve a mandarlo', async () => {
    filas.set('s1', 'PREFIJO-S1');
    ollamaGenerate.mockRejectedValueOnce(new Error('Ollama caído'));
    await expect(calentarNarradorDePartida('s1')).rejects.toThrow('Ollama caído');
    expect(await calentarNarradorDePartida('s1')).toBe(true);
  });
});
