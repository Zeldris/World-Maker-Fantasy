import { describe, it, expect, vi } from 'vitest';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-21): `loreContextFor` no tenía ningún test
/// pese a ser lógica de negocio real y no trivial — 10 ramas por `entityType` y, dentro de
/// npc/fauna/raza, una resolución de variante por sexo (`stripSexoSuffix`/`withSexoVariante`) que
/// ya ha tenido DOS bugs reales documentados en el propio archivo (2026-07-22: "el prompt no
/// indica en ninguna parte 'female'"; "Goirntes hembra de Meseta del Orden no indica female en
/// ninguna parte"). El resto de dependencias (berigLore.ts, sexDimorphism.ts, construction.ts,
/// crafting.ts, classAbilities.ts, startingAbilities.ts) son datos/lógica pura reales, sin mockear
/// — solo se mockea Prisma (mismo patrón que chapterSummary.test.ts) y worldCatalog.ts (mismo
/// patrón que entityDiscovery.test.ts).
const findUniqueNpc = vi.fn();
const findUniqueItem = vi.fn();
const findFirstHarvestYield = vi.fn();
const findUniqueLocation = vi.fn();
const findUniqueFaction = vi.fn();
const findUniqueHistoria = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    npc: { findUnique: (...args: unknown[]) => findUniqueNpc(...args) },
    itemCatalog: { findUnique: (...args: unknown[]) => findUniqueItem(...args) },
    harvestYield: { findFirst: (...args: unknown[]) => findFirstHarvestYield(...args) },
    location: { findUnique: (...args: unknown[]) => findUniqueLocation(...args) },
    faction: { findUnique: (...args: unknown[]) => findUniqueFaction(...args) },
    historiaEntry: { findUnique: (...args: unknown[]) => findUniqueHistoria(...args) },
  },
}));

vi.mock('../scripts/worldCatalog.js', () => ({
  harvestSourceAliases: { 'corredor-de-cauce': ['corredor'] },
  harvestSourceDescriptions: { 'una-flor-sin-npc': 'Flor silvestre sin fauna asociada.' },
  sourceDisplayNameFor: (slug: string, npcName?: string | null) => npcName ?? slug,
}));

const { loreContextFor, stripLocationTimeVariant } = await import('./imagePromptContext.js');

describe('stripLocationTimeVariant', () => {
  it('sin sufijo, devuelve el slug tal cual con los dos ejes en null', () => {
    expect(stripLocationTimeVariant('hondonada-del-eco')).toEqual({ baseSlug: 'hondonada-del-eco', momento: null, estacion: null });
  });

  it('con los dos ejes, en el orden momento-estacion', () => {
    expect(stripLocationTimeVariant('hondonada-del-eco-dia-primavera')).toEqual({
      baseSlug: 'hondonada-del-eco',
      momento: 'dia',
      estacion: 'primavera',
    });
  });

  it('con solo estación (sin momento)', () => {
    expect(stripLocationTimeVariant('hondonada-del-eco-invierno')).toEqual({ baseSlug: 'hondonada-del-eco', momento: null, estacion: 'invierno' });
  });

  it('con solo momento (sin estación)', () => {
    expect(stripLocationTimeVariant('hondonada-del-eco-noche')).toEqual({ baseSlug: 'hondonada-del-eco', momento: 'noche', estacion: null });
  });

  it('un slug base que termina por casualidad en una palabra de estación no se confunde (no es un caso real del catálogo, pero cubre el límite del método)', () => {
    // 'del-eco' no coincide con ningún sufijo reconocido, así que esto no dispara falsos positivos
    // — documentado aquí como el límite real del enfoque (sufijo por texto, no un campo aparte).
    expect(stripLocationTimeVariant('rio-verano-eco')).toEqual({ baseSlug: 'rio-verano-eco', momento: null, estacion: null });
  });
});

