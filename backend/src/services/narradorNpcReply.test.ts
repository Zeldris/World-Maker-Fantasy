import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
  ollamaGenerateStream: vi.fn(),
}));

const { generateNpcReply, npcConoceNombreDelJugador, hablaDeSiComoOtro, abreConElNpc, replicaDefectuosa, hasPlayerLineAddressedToPlayer } = await import('./narrador.js');

describe('generateNpcReply (fase 1 hacia main, P327)', () => {
  beforeEach(() => {
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ reply: '«¿Qué quieres?»' }) });
  });

  it('con el nombre oculto, el prompt no lleva el nombre real ni el de pila', async () => {
    await generateNpcReply({
      npc: { name: 'Ugrak Tuerto', nombreVisible: 'Orco desconocido', role: 'guardián del paso', personality: 'Ugrak es callado.', bio: 'Ugrak Tuerto guarda el paso.' },
      characterName: 'Gorhorn',
      action: 'Hola, ¿quién eres?',
      sessionFacts: [],
    });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).toContain('PERSONAJE QUE ERES: Orco desconocido');
    expect(prompt).not.toMatch(/Ugrak/);
  });

  // QA-518 (P487): con el lore de lo nombrado, el NPC no dice «no conozco a nadie con ese nombre».
  it('el lore de lo nombrado entra en el prompt, tras los hechos; sin lore, ni el bloque', async () => {
    const npc = { name: 'Ulkha Ketg', role: 'Terk\'ikar', personality: '', bio: '' };
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: '¿Quién es Gistera?', sessionFacts: ['Gorhorn llega.'], lore: ['Gistera Koh y Uhuld Koh: Gistera huye con su hijo.'] });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).toMatch(/LO QUE SABES DEL MUNDO \(nunca digas que no lo conoces;[^\n]*desde tu lado: lo de otro clan, pueblo o raza es ajeno[^\n]*\):\n- Gistera Koh y Uhuld Koh: Gistera huye con su hijo\./);
    expect(prompt).toMatch(/1-2 frases[^\n]*sin recitarlo[^\n]*no inventes/);
    expect(prompt.indexOf('Gorhorn llega.')).toBeLessThan(prompt.indexOf('LO QUE SABES DEL MUNDO'));
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Hola', sessionFacts: [] });
    expect((ollamaGenerate.mock.calls[1]![0] as { prompt: string }).prompt).not.toContain('LO QUE SABES DEL MUNDO');
  });

  it('sin nombre oculto, el prompt lleva su nombre', async () => {
    await generateNpcReply({ npc: { name: 'Ugrak Tuerto', role: 'guardián', personality: '', bio: '' }, characterName: 'Gorhorn', action: 'Hola', sessionFacts: [] });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).toContain('PERSONAJE QUE ERES: Ugrak Tuerto');
  });
});

describe('generateNpcReply y el nombre del jugador (QA-289 fila 2, P266)', () => {
  const npc = { name: 'Ulkha Ketg', role: 'cazadora', personality: '', bio: '' };
  beforeEach(() => {
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ reply: '«¿Qué quieres?»' }) });
  });

  it('sin presentarse, el prompt no lleva el nombre del jugador ni en los hechos ni en la acción', async () => {
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Hola, ¿cazas por aquí?', sessionFacts: ['Gorhorn llega al Paso de los Pilares Rotos.'] });
    const { prompt } = ollamaGenerate.mock.calls[0]![0] as { prompt: string };
    expect(prompt).not.toMatch(/Gorhorn/);
    expect(prompt).toContain('el forastero llega al Paso');
    expect(prompt).toContain('no sabes cómo se llama');
  });

  it('si se presenta (en la acción o en un hecho que vio), el prompt lleva su nombre', async () => {
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Soy Gorhorn, del clan Maktor.', sessionFacts: [] });
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Hola otra vez', sessionFacts: ['Gorhorn le dice su nombre a Ulkha Ketg.'] });
    for (const call of ollamaGenerate.mock.calls) expect((call[0] as { prompt: string }).prompt).toContain('Gorhorn te acaba de decir');
  });

  it('npcConoceNombreDelJugador: nombrarlo no basta; hace falta presentarse', () => {
    expect(npcConoceNombreDelJugador('Gorhorn', 'Gorhorn saluda', ['Gorhorn camina hacia el norte.'])).toBe(false);
    expect(npcConoceNombreDelJugador('Gorhorn', 'Me llamo Gorhorn', [])).toBe(true);
    expect(npcConoceNombreDelJugador('Gorhorn', 'Hola', ['Gorhorn se presenta ante la cazadora.'])).toBe(true);
    expect(npcConoceNombreDelJugador('Gorhorn', 'Soy Gorhornix', [])).toBe(false);
  });
});

describe('generateNpcReply no habla de sí como de otra persona (QA-289, P263)', () => {
  const npc = { name: 'Ulkha Ketg', role: "Terk'ikar del Clan Serhu", personality: '', bio: '' };
  const mezclada = JSON.stringify({ reply: '«El mando sigue en manos de mi hermana, Ulkha Ketg.»' });
  beforeEach(() => ollamaGenerate.mockReset());

  it('los hechos sobre el NPC llevan «(tú)»', async () => {
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ reply: '«Mando yo.»' }) });
    await generateNpcReply({ npc, characterName: 'Gorhorn', action: '¿Quién manda en el Clan Serhu?', sessionFacts: ['En Clan Serhu manda Ulkha Ketg.'] });
    expect((ollamaGenerate.mock.calls[0]![0] as { prompt: string }).prompt).toContain('manda Ulkha Ketg (tú).');
  });

  it('si la réplica habla de sí como de otro, reintenta una vez; si repite, sin réplica', async () => {
    ollamaGenerate.mockResolvedValueOnce({ text: mezclada }).mockResolvedValueOnce({ text: JSON.stringify({ reply: '«Mando yo.»' }) });
    expect(await generateNpcReply({ npc, characterName: 'Gorhorn', action: '¿Quién manda?', sessionFacts: [] })).toBe('«Mando yo.»');
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: mezclada });
    expect(await generateNpcReply({ npc, characterName: 'Gorhorn', action: '¿Quién manda?', sessionFacts: [] })).toBe('');
    expect(ollamaGenerate).toHaveBeenCalledTimes(2);
  });

  it('hablaDeSiComoOtro: posesivo junto a su nombre sí; presentarse, no', () => {
    expect(hablaDeSiComoOtro('«El mando sigue en manos de mi hermana, Ulkha Ketg.»', 'Ulkha Ketg')).toBe(true);
    expect(hablaDeSiComoOtro('«Lo decide su jefa Ulkha Ketg.»', 'Ulkha Ketg')).toBe(true);
    expect(hablaDeSiComoOtro('«Yo, Ulkha Ketg, soy la que manda.»', 'Ulkha Ketg')).toBe(false);
    expect(hablaDeSiComoOtro('«Mi nombre es Ulkha Ketg.»', 'Ulkha Ketg')).toBe(false);
    expect(hablaDeSiComoOtro('«Mi hermano Torgash Ketg guía la guerra.»', 'Ulkha Ketg')).toBe(false);
  });
});

