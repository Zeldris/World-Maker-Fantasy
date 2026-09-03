import { describe, it, expect } from 'vitest';
import { matchHarvestSource, matchesVerbForMetodo, detectHarvestSourcesInScene } from './harvest.js';

describe('matchHarvestSource', () => {
  it('coincide con un alias exacto', () => {
    expect(matchHarvestSource('Despiezo un corredor de cauce')).toBe('corredor-de-cauce');
  });

  it('tolera una errata de una palabra (roadmap 2026-07-20, misma clase de bug que matchNpcAliases)', () => {
    // "corredr" en vez de "corredor" — ningún alias de corredor-de-cauce matchea por substring
    // exacto con esta errata, así que esto solo pasa si funciona la tolerancia por distancia.
    expect(matchHarvestSource('Despiezo un corredr que acabo de cazar')).toBe('corredor-de-cauce');
  });

  it('no matchea nada si no hay ninguna especie mencionada', () => {
    expect(matchHarvestSource('Camino tranquilamente por la llanura')).toBeUndefined();
  });

  it('bug real 2026-09-01: "suelo" no colisiona con Raíz de Fuego (Levenshtein 2, s→f/l→g) al seguir un rastro', () => {
    // Partida Gorhorn/Hondonada del Eco: esta frase es intención de rastrear una presa, sin
    // ninguna mención real a Raíz de Fuego ni a su zona (Fumarolas Negras) — antes del fix,
    // "suelo" (palabra de terreno de uso constante, no una errata de "fuego") colaba
    // 'raiz-de-fuego' por tolerancia a erratas. La frase SÍ nombra a "canizor" (fauna real,
    // ver test de matchesVerbForMetodo justo abajo) — matchHarvestSource acierta ahí, la
    // protección real contra resolver esto como recolección la da el chequeo de verbo (CAZA
    // exige despiezar/desollar, no "seguir el rastro").
    const action = 'Recojo mi hacha del suelo y sigo el rastro que ha dejado el canizor, con cuidado de no perderlo de vista.';
    expect(matchHarvestSource(action)).toBe('canizor');
    expect(matchesVerbForMetodo(action, 'CAZA')).toBe(false);
  });

  it('bug real 2026-09-03: "acabo" no colisiona con Trepador Ocaso al examinar un objeto del inventario', () => {
    // Partida de Gorhorn, Los Restos de Maktor: examinar un objeto YA en el inventario, sin
    // mencionar ninguna fuente real — antes del fix, "acabo" (de "acabo de encontrar") colaba
    // 'trepador-ocaso' por tolerancia a erratas (distancia ≤2 de "ocaso"), bloqueando el turno
    // entero con "¿trepador ocaso? Aquí no, desde luego...".
    const action = 'Examino con cuidado el Tótem de clan roto que acabo de encontrar, buscando cualquier marca o símbolo que reconozca.';
    expect(matchHarvestSource(action)).toBeUndefined();
  });
});

// Verbo por método (2026-07-29, petición explícita: "para conseguir estos recursos debes cazar...
// o talar... o picar") — antes un único regex genérico servía para cualquier fuente.
describe('matchesVerbForMetodo', () => {
  it('CAZA exige desollar/despiezar, no cualquier verbo genérico', () => {
    expect(matchesVerbForMetodo('Despiezo el cadáver del corredor de cauce', 'CAZA')).toBe(true);
    expect(matchesVerbForMetodo('Desuello a la presa ya derrotada', 'CAZA')).toBe(true);
    expect(matchesVerbForMetodo('Recojo lo que encuentro por aquí', 'CAZA')).toBe(false);
  });

  it('TALA exige talar/cortar madera, no un verbo genérico de recolección', () => {
    expect(matchesVerbForMetodo('Talo el matorral de cuerno para sacar leña', 'TALA')).toBe(true);
    expect(matchesVerbForMetodo('Corto madera del matorral', 'TALA')).toBe(true);
    expect(matchesVerbForMetodo('Recojo leña del suelo', 'TALA')).toBe(false);
  });

  it('MINERIA exige picar/minar/extraer roca-piedra-mena, no un verbo genérico', () => {
    expect(matchesVerbForMetodo('Pico la roca de Los Pilares Rotos', 'MINERIA')).toBe(true);
    expect(matchesVerbForMetodo('Extraigo mena de la veta', 'MINERIA')).toBe(true);
    expect(matchesVerbForMetodo('Recojo una piedra suelta', 'MINERIA')).toBe(false);
  });

  it('bug real 2026-09-03: MINERIA no dispara por substring — "Examino" no es "mino"', () => {
    // Sin boundary de palabra, "min[oae]" matcheaba dentro de "exa-MINO", bloqueando cualquier
    // turno de examinar algo como si fuera una acción de minería.
    expect(matchesVerbForMetodo('Examino con cuidado el objeto que acabo de encontrar', 'MINERIA')).toBe(false);
  });

  it('EXTRACCION acepta el verbo genérico de recolección deliberada', () => {
    expect(matchesVerbForMetodo('Recolecto salvia del polvo con cuidado', 'EXTRACCION')).toBe(true);
    expect(matchesVerbForMetodo('Miro el horizonte', 'EXTRACCION')).toBe(false);
  });

  it('PASIVO nunca matchea ningún verbo (solo sale de discovery.ts, nunca de una fuente nombrada)', () => {
    expect(matchesVerbForMetodo('Recojo, talo, pico y despiezo todo a la vez', 'PASIVO')).toBe(false);
  });
});

// Rediseño de profesiones (2026-08-07): "ya localizado en la zona" para el pop-up de una
// habilidad de recolección — busca alias de fuentes candidatas en los hechos de sesión recientes.
describe('detectHarvestSourcesInScene', () => {
  it('encuentra una fuente mencionada en los hechos recientes', () => {
    const facts = ['Gorhorn llega a Los Pilares Rotos.', 'Ve vetas de hierro visibles entre las grietas de la roca erosionada.'];
    expect(detectHarvestSourcesInScene(facts, ['veta-hierro-pilares-rotos', 'matorral-de-cuerno'])).toEqual(['veta-hierro-pilares-rotos']);
  });

  it('devuelve vacío si ninguna fuente candidata se ha mencionado todavía', () => {
    const facts = ['Gorhorn camina por la llanura al anochecer.'];
    expect(detectHarvestSourcesInScene(facts, ['veta-hierro-pilares-rotos', 'matorral-de-cuerno'])).toEqual([]);
  });

  it('solo busca entre los slugs candidatos dados, ignora menciones de otras fuentes', () => {
    const facts = ['Gorhorn ve un matorral de cuerno cerca del camino.'];
    expect(detectHarvestSourcesInScene(facts, ['veta-hierro-pilares-rotos'])).toEqual([]);
  });
});
