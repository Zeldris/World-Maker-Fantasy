import { describe, it, expect, vi, beforeEach } from 'vitest';

const findManyNpc = vi.fn();
const findManyLocation = vi.fn();
const findUniqueLocation = vi.fn();
const findManyHarvestYield = vi.fn();
const findFirstQuest = vi.fn();
const findManyQuest = vi.fn();
const findManyNpcState = vi.fn();
const findFirstDiscovered = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args), findUnique: (...args: unknown[]) => findUniqueLocation(...args) },
    harvestYield: { findMany: (...args: unknown[]) => findManyHarvestYield(...args) },
    quest: { findFirst: (...args: unknown[]) => findFirstQuest(...args), findMany: (...args: unknown[]) => findManyQuest(...args) },
    npcState: { findMany: (...args: unknown[]) => findManyNpcState(...args) },
    discoveredEntity: { findFirst: (...args: unknown[]) => findFirstDiscovered(...args) },
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
  detectsBindingWithoutRopesClaim,
  bindingWithoutRopesNarrationFor,
  BINDING_VERB_REGEX,
  detectsUnresolvedDialogueTargetClaim,
  unresolvedDialogueTargetNarrationFor,
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

// Hallazgo real jugando en vivo (2026-09-15): "Intento capturar al Orco Enfurecido convaleciente,
// atándolo" se narró con éxito sin cuerdas en el inventario real — el botón dedicado "Capturar en
// la zona" (companeros.ts) sí las exige y bloquea sin ellas. Mismo molde que
// `detectsUnequippedWeaponClaim` (reclamar usar algo que no se tiene), pero contra el inventario
// general en vez de equipo puesto.
describe('detectsBindingWithoutRopesClaim', () => {
  it('detecta atar sin cuerdas', () => {
    expect(detectsBindingWithoutRopesClaim('Ato al orco convaleciente.', false)).toEqual({ matchedVerb: expect.stringMatching(/^at/i) });
  });

  it('no dispara si SÍ tiene cuerdas (el motor real lo resuelve, no este guard)', () => {
    expect(detectsBindingWithoutRopesClaim('Ato al orco convaleciente.', true)).toBeNull();
  });

  it('detecta otros verbos de atadura/inmovilización sin cuerdas', () => {
    expect(detectsBindingWithoutRopesClaim('Lo amarro a un poste.', false)).not.toBeNull();
    expect(detectsBindingWithoutRopesClaim('Maniato al prisionero.', false)).not.toBeNull();
    expect(detectsBindingWithoutRopesClaim('Lo inmovilizo en el suelo.', false)).not.toBeNull();
    expect(detectsBindingWithoutRopesClaim('Le amordazo para que no grite.', false)).not.toBeNull();
  });

  it('no dispara sin ningún verbo de atadura, aunque falten cuerdas', () => {
    expect(detectsBindingWithoutRopesClaim('Exploro la zona con cuidado.', false)).toBeNull();
  });
});

describe('bindingWithoutRopesNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(bindingWithoutRopesNarrationFor().length).toBeGreaterThan(0);
    }
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
      { slug: 'gistera-koh', name: 'Gistera Koh', aliases: [] },
    ]);
    // Sin misión activa por defecto — la mayoría de los tests de este describe no la necesitan;
    // el describe siguiente (isPursuerOrcoInScene) la sobreescribe caso a caso.
    findFirstQuest.mockReset().mockResolvedValue(null);
    findFirstDiscovered.mockReset().mockResolvedValue(null);
  });

  it('detecta interactuar con un NPC real de catálogo que no está en la escena actual', async () => {
    const result = await detectsAbsentSceneNpcClaim("Le pregunto a Torgash por su clan.", 'world1', 'save1', []);
    expect(result).toEqual({ name: 'Torgash', conocido: false, esFauna: false, articulo: null, genero: null });
  });

  it('no dispara si el NPC mencionado SÍ está en la lista de escena', async () => {
    const result = await detectsAbsentSceneNpcClaim('Le pregunto a Torgash por su clan.', 'world1', 'save1', ['torgash']);
    expect(result).toBeNull();
  });

  it('no dispara sin intención real de interacción (mención de pasada)', async () => {
    const result = await detectsAbsentSceneNpcClaim('Pienso en lo que me dijo Torgash hace días.', 'world1', 'save1', []);
    expect(result).toBeNull();
  });

  it('no dispara si el texto no nombra a ningún NPC real del catálogo', async () => {
    const result = await detectsAbsentSceneNpcClaim('Ataco a un desconocido cualquiera.', 'world1', 'save1', []);
    expect(result).toBeNull();
  });

  // Bug real jugando en vivo (2026-09-07): "Ataco al 'Orco enfurecido' que persigue a 'Gistera
  // Koh'." se rechazaba con "No hay ningún Gistera Koh al que dirigirse aquí" — el objetivo REAL
  // del ataque (el Orco) sí estaba disponible vía la inyección determinista del perseguidor
  // (`isPursuerOrcoInScene`), pero el validador no lo sabía y bloqueaba el turno citando el
  // SEGUNDO nombre (mencionado solo como contexto), nunca el primero.
  it('con la misión del Orco ACTIVA y vocabulario de perseguidor: el Orco cuenta como presente, y el turno no se bloquea aunque cite a Gistera (ya ausente) de paso', async () => {
    findFirstQuest.mockResolvedValueOnce({ status: 'ACTIVA' });
    const result = await detectsAbsentSceneNpcClaim(
      "Ataco al 'Orco enfurecido' que persigue a 'Gistera Koh'.",
      'world1',
      'save1',
      [],
    );
    expect(result).toBeNull();
  });

  it('sin la misión del Orco ACTIVA: el mismo texto SÍ se bloquea (el Orco no está disponible sin la quest)', async () => {
    findFirstQuest.mockResolvedValueOnce(null);
    const result = await detectsAbsentSceneNpcClaim(
      "Ataco al 'Orco enfurecido' que persigue a 'Gistera Koh'.",
      'world1',
      'save1',
      [],
    );
    expect(result).not.toBeNull();
  });
});

