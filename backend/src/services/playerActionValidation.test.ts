import { describe, it, expect, vi, beforeEach } from 'vitest';

const findManyNpc = vi.fn();
const findManyLocation = vi.fn();
const findManyHarvestYield = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args) },
    harvestYield: { findMany: (...args: unknown[]) => findManyHarvestYield(...args) },
  },
}));

const {
  detectsUnequippedWeaponClaim,
  wrongWeaponNarrationFor,
  detectsAbsentSceneNpcClaim,
  absentSceneNpcNarrationFor,
  detectsPlayerAnachronism,
  anachronismNarrationFor,
  detectsWrongRegionHarvestClaim,
  wrongRegionHarvestNarrationFor,
  detectsUnknownConstructionClaim,
  unknownConstructionNarrationFor,
  detectsFabricatedNpcClaim,
  fabricatedNpcNarrationFor,
  detectsFabricatedHarvestSourceClaim,
  fabricatedHarvestSourceNarrationFor,
  deterministicActionUnavailableNarrationFor,
  detectsUnknownDestinationClaim,
  unknownDestinationNarrationFor,
  detectsHarvestSkillMisuseClaim,
  harvestSkillMisuseNarrationFor,
} = await import('./playerActionValidation.js');

describe('detectsUnequippedWeaponClaim', () => {
  it('detecta reclamar un arma de categoría distinta a la equipada', () => {
    expect(detectsUnequippedWeaponClaim("Uso mi lanza y lo apuñalo.", ['Maza orca'])).toEqual({ claimedNoun: 'lanza' });
  });

  it('no dispara si el arma reclamada SÍ coincide con una equipada (por nombre)', () => {
    expect(detectsUnequippedWeaponClaim('Ataco con mi maza.', ['Maza orca'])).toBeNull();
  });

  it('no dispara si no lleva ningún arma equipada (caso "va desarmado", fuera de alcance)', () => {
    expect(detectsUnequippedWeaponClaim('Ataco con mi lanza.', [])).toBeNull();
  });

  it('no dispara con una mención sin verbo de uso/ataque (recuerdo legítimo)', () => {
    expect(detectsUnequippedWeaponClaim('Recuerdo la vieja lanza de mi padre.', ['Maza orca'])).toBeNull();
  });

  it('no dispara si el texto no menciona ninguna categoría de arma', () => {
    expect(detectsUnequippedWeaponClaim('Exploro la zona con cuidado.', ['Maza orca'])).toBeNull();
  });

  it('reconoce el arma equipada por coincidencia de sustantivo dentro del nombre completo', () => {
    expect(detectsUnequippedWeaponClaim('Golpeo con mi hacha.', ['Hacha de guerra rota'])).toBeNull();
  });

  it('detecta con dos armas equipadas (dual-wield) si ninguna coincide', () => {
    expect(detectsUnequippedWeaponClaim('Clavo mi daga en el enemigo.', ['Hacha de guerra rota', 'Maza orca'])).toEqual({ claimedNoun: 'daga' });
  });

  // Consolidación (2026-09-01, "EXPULSAR estructuralmente inalcanzable, no existe ningún escudo en
  // el mundo"): "escudo" ya estaba en WEAPON_CATEGORY_NOUNS desde antes de que existiera ningún
  // ítem tipoArma:'ESCUDO' real (bloqueaba a cualquiera que lo nombrara sin llevarlo). Confirma que
  // con el ítem real ya en el catálogo ("Escudo de torre goirntes"), el guard SÍ lo reconoce como
  // arma equipada legítima — desbloquea "Embate de Escudo" para quien lo lleve puesto.
  it('reconoce un escudo real equipado y no bloquea "Embate de Escudo"', () => {
    expect(detectsUnequippedWeaponClaim('Cargo con mi escudo y golpeo con él.', ['Escudo de torre goirntes'])).toBeNull();
  });
});

describe('wrongWeaponNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(wrongWeaponNarrationFor('Maza orca').length).toBeGreaterThan(0);
    }
  });
});