describe('abreConElNpc (QA-289, P412)', () => {
  it('true si en la primera frase el NPC sale antes que el jugador', () => {
    expect(abreConElNpc('Ulkha Ketg mira las raciones de viaje de Gorhorn con una sonrisa. Gorhorn calla.', 'Ulkha Ketg', 'Gorhorn')).toBe(true);
    expect(abreConElNpc('Ulkha Ketg sonríe despacio. Gorhorn le tiende el odre.', 'Ulkha Ketg', 'Gorhorn')).toBe(true);
    expect(abreConElNpc('Gorhorn le tiende el odre. Ulkha Ketg sonríe.', 'Ulkha Ketg', 'Gorhorn')).toBe(false);
  });
});

describe('acción del jugador delante (QA-289, P412, ronda 4)', () => {
  it('abre con la acción en tercera persona si la primera frase no nombra al jugador', async () => {
    const { conAccionDelanteDe } = await import('./narrador.js');
    const cielo = 'Ulkha Ketg mira hacia el cielo, sus ojos se entrecierran. Después, su mirada regresa a Gorhorn.';
    expect(conAccionDelanteDe(cielo, 'Observa el cielo sobre el campamento', 'Gorhorn', 'Observo el cielo sobre el campamento')).toBe(
      `Gorhorn observa el cielo sobre el campamento. ${cielo}`,
    );
    expect(conAccionDelanteDe('Ulkha Ketg calla.', 'Gorhorn le pregunta por el Clan Serhu.', 'Gorhorn', 'Le pregunto por el Clan Serhu')).toBe(
      'Gorhorn le pregunta por el Clan Serhu. Ulkha Ketg calla.',
    );
  });

  it('nombrar al jugador más adelante en la primera frase no basta (P412, ronda 5)', async () => {
    const { conAccionDelanteDe } = await import('./narrador.js');
    const cielo = "Ulkha Ketg se gira hacia Gorhorn, su mirada fría y calculadora. '¿Qué buscas en el cielo?'";
    expect(conAccionDelanteDe(cielo, 'Observa el cielo', 'Gorhorn', 'Observo el cielo')).toBe(`Gorhorn observa el cielo. ${cielo}`);
    const totem = 'Su mirada se desplaza hacia el tótem Maktor que Gorhorn lleva atado. Ulkha Ketg asiente.';
    expect(conAccionDelanteDe(totem, 'Saluda a Ulkha con respeto', 'Gorhorn', 'Saludo a Ulkha con respeto')).toBe(
      `Gorhorn saluda a Ulkha con respeto. ${totem}`,
    );
    const mientras = 'Mientras Gorhorn observa el cielo, el viento sopla.';
    expect(conAccionDelanteDe(mientras, 'Observa el cielo', 'Gorhorn', 'Observo el cielo')).toBe(mientras);
  });

  it('se deja si ya abre con el jugador, si el campo copia la acción o llega vacío', async () => {
    const { conAccionDelanteDe } = await import('./narrador.js');
    const deGorhorn = 'Gorhorn revisa el filo de su hacha. Brilla al sol.';
    expect(conAccionDelanteDe(deGorhorn, 'Revisa el filo de su hacha', 'Gorhorn', 'Reviso el filo de mi hacha')).toBe(deGorhorn);
    expect(conAccionDelanteDe('El orco calla.', 'Reviso el filo de mi hacha', 'Gorhorn', 'Reviso el filo de mi hacha')).toBe('El orco calla.');
    expect(conAccionDelanteDe('El orco calla.', '', 'Gorhorn', 'Reviso el filo de mi hacha')).toBe('El orco calla.');
    // Ronda 5d: primera persona e infinitivo no se ponen delante.
    expect(conAccionDelanteDe('Ulkha calla.', 'Afilo el cuchillo de hielo sílice', 'Gorhorn', 'Afilo mi cuchillo')).toBe('Ulkha calla.');
    expect(conAccionDelanteDe('Ulkha calla.', 'preguntar a Ulkha Ketg por la zona', 'Gorhorn', 'Le pregunto a Ulkha Ketg por la zona')).toBe('Ulkha calla.');
  });

  it('narrateAction pide el campo fuera de combate, lo pone delante y no lo devuelve', async () => {
    const { narrateAction, claveAccionDelJugador } = await import('./narrador.js');
    const clave = claveAccionDelJugador('Gorhorn');
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ [clave]: 'observa el cielo', narration: 'Ulkha Ketg mira hacia el cielo.', newFacts: [] }) });
    const res = await narrateAction({ worldFacts: [], characterSummary: 'Gorhorn, orco.', characterName: 'Gorhorn', action: 'Observo el cielo' } as Parameters<typeof narrateAction>[0]);
    expect(res.narration).toBe('Gorhorn observa el cielo. Ulkha Ketg mira hacia el cielo.');
    expect(clave in res).toBe(false);
    const opciones = ollamaGenerate.mock.calls[0]![0] as { prompt: string; format: { properties: Record<string, unknown>; required: string[] } };
    expect(Object.keys(opciones.format.properties)[0]).toBe(clave);
    // Ronda 5c: sin `required`, el modelo se lo saltaba siempre.
    expect(opciones.format.required[0]).toBe(clave);
    expect(opciones.prompt).toContain(`En "${clave}"`);
  });
});

