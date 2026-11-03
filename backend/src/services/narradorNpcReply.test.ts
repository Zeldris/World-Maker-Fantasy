import { describe, it, expect, vi, beforeEach } from 'vitest';

const ollamaGenerate = vi.fn();
vi.mock('../lib/ollama.js', () => ({
  ollamaGenerate: (...args: unknown[]) => ollamaGenerate(...args),
  ollamaGenerateStream: vi.fn(),
}));

const { generateNpcReply, npcConoceNombreDelJugador, hablaDeSiComoOtro, abreConElNpc } = await import('./narrador.js');

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
    expect(unirReplica('Gorhorn pregunta.', '«Aquí no.»', { name: 'Ulkha Ketg', nombreVisible: 'Orca desconocida', articulo: null, genero: 'F' })).toBe('Gorhorn pregunta. La orca desconocida responde: «Aquí no.»');
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
    expect(empezarPorElJugador('Ulkha Ketg sonríe. El viento sopla.', 'Ulkha Ketg', 'Gorhorn')).toBe('Ulkha Ketg sonríe. El viento sopla.');
    expect(empezarPorElJugador('Gorhorn le tiende el odre. Ulkha Ketg sonríe.', 'Ulkha Ketg', 'Gorhorn')).toBe('Gorhorn le tiende el odre. Ulkha Ketg sonríe.');
  });
});
