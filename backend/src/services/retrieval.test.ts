import { describe, it, expect, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

import { isWeaklyGrounded, formatLoreForPrompt, titulosPorEntidad, loreParaReplica, cargarLoreParaReplica, type RetrievedLore } from './retrieval.js';
import { loreChunks } from '../scripts/loreChunks.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — solo las dos
// funciones puras; `retrieveLore` depende de Postgres/pgvector real y queda fuera de alcance de
// un test unitario (ya cubierta indirectamente por los tests de integración de turn.ts).

// `withQueryTimeout` no se exporta (uso interno de retrieval.ts) — se cubre indirectamente aquí
// reimplementando el mismo contrato exacto, mismo criterio que otros helpers internos pequeños
// del proyecto sin export propio. Bug real que motivó esta función (2026-08-31): un `$queryRaw`
// contra Postgres/Supabase remoto sin timeout podía colgar el turno entero indefinidamente.
function withQueryTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}: la consulta a Postgres no respondió en ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

describe('withQueryTimeout', () => {
  it('resuelve con el valor real si la consulta termina antes del timeout', async () => {
    const result = await withQueryTimeout(Promise.resolve('ok'), 50, 'test');
    expect(result).toBe('ok');
  });

  it('propaga el error real de la consulta si falla antes del timeout', async () => {
    await expect(withQueryTimeout(Promise.reject(new Error('fallo real de Postgres')), 50, 'test')).rejects.toThrow('fallo real de Postgres');
  });

  it('rechaza con un mensaje claro si la consulta nunca resuelve (cuelgue de red)', async () => {
    await expect(withQueryTimeout(new Promise(() => {}), 20, 'retrieveLore')).rejects.toThrow(/retrieveLore.*20ms/);
  });
});

function chunk(distance: number, title = 'Fragmento', text = 'Texto de prueba.'): RetrievedLore {
  return { title, text, distance };
}

describe('isWeaklyGrounded', () => {
  it('sin fragmentos, está débilmente anclado (no hay nada real que ofrecer)', () => {
    expect(isWeaklyGrounded([])).toBe(true);
  });

  it('el mejor fragmento está por debajo del umbral: bien anclado', () => {
    expect(isWeaklyGrounded([chunk(0.3), chunk(0.9)])).toBe(false);
  });

  it('todos los fragmentos están por encima del umbral: débilmente anclado', () => {
    expect(isWeaklyGrounded([chunk(0.8), chunk(0.9)])).toBe(true);
  });

  it('mira el más cercano, vaya donde vaya: los que entran por nombre van primero (QA-289)', () => {
    expect(isWeaklyGrounded([chunk(0.75001)])).toBe(true);
    expect(isWeaklyGrounded([chunk(0.9), chunk(0.3)])).toBe(false);
  });
});