describe('narrateAction tras repetir el turno anterior (QA-289, P414)', () => {
  const anterior = 'Ulkha Ketg mira a Gorhorn con una expresión de sorpresa mientras él bebe del odre junto a la hoguera del paso.';
  const ctx = {
    worldFacts: [`TU PROPIA NARRACIÓN DEL TURNO ANTERIOR (no la repitas): "${anterior}". Varía el vocabulario.`],
    characterSummary: 'Gorhorn, orco del Clan Maktor.',
    characterName: 'Gorhorn',
    action: 'Le pregunto a Ulkha Ketg qué la trae al paso',
    lastNarrationText: anterior,
  };
  beforeEach(() => {
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: anterior, newFacts: [] }) })
      .mockResolvedValue({ text: JSON.stringify({ narration: 'Gorhorn deja el odre en la piedra y se vuelve hacia la cazadora con el ceño fruncido.', newFacts: [] }) });
  });

  it('el reintento va sin la narración anterior y no cae al respaldo', async () => {
    const { narrateAction } = await import('./narrador.js');
    const res = await narrateAction(ctx as Parameters<typeof narrateAction>[0]);
    expect(res.narration).toMatch(/^Gorhorn deja el odre/);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts[0]).toContain('TU PROPIA NARRACIÓN DEL TURNO ANTERIOR');
    expect(prompts[1]).not.toContain('TU PROPIA NARRACIÓN DEL TURNO ANTERIOR');
  });
});

describe('narrateAction: el intento 2 conserva el prefijo tras un rechazo (QA-501)', () => {
  const ctx = {
    worldFacts: ['Hecho A de la escena.', 'Hecho B de la escena.', 'Hecho C de la escena.'],
    characterSummary: 'Gorhorn, orco del Clan Maktor.',
    characterName: 'Gorhorn',
    action: 'Miro el paso',
    criticalFactsCount: 1,
    backgroundLore: ['Lore de fondo del paso.'],
  };
  const buena = JSON.stringify({ narration: 'Gorhorn otea el paso rocoso con calma.', newFacts: [] });

  it('tras un rechazo de la guarda, el mismo prompt entero y el motivo al final', async () => {
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: 'Gorhorn mira the river con calma.', newFacts: [] }) })
      .mockResolvedValue({ text: buena });
    const { narrateAction } = await import('./narrador.js');
    await narrateAction(ctx as unknown as Parameters<typeof narrateAction>[0]);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts[1]!.startsWith(prompts[0]!)).toBe(true);
    expect(prompts[1]).toContain('Hecho C de la escena.');
    expect(prompts[1]!.slice(prompts[0]!.length)).toMatch(/SE DESCARTÓ POR: fuga de inglés/);
  });

  it('revisión: el intento 3 tras un rechazo va recortado (QA-166) pero con el motivo del descarte', async () => {
    ollamaGenerate.mockReset();
    const mala = JSON.stringify({ narration: 'Gorhorn mira the river con calma.', newFacts: [] });
    ollamaGenerate.mockResolvedValueOnce({ text: mala }).mockResolvedValueOnce({ text: mala }).mockResolvedValue({ text: buena });
    const { narrateAction } = await import('./narrador.js');
    await narrateAction(ctx as unknown as Parameters<typeof narrateAction>[0]);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).not.toContain('Hecho C de la escena.');
    expect(prompts[2]).toMatch(/SE DESCARTÓ POR: fuga de inglés/);
  });

  it('tras un fallo técnico (JSON cortado), el prompt recortado', async () => {
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValueOnce({ text: '{"narration": "Gorhorn mi' }).mockResolvedValue({ text: buena });
    const { narrateAction } = await import('./narrador.js');
    await narrateAction(ctx as unknown as Parameters<typeof narrateAction>[0]);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts[0]).toContain('Hecho C de la escena.');
    expect(prompts[1]).not.toContain('Hecho C de la escena.');
    expect(prompts[1]).not.toContain('Lore de fondo del paso.');
    expect(prompts[1]).not.toMatch(/SE DESCARTÓ/);
  });
});

describe('narrateAction con todos los intentos rechazados por motivos distintos (QA-289)', () => {
  it('el último resultado también pasa por el posproceso: sin el campo de la acción y con ella delante', async () => {
    const anterior = 'Ulkha Ketg mira a Gorhorn con una expresión de sorpresa mientras él bebe del odre junto a la hoguera del paso.';
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: anterior, newFacts: [] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: anterior, newFacts: [] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: 'El viento trae un hechizo antiguo sobre el paso rocoso.', newFacts: [], loQueHaceGorhorn: 'afila el cuchillo contra la piedra' }) });
    const { narrateAction } = await import('./narrador.js');
    const res = await narrateAction({
      worldFacts: [],
      characterSummary: 'Gorhorn, orco del Clan Maktor.',
      characterName: 'Gorhorn',
      characterClase: 'GUERRERO',
      action: 'Miro el paso',
      lastNarrationText: anterior,
    } as unknown as Parameters<typeof narrateAction>[0]);
    expect(res.narration).toMatch(/^Gorhorn afila el cuchillo contra la piedra\./);
    expect(res).not.toHaveProperty('loQueHaceGorhorn');
  });
});

