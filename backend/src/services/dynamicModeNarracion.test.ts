import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
}));

const { narrarVueltaModoDinamico, hasFutureTenseLeak, hasFalseFaunaCommunication } = await import('./dynamicModeNarracion.js');
const { hasSecondPersonLeak } = await import('./narrador.js');

const BASE_INPUT = {
  tipo: 'NPC' as const,
  targetName: 'Gistera Koh',
  vuelta: 1,
  maxVueltas: 3,
  characterSummary: 'Gorhorn, cazador de Clan Maktor.',
  respuestaJugador: null,
};

const BASE_INPUT_FAUNA = {
  ...BASE_INPUT,
  tipo: 'FAUNA' as const,
  targetName: 'gesgurio',
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

/// Fuga de vocabulario "los humanos" (hallazgo A, ronda 2 de pruebas autónomas 2026-09-05): un
/// gesgurio en modo dinámico narró "lo que los humanos ocultan tras sus almas" — Helek Sirik no
/// tiene raza humana. Mismo criterio que la persona gramatical: este flujo tiene su propio
/// narrador, necesita su propio guard.
describe('narrarVueltaModoDinamico — guard de fuga de raza humana', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
  });

  it('bug real jugando en vivo (2026-09-05): descarta un intento que menciona "los humanos" y usa el siguiente intento válido', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El gesgurio te observa como si pudiera ver lo que los humanos ocultan tras sus almas.',
          opciones: ['Observarlo', 'Ignorarlo'],
          cierra: false,
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El gesgurio observa a Gorhorn fijamente, sus ojos vidriosos escrutando cada movimiento.',
          opciones: ['Observarlo', 'Ignorarlo'],
          cierra: false,
        }),
      });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.narration).toBe('El gesgurio observa a Gorhorn fijamente, sus ojos vidriosos escrutando cada movimiento.');
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('si los 2 intentos mencionan "humanos", cae al texto determinista (sin la fuga)', async () => {
    const { hasHumanRaceLeak } = await import('./narrador.js');
    ollamaGenerate.mockResolvedValue({
      text: JSON.stringify({
        narration: 'El gesgurio observa a los humanos con curiosidad.',
        opciones: ['Observarlo', 'Ignorarlo'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(hasHumanRaceLeak(result.narration)).toBe(false);
  });
});

/// Tiempo verbal futuro (hallazgo C, ronda 2 de pruebas autónomas 2026-09-05): una vuelta narró
/// "un kirelon-arenoso emergerá... se asomarán... se tambalearán" en vez del presente narrativo
/// consistente con el resto de la escena.
describe('narrarVueltaModoDinamico — guard de tiempo verbal (futuro)', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
  });

  it('bug real jugando en vivo (2026-09-05): descarta un intento en futuro y usa el siguiente intento en presente', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'Un kirelon-arenoso emergerá lentamente de uno de los huecos en la pared rojiza.',
          opciones: ['Observarlo de lejos', 'Acercarse con cautela'],
          cierra: false,
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'Un kirelon-arenoso emerge lentamente de uno de los huecos en la pared rojiza.',
          opciones: ['Observarlo de lejos', 'Acercarse con cautela'],
          cierra: false,
        }),
      });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.narration).toBe('Un kirelon-arenoso emerge lentamente de uno de los huecos en la pared rojiza.');
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('no dispara con presente narrativo normal', async () => {
    ollamaGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        narration: 'El kirelon-arenoso se retuerce en la penumbra, sus patas inmóviles.',
        opciones: ['Observarlo de lejos', 'Acercarse con cautela'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.narration).toBe('El kirelon-arenoso se retuerce en la penumbra, sus patas inmóviles.');
    expect(ollamaGenerate).toHaveBeenCalledTimes(1);
  });

  it('si los 2 intentos están en futuro, cae al texto determinista (sin futuro)', async () => {
    ollamaGenerate.mockResolvedValue({
      text: JSON.stringify({
        narration: 'Un kirelon-arenoso emergerá de la penumbra.',
        opciones: ['Observarlo de lejos', 'Acercarse con cautela'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(hasFutureTenseLeak(result.narration)).toBe(false);
  });
});

describe('hasFutureTenseLeak', () => {
  it('detecta futuro simple en 3ª persona singular y plural', () => {
    expect(hasFutureTenseLeak('Un kirelon-arenoso emergerá lentamente de la pared.')).toBe(true);
    expect(hasFutureTenseLeak('Sus patas garrudas se tambalearán mientras se orienta.')).toBe(true);
    expect(hasFutureTenseLeak('El gesgurio se acercará con curiosidad.')).toBe(true);
  });

  it('no dispara con presente narrativo normal', () => {
    expect(hasFutureTenseLeak('Un kirelon-arenoso emerge lentamente de la pared.')).toBe(false);
    expect(hasFutureTenseLeak('Gorhorn camina hacia el sur, atento a cualquier sonido.')).toBe(false);
  });

  it('no dispara con infinitivos ni otras palabras que terminan en -ar/-er/-ir', () => {
    expect(hasFutureTenseLeak('Gorhorn decide hablar con calma.')).toBe(false);
    expect(hasFutureTenseLeak('El eco de sus pasos resuena en la cueva.')).toBe(false);
    expect(hasFutureTenseLeak('examinándola en busca de inscripciones.')).toBe(false);
  });
});

/// Capacidad de comunicación (bug real reincidente: kirelon-arenoso "respondiendo" a
/// "Preguntarle..." el 2026-08-27, y gesgurio ofreciendo "Intentar comunicarte con gesgurio" en la
/// ronda de pruebas de verificación en vivo 2026-09-05). El prompt ya le pide a FAUNA que nunca
/// hable (`capacidadHint`), pero el modelo pequeño lo ignora bajo presión narrativa — mismo patrón
/// que persona gramatical/"humanos"/futuro en este mismo archivo.
describe('narrarVueltaModoDinamico — guard de capacidad de comunicación (FAUNA nunca habla)', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
  });

  it('bug real jugando en vivo (2026-09-05): descarta un intento que ofrece "comunicarte" a una FAUNA y usa el siguiente intento válido', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El gesgurio se acerca sigilosamente, observando a Gorhorn.',
          opciones: ['Intentar comunicarte con gesgurio', 'Ignorarlo y seguir tu camino'],
          cierra: false,
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El gesgurio se acerca sigilosamente, observando a Gorhorn.',
          opciones: ['Observarlo de cerca', 'Ignorarlo y seguir tu camino'],
          cierra: false,
        }),
      });
    const result = await narrarVueltaModoDinamico(BASE_INPUT_FAUNA);
    expect(result.opciones).toEqual(['Observarlo de cerca', 'Ignorarlo y seguir tu camino']);
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('bug real de catálogo (2026-08-27): descarta un intento con "Preguntarle..." como opción para una FAUNA', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El kirelon-arenoso se retuerce cerca de Gorhorn.',
          opciones: ['Preguntarle por el camino', 'Ahuyentarlo con piedras'],
          cierra: false,
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El kirelon-arenoso se retuerce cerca de Gorhorn.',
          opciones: ['Acercarse con cautela', 'Ahuyentarlo con piedras'],
          cierra: false,
        }),
      });
    const result = await narrarVueltaModoDinamico({ ...BASE_INPUT_FAUNA, targetName: 'kirelon-arenoso' });
    expect(result.opciones).toEqual(['Acercarse con cautela', 'Ahuyentarlo con piedras']);
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('descarta también si es la propia narración (no las opciones) la que describe a la fauna "respondiendo"', async () => {
    ollamaGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El gesgurio responde con un gruñido gutural a la pregunta de Gorhorn.',
          opciones: ['Observarlo de cerca', 'Ignorarlo'],
          cierra: false,
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          narration: 'El gesgurio ladea la cabeza, atento a cada movimiento de Gorhorn.',
          opciones: ['Observarlo de cerca', 'Ignorarlo'],
          cierra: false,
        }),
      });
    const result = await narrarVueltaModoDinamico(BASE_INPUT_FAUNA);
    expect(result.narration).toBe('El gesgurio ladea la cabeza, atento a cada movimiento de Gorhorn.');
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('un NPC (no FAUNA) SÍ puede tener opciones de diálogo — el guard nunca dispara para NPC', async () => {
    ollamaGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        narration: 'Gistera Koh mira a Gorhorn con desconfianza.',
        opciones: ['Preguntarle qué quiere', 'Intentar comunicarte con calma'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT);
    expect(result.opciones).toEqual(['Preguntarle qué quiere', 'Intentar comunicarte con calma']);
    expect(ollamaGenerate).toHaveBeenCalledTimes(1);
  });

  it('si los 2 intentos ofrecen comunicación para una FAUNA, cae al texto determinista (sin verbos de comunicación)', async () => {
    ollamaGenerate.mockResolvedValue({
      text: JSON.stringify({
        narration: 'El gesgurio se acerca.',
        opciones: ['Preguntarle qué quiere', 'Ignorarlo'],
        cierra: false,
      }),
    });
    const result = await narrarVueltaModoDinamico(BASE_INPUT_FAUNA);
    expect(hasFalseFaunaCommunication('FAUNA', result.narration, result.opciones)).toBe(false);
  });
});

