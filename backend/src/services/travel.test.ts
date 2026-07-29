import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  detectsTravelIntent,
  matchDestination,
  buildAdjacency,
  shortestPath,
  edgeBetween,
  minutosConDestreza,
  bandaForMinutos,
  initialLocationSlugFor,
  fuzzyMatchCandidates,
  fuzzyMatchesAnyStem,
  findFuzzyStemMatch,
  type LocationNode,
  type LinkEdge,
} from './travel.js';

describe('normalizeText', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizeText('El Pozo de Cauce Viejo')).toBe('el pozo de cauce viejo');
    expect(normalizeText('Acción')).toBe('accion');
  });
});

describe('fuzzyMatchCandidates + fuzzyMatchesAnyStem + findFuzzyStemMatch (deuda técnica 2026-07-30, primitiva compartida por todos los detectores de intención por tolerancia a erratas del proyecto)', () => {
  it('fuzzyMatchCandidates descarta palabras de menos de 5 letras', () => {
    expect(fuzzyMatchCandidates('voy a por el oro')).toEqual([]);
    expect(fuzzyMatchCandidates('registro el cuerpo del enemigo caido')).toEqual(['registro', 'cuerpo', 'enemigo', 'caido']);
  });

  it('fuzzyMatchesAnyStem tolera distancia 2 pero no más', () => {
    expect(fuzzyMatchesAnyStem('saqeo', ['saque'])).toBe(true); // distancia 2
    expect(fuzzyMatchesAnyStem('ataque', ['saque'])).toBe(true); // el propio bug real que motivó esto
    expect(fuzzyMatchesAnyStem('horizonte', ['saque'])).toBe(false);
  });

  it('findFuzzyStemMatch respeta las exclusiones (bug real 2026-07-29: "ataque"/"desde"/"comer" confundidos con stems de saqueo)', () => {
    const words = fuzzyMatchCandidates('lanzo un ataque rapido');
    expect(findFuzzyStemMatch(words, ['saque'])).toBe('ataque'); // sin exclusión, colisiona
    expect(findFuzzyStemMatch(words, ['saque'], new Set(['ataque']))).toBeNull(); // con exclusión, no
  });

  it('findFuzzyStemMatch devuelve null sin ninguna coincidencia', () => {
    expect(findFuzzyStemMatch(['horizonte', 'paisaje'], ['saque', 'registr'])).toBeNull();
  });
});

describe('detectsTravelIntent', () => {
  it('detecta "voy a" y "voy hacia" (regresión: bug real encontrado y corregido)', () => {
    expect(detectsTravelIntent('voy a el pozo')).toBe(true);
    expect(detectsTravelIntent('voy hacia el pozo a rellenar el odre')).toBe(true);
  });
  it('detecta viajar/caminar/regresar', () => {
    expect(detectsTravelIntent('camino hacia el cruce')).toBe(true);
    expect(detectsTravelIntent('regreso a la hondonada')).toBe(true);
  });
  it('no detecta intención de viaje en una acción no relacionada', () => {
    expect(detectsTravelIntent('examino mis alrededores con cuidado')).toBe(false);
  });
});

const locations: LocationNode[] = [
  { id: 'a', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', aliases: ['hondonada', 'el eco'] },
  { id: 'b', slug: 'pozo-cauce-viejo', name: 'El Pozo de Cauce Viejo', aliases: ['pozo', 'el pozo'] },
  { id: 'c', slug: 'pilares-rotos', name: 'Los Pilares Rotos', aliases: ['pilares'] },
];

describe('matchDestination', () => {
  it('matchea por el alias más largo que aparece en el texto', () => {
    const match = matchDestination('voy hacia el pozo a rellenar el odre', locations);
    expect(match?.slug).toBe('pozo-cauce-viejo');
  });
  it('excluye la ubicación actual (no se puede viajar a donde ya se está)', () => {
    const match = matchDestination('voy al pozo', locations, 'b');
    expect(match).toBeUndefined();
  });
  it('no matchea si no hay ningún alias en el texto', () => {
    const match = matchDestination('descanso un rato', locations);
    expect(match).toBeUndefined();
  });
});

describe('buildAdjacency + shortestPath (Dijkstra)', () => {
  const links: LinkEdge[] = [
    { fromId: 'a', toId: 'b', minutosBase: 150 },
    { fromId: 'b', toId: 'c', minutosBase: 180 },
    { fromId: 'a', toId: 'c', minutosBase: 500 }, // ruta directa más cara que pasar por b
  ];

  it('el grafo es bidireccional', () => {
    const adjacency = buildAdjacency(links);
    expect(adjacency.get('b')?.some((e) => e.to === 'a')).toBe(true);
  });

  it('encuentra el camino más corto real, no el directo si es más caro', () => {
    const adjacency = buildAdjacency(links);
    const result = shortestPath(adjacency, 'a', 'c');
    expect(result?.path).toEqual(['a', 'b', 'c']);
    expect(result?.totalMinutos).toBe(330);
  });

  it('devuelve totalMinutos 0 si origen y destino son el mismo', () => {
    const adjacency = buildAdjacency(links);
    const result = shortestPath(adjacency, 'a', 'a');
    expect(result).toEqual({ path: ['a'], totalMinutos: 0 });
  });

  it('devuelve null si no hay camino posible', () => {
    const adjacency = buildAdjacency([{ fromId: 'x', toId: 'y', minutosBase: 10 }]);
    expect(shortestPath(adjacency, 'a', 'c')).toBeNull();
  });
});

describe('edgeBetween', () => {
  it('encuentra la arista sin importar el sentido guardado', () => {
    const links: LinkEdge[] = [{ fromId: 'a', toId: 'b', minutosBase: 100, terreno: 'llanura' }];
    expect(edgeBetween(links, 'b', 'a')?.terreno).toBe('llanura');
  });
});

describe('minutosConDestreza', () => {
  it('reduce el tiempo con más destreza (fórmula base/(1+destreza/20))', () => {
    expect(minutosConDestreza(150, { fuerza: 10, destreza: 0, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 })).toBe(150);
    expect(minutosConDestreza(150, { fuerza: 10, destreza: 9, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 })).toBe(103);
  });
  it('nunca baja de 1 minuto', () => {
    expect(minutosConDestreza(1, { fuerza: 10, destreza: 100, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 })).toBe(1);
  });
});

describe('bandaForMinutos', () => {
  it('corta < 60, extendida < 1440, larga >= 1440', () => {
    expect(bandaForMinutos(30)).toBe('corta');
    expect(bandaForMinutos(103)).toBe('extendida');
    expect(bandaForMinutos(1440)).toBe('larga');
  });
});

describe('initialLocationSlugFor', () => {
  it('Gorhorn empieza en la Hondonada del Eco', () => {
    expect(initialLocationSlugFor('Gorhorn')).toBe('hondonada-del-eco');
  });
  it('otros personajes no tienen ubicación inicial todavía (fuera de alcance v1)', () => {
    expect(initialLocationSlugFor('Sael Vhorn')).toBeUndefined();
  });
});