describe('P310: una conocida ausente no se trata como desconocida', () => {
  beforeEach(() => {
    findManyNpc.mockReset().mockResolvedValue([{ slug: 'gistera-koh', name: 'Gistera Koh', aliases: ['gistera koh', 'gistera'] }]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    findFirstDiscovered.mockReset();
  });

  it('con la ficha DESCUBIERTO marca conocido y pregunta por esa ficha en la partida y en fase DESCUBIERTO', async () => {
    findFirstDiscovered.mockResolvedValue({ id: 'd1' });
    const result = await detectsAbsentSceneNpcClaim('Le regalo a Gistera un pan y le digo: «Toma, es para ti».', 'world1', 'save1', []);
    expect(result).toEqual({ name: 'Gistera Koh', conocido: true, esFauna: false, articulo: null, genero: null });
    expect(findFirstDiscovered).toHaveBeenCalledWith(expect.objectContaining({ where: { saveId: 'save1', entityType: 'npc', entitySlug: 'gistera-koh', fase: 'DESCUBIERTO' } }));
  });

  it('sin ficha DESCUBIERTO sigue siendo desconocida', async () => {
    findFirstDiscovered.mockResolvedValue(null);
    const result = await detectsAbsentSceneNpcClaim('Le pregunto a Gistera Koh por su clan.', 'world1', 'save1', []);
    expect(result).toEqual({ name: 'Gistera Koh', conocido: false, esFauna: false, articulo: null, genero: null });
  });

  it('la ficha de una persona se busca como npc, y la de una fauna conocida, como fauna (entityTypeDeSerVivo)', async () => {
    findFirstDiscovered.mockResolvedValue({ id: 'd1' });
    await detectsAbsentSceneNpcClaim('Le regalo a Gistera un pan y le digo: «Toma, es para ti».', 'world1', 'save1', []);
    expect(findFirstDiscovered).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ entityType: 'npc' }) }));
    findManyNpc.mockResolvedValue([{ slug: 'murgol', name: 'Múrgol', aliases: ['murgol'] }]);
    const fauna = await detectsAbsentSceneNpcClaim('Ataco al murgol con mi lanza.', 'world1', 'save1', []);
    expect(fauna).toEqual({ name: 'Múrgol', conocido: true, esFauna: true, articulo: null, genero: null });
    expect(findFirstDiscovered).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ entityType: 'fauna', entitySlug: 'murgol' }) }));
  });

  it('una fauna conocida ausente nunca se llama «esa persona»; una persona sí', () => {
    for (let i = 0; i < 40; i++) {
      expect(absentSceneNpcNarrationFor('Múrgol', true, true)).not.toMatch(/persona/i);
    }
    const frases = new Set(Array.from({ length: 80 }, () => absentSceneNpcNarrationFor('Gistera Koh', true, false)));
    expect([...frases].some((f) => /esa persona/.test(f))).toBe(true);
  });

  it('la conocida ausente lleva su artículo y el pronombre concuerda con el género (P310)', () => {
    for (let i = 0; i < 60; i++) {
      const f = absentSceneNpcNarrationFor('Cazadora Serhu', true, false, 'la', 'F');
      expect(f).toMatch(/la Cazadora Serhu/i);
      expect(f).not.toMatch(/(?<!la )Cazadora Serhu/i);
      expect(f).not.toMatch(/\blo (busca|comprueba)\b/);
      const m = absentSceneNpcNarrationFor('Guardián Ketg', true, false, 'el', 'M');
      expect(m).toMatch(/\b(el|al) Guardián Ketg/i);
      expect(m).not.toMatch(/\bla busca\b/);
    }
  });

  it('con artículo «el», «a» se contrae: «al Guardián Ketg», nunca «a el» (P310, revisión)', () => {
    const frases = new Set(Array.from({ length: 120 }, () => absentSceneNpcNarrationFor('Guardián Ketg', true, false, 'el', 'M')));
    for (const f of frases) expect(f).not.toMatch(/\ba el\b/i);
    expect([...frases].some((f) => /\bal Guardián Ketg\b/.test(f))).toBe(true);
    expect([...frases].some((f) => /^El Guardián Ketg no está/.test(f))).toBe(true);
  });

  it('la narración de una conocida nunca dice «quienquiera que sea» ni «no hay nadie», y siempre cita el nombre', () => {
    for (let i = 0; i < 40; i++) {
      const texto = absentSceneNpcNarrationFor('Gistera Koh', true);
      expect(texto).toContain('Gistera Koh');
      expect(texto).not.toMatch(/quienquiera|sea quien sea|nadie|ni rastro de/i);
    }
  });
});

