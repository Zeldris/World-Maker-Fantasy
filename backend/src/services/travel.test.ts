import { describe, it, expect, vi } from 'vitest';
import type { AttributeBlock } from './dice.js';

const locationFindMany = vi.fn();
const locationFindUnique = vi.fn();
const linkFindMany = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    location: {
      findMany: (...args: unknown[]) => locationFindMany(...args),
      findUnique: (...args: unknown[]) => locationFindUnique(...args),
    },
    locationLink: {
      findMany: (...args: unknown[]) => linkFindMany(...args),
    },
  },
}));

const {
  normalizeText,
  detectsTravelIntent,
  detectsVagueMovementIntent,
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
  resolveTravel,
  matchesAliasBoundary,
  cardinalDirectionBetween,
} = await import('./travel.js');
type LocationNode = import('./travel.js').LocationNode;
type LinkEdge = import('./travel.js').LinkEdge;

const ATTRS: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

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

// docs/revisar-partida-hallazgos.md (2026-08-01, "bucle" de ambientación sin progreso): "avanzo"/
// "continúo" sin nombrar un destino real no disparaban ni detectsTravelIntent ni matchDestination.
describe('detectsVagueMovementIntent', () => {
  it('detecta "avanzo"/"prosigo"/"me adentro" solos, sin necesitar más contexto', () => {
    expect(detectsVagueMovementIntent('Avanzo por una salida')).toBe(true);
    expect(detectsVagueMovementIntent('Prosigo con cautela')).toBe(true);
    expect(detectsVagueMovementIntent('Me adentro en la oscuridad')).toBe(true);
  });

  it('detecta "sigo"/"continúo" solo si van acompañados de una palabra de movimiento', () => {
    expect(detectsVagueMovementIntent('Continuo por la cueva')).toBe(true);
    expect(detectsVagueMovementIntent('Continuo hasta llegar a la siguiente localización')).toBe(true);
    expect(detectsVagueMovementIntent('Sigo adelante sin mirar atrás')).toBe(true);
  });

  it('detecta "siguiente zona/localización" y "busco la salida"', () => {
    expect(detectsVagueMovementIntent('Voy a la siguiente zona')).toBe(true);
    expect(detectsVagueMovementIntent('Busco la salida de la cueva')).toBe(true);
  });

  it('NO confunde "sigo mirando"/"continúo hablando" con movimiento (no van acompañados de nada que indique desplazamiento)', () => {
    expect(detectsVagueMovementIntent('Sigo mirando el horizonte')).toBe(false);
    expect(detectsVagueMovementIntent('Continuo hablando con el mercader')).toBe(false);
  });

  it('NO confunde el idiom "continúo por ahora" con "continúo por <lugar>"', () => {
    expect(detectsVagueMovementIntent('Continuo por ahora sin decir nada más')).toBe(false);
  });

  it('no detecta nada en una acción sin ninguna intención de movimiento', () => {
    expect(detectsVagueMovementIntent('Examino mi inventario con calma')).toBe(false);
  });
});