describe('loreContextFor — npc', () => {
  it('devuelve null si el npc no existe', async () => {
    findUniqueNpc.mockResolvedValueOnce(null);
    expect(await loreContextFor('w1', 'npc', 'nadie')).toBeNull();
  });

  it('sin sufijo de sexo, arma el lore general (role, faction, bio, personality)', async () => {
    findUniqueNpc.mockResolvedValueOnce({
      name: 'Torgash',
      role: 'Cazador',
      faction: 'Clan Serhu',
      bio: 'Un cazador experimentado.',
      personality: 'Reservado.',
    });

    const result = await loreContextFor('w1', 'npc', 'torgash');

    expect(result).toEqual({
      name: 'Torgash',
      loreContext: 'Cazador, Clan Serhu. Un cazador experimentado. Reservado.',
    });
  });

  // Bug real (2026-07-22): "el prompt no indica en ninguna parte 'female'" — el sexoLabel
  // explícito es justamente lo que arregló esto.
  it('con sufijo -hembra y variante conocida (NPC_SEXO_VARIANTES), añade sexoLabel/medidas/rasgos', async () => {
    findUniqueNpc.mockResolvedValueOnce({
      name: 'Soldado de la Concordia',
      role: 'Soldado',
      faction: 'Concordia de Hierro',
      bio: 'Patrulla la Meseta.',
      personality: 'Disciplinado.',
    });

    const result = await loreContextFor('w1', 'npc', 'soldado-concordia-hembra');

    expect(findUniqueNpc).toHaveBeenCalledWith({ where: { worldId_slug: { worldId: 'w1', slug: 'soldado-concordia' } } });
    expect(result?.loreContext).toContain('Es de sexo hembra (mujer, femenino).');
    expect(result?.loreContext).toContain('Mide aproximadamente 174 cm');
    expect(result?.loreContext).toContain('igual de resistente a la marcha y la carga');
  });

  it('con sufijo -macho pero sin variante conocida en NPC_SEXO_VARIANTES, cae al lore general sin ninguna mención de sexo', async () => {
    // NPC plantilla sin entrada real en NPC_SEXO_VARIANTES (todas las plantillas hoy sembradas sí
    // la tienen — este slug es deliberadamente inventado para forzar el hueco y probar el fallback
    // de `withSexoVariante`, que debe devolver el lore general intacto, no reventar).
    findUniqueNpc.mockResolvedValueOnce({
      name: 'Explorador sin variante',
      role: 'Explorador',
      faction: null,
      bio: 'Recorre territorio inexplorado.',
      personality: 'Cauto.',
    });

    const result = await loreContextFor('w1', 'npc', 'explorador-sin-variante-macho');

    expect(result?.loreContext).not.toMatch(/sexo (macho|hembra)/);
    expect(result?.loreContext).toBe('Explorador. Recorre territorio inexplorado. Cauto.');
  });
});

describe('loreContextFor — item', () => {
  it('devuelve null si el objeto no existe', async () => {
    findUniqueItem.mockResolvedValueOnce(null);
    expect(await loreContextFor('w1', 'item', 'nada')).toBeNull();
  });

  it('incluye medidas y origen solo cuando existen', async () => {
    findUniqueItem.mockResolvedValueOnce({
      name: 'Hacha de guerra',
      category: 'arma',
      description: 'Un hacha pesada.',
      dimensiones: '90cm de largo',
      lugarOrigen: 'Clan Maktor',
    });

    const result = await loreContextFor('w1', 'item', 'hacha-de-guerra');

    expect(result?.loreContext).toBe('Categoría: arma. Un hacha pesada. Medidas: 90cm de largo Origen: Clan Maktor');
  });

  it('sin dimensiones ni lugarOrigen, no añade esos fragmentos', async () => {
    findUniqueItem.mockResolvedValueOnce({ name: 'Piedra', category: 'material', description: 'Una piedra cualquiera.', dimensiones: null, lugarOrigen: null });

    const result = await loreContextFor('w1', 'item', 'piedra');

    expect(result?.loreContext).toBe('Categoría: material. Una piedra cualquiera.');
  });
});