describe('gesto repetido y réplica sin hablante (QA-289, P411)', () => {
  it('quita la frase que repite 6 palabras seguidas del turno anterior; si es la única, la deja', async () => {
    const { quitarFrasesRepetidas } = await import('./narrador.js');
    const anterior = 'Ulkha Ketg se ajusta su cinturón de cuero mientras habla. El viento sopla.';
    expect(quitarFrasesRepetidas('Gorhorn bebe del odre. Ulkha se ajusta su cinturón de cuero mientras habla.', anterior)).toBe('Gorhorn bebe del odre.');
    expect(quitarFrasesRepetidas('Ulkha se ajusta su cinturón de cuero mientras habla.', anterior)).toBe('Ulkha se ajusta su cinturón de cuero mientras habla.');
    expect(quitarFrasesRepetidas('Gorhorn bebe del odre. Ulkha se ajusta el cinturón y calla.', anterior)).toBe('Gorhorn bebe del odre. Ulkha se ajusta el cinturón y calla.');
  });

  it('la réplica lleva hablante si la última frase no lo nombra', async () => {
    const { unirReplica } = await import('./narrador.js');
    const orco = { name: 'Orco Enfurecido', articulo: 'el', genero: 'M' };
    expect(unirReplica('Gorhorn se acerca. Ulkha Ketg mira a Gorhorn.', '«¡Fuera!»', orco)).toBe('Gorhorn se acerca. Ulkha Ketg mira a Gorhorn. El orco enfurecido responde: «¡Fuera!»');
    expect(unirReplica('Gorhorn se acerca. El Orco Enfurecido gruñe.', '«¡Fuera!»', orco)).toBe('Gorhorn se acerca. El Orco Enfurecido gruñe. «¡Fuera!»');
    expect(unirReplica('Gorhorn pregunta.', '«Me llamo Ulkha.»', { name: 'Ulkha Ketg', articulo: null, genero: 'F' })).toBe('Gorhorn pregunta. Ulkha Ketg responde: «Me llamo Ulkha.»');
    // P425: un guion suelto al abrir la réplica, dentro o fuera de la comilla, se quita.
    expect(unirReplica('Gorhorn pregunta.', '«-La situación es inmutable.»', { name: 'Ulkha Ketg', articulo: null, genero: 'F' })).toBe('Gorhorn pregunta. Ulkha Ketg responde: «La situación es inmutable.»');
    expect(unirReplica('Gorhorn pregunta.', '- La situación es inmutable.', { name: 'Ulkha Ketg', articulo: null, genero: 'F' })).toBe('Gorhorn pregunta. Ulkha Ketg responde: «La situación es inmutable.»');
    expect(unirReplica('Gorhorn pregunta.', '«Aquí no.»', { name: 'Ulkha Ketg', nombreVisible: 'Orca desconocida', articulo: null, genero: 'F' })).toBe('Gorhorn pregunta. La orca desconocida responde: «Aquí no.»');
  });

  it('QA-289: sin réplica (vacía) se pone una de respaldo, para que el NPC conteste algo', async () => {
    const { unirReplica, REPLICA_DE_RESPALDO } = await import('./narrador.js');
    expect(unirReplica('Gorhorn pregunta.', '  ', { name: 'Ulkha Ketg', articulo: null, genero: 'F' })).toBe(`Gorhorn pregunta. Ulkha Ketg responde: ${REPLICA_DE_RESPALDO}`);
  });

  it('QA-289: quitarCitas, quitarRestosDeDialogo y empezarPorElJugador conservan los saltos de párrafo', async () => {
    const { quitarCitas, quitarRestosDeDialogo, empezarPorElJugador } = await import('./narrador.js');
    expect(quitarCitas('Gorhorn mira el paso.\n\nUlkha dice «Fuera» y calla.')).toBe('Gorhorn mira el paso.\n\nUlkha dice y calla.');
    expect(quitarRestosDeDialogo('Gorhorn mira.\n\n¿Qué quieres?\n\nUlkha calla.', 'Gorhorn')).toBe('Gorhorn mira.\n\nUlkha calla.');
    expect(empezarPorElJugador('Gorhorn mira.\n\nUlkha calla.', 'Ulkha Ketg', 'Gorhorn')).toBe('Gorhorn mira.\n\nUlkha calla.');
  });

  it('la réplica sin comillas va entre «…», y tras una frase sin acabar, con dos puntos (bench 20)', async () => {
    const { unirReplica } = await import('./narrador.js');
    const ulkha = { name: 'Ulkha Ketg', articulo: null, genero: 'F' };
    expect(unirReplica('Gorhorn pregunta a Ulkha Ketg qué la trae al paso, y ella responde', 'Estoy aquí por las huellas.', ulkha)).toBe(
      'Gorhorn pregunta a Ulkha Ketg qué la trae al paso, y ella responde: «Estoy aquí por las huellas.»',
    );
    expect(unirReplica('Ulkha Ketg se presenta con una voz suave,', "'Soy Ulkha Ketg.'", ulkha)).toBe('Ulkha Ketg se presenta con una voz suave: «Soy Ulkha Ketg.»');
  });

  it('si todas las frases repiten el turno anterior, cuenta como repetición (ronda 2, 12:21-12:22)', async () => {
    const { repiteTodasLasFrases } = await import('./narrador.js');
    const anterior = 'Ulkha Ketg mira a Gorhorn con una expresión seria, su mirada fija en los ojos de Gorhorn. La jefa del Clan Serhu se queda en silencio durante un momento.';
    expect(repiteTodasLasFrases('Ulkha mira a Gorhorn con una expresión seria, su mirada fija en él. La jefa del Clan Serhu se queda en silencio durante un momento.', anterior)).toBe(true);
    expect(repiteTodasLasFrases('Gorhorn deja el odre. La jefa del Clan Serhu se queda en silencio durante un momento.', anterior)).toBe(false);
    expect(repiteTodasLasFrases('Ulkha mira a Gorhorn con una expresión seria.', undefined)).toBe(false);
  });

  it('la réplica que empieza igual que la anterior se pide otra vez; el eco se quita', async () => {
    const { generateNpcReply, empiezaIgual, ultimaReplica } = await import('./narrador.js');
    expect(empiezaIgual('«¿Qué sabes tú de mi clan?»', '«¿Qué sabes tú de ella?»')).toBe(true);
    expect(empiezaIgual('«Vete de aquí.»', '«¿Qué sabes tú de ella?»')).toBe(false);
    expect(ultimaReplica('Gorhorn pregunta. El orco responde: «¿Qué sabes tú de ella?» Y escupe.')).toBe('«¿Qué sabes tú de ella?»');
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: '«¿Qué sabes tú de mi clan?»' }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: '«No te importa, no te importa, no te importa…»' }) });
    const npc = { name: 'Orco Enfurecido', role: 'guerrero', personality: '', bio: '' };
    const reply = await generateNpcReply({ npc, characterName: 'Gorhorn', action: '¿Quién es tu familia?', sessionFacts: [], replicaAnterior: '«¿Qué sabes tú de ella?»' });
    expect(reply).toBe('«No te importa…»');
    expect((ollamaGenerate.mock.calls[0]![0] as { prompt: string }).prompt).toContain('Tu réplica anterior fue «¿Qué sabes tú de ella?»');
  });
});