describe('hasFalseFaunaCommunication', () => {
  it('detecta verbos de comunicación en las opciones cuando el tipo es FAUNA', () => {
    expect(hasFalseFaunaCommunication('FAUNA', 'El gesgurio observa.', ['Intentar comunicarte con gesgurio', 'Ignorarlo'])).toBe(true);
    expect(hasFalseFaunaCommunication('FAUNA', 'El gesgurio observa.', ['Preguntarle por el camino', 'Ignorarlo'])).toBe(true);
  });

  it('detecta verbos de comunicación en la propia narración cuando el tipo es FAUNA', () => {
    expect(hasFalseFaunaCommunication('FAUNA', 'El gesgurio responde con un gruñido.', ['Observarlo', 'Ignorarlo'])).toBe(true);
    expect(hasFalseFaunaCommunication('FAUNA', 'Gorhorn intenta hablar con la criatura.', ['Observarlo', 'Ignorarlo'])).toBe(true);
  });

  it('nunca dispara cuando el tipo es NPC, aunque haya verbos de comunicación', () => {
    expect(hasFalseFaunaCommunication('NPC', 'Gistera Koh responde con calma.', ['Preguntarle qué quiere', 'Conversar'])).toBe(false);
  });

  it('no dispara con opciones/narración normales sin verbos de comunicación', () => {
    expect(hasFalseFaunaCommunication('FAUNA', 'El gesgurio se acerca con curiosidad.', ['Observarlo de lejos', 'Ofrecerle comida', 'Ignorarlo'])).toBe(false);
  });
});