describe('loreContextFor — fauna', () => {
  it('devuelve null si no hay HarvestYield para ese sourceSlug', async () => {
    findFirstHarvestYield.mockResolvedValueOnce(null);
    expect(await loreContextFor('w1', 'fauna', 'nada')).toBeNull();
  });

  it('fauna cazable (con Npc asociado) usa el bio del Npc y se etiqueta "Fauna cazable"', async () => {
    findFirstHarvestYield.mockResolvedValueOnce({ sourceSlug: 'corredor-de-cauce' });
    findUniqueNpc.mockResolvedValueOnce({ name: 'Corredor de Cauce', bio: 'Corre en manadas por la estepa.' });

    const result = await loreContextFor('w1', 'fauna', 'corredor-de-cauce');

    expect(result?.loreContext).toContain('Fauna cazable de las Llanuras del Viento Rojo.');
    expect(result?.loreContext).toContain('Corre en manadas por la estepa.');
    expect(result?.loreContext).toContain('También conocido como: corredor.');
  });

  it('recurso sin Npc (flora/mineral) usa harvestSourceDescriptions y se etiqueta "Flora o material recolectable"', async () => {
    findFirstHarvestYield.mockResolvedValueOnce({ sourceSlug: 'una-flor-sin-npc' });
    findUniqueNpc.mockResolvedValueOnce(null);

    const result = await loreContextFor('w1', 'fauna', 'una-flor-sin-npc');

    expect(result?.loreContext).toContain('Flora o material recolectable de las Llanuras del Viento Rojo.');
    expect(result?.loreContext).toContain('Flor silvestre sin fauna asociada.');
  });

  it('con sufijo de sexo y variante conocida (FAUNA_SEXO_VARIANTES), añade el sexo explícito', async () => {
    findFirstHarvestYield.mockResolvedValueOnce({ sourceSlug: 'corredor-de-cauce' });
    findUniqueNpc.mockResolvedValueOnce({ name: 'Corredor de Cauce', bio: 'Corre en manadas por la estepa.' });

    const result = await loreContextFor('w1', 'fauna', 'corredor-de-cauce-macho');

    expect(result?.loreContext).toContain('Es de sexo macho (hombre, masculino).');
    expect(result?.loreContext).toContain('Mide aproximadamente 145 cm');
  });
});

describe('loreContextFor — raza', () => {
  it('raza general sin sufijo de sexo: lore de BERIG_RAZAS', async () => {
    const result = await loreContextFor('w1', 'raza', 'orcos');
    expect(result?.name).toBe('Orcos — Hijos del Estallido');
    expect(result?.loreContext).toBeTruthy();
  });

  // RAZA_SEXO_VARIANTES está vacío a propósito (sexDimorphism.ts: las 4 razas de Berig llevan su
  // sexo cruzado con región, no a nivel general) — a nivel de raza GENERAL (sin variante regional)
  // hoy no hay ningún dato de sexo que añadir, así que cae al lore general sin mención de sexo.
  // Cobertura deliberada de este hueco de datos conocido (ver informe de auditoría) — no es un bug
  // de código, RAZA_SEXO_VARIANTES existe vacío a propósito para una raza futura sin variantes.
  it('raza general con sufijo de sexo pero sin variante en RAZA_SEXO_VARIANTES (vacío a propósito): cae al lore general', async () => {
    const result = await loreContextFor('w1', 'raza', 'orcos-macho');
    expect(result?.loreContext).not.toMatch(/sexo (macho|hembra)/);
  });

  it('variante regional sin sufijo de sexo: combina lore general de la raza + específico de la variante', async () => {
    const result = await loreContextFor('w1', 'raza', 'orcos-llanuras');
    expect(result?.name).toBe('Orcos de las Llanuras del Viento Rojo (Clanes Maktor y Serhu)');
  });

  // Bug real (2026-07-22, "Goirntes hembra de Meseta del Orden no indica female en ninguna
  // parte") — variante regional CON su propia entrada en RAZA_VARIANTE_SEXO_VARIANTES.
  it('variante regional con sufijo de sexo y entrada en RAZA_VARIANTE_SEXO_VARIANTES: usa esa entrada (nunca la general vacía)', async () => {
    const result = await loreContextFor('w1', 'raza', 'orcos-llanuras-hembra');

    expect(result?.loreContext).toContain('Es de sexo hembra (mujer, femenino).');
    expect(result?.loreContext).toContain('Mide aproximadamente 190 cm');
  });

  it('slug de variante regional inexistente con sufijo de sexo: null', async () => {
    expect(await loreContextFor('w1', 'raza', 'orcos-region-inventada-macho')).toBeNull();
  });

  it('slug de raza totalmente desconocido: null', async () => {
    expect(await loreContextFor('w1', 'raza', 'raza-inventada')).toBeNull();
  });
});