describe('restos de diálogo en la narración (QA-289, ronda 2: P415, P416, P417)', () => {
  it('quita preguntas sueltas, cierres sin apertura, coletillas sin cita y frases sobre la respuesta', async () => {
    const { quitarRestosDeDialogo } = await import('./narrador.js');
    expect(quitarRestosDeDialogo('¿Qué sabes tú de ella? ¿Por qué preguntas por ella?» El orco aprieta los puños.', 'Gorhorn')).toBe('El orco aprieta los puños.');
    expect(quitarRestosDeDialogo('El orco duda, pero decide hablar. dice con una voz agitada.', 'Gorhorn')).toBe('El orco duda, pero decide hablar.');
    expect(quitarRestosDeDialogo('Gorhorn inclina la cabeza con un gesto de respeto. dice Gorhorn con voz suave.', 'Gorhorn')).toBe('Gorhorn inclina la cabeza con un gesto de respeto.');
    expect(quitarRestosDeDialogo('El orco se tensa. La respuesta del orco es un susurro.', 'Gorhorn')).toBe('El orco se tensa.');
    expect(quitarRestosDeDialogo('Gorhorn le responde con calma. El orco se tensa.', 'Gorhorn')).toBe('Gorhorn le responde con calma. El orco se tensa.');
    expect(quitarRestosDeDialogo('Gorhorn pregunta a Ulkha Ketg qué la trae al paso, y ella responde', 'Gorhorn')).toBe('Gorhorn pregunta a Ulkha Ketg qué la trae al paso, y ella responde');
    // P423: la narración decidía la respuesta del NPC («acepta la oferta») y la réplica, aparte, la contradecía.
    expect(quitarRestosDeDialogo('Gorhorn le tiende el odre. El orco acepta la oferta, pero su mirada sigue siendo furtiva. El viento sopla.', 'Gorhorn')).toBe('Gorhorn le tiende el odre. El viento sopla.');
    expect(quitarRestosDeDialogo('Gorhorn le tiende el odre. Ella rechaza el agua con un gesto seco.', 'Gorhorn')).toBe('Gorhorn le tiende el odre.');
    expect(quitarRestosDeDialogo('Gorhorn le tiende el odre. El orco se niega a mirarlo.', 'Gorhorn')).toBe('Gorhorn le tiende el odre.');
    expect(quitarRestosDeDialogo('Gorhorn acepta el reto y da un paso al frente.', 'Gorhorn')).toBe('Gorhorn acepta el reto y da un paso al frente.');
  });

  it('sinEco quita trozos repetidos seguidos y deja la puntuación del último', async () => {
    const { sinEco } = await import('./narrador.js');
    expect(sinEco('«No te importa, no te importa, no te importa…»')).toBe('«No te importa…»');
    expect(sinEco('«Vete. Vete ya.»')).toBe('«Vete. Vete ya.»');
  });
});

describe('nombre inventado en la réplica (QA-289, ronda 2: P420)', () => {
  const conocidos = new Set(['clan', 'serhu', 'maktor', 'ulkha', 'ketg']);

  it('nombreInventado: un nombre propio a media frase fuera del vocabulario; al abrir frase, no', async () => {
    const { nombreInventado } = await import('./narrador.js');
    expect(nombreInventado('«El honor busca la verdad sobre la traición de los Goirntes, que han armado a mi clan.»', conocidos, [])).toBe('Goirntes');
    expect(nombreInventado('«El Clan Serhu no olvida a los Maktor.»', conocidos, [])).toBeNull();
    expect(nombreInventado('«Vete. Nadie te ha llamado.»', conocidos, [])).toBeNull();
    expect(nombreInventado('«Saluda a Gorhorn de mi parte.»', conocidos, ['Gorhorn bebe del odre.'])).toBeNull();
  });

  it('generateNpcReply pide otra réplica si trae un nombre inventado', async () => {
    const { generateNpcReply } = await import('./narrador.js');
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: '«Busco la traición de los Goirntes.»' }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: '«Busco a quien traicionó al Clan Serhu.»' }) });
    const npc = { name: 'Ulkha Ketg', role: 'cazadora', personality: '', bio: '' };
    expect(await generateNpcReply({ npc, characterName: 'Gorhorn', action: '¿Qué buscas?', sessionFacts: [], nombresConocidos: conocidos })).toBe('«Busco a quien traicionó al Clan Serhu.»');
  });
});