describe('absentSceneNpcNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(absentSceneNpcNarrationFor('Torgash').length).toBeGreaterThan(0);
    }
  });
});

// Hallazgo real jugando en vivo (2026-09-15): "Hablo con la mujer orca del Clan Serhu" con Gistera
// Koh presente de verdad en escena (solo nombrada por descripción, nunca por alias real) dejaba el
// turno caer a narración libre — el LLM improvisó a quién responde en vez de que el motor lo
// resolviera. Ver comentario completo junto a la función en playerActionValidation.ts.
describe('detectsUnresolvedDialogueTargetClaim', () => {
  beforeEach(() => {
    findManyNpc.mockReset().mockResolvedValue([
      { id: 'npc1', name: 'Gistera Koh', kind: 'PRINCIPAL', homeLocationSlug: null, nucleoJugable: true },
    ]);
    findUniqueLocation.mockReset().mockResolvedValue({ slug: 'la-hondonada-del-eco', region: 'Llanuras del Viento Rojo' });
    findManyQuest.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
  });

  it('dispara: diálogo dirigido a alguien por descripción, sin ningún NPC resuelto en escena, habiendo candidatos reales en la región', async () => {
    const result = await detectsUnresolvedDialogueTargetClaim(
      'Hablo con la mujer orca del Clan Serhu para saber qué la persigue.',
      [],
      'world1',
      'save1',
      'loc1',
    );
    expect(result).toBe(true);
  });

  it('no dispara si ya hay al menos un NPC resuelto en escena (el jugador sí nombró a alguien real, sea quien sea)', async () => {
    const result = await detectsUnresolvedDialogueTargetClaim(
      'Hablo con la mujer orca del Clan Serhu para saber qué la persigue.',
      ['gistera-koh'],
      'world1',
      'save1',
      'loc1',
    );
    expect(result).toBe(false);
  });

  it('no dispara sin verbo de diálogo dirigido (prosa libre sin dirigirse a nadie)', async () => {
    const result = await detectsUnresolvedDialogueTargetClaim('Exploro la zona buscando comida.', [], 'world1', 'save1', 'loc1');
    expect(result).toBe(false);
  });

  it('no dispara con verbos de movimiento/lugar ambiguos ("me acerco a", "me dirijo a") — no son diálogo dirigido a persona', async () => {
    expect(await detectsUnresolvedDialogueTargetClaim('Me acerco a la cueva para explorarla.', [], 'world1', 'save1', 'loc1')).toBe(false);
    expect(await detectsUnresolvedDialogueTargetClaim('Me dirijo a la aldea de pescadores.', [], 'world1', 'save1', 'loc1')).toBe(false);
  });

  it('no dispara si no hay ningún NPC candidato real en absoluto en esta región (nadie a quien pudiera referirse)', async () => {
    findManyNpc.mockReset().mockResolvedValue([]);
    const result = await detectsUnresolvedDialogueTargetClaim('Le pregunto a la desconocida qué hace aquí.', [], 'world1', 'save1', 'loc1');
    expect(result).toBe(false);
  });
});

describe('unresolvedDialogueTargetNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(unresolvedDialogueTargetNarrationFor().length).toBeGreaterThan(0);
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
  // P83 (QA-27): un chip de un objeto que se lleva, sin verbo, no es intentar recolectarlo.
  it('el nombre citado no cuenta como verbo («Pico de minero» no es «minar»)', () => {
    expect(detectsFabricatedHarvestSourceClaim("'Pico de minero'")).toBeNull();
  });
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