describe('loreContextFor — location/faction/historia', () => {
  it('location: null si no existe, lore con región/tipo/descripción si existe', async () => {
    findUniqueLocation.mockResolvedValueOnce(null);
    expect(await loreContextFor('w1', 'location', 'nada')).toBeNull();

    findUniqueLocation.mockResolvedValueOnce({ name: 'Los Pilares Rotos', region: 'Las Llanuras del Viento Rojo', kind: 'punto_de_interes', description: 'Ruinas antiguas.' });
    const result = await loreContextFor('w1', 'location', 'los-pilares-rotos');
    expect(result).toEqual({ name: 'Los Pilares Rotos', loreContext: 'Región: Las Llanuras del Viento Rojo. Tipo: punto_de_interes. Ruinas antiguas.' });
  });

  // Día/noche/estación (2026-08-27) — el sufijo se despoja ANTES de consultar Prisma (la fila real
  // sigue viviendo bajo el slug base) y el texto genérico de cada eje se añade al final, en ese
  // orden, sin tocar el general.
  it('location: sufijo de día/noche/estación consulta el slug BASE y añade el texto genérico de cada eje', async () => {
    findUniqueLocation.mockResolvedValueOnce({ name: 'Los Pilares Rotos', region: 'Las Llanuras del Viento Rojo', kind: 'punto_de_interes', description: 'Ruinas antiguas.' });
    const result = await loreContextFor('w1', 'location', 'los-pilares-rotos-noche-invierno');
    expect(findUniqueLocation).toHaveBeenLastCalledWith({ where: { worldId_slug: { worldId: 'w1', slug: 'los-pilares-rotos' } } });
    expect(result?.loreContext).toBe(
      'Región: Las Llanuras del Viento Rojo. Tipo: punto_de_interes. Ruinas antiguas. ' +
        'Es de noche: iluminada por un brillo perlado y difuso repartido por todo el cielo (nunca un disco de luna — este mundo no tiene luna), estrellas visibles, o fuego; sombras profundas, colores apagados y fríos, sin luz solar. ' +
        'Es invierno: frío marcado, posible nieve o escarcha si la región lo permite, luz fría y apagada, vegetación reducida o desnuda.',
    );
  });

  it('location: solo un eje del sufijo (sin el otro) también funciona, cada uno es independiente', async () => {
    findUniqueLocation.mockResolvedValueOnce({ name: 'Los Pilares Rotos', region: 'Las Llanuras del Viento Rojo', kind: 'punto_de_interes', description: 'Ruinas antiguas.' });
    const result = await loreContextFor('w1', 'location', 'los-pilares-rotos-dia');
    expect(findUniqueLocation).toHaveBeenLastCalledWith({ where: { worldId_slug: { worldId: 'w1', slug: 'los-pilares-rotos' } } });
    expect(result?.loreContext).toBe(
      'Región: Las Llanuras del Viento Rojo. Tipo: punto_de_interes. Ruinas antiguas. Es de día: luz solar clara y directa, buena visibilidad de todos los detalles del paisaje.',
    );
  });

  it('zona: mismo sufijo de día/noche/estación, manteniendo los puntos calibrados en el texto', async () => {
    findUniqueLocation.mockResolvedValueOnce({
      name: 'La Hondonada del Eco',
      region: 'Las Llanuras del Viento Rojo',
      kind: 'zona_explorable',
      description: 'Una hondonada resguardada.',
      zonePoints: [{ label: 'Pozo viejo', targetSlug: 'pozo-viejo' }],
    });
    const result = await loreContextFor('w1', 'zona', 'hondonada-del-eco-noche-verano');
    expect(findUniqueLocation).toHaveBeenLastCalledWith({
      where: { worldId_slug: { worldId: 'w1', slug: 'hondonada-del-eco' } },
      include: { zonePoints: { where: { saveId: null } } },
    });
    expect(result?.loreContext).toContain('Elementos reales presentes en la zona');
    expect(result?.loreContext).toContain('Pozo viejo');
    expect(result?.loreContext).toContain('Es de noche');
    expect(result?.loreContext).toContain('Es verano');
  });

  it('faction: null si no existe, lore con raza dominante/descripción si existe', async () => {
    findUniqueFaction.mockResolvedValueOnce(null);
    expect(await loreContextFor('w1', 'faction', 'nada')).toBeNull();

    findUniqueFaction.mockResolvedValueOnce({ name: 'Clan Serhu', raza: 'Orcos', description: 'Clan dominante de las Llanuras.' });
    const result = await loreContextFor('w1', 'faction', 'clan-serhu');
    expect(result).toEqual({ name: 'Clan Serhu', loreContext: 'Raza dominante: Orcos. Clan dominante de las Llanuras.' });
  });

  it('historia: null si no existe, título+texto tal cual si existe (sin candado de traducción aquí)', async () => {
    findUniqueHistoria.mockResolvedValueOnce(null);
    expect(await loreContextFor('w1', 'historia', 'nada')).toBeNull();

    findUniqueHistoria.mockResolvedValueOnce({ title: 'La caída del Clan Maktor', text: 'Texto completo de la entrada.' });
    const result = await loreContextFor('w1', 'historia', 'la-caida-del-clan-maktor');
    expect(result).toEqual({ name: 'La caída del Clan Maktor', loreContext: 'Texto completo de la entrada.' });
  });
});

