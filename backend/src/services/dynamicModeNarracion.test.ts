import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
}));

const { narrarVueltaModoDinamico } = await import('./dynamicModeNarracion.js');

const BASE_INPUT = {
  tipo: 'NPC' as const,
  targetName: 'Gistera Koh',
  vuelta: 1,
  maxVueltas: 3,
  characterSummary: 'Gorhorn, cazador de Clan Maktor.',
  respuestaJugador: null,
};

/// Guard determinista para "nunca sustituye un combate" (checklist-pruebas-juego.md, candidato de
/// bug anotado: la instrucción vivía SOLO en el prompt, sin nada que lo garantice si el modelo
/// pequeño la ignora — mismo patrón frágil ya visto con otras instrucciones "no hagas X" de este
/// proyecto, ej. "narra en 3ª persona"). `hasCombatVocabulary` (narrador.ts, mismo regex que
/// `hasFalseCombatHit`) fuerza `cierra: true` si la narración de la vuelta describe un golpe real,
/// sin depender de que el LLM marque el campo por su cuenta.
describe('narrarVueltaModoDinamico — guard determinista de "nunca sustituye combate"', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
  });

  it('el LLM narra un golpe real sin marcar cierra:true — el guard lo fuerza igual', async () => {
    ollamaGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        narration: 'Gistera Koh, furiosa, golpea con fuerza el hombro de Gorhorn, dejando una herida visible.',
        opciones: ['Devolver el golpe', 'Retroceder'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.cierra).toBe(true);
  });

  it('una narración pacífica respeta cierra:false tal cual lo devuelve el modelo', async () => {
    ollamaGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        narration: 'Gistera Koh te mira con desconfianza, pero no hace ademán de atacar.',
        opciones: ['Acercarte con calma', 'Preguntar qué quiere'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.cierra).toBe(false);
  });

  it('sigue respetando cierra:true del modelo cuando la narración no tiene vocabulario de golpe', async () => {
    ollamaGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        narration: 'Gistera Koh asiente y se marcha, satisfecha con tu respuesta.',
        opciones: ['Seguir tu camino', 'Despedirte'],
        cierra: true,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.cierra).toBe(true);
  });
});