describe('detectsAbsentSceneNpcClaim', () => {
  beforeEach(() => {
    findManyNpc.mockReset().mockResolvedValue([
      { slug: 'torgash', name: 'Torgash', aliases: ["kort'ikar torgash"] },
      { slug: 'orco-enfurecido-hondonada', name: 'Orco enfurecido', aliases: ['orco enfurecido'] },
    ]);
  });

  it('detecta interactuar con un NPC real de catálogo que no está en la escena actual', async () => {
    const result = await detectsAbsentSceneNpcClaim("Le pregunto a Torgash por su clan.", 'world1', []);
    expect(result).toEqual({ name: 'Torgash' });
  });

  it('no dispara si el NPC mencionado SÍ está en la lista de escena', async () => {
    const result = await detectsAbsentSceneNpcClaim('Le pregunto a Torgash por su clan.', 'world1', ['torgash']);
    expect(result).toBeNull();
  });

  it('no dispara sin intención real de interacción (mención de pasada)', async () => {
    const result = await detectsAbsentSceneNpcClaim('Pienso en lo que me dijo Torgash hace días.', 'world1', []);
    expect(result).toBeNull();
  });

  it('no dispara si el texto no nombra a ningún NPC real del catálogo', async () => {
    const result = await detectsAbsentSceneNpcClaim('Ataco a un desconocido cualquiera.', 'world1', []);
    expect(result).toBeNull();
  });
});

describe('absentSceneNpcNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(absentSceneNpcNarrationFor('Torgash').length).toBeGreaterThan(0);
    }
  });
});

describe('detectsPlayerAnachronism', () => {
  it('detecta un anacronismo en la propia acción del jugador', () => {
    expect(detectsPlayerAnachronism('Me monto en mi nave espacial y me voy volando.')).toBe(true);
    expect(detectsPlayerAnachronism('Busco un mechero para encender fuego rápido.')).toBe(false);
    expect(detectsPlayerAnachronism('¿Tengo pólvora en el inventario?')).toBe(true);
  });

  it('no dispara con una acción normal, coherente con el mundo', () => {
    expect(detectsPlayerAnachronism('Exploro la zona con cuidado, hacha en mano.')).toBe(false);
  });
});

describe('anachronismNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(anachronismNarrationFor().length).toBeGreaterThan(0);
    }
  });
});

describe('detectsWrongRegionHarvestClaim', () => {
  it('detecta talar una fuente real cuya región conocida no coincide con la actual', () => {
    expect(detectsWrongRegionHarvestClaim('Talo el matorral de cuerno.', 'Ciénaga Troncal')).toEqual({ sourceSlug: 'matorral-de-cuerno' });
  });

  it('no dispara si la región coincide (con o sin artículo)', () => {
    expect(detectsWrongRegionHarvestClaim('Talo el matorral de cuerno.', 'Las Llanuras del Viento Rojo')).toBeNull();
    expect(detectsWrongRegionHarvestClaim('Talo el matorral de cuerno.', 'Llanuras del Viento Rojo')).toBeNull();
  });

  it('no dispara sin región actual conocida', () => {
    expect(detectsWrongRegionHarvestClaim('Talo el matorral de cuerno.', null)).toBeNull();
  });

  it('no dispara sin verbo real de recolección (mención de pasada)', () => {
    expect(detectsWrongRegionHarvestClaim('Recuerdo el matorral de cuerno de mi tierra.', 'Ciénaga Troncal')).toBeNull();
  });

  it('no dispara si el texto no nombra ninguna fuente real de catálogo', () => {
    expect(detectsWrongRegionHarvestClaim('Exploro la zona con cuidado.', 'Ciénaga Troncal')).toBeNull();
  });
});

describe('wrongRegionHarvestNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(wrongRegionHarvestNarrationFor('matorral de cuerno').length).toBeGreaterThan(0);
    }
  });
});

describe('detectsUnknownConstructionClaim', () => {
  it('detecta construir un tipo de edificio que no coincide con ninguna receta real', () => {
    expect(detectsUnknownConstructionClaim('Construyo una Torre de Cristal.')).toBe(true);
  });

  it('no dispara con una receta real conocida', () => {
    expect(detectsUnknownConstructionClaim('Construyo un campamento.')).toBe(false);
    expect(detectsUnknownConstructionClaim('Levanto una choza.')).toBe(false);
    expect(detectsUnknownConstructionClaim('Construyo un ayuntamiento.')).toBe(false);
  });

  it('no dispara sin verbo real de construcción', () => {
    expect(detectsUnknownConstructionClaim('Admiro la torre desde lejos.')).toBe(false);
  });

  it('no dispara con "mejorar"/"ampliar" en un sentido no constructivo (verbo deliberadamente excluido)', () => {
    expect(detectsUnknownConstructionClaim('Intento mejorar mi puntería practicando.')).toBe(false);
    expect(detectsUnknownConstructionClaim('Amplío mis conocimientos sobre la zona.')).toBe(false);
  });
});