describe('loreContextFor — construccion/crafteo/personaje/ability (contenido estático)', () => {
  it('construccion: busca por key o por imageSlug en CONSTRUCTION_RECIPES', async () => {
    const result = await loreContextFor('w1', 'construccion', 'campamento');
    expect(result?.name).toBe('Campamento Base Orco de las Llanuras');
    expect(await loreContextFor('w1', 'construccion', 'no-existe')).toBeNull();
  });

  it('crafteo: busca por key en CRAFTING_RECIPES', async () => {
    const result = await loreContextFor('w1', 'crafteo', 'axeRepair');
    expect(result?.name).toBe('Hacha de guerra Maktor restaurada');
    expect(await loreContextFor('w1', 'crafteo', 'no-existe')).toBeNull();
  });

  it('personaje: busca por slug en BERIG_PERSONAJES', async () => {
    const result = await loreContextFor('w1', 'personaje', 'gorhorn');
    expect(result?.name).toBeTruthy();
    expect(result?.loreContext).toContain('Raza: ');
    expect(await loreContextFor('w1', 'personaje', 'no-existe')).toBeNull();
  });

  it('ability: busca por slugify(nombre) entre startingAbilitiesFor("Gorhorn") + allClassAbilityUnlocks', async () => {
    const result = await loreContextFor('w1', 'ability', 'descansar');
    expect(result?.name).toBe('Descansar');
    expect(result?.loreContext).toContain('Habilidad inicial de Gorhorn');
    expect(await loreContextFor('w1', 'ability', 'no-existe')).toBeNull();
  });
});
