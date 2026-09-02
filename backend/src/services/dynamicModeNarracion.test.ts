import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
}));

const { narrarVueltaModoDinamico } = await import('./dynamicModeNarracion.js');
const { hasSecondPersonLeak } = await import('./narrador.js');

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
        narration: 'Gistera Koh asiente y se marcha, satisfecha con la respuesta de Gorhorn.',
        opciones: ['Seguir tu camino', 'Despedirte'],
        cierra: true,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.cierra).toBe(true);
  });
});

/// Persona gramatical (checklist-pruebas-juego.md: "confirmado en vivo que el modelo pequeño la
/// ignora" — turno real "Te ergues... impactarte..."): este flujo tiene su propio narrador,
/// separado de narrador.ts § narrateAction (que ya reintentaba con hasSecondPersonLeak) — sin este
/// guard, una fuga a 2ª persona se aceptaba tal cual, sin ningún reintento.
describe('narrarVueltaModoDinamico — guard de persona gramatical (2ª persona)', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
  });

  it('descarta un intento con fuga a 2ª persona y usa el siguiente intento válido', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'Te ergues frente a Gistera Koh, que se prepara para impactarte con su vara.',
          opciones: ['Retroceder', 'Sostenerle la mirada'],
          cierra: false,
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'Gorhorn se yergue frente a Gistera Koh, que se prepara para golpearlo con su vara.',
          opciones: ['Retroceder', 'Sostenerle la mirada'],
          cierra: false,
        }),
      });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.narration).toBe('Gorhorn se yergue frente a Gistera Koh, que se prepara para golpearlo con su vara.');
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('si los 2 intentos tienen fuga a 2ª persona, cae al texto determinista (sin fuga, mismo criterio que el resto de guards)', async () => {
    ollamaGenerate.mockResolvedValue({
      text: JSON.stringify({
        narration: 'Te preparas para responder a Gistera Koh.',
        opciones: ['Retroceder', 'Sostenerle la mirada'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(hasSecondPersonLeak(result.narration)).toBe(false);
  });
});