describe('unknownConstructionNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(unknownConstructionNarrationFor().length).toBeGreaterThan(0);
    }
  });
});

describe('detectsFabricatedNpcClaim', () => {
  beforeEach(() => {
    findManyNpc.mockReset().mockResolvedValue([{ slug: 'torgash', name: 'Torgash', aliases: ["kort'ikar torgash"] }]);
  });

  it('detecta un nombre citado entre comillas que no existe en ningún sitio del catálogo', async () => {
    const result = await detectsFabricatedNpcClaim("Ataco a 'el Dragón de Fuego Eterno'.", 'world1');
    expect(result).toEqual({ quotedName: 'el Dragón de Fuego Eterno' });
  });

  it('no dispara si el nombre citado SÍ coincide con un NPC real del catálogo', async () => {
    const result = await detectsFabricatedNpcClaim("Ataco a 'Torgash'.", 'world1');
    expect(result).toBeNull();
  });

  it('no dispara SIN comillas, aunque el nombre suene inventado (prosa libre legítima)', async () => {
    const result = await detectsFabricatedNpcClaim('Ataco al Dragón de Fuego Eterno.', 'world1');
    expect(result).toBeNull();
    expect(findManyNpc).not.toHaveBeenCalled();
  });

  it('no dispara sin intención real de interacción (mención de pasada)', async () => {
    const result = await detectsFabricatedNpcClaim("Pienso en 'el Dragón de Fuego Eterno' de las leyendas.", 'world1');
    expect(result).toBeNull();
  });

  it('no dispara con un nombre citado demasiado corto', async () => {
    const result = await detectsFabricatedNpcClaim("Ataco a 'X'.", 'world1');
    expect(result).toBeNull();
  });

  it('bug real jugando en vivo (2026-08-20): no dispara con diálogo del propio jugador entre comillas, aunque la réplica no coincida con ningún NPC del catálogo', async () => {
    const result = await detectsFabricatedNpcClaim("Me acerco a ella y digo: 'Quien eres y a donde vas con tanta prisa?'", 'world1');
    expect(result).toBeNull();
    expect(findManyNpc).not.toHaveBeenCalled();
  });
});

describe('fabricatedNpcNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(fabricatedNpcNarrationFor('el Dragón de Fuego Eterno').length).toBeGreaterThan(0);
    }
  });
});

describe('detectsFabricatedHarvestSourceClaim', () => {
  it('detecta un nombre citado entre comillas que no existe en ningún catálogo de recolección', () => {
    expect(detectsFabricatedHarvestSourceClaim("Recolecto 'flor de cristal lunar'.")).toEqual({ quotedName: 'flor de cristal lunar' });
  });

  it('no dispara si el nombre citado SÍ coincide con una fuente real', () => {
    expect(detectsFabricatedHarvestSourceClaim("Talo 'matorral de cuerno'.")).toBeNull();
  });

  it('no dispara SIN comillas, aunque el nombre suene inventado (prosa libre legítima)', () => {
    expect(detectsFabricatedHarvestSourceClaim('Recolecto flor de cristal lunar.')).toBeNull();
  });

  it('no dispara sin verbo real de recolección (mención de pasada)', () => {
    expect(detectsFabricatedHarvestSourceClaim("Recuerdo 'flor de cristal lunar' de mi tierra.")).toBeNull();
  });

  it('no dispara con un nombre citado demasiado corto', () => {
    expect(detectsFabricatedHarvestSourceClaim("Recolecto 'X'.")).toBeNull();
  });
});

describe('fabricatedHarvestSourceNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(fabricatedHarvestSourceNarrationFor('flor de cristal lunar').length).toBeGreaterThan(0);
    }
  });
});

describe('deterministicActionUnavailableNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(deterministicActionUnavailableNarrationFor().length).toBeGreaterThan(0);
    }
  });
});