describe('empezarPorElJugador (QA-289, ronda 2: P412)', () => {
  it('si abre con el NPC, sus frases del principio pasan al final', async () => {
    const { empezarPorElJugador } = await import('./narrador.js');
    expect(empezarPorElJugador('Ulkha Ketg sonríe despacio. Gorhorn le tiende el odre. El viento sopla.', 'Ulkha Ketg', 'Gorhorn')).toBe(
      'Gorhorn le tiende el odre. El viento sopla. Ulkha Ketg sonríe despacio.',
    );
    expect(empezarPorElJugador('Ulkha Ketg sonríe. Gorhorn se acerca. Gorhorn pregunta qué la trae al paso, y ella responde', 'Ulkha Ketg', 'Gorhorn')).toBe(
      'Gorhorn se acerca. Ulkha Ketg sonríe. Gorhorn pregunta qué la trae al paso, y ella responde',
    );
    expect(empezarPorElJugador('Ulkha Ketg sonríe. Ella se aparta el pelo.', 'Ulkha Ketg', 'Gorhorn', 'F')).toBe('Ulkha Ketg sonríe. Ella se aparta el pelo.');
  });

  it('P425: abre con «Ella» siendo NPC, o sin nombrar al jugador: abre la primera frase que no es del NPC', async () => {
    const { empezarPorElJugador, abreConElNpc } = await import('./narrador.js');
    expect(empezarPorElJugador('Ella se acerca a Gorhorn con una elegancia fluida. Gorhorn la saluda con la cabeza.', 'Ulkha Ketg', 'Gorhorn', 'F')).toBe(
      'Gorhorn la saluda con la cabeza. Ella se acerca a Gorhorn con una elegancia fluida.',
    );
    expect(empezarPorElJugador('Ulkha Ketg se vuelve hacia él. El viento sopla en la hondonada.', 'Ulkha Ketg', 'Gorhorn')).toBe(
      'El viento sopla en la hondonada. Ulkha Ketg se vuelve hacia él.',
    );
    expect(abreConElNpc('Él la mira. Ulkha Ketg calla.', 'Ulkha Ketg', 'Gorhorn', 'M')).toBe(false);
    expect(abreConElNpc('Ella calla.', 'Ulkha Ketg', 'Gorhorn')).toBe(false);
    expect(empezarPorElJugador('Gorhorn le tiende el odre. Ulkha Ketg sonríe.', 'Ulkha Ketg', 'Gorhorn')).toBe('Gorhorn le tiende el odre. Ulkha Ketg sonríe.');
  });
});

describe('resultado del golpe obligatorio en combate (QA-340)', () => {
  const base = { worldFacts: [], characterSummary: 'Gorhorn, orco.', characterName: 'Gorhorn', action: 'Ataco con el hacha', enCombate: true, combatRivalNarrado: 'Orco enfurecido' };

  it('el valor sale de la mecánica: nadie, el jugador, el rival o los dos', async () => {
    const { resultadoDelGolpe } = await import('./narrador.js');
    expect(resultadoDelGolpe({ ...base, combatBothMissed: true })).toBe('Nadie acierta: ni Gorhorn ni Orco enfurecido conectan su golpe.');
    // QA-504 (P481): defendiéndose, el golpe se pierde (sin «impacto» que absorber ni resistir): en positivo y sin cubrirse.
    const defensa = resultadoDelGolpe({ ...base, combatBothMissed: true, playerActedAsDefenderThisExchange: true });
    expect(defensa).toMatch(/^(El golpe de Orco enfurecido se pierde en el aire: Gorhorn lo esquiva y no le toca\. Orco enfurecido sigue en pie y atento\.|Orco enfurecido lanza su golpe y Gorhorn lo desv[ií]a: pasa de largo sin tocarle\. Orco enfurecido sigue en pie, en guardia\.|El ataque de Orco enfurecido falla: Gorhorn se aparta a tiempo y el golpe pasa de largo, sin tocarle\. Orco enfurecido sigue en pie y listo\.)$/);
    // QA-508: las tres variantes dicen que el rival sigue en pie, y sin ideas de derribo.
    expect(defensa).toContain('Orco enfurecido sigue en pie');
    expect(defensa).not.toMatch(/desplom|derrib|ca[eé]/i);
    expect(defensa).not.toMatch(/impacto|absorb|resist|encaj|se cubre/i);
    // Determinista por turno, y varía según la acción.
    expect(resultadoDelGolpe({ ...base, combatBothMissed: true, playerActedAsDefenderThisExchange: true })).toBe(defensa);
    const distintas = new Set(['Me defiendo', 'Me cubro', 'Paro el golpe', 'Levanto el escudo'].map((action) => resultadoDelGolpe({ ...base, action, combatBothMissed: true, playerActedAsDefenderThisExchange: true })));
    expect(distintas.size).toBeGreaterThan(1);
    expect(resultadoDelGolpe({ ...base, jugadorConectaEsteTurno: true })).toBe('Gorhorn acierta y golpea a Orco enfurecido; Orco enfurecido no le acierta.');
    expect(resultadoDelGolpe({ ...base, jugadorRecibeGolpeEsteTurno: true })).toBe('Orco enfurecido acierta y golpea a Gorhorn; Gorhorn no le acierta.');
    expect(resultadoDelGolpe({ ...base, jugadorConectaEsteTurno: true, jugadorRecibeGolpeEsteTurno: true })).toMatch(/^Los dos aciertan/);
    // Sin intercambio resuelto, fuera de combate o sin rival, no hay campo.
    expect(resultadoDelGolpe({ ...base })).toBeNull();
    expect(resultadoDelGolpe({ ...base, enCombate: false, combatBothMissed: true })).toBeNull();
    expect(resultadoDelGolpe({ ...base, combatRivalNarrado: undefined, combatBothMissed: true })).toBeNull();
    // En la Deck, con el nombre real, la narración llamó «Orco enfurecido» al rival sin descubrir: va el narrado.
    expect(resultadoDelGolpe({ ...base, combatRivalNarrado: 'el orco desconocido', jugadorRecibeGolpeEsteTurno: true })).toBe(
      'El orco desconocido acierta y golpea a Gorhorn; Gorhorn no le acierta.',
    );
  });

  it('P473: el prompt dice quién golpea a quién y el reintento lleva ese hecho', async () => {
    const { narrateAction } = await import('./narrador.js');
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ narration: 'Gorhorn clava el hacha en el orco.', newFacts: [] }) });
    await narrateAction({ ...base, jugadorRecibeGolpeEsteTurno: true } as Parameters<typeof narrateAction>[0]);
    const frase = 'Orco enfurecido acierta y golpea a Gorhorn; Gorhorn no le acierta.';
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts[0]).toContain(`RESULTADO YA DECIDIDO, NO LO CAMBIES: ${frase}`);
    // Rechazado el 1.º (jugador acertando), el reintento lleva el hecho entre los HECHOS.
    expect(prompts.length).toBeGreaterThan(1);
    expect(prompts[1]).toContain(`Resultado del intercambio (ya decidido): ${frase}`);
  });

  it('QA-504: tras rechazar un golpe falso defendiéndose, el reintento dice en positivo que el golpe no le toca', async () => {
    const { narrateAction } = await import('./narrador.js');
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: 'Gorhorn clava el hacha en el orco y el golpe del orco le alcanza.', newFacts: [] }) })
      .mockResolvedValue({ text: JSON.stringify({ narration: 'El orco lanza su golpe y Gorhorn lo esquiva.', newFacts: [] }) });
    await narrateAction({ ...base, combatBothMissed: true, playerActedAsDefenderThisExchange: true } as Parameters<typeof narrateAction>[0]);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts.length).toBeGreaterThan(1);
    expect(prompts[0]).not.toContain('TU RESPUESTA ANTERIOR');
    expect(prompts[1]).toContain('Cuéntalo así: el golpe de Orco enfurecido falla, se pierde en el aire o Gorhorn lo esquiva o lo desvía, y no le toca. Orco enfurecido sigue en pie y atento.');
  });

  it('QA-508: en defensa sin acierto, el 1.er intento y el reintento dicen que el rival sigue en pie', async () => {
    const { narrateAction } = await import('./narrador.js');
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ narration: 'Gorhorn clava el hacha en el orco y el golpe del orco le alcanza.', newFacts: [] }) })
      .mockResolvedValue({ text: JSON.stringify({ narration: 'El orco lanza su golpe y Gorhorn lo esquiva.', newFacts: [] }) });
    await narrateAction({ ...base, combatBothMissed: true, playerActedAsDefenderThisExchange: true } as Parameters<typeof narrateAction>[0]);
    const prompts = ollamaGenerate.mock.calls.map((c) => (c[0] as { prompt: string }).prompt);
    expect(prompts[0]).toMatch(/RESULTADO YA DECIDIDO, NO LO CAMBIES: .*Orco enfurecido sigue en pie/);
    expect(prompts[1]).toMatch(/Cuéntalo así: .*Orco enfurecido sigue en pie y atento\./);
  });

  it('narrateAction lo pide primero, obligatorio y con un único valor, y no lo devuelve', async () => {
    const { narrateAction, CLAVE_RESULTADO_GOLPE } = await import('./narrador.js');
    const valor = 'Nadie acierta: ni Gorhorn ni Orco enfurecido conectan su golpe.';
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: JSON.stringify({ [CLAVE_RESULTADO_GOLPE]: valor, narration: 'Gorhorn lanza el hacha y el Orco enfurecido la esquiva.', newFacts: [] }) });
    const res = await narrateAction({ ...base, combatBothMissed: true } as Parameters<typeof narrateAction>[0]);
    expect(CLAVE_RESULTADO_GOLPE in res).toBe(false);
    const { format } = ollamaGenerate.mock.calls[0]![0] as { format: { properties: Record<string, { enum?: string[] }>; required: string[] } };
    expect(Object.keys(format.properties)[0]).toBe(CLAVE_RESULTADO_GOLPE);
    expect(format.properties[CLAVE_RESULTADO_GOLPE]!.enum).toEqual([valor]);
    expect(format.required[0]).toBe(CLAVE_RESULTADO_GOLPE);
  });
});