const locations: LocationNode[] = [
  { id: 'a', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', aliases: ['hondonada', 'el eco'] },
  { id: 'b', slug: 'pozo-cauce-viejo', name: 'El Pozo de Cauce Viejo', aliases: ['pozo', 'el pozo'] },
  { id: 'c', slug: 'pilares-rotos', name: 'Los Pilares Rotos', aliases: ['pilares'] },
  // Alias reales de worldCatalog.ts (restos-de-maktor) — "maktor" a secas se quitó de aquí en
  // 2026-07-30 precisamente por el bug real que reproduce el test de abajo; solo quedan formas
  // multi-palabra inequívocas.
  { id: 'd', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', aliases: ['los restos de maktor', 'ruinas de maktor'] },
];

describe('matchesAliasBoundary — límite de palabra + longitud mínima (auditoría 2026-08-11)', () => {
  it('un alias corto de una sola palabra NO matchea como substring de otra palabra (bug real "res"/"presas" de docs/revisar-partida.md § 3)', () => {
    expect(matchesAliasBoundary('busco presas para cazar esta noche', 'res')).toBe(false);
    expect(matchesAliasBoundary('eso me parece interesante', 'res')).toBe(false);
  });
  it('un alias de 4+ letras SÍ matchea como palabra suelta', () => {
    expect(matchesAliasBoundary('veo un murgol pastando', 'murgol')).toBe(true);
  });
  it('un alias de 4+ letras NO matchea si es solo parte de otra palabra más larga', () => {
    expect(matchesAliasBoundary('el ecosistema de la hondonada', 'eco')).toBe(false);
  });
  it('un alias multi-palabra no tiene mínimo de longitud propio, ya es específico por sí solo', () => {
    expect(matchesAliasBoundary('voy a los restos de maktor', 'los restos de maktor')).toBe(true);
  });
  it('respeta el límite de palabra con nombres propios acentuados (no usa \\b de JS)', () => {
    expect(matchesAliasBoundary("hablo con torgash", 'torgash')).toBe(true);
    expect(matchesAliasBoundary('un torgashiano inventado', 'torgash')).toBe(false);
  });
});

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
  it('bug real de docs/revisar-partida.md § 3: presentarse como "Gorhorn Maktor" no debe activar un viaje a las ruinas', () => {
    const match = matchDestination('Soy Gorhorn Maktor, quien eres', locations);
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
    expect(minutosConDestreza(150, { fuerza: 10, destreza: 0, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 })).toBe(150);
    expect(minutosConDestreza(150, { fuerza: 10, destreza: 9, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 })).toBe(103);
  });
  it('nunca baja de 1 minuto', () => {
    expect(minutosConDestreza(1, { fuerza: 10, destreza: 100, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 })).toBe(1);
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

// docs/revisar-partida-hallazgos.md (2026-08-01, "bucle" de ambientación sin progreso): fallback de
// movimiento vago sin destino nombrado — solo se auto-resuelve con EXACTAMENTE una salida real.
describe('resolveTravel — fallback de movimiento vago (sin destino nombrado)', () => {
  const LOC_A = { id: 'loc-a', slug: 'zona-a', name: 'Zona A', description: '', region: 'Las Llanuras del Viento Rojo', kind: 'CAMPO', aliases: [] };
  const LOC_B = { id: 'loc-b', slug: 'zona-b', name: 'Zona B', description: '', region: 'Las Llanuras del Viento Rojo', kind: 'CAMPO', aliases: ['zona b'] };
  const LOC_C = { id: 'loc-c', slug: 'zona-c', name: 'Zona C', description: '', region: 'Las Llanuras del Viento Rojo', kind: 'CAMPO', aliases: ['zona c'] };
  const linkAB = { fromId: 'loc-a', toId: 'loc-b', minutosBase: 10, terreno: 'llano', riesgo: null, from: LOC_A, to: LOC_B };
  const linkAC = { fromId: 'loc-a', toId: 'loc-c', minutosBase: 15, terreno: 'llano', riesgo: null, from: LOC_A, to: LOC_C };

  it('con una sola salida real, "avanzo" viaja ahí sin que el jugador nombre nada', async () => {
    locationFindMany.mockResolvedValue([LOC_A, LOC_B]);
    locationFindUnique.mockResolvedValue(LOC_B);
    linkFindMany.mockResolvedValue([linkAB]);

    const result = await resolveTravel({ action: 'Avanzo por una salida', worldId: 'w1', currentLocationId: 'loc-a', attributes: ATTRS });
    expect(result?.toLocationId).toBe('loc-b');
    expect(result?.toLocationName).toBe('Zona B');
  });

  it('con 2+ salidas reales, no adivina cuál — no resuelve viaje (deja que el turno pregunte)', async () => {
    locationFindMany.mockResolvedValue([LOC_A, LOC_B, LOC_C]);
    linkFindMany.mockResolvedValue([linkAB, linkAC]);

    const result = await resolveTravel({ action: 'Continuo por el camino adelante', worldId: 'w1', currentLocationId: 'loc-a', attributes: ATTRS });
    expect(result).toBeNull();
  });

  it('sin ninguna intención de movimiento (vaga ni nombrada), no hace nada', async () => {
    locationFindMany.mockResolvedValue([LOC_A, LOC_B]);
    linkFindMany.mockResolvedValue([linkAB]);

    const result = await resolveTravel({ action: 'Examino mi inventario con calma', worldId: 'w1', currentLocationId: 'loc-a', attributes: ATTRS });
    expect(result).toBeNull();
  });

  it('un destino nombrado explícitamente sigue funcionando igual que siempre (no lo toca el fallback)', async () => {
    locationFindMany.mockResolvedValue([LOC_A, LOC_B, LOC_C]);
    linkFindMany.mockResolvedValue([linkAB, linkAC]);

    const result = await resolveTravel({ action: 'Voy hacia la zona b', worldId: 'w1', currentLocationId: 'loc-a', attributes: ATTRS });
    expect(result?.toLocationId).toBe('loc-b');
  });
});

describe('cardinalDirectionBetween', () => {
  const ORIGIN = { x: 0, y: 0 };

  it('este puro (dx>0, dy=0)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: 10, y: 0 })).toBe('este');
  });

  it('norte puro (dx=0, dy>0)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: 0, y: 10 })).toBe('norte');
  });

  it('oeste puro (dx<0, dy=0)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: -10, y: 0 })).toBe('oeste');
  });

  it('sur puro (dx=0, dy<0)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: 0, y: -10 })).toBe('sur');
  });

  it('noreste (dx>0, dy>0, diagonal exacta)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: 10, y: 10 })).toBe('noreste');
  });

  it('sureste (dx>0, dy<0, diagonal exacta)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: 10, y: -10 })).toBe('sureste');
  });

  it('suroeste (dx<0, dy<0, diagonal exacta)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: -10, y: -10 })).toBe('suroeste');
  });

  it('noroeste (dx<0, dy>0, diagonal exacta)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: -10, y: 10 })).toBe('noroeste');
  });

  it('un poco al norte de la diagonal noreste sigue siendo noreste (dentro del sector de 45°)', () => {
    expect(cardinalDirectionBetween(ORIGIN, { x: 10, y: 12 })).toBe('noreste');
  });

  it('no depende del origen ser (0,0) — mismo desplazamiento relativo, mismo resultado', () => {
    expect(cardinalDirectionBetween({ x: 5, y: 5 }, { x: 15, y: 5 })).toBe('este');
  });
});