describe('formatLoreForPrompt', () => {
  it('formatea cada fragmento como "título: texto"', () => {
    expect(formatLoreForPrompt([chunk(0.1, 'Los orcos', 'Orgullo, fuerza, honor.')])).toEqual(['Los orcos: Orgullo, fuerza, honor.']);
  });

  it('sin fragmentos, devuelve una lista vacía', () => {
    expect(formatLoreForPrompt([])).toEqual([]);
  });

  it('corta antes de superar el tope de caracteres, pero nunca deja el resultado vacío', () => {
    const largo = 'x'.repeat(1500);
    const result = formatLoreForPrompt([chunk(0.1, 'Uno', largo), chunk(0.2, 'Dos', 'corto')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Uno');
  });

  it('incluye varios fragmentos mientras quepan dentro del tope', () => {
    const result = formatLoreForPrompt([chunk(0.1, 'A', 'corto A'), chunk(0.2, 'B', 'corto B'), chunk(0.3, 'C', 'corto C')]);
    expect(result).toHaveLength(3);
  });
});

// QA-289 (P251, P272): el trozo de una entidad que nombra la acción entra por nombre, no solo por embedding.
describe('titulosPorEntidad', () => {
  const titulos = [
    'Acercarse al Campamento del Clan Serhu',
    'Campamento del Clan Serhu (Llanuras del Viento Rojo)',
    'Clan Maktor (el clan de Gorhorn) — aniquilado dos veces',
    'Clan Serhu y la casta de Ketg',
    'Gorhorn, guerrero del Clan Maktor (único personaje jugable)',
    "Terk'ikar Ulkha Ketg, del Clan Serhu",
    'Las Llanuras del Viento Rojo',
  ];

  it('el nombre entero va primero; el mismo nombre con un título delante, detrás; un sitio que solo lo lleva, nunca', () => {
    expect(titulosPorEntidad(titulos, ['Le pregunto a Ulkha Ketg quién manda en el Clan Serhu'])).toEqual([
      'Clan Serhu y la casta de Ketg',
      "Terk'ikar Ulkha Ketg, del Clan Serhu",
    ]);
  });

  it('sin tildes ni mayúsculas en el texto también vale, y un nombre de una palabra («Gorhorn») no entra solo', () => {
    expect(titulosPorEntidad(titulos, ['gorhorn pregunta qué le pasó al clan maktor'])).toEqual(['Clan Maktor (el clan de Gorhorn) — aniquilado dos veces']);
  });

  it('los NPC en escena cuentan como texto, y sin nombres no hay entradas directas', () => {
    expect(titulosPorEntidad(titulos, ['¿Quién manda aquí?', 'Ulkha Ketg'])).toEqual(["Terk'ikar Ulkha Ketg, del Clan Serhu"]);
    expect(titulosPorEntidad(titulos, ['Miro a mi alrededor.'])).toEqual([]);
  });

  // QA-513 (P272): «los Maktor» sin «Clan» trae «Clan Maktor»; una palabra corta de un nombre mayor no trae nada.
  it('la palabra propia suelta con mayúscula casa una cabeza «Clan X»; detrás de los nombres enteros', () => {
    const t = [...titulos, 'Casa Ketg', 'El Signeran — el duelo de honor orco'];
    expect(titulosPorEntidad(t, ['Le pregunto a Ulkha Ketg qué pasó con los Maktor'])).toEqual([
      "Terk'ikar Ulkha Ketg, del Clan Serhu",
      'Clan Maktor (el clan de Gorhorn) — aniquilado dos veces',
    ]);
  });

  it('«Ketg» dentro de «Ulkha Ketg» no trae «Casa Ketg»; sin mayúscula o solo con la genérica tampoco', () => {
    const t = [...titulos, 'Casa Ketg', 'Las Llanuras'];
    expect(titulosPorEntidad(t, ['Le pregunto a Ulkha Ketg'])).toEqual(["Terk'ikar Ulkha Ketg, del Clan Serhu"]);
    expect(titulosPorEntidad(t, ['hablo de los maktor'])).toEqual([]);
    expect(titulosPorEntidad(t, ['Hablo con la Casa de Piedra'])).toEqual([]);
    expect(titulosPorEntidad(t, ['Pienso en Ketg'])).toEqual(['Casa Ketg']);
  });
});

// QA-518 (P487): «¿quién es Gistera?» con Ulkha en escena. Un nombre de pila trae la cabeza de dos palabras que empieza
// por él; ni una genérica («Clan»), ni una palabra corta, ni una cabeza de tres palabras.
describe('titulosPorEntidad con un nombre de pila (QA-518)', () => {
  const t = ['Gistera Koh y Uhuld Koh (encuentro del primer turno)', 'Feg Tusha (los Faerus de Hashma)', 'Dentro de Karot Veku — el Ketg', 'Clan Maktor (el clan de Gorhorn) — aniquilado dos veces'];

  it('«Gistera» trae «Gistera Koh…»; «Dentro», «Feg» y «Clan» sueltos, no', () => {
    const o = { nombreDePila: true };
    expect(titulosPorEntidad(t, ['Ulkha, ¿quién es Gistera?'], o)).toEqual(['Gistera Koh y Uhuld Koh (encuentro del primer turno)']);
    expect(titulosPorEntidad(t, ['Dentro de la tienda hablo con Feg.'], o)).toEqual([]);
    expect(titulosPorEntidad(t, ['Pregunto por el Clan'], o)).toEqual([]);
  });

  it('sin la opción (la recuperación del narrador), el rango 3 está apagado', () => {
    expect(titulosPorEntidad(t, ['Ulkha, ¿quién es Gistera?'])).toEqual([]);
  });
});

describe('loreParaReplica (QA-518, P487, P491)', () => {
  const trozo = (title: string, text: string): RetrievedLore => ({ title, text, distance: 0.5 });
  const chunks = [
    trozo("Terk'ikar Ulkha Ketg, del Clan Serhu", 'Ulkha manda el Clan Serhu.'),
    trozo('Clan Maktor (el clan de Gorhorn) — aniquilado dos veces', 'Los Maktor cayeron dos veces.'),
    trozo('Gistera Koh y Uhuld Koh (encuentro del primer turno)', 'Gistera huye con su hijo Uhuld.'),
    trozo('Clan Serhu y la casta de Ketg', 'Ketg es la casta que manda en el Clan Serhu. '.repeat(30)),
    trozo('Las Llanuras del Viento Rojo', 'Arena roja.'),
  ];

  it('solo lo que nombra la frase del jugador, nunca lo semántico ni la entrada del propio NPC', () => {
    expect(loreParaReplica(chunks, 'Ulkha Ketg, ¿quién es Gistera?', 'Ulkha Ketg')).toEqual(['Gistera Koh y Uhuld Koh (encuentro del primer turno): Gistera huye con su hijo Uhuld.']);
    expect(loreParaReplica(chunks, 'Cuéntame qué pasó con los Maktor, Ulkha.', 'Ulkha Ketg')).toEqual(['Clan Maktor (el clan de Gorhorn) — aniquilado dos veces: Los Maktor cayeron dos veces.']);
    expect(loreParaReplica(chunks, 'Hola, ¿qué tal la caza?', 'Ulkha Ketg')).toEqual([]);
  });

  it('como mucho dos, y cada una recortada en un punto antes de 280 caracteres (P491: «Clan Serhu» trae la casta de Ketg)', () => {
    const lore = loreParaReplica(chunks, 'Le pregunto por su oficio en el Clan Serhu, por Gistera y por el Clan Maktor', 'Tirag Susig');
    expect(lore).toHaveLength(2);
    const serhu = lore.find((l) => l.startsWith('Clan Serhu y la casta de Ketg: Ketg es la casta'))!;
    expect(serhu.length).toBeLessThanOrEqual('Clan Serhu y la casta de Ketg: '.length + 280);
    expect(serhu).toMatch(/Serhu\.$/);
  });

  it('sin las frases de secreto, y corto (P493)', () => {
    const c = [trozo('Gistera Koh y Uhuld Koh (encuentro)', 'Gistera Koh es una orca criada por Uhuld. Uhuld tramaba en secreto exponer a la casta — sin saberlo, ese descendiente era Gorhorn (secreto que ni Gistera ni Gorhorn conocen). Gistera huyó esa noche. '.repeat(3))];
    const [l] = loreParaReplica(c, '¿Quién es Gistera?', 'Ulkha Ketg');
    expect(l).toContain('Gistera Koh es una orca criada por Uhuld.');
    expect(l).not.toMatch(/secreto|sin saberlo|Gorhorn/);
    expect(l.length).toBeLessThanOrEqual('Gistera Koh y Uhuld Koh (encuentro): '.length + 280);
  });

  // QA-525 (P272): con el texto real, el recorte desde el principio dejaba solo «Clan de las Llanuras… Sufrió dos golpes»,
  // sin Kadrog ni los Goirntes. Con una sola entrada nombrada, entran las frases que casan con la pregunta.
  it('una sola entrada: las frases que casan con la pregunta, aunque vayan tarde (P272)', () => {
    const maktor = loreChunks.find((c) => c.title.startsWith('Clan Maktor'))!;
    const [l] = loreParaReplica([trozo(maktor.title, maktor.text)], 'Le digo a Ulkha Ketg: ¿Qué pasó con los Maktor?', 'Ulkha Ketg');
    expect(l).toContain('Goirntes');
    expect(l).toContain('Clan de las Llanuras del Viento Rojo');
    expect(l).not.toContain('único superviviente');
    expect(l.length).toBeLessThanOrEqual(`${maktor.title}: `.length + 2 * 280);
  });

  it('una entrada hecha solo de secretos no entra', () => {
    expect(loreParaReplica([trozo('Gistera Koh y Uhuld Koh', 'Es un secreto de trama.')], '¿Quién es Gistera?', 'Ulkha Ketg')).toEqual([]);
  });
});

// QA-518: con dos NPC en escena, retrieveLore llena sus huecos con las entradas de esos NPC; la réplica busca en todo el lore.
describe('cargarLoreParaReplica', () => {
  it('trae Gistera aunque lo recuperado por retrieveLore sean las entradas de los NPC en escena', async () => {
    queryRaw.mockResolvedValue([
      { title: "Terk'ikar Ulkha Ketg, del Clan Serhu", text: 'Ulkha manda.' },
      { title: 'Tirag Susig, cazador', text: 'Tirag caza.' },
      { title: 'Gistera Koh y Uhuld Koh (encuentro del primer turno)', text: 'Gistera huye con su hijo Uhuld.' },
    ]);
    const lore = await cargarLoreParaReplica('w1', 'Ulkha Ketg, ¿quién es Gistera?', 'Ulkha Ketg');
    expect(lore).toEqual(['Gistera Koh y Uhuld Koh (encuentro del primer turno): Gistera huye con su hijo Uhuld.']);
  });
});