describe('réplica defectuosa del NPC (P466, P467, P469)', () => {
  const npc = { name: 'Ulkha Ketg', role: 'cazadora', personality: '', bio: '' };
  beforeEach(() => ollamaGenerate.mockReset());

  it('replicaDefectuosa: acotación, tercera persona propia, nombre del jugador sin conocerlo', () => {
    expect(replicaDefectuosa('«Ulkha Ketg se inclina hacia Gorhorn, su mirada fija.»', npc, 'Gorhorn', true)).toBe('acotación sin frase hablada');
    expect(replicaDefectuosa('«Si quieres que Ulkha Ketg te escuche, ofrécele algo.»', npc, 'Gorhorn', false)).toBe('habla de sí en tercera persona');
    expect(replicaDefectuosa('«¿Qué quieres, Gorhorn?»', npc, 'Gorhorn', false)).toBe('nombre del jugador sin conocerlo');
    expect(replicaDefectuosa('«¿Qué quieres, Gorhorn?»', npc, 'Gorhorn', true)).toBeNull();
    expect(replicaDefectuosa('«Yo, Ulkha Ketg, mando aquí.»', npc, 'Gorhorn', true)).toBeNull();
    expect(replicaDefectuosa('«Me llamo Ulkha Ketg.»', npc, 'Gorhorn', true)).toBeNull();
  });

  it('una réplica que es solo acotación se pide otra vez; si repite, sin réplica', async () => {
    const acotacion = JSON.stringify({ reply: 'Ulkha Ketg se inclina hacia el forastero, su voz baja y profunda resuena.' });
    ollamaGenerate.mockResolvedValueOnce({ text: acotacion }).mockResolvedValueOnce({ text: JSON.stringify({ reply: '«Los Maktor cayeron en la guerra.»' }) });
    expect(await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Cuéntame qué pasó con los Maktor', sessionFacts: [] })).toBe('«Los Maktor cayeron en la guerra.»');
    ollamaGenerate.mockReset();
    ollamaGenerate.mockResolvedValue({ text: acotacion });
    expect(await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Cuéntame', sessionFacts: [] })).toBe('');
  });

  it('un NPC que no conoce al jugador no lo llama por su nombre', async () => {
    ollamaGenerate.mockResolvedValueOnce({ text: JSON.stringify({ reply: '«¿Qué quieres, Gorhorn?»' }) }).mockResolvedValueOnce({ text: JSON.stringify({ reply: '«¿Qué quieres, forastero?»' }) });
    expect(await generateNpcReply({ npc, characterName: 'Gorhorn', action: 'Hola, ¿cazas por aquí?', sessionFacts: [] })).toBe('«¿Qué quieres, forastero?»');
  });
});

describe('réplica sin habla y cita del NPC en boca del jugador (P466, P474)', () => {
  const npc = { name: 'Ulkha Ketg', role: 'cazadora', personality: '', bio: '' };
  it('P466: acotación sin comillas que abre con una parte del nombre o habla del jugador se rechaza', () => {
    expect(replicaDefectuosa('Ulkha mira hacia Gorhorn, su rostro serio.', npc, 'Gorhorn', true)).toBe('acotación sin frase hablada');
    expect(replicaDefectuosa('Se inclina hacia Gorhorn, su mirada fija y sin parpadear, mientras su voz baja resuena en la plaza.', npc, 'Gorhorn', true)).toBe('acotación sin frase hablada');
    expect(replicaDefectuosa('Los Maktor cayeron en la guerra, Gorhorn.', npc, 'Gorhorn', true)).toBeNull();
    expect(replicaDefectuosa('Ulkha, así me llaman: los Maktor cayeron por débiles.', npc, 'Gorhorn', true)).toBeNull();
    expect(replicaDefectuosa('«La caída del Clan Maktor fue el resultado de su propia debilidad, Gorhorn.»', npc, 'Gorhorn', true)).toBeNull();    // Vocativo sin coma tras «mira»: es habla, no una acotación (revisión de P466).
    expect(replicaDefectuosa('Mira Gorhorn, los Maktor cayeron por débiles.', npc, 'Gorhorn', true)).toBeNull();
  });
  it('P474: una cita con el nombre del jugador en vocativo no puede abrirla el propio jugador', () => {
    expect(hasPlayerLineAddressedToPlayer('Gorhorn se acerca a Ulkha… "La caída del Clan Maktor fue el resultado de su propia debilidad, Gorhorn"', 'Gorhorn')).toBe(true);
    expect(hasPlayerLineAddressedToPlayer('Ulkha Ketg lo mira. Gorhorn dice: «Gorhorn, ¿qué quieres?»', 'Gorhorn')).toBe(true);
    expect(hasPlayerLineAddressedToPlayer('Ulkha Ketg responde: «La caída del Clan Maktor fue su debilidad, Gorhorn.»', 'Gorhorn')).toBe(false);
    expect(hasPlayerLineAddressedToPlayer('Gorhorn se acerca a Ulkha. «¿Qué pasó con los Maktor, Ulkha?»', 'Gorhorn')).toBe(false);
    expect(hasPlayerLineAddressedToPlayer('Gorhorn asiente. Ulkha Ketg lo mira: «Escucha, Gorhorn.»', 'Gorhorn')).toBe(false);
  });
});

describe('turno de diálogo puro sin narrador (P464b, P466, P474, P476)', () => {
  it('la línea fija cita lo que dice el jugador, o dice solo a quién se dirige', async () => {
    const { lineaDialogoDelJugador } = await import('./narrador.js');
    expect(lineaDialogoDelJugador('Gorhorn', 'Le digo a Gistera Koh: ¿quién manda en el Clan Serhu?', 'Gistera Koh')).toBe('Gorhorn le pregunta a Gistera Koh: «¿Quién manda en el Clan Serhu?»');
    expect(lineaDialogoDelJugador('Gorhorn', 'Le digo a Ulkha: «Cuéntame qué pasó con los Maktor, Ulkha»', 'Ulkha Ketg')).toBe('Gorhorn le dice a Ulkha Ketg: «Cuéntame qué pasó con los Maktor, Ulkha.»');
    expect(lineaDialogoDelJugador('Gorhorn', 'Le pregunto qué opina de mí', 'el orco desconocido')).toBe('Gorhorn se vuelve hacia el orco desconocido y le pregunta.');
    expect(lineaDialogoDelJugador('Gorhorn', 'Saludo con la cabeza', 'el orco desconocido')).toBe('Gorhorn se dirige al orco desconocido.');
    expect(lineaDialogoDelJugador('Gorhorn', 'Saludo con la cabeza', 'la orca desconocida')).toBe('Gorhorn se dirige a la orca desconocida.');
  });

  it('la réplica lleva siempre su hablante, aunque la línea del jugador ya nombre al NPC', async () => {
    const { unirReplica } = await import('./narrador.js');
    const ulkha = { name: 'Ulkha Ketg', articulo: null, genero: 'F' };
    expect(unirReplica('Gorhorn le pregunta a Ulkha Ketg: «¿Qué te trae?»', '«El hambre.»', ulkha, true)).toBe('Gorhorn le pregunta a Ulkha Ketg: «¿Qué te trae?» Ulkha Ketg responde: «El hambre.»');
    expect(unirReplica('Gorhorn le pregunta a Ulkha Ketg: «¿Qué te trae?»', '«El hambre.»', ulkha)).toBe('Gorhorn le pregunta a Ulkha Ketg: «¿Qué te trae?» «El hambre.»');
  });
});

describe('P273: dialogo_npc lleva intento y el motivo del rechazo anterior', () => {
  it('el reintento va con intento 2 y el motivo; el primero sin motivo', async () => {
    ollamaGenerate.mockReset();
    ollamaGenerate
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: 'Ulkha Ketg se inclina hacia ti.' }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: '«Pasa, viajero.»' }) });
    await generateNpcReply({ npc: { name: 'Ulkha Ketg', role: 'guardia', personality: '', bio: '' }, characterName: 'Gorhorn', action: 'Hola', sessionFacts: [] });
    const [a, b] = ollamaGenerate.mock.calls.map((c) => c[0] as { intento?: number; rechazoPrevio?: string });
    expect(a).toMatchObject({ intento: 1 });
    expect(a!.rechazoPrevio).toBeUndefined();
    expect(b).toMatchObject({ intento: 2, rechazoPrevio: 'acotación sin frase hablada' });
  });
});