describe('detectsUnknownDestinationClaim', () => {
  beforeEach(() => {
    findManyLocation.mockReset();
    findManyLocation.mockResolvedValue([
      { id: 'loc-1', slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', aliases: ['la hondonada del eco', 'hondonada'] },
      { id: 'loc-2', slug: 'restos-de-maktor', name: 'Los Restos de Maktor', aliases: ['los restos de maktor', 'maktor'] },
    ]);
  });

  it('detecta un destino declarado con verbo inequívoco que no coincide con ninguna ubicación real', async () => {
    expect(await detectsUnknownDestinationClaim('Me dirijo hacia la Torre de Cristal.', 'w1')).toBe(true);
  });

  it('no dispara si el destino SÍ coincide con una ubicación real', async () => {
    expect(await detectsUnknownDestinationClaim('Voy hacia la Hondonada del Eco.', 'w1')).toBe(false);
  });

  it('no dispara sin ningún verbo de viaje', async () => {
    expect(await detectsUnknownDestinationClaim('Miro alrededor con calma.', 'w1')).toBe(false);
  });

  it('no dispara con movimiento vago sin destino nombrado ("sigo por el camino")', async () => {
    expect(await detectsUnknownDestinationClaim('Sigo caminando por el camino de tierra.', 'w1')).toBe(false);
  });

  it('no dispara con una dirección cardinal suelta, sin nombre propio de lugar (decisión de la usuaria: las cardinales son para moverse dentro de una zona, no entre ubicaciones del mapa)', async () => {
    expect(await detectsUnknownDestinationClaim('Salgo de la hondonada y camino hacia el norte, alejándome del orco.', 'w1')).toBe(false);
    expect(await detectsUnknownDestinationClaim('Me dirijo al sur en busca de un lugar donde acampar.', 'w1')).toBe(false);
  });

  it('no dispara con intención de ataque/búsqueda hostil, aunque coincida por casualidad con "voy a" (bug real encontrado en la suite: "Voy a luchar contra...")', async () => {
    expect(await detectsUnknownDestinationClaim("Voy a luchar contra 'Orco enfurecido'.", 'w1')).toBe(false);
  });
});

describe('unknownDestinationNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(unknownDestinationNarrationFor().length).toBeGreaterThan(0);
    }
  });
});

describe('detectsHarvestSkillMisuseClaim', () => {
  beforeEach(() => {
    findManyHarvestYield.mockReset();
  });

  it('detecta fuente real + verbo correcto de su método (TALA) — debería ir por el modal, no resolverse aquí', async () => {
    findManyHarvestYield.mockResolvedValue([{ metodoObtencion: 'TALA' }]);
    const claim = await detectsHarvestSkillMisuseClaim('Talo el matorral de cuerno para sacar leña.', 'w1');
    expect(claim).toEqual({
      sourceSlug: 'matorral-de-cuerno',
      sourceName: 'matorral de cuerno',
      oficio: 'talador',
      abilityLabel: 'Talar',
    });
  });

  it('no dispara sin ningún verbo de recolección (chequeo barato previo, evita consultar BD)', async () => {
    expect(await detectsHarvestSkillMisuseClaim('Miro alrededor con calma.', 'w1')).toBeNull();
    expect(findManyHarvestYield).not.toHaveBeenCalled();
  });

  it('bug real encontrado en la suite: no dispara con una acción de combate sin relación real con recolectar, aunque matchee una fuente por fuzzy', async () => {
    const claim = await detectsHarvestSkillMisuseClaim('Cargo mi escudo con todo mi peso y golpeo, buscando apartar a mi rival del combate.', 'w1');
    expect(claim).toBeNull();
    expect(findManyHarvestYield).not.toHaveBeenCalled();
  });

  it('no dispara con el verbo equivocado para el método real de la fuente (mismo criterio que detectHarvest ya usaba)', async () => {
    findManyHarvestYield.mockResolvedValue([{ metodoObtencion: 'MINERIA' }]);
    expect(await detectsHarvestSkillMisuseClaim('Recojo una piedra suelta.', 'w1')).toBeNull();
  });

  it('nunca dispara para CAZA (desuello) — ambos caminos ya comparten el mismo criterio real', async () => {
    findManyHarvestYield.mockResolvedValue([{ metodoObtencion: 'CAZA' }]);
    expect(await detectsHarvestSkillMisuseClaim('Despiezo el cadáver del corredor de cauce.', 'w1')).toBeNull();
  });

  it('no dispara si la fuente no existe en HarvestYield', async () => {
    findManyHarvestYield.mockResolvedValue([]);
    expect(await detectsHarvestSkillMisuseClaim('Talo el matorral de cuerno.', 'w1')).toBeNull();
  });
});

describe('harvestSkillMisuseNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(harvestSkillMisuseNarrationFor('matorral de cuerno').length).toBeGreaterThan(0);
    }
  });
});
