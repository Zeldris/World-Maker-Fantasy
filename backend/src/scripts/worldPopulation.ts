import type { PopulationTargetType } from '@prisma/client';

/// Control de vida del mundo (2026-07-29, petición explícita: "establecer la 'población' para
/// limitar e ir haciendo un control de la vida en el mundo"). Nunca visible para la jugadora —
/// puro control interno, base para zonas de aparición por probabilidad, extinción, sobrepoblación
/// y migraciones futuras (esta sesión solo sienta los datos semilla, no la simulación dinámica).
///
/// Dos ejes deliberadamente separados (decisión de diseño explícita): `poblacion`/`poblacionMax`
/// es la salud demográfica (un único número global, nunca partido por región); `distribucion` es
/// dónde está repartida AHORA MISMO esa misma población (pesos relativos por región, no un
/// conteo fijo) — migrar un día solo reescribirá `distribucion`, nunca `poblacion`.
export interface WorldPopulationInput {
  targetType: PopulationTargetType;
  targetSlug: string;
  label: string;
  poblacion: number;
  poblacionMax: number;
  /// Pesos relativos por región (suman ~1.0 hoy — todo anclado a una sola región mientras no
  /// exista todavía ningún evento de migración/guerra que los reparta entre varias).
  distribucion: Record<string, number>;
}

export const worldPopulations: WorldPopulationInput[] = [
  // --- Razas (cifras dadas explícitamente por la usuaria, 2026-07-29) ---
  {
    targetType: 'RAZA',
    targetSlug: 'goirntes',
    label: 'Goirntes (Meseta del Orden)',
    poblacion: 4000,
    poblacionMax: 5500,
    distribucion: { 'Meseta del Orden': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'nabieus',
    label: 'Nabieus (Margen Silencioso)',
    poblacion: 2600,
    poblacionMax: 3200,
    distribucion: { 'Margen Silencioso': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'faerus',
    label: 'Faerus (Margen Silencioso)',
    poblacion: 1200,
    poblacionMax: 1900,
    distribucion: { 'Margen Silencioso': 1 },
  },
  // Los 3 clanes orcos son filas separadas a propósito (confirmado por la usuaria: son
  // sub-razas ya adaptadas a su región — biología distinta entre ellas, Serhu vs. Helsig vs.
  // Goshg — que rara vez se desplazan salvo guerra o evento de mundo muy concreto). El Clan
  // Maktor no tiene fila propia: reducido a Gorhorn en solitario, no una población a trackear.
  {
    targetType: 'RAZA',
    targetSlug: 'orcos-llanuras',
    // Etiqueta corregida (2026-08-03, sesión "ampliamos lore" — historia orca profunda): ya no
    // dice "Maktor/Serhu". Con el Clan Maktor reducido a Gorhorn en solitario (aniquilado por una
    // incursión Goirnte, ver areas.md § Historia profunda), esta fila es de facto solo el Clan
    // Serhu — se deja el targetSlug genérico `orcos-llanuras` tal cual (no rompe nada que ya
    // dependa de él), solo se corrige el label. La cifra (800/1.000) no cambia: ya cuadraba con
    // el ritmo de crecimiento explicado en areas.md § "El cerco social".
    label: 'Orcos del Clan Serhu (Llanuras del Viento Rojo)',
    poblacion: 600,
    poblacionMax: 1000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'orcos-cristal-helado',
    label: 'Orcos del clan Helsig (Cristal Helado)',
    poblacion: 400,
    poblacionMax: 700,
    distribucion: { 'Cristal Helado': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'orcos-cienaga',
    label: 'Orcos del clan Goshg (Ciénaga Troncal)',
    poblacion: 600,
    poblacionMax: 850,
    distribucion: { 'Ciénaga Troncal': 1 },
  },

  // --- Fauna (semilla propuesta, 2026-07-29: cuanto más pequeño el animal, mayor su número;
  // grandes/peligrosos/con materiales valiosos quedan controlados) — todas en Llanuras del
  // Viento Rojo salvo Cornante (Ciénaga Troncal, su propia descripción lo deja claro: "se hunden
  // en el barro de la ciénaga") y Sombra de Kroj (Margen Silencioso, "caza en grupo en El Margen
  // Silencioso" es texto literal de su descripción).
  {
    targetType: 'FAUNA',
    targetSlug: 'corredor-de-cauce',
    label: 'Corredor de Cauce',
    poblacion: 3500,
    poblacionMax: 5000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'corretolvas',
    label: 'Corretolvas',
    poblacion: 4500,
    poblacionMax: 6000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'murgol',
    label: 'Múrgol',
    poblacion: 2800,
    poblacionMax: 4000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'buitre-cenizo',
    label: 'Buitre Cenizo',
    poblacion: 3200,
    poblacionMax: 4000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'espina-del-viento',
    label: 'Espina del Viento',
    poblacion: 1800,
    poblacionMax: 3500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'cruzavientos',
    label: 'Cruzavientos',
    poblacion: 600,
    poblacionMax: 1200,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'aullador-rojo',
    label: 'Aullador Rojo',
    poblacion: 1400,
    poblacionMax: 3200,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'salamandra-de-escoria',
    label: 'Salamandra de Escoria',
    poblacion: 1200,
    poblacionMax: 1800,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'rondador-de-brasas',
    label: 'Rondador de Brasas',
    poblacion: 350,
    poblacionMax: 900,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // Canizor (añadido 2026-08-03, sesión "ampliamos lore"): solitario y territorial (a diferencia
  // del Aullador Rojo, que caza en jauría) — cada individuo necesita un territorio propio grande,
  // así que su población se queda deliberadamente baja, por debajo de Rondador de Brasas.
  {
    targetType: 'FAUNA',
    targetSlug: 'canizor',
    label: 'Canizor',
    poblacion: 200,
    poblacionMax: 1200,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // Gargantúa de Ceniza: la más controlada de todas a propósito — enorme, solo se caza en
  // cacería ritual de clan o cadáver ya muerto (ver harvest.ts), y sus placas óseas/huesos largos
  // son material de construcción pesado real (choza/peto, ver construction.ts/crafting.ts).
  {
    targetType: 'FAUNA',
    targetSlug: 'gargantua-de-ceniza',
    label: 'Gargantúa de Ceniza',
    poblacion:50,
    poblacionMax: 380,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // --- NPCs itinerantes sin `homeLocationSlug` fijo — mismo bug de fondo que el de herborista
  // (auditoría de catálogo 2026-08-13): la sugerencia ambiental de encuentro (`turnResolution.ts`,
  // 25% de probabilidad por turno explorando) exige una fila `WorldPopulation` con
  // `targetType: 'FAUNA'` y `poblacion > 0` para poder proponer un candidato sin que el jugador lo
  // nombre antes — sin fila, un NPC bien definido y con loadout completo nunca se sugiere solo, y
  // sin ninguna misión que lo señale, en la práctica no aparece nunca en una partida real. Cifras
  // deliberadamente bajas (arquetipo humano suelto, no una especie entera como la fauna de arriba)
  // — más raro que la fauna común, pero no tan excepcional como la Gargantúa de Ceniza.
  {
    targetType: 'FAUNA',
    targetSlug: 'orco-rezagado',
    label: 'Orco rezagado',
    poblacion: 10,
    poblacionMax: 50,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'mercader-de-paso',
    label: 'Mercader de paso',
    poblacion: 10,
    poblacionMax: 25,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'peregrino-de-los-tumulos',
    label: 'Peregrino de los túmulos',
    poblacion: 3,
    poblacionMax: 8,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // --- Recursos de recolección (rediseño de profesiones, 2026-08-07) — MINERIA/TALA de
  // HarvestYield, núcleo jugable (Llanuras). Desuello (CAZA) no necesita fila propia: ya usa la
  // población FAUNA de arriba.
  {
    targetType: 'RECURSO',
    targetSlug: 'roca-pilares-rotos',
    label: 'Roca de Los Pilares Rotos (piedra)',
    poblacion: 4000,
    poblacionMax: 4000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'veta-hierro-pilares-rotos',
    label: 'Veta de hierro de Los Pilares Rotos',
    poblacion: 600,
    poblacionMax: 600,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'matorral-de-cuerno',
    label: 'Matorral de Cuerno (madera)',
    poblacion: 400,
    poblacionMax: 500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // --- EXTRACCION (hierbas/flores/objetos), núcleo jugable (Llanuras) — bug real confirmado
  // jugando en vivo (2026-08-13, "llevo 2 zonas sin encontrar nada en herboristería"): el
  // comentario de arriba decía "EXTRACCION queda fuera por ahora — ninguna profesión nueva las
  // necesita todavía" (2026-08-07), pero la profesión herborista ya se activó y usa exactamente
  // estas fuentes — sin fila `WorldPopulation`, `candidateSourcesFor` (recolectar.ts) nunca las
  // ofrece: cero población sembrada = herborista nunca encuentra nada, en ninguna zona. Añadidas
  // las 10 fuentes EXTRACCION cuya propia descripción/región (`harvestSourceRegion`) ya confirma
  // que son del núcleo jugable — quedan fuera a propósito `hierba-del-hierro` (Meseta del Orden) y
  // `trepador-ocaso` (Ciénaga Troncal), ambas marcadas "fuera del núcleo jugable actual" en su
  // propio HarvestYield, mismo criterio que ya se aplicó a `hielo-silice` (MINERIA, Cristal
  // Helado). Cifras deliberadamente por debajo de piedra/veta/madera (más "delicadas" que roca o
  // madera): 60-90 para objetos finitos no renovables por naturaleza (ofrendas rituales, restos
  // personales) o flora muy restringida (Flor de Ceniza, solo en suelo de ceniza volcánica) y
  // arena imán (ligada a tormentas puntuales, no a crecimiento); 80-140 para el resto de flora
  // silvestre, cifra de partida ajustable como el resto de este archivo.
  {
    targetType: 'RECURSO',
    targetSlug: 'arena-iman',
    label: 'Arena Imán',
    poblacion: 500,
    poblacionMax: 750,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'bulbo-del-cauce',
    label: 'Bulbo del Cauce',
    poblacion: 110,
    poblacionMax: 240,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'cardo-brujula',
    label: 'Cardo Brújula',
    poblacion: 120,
    poblacionMax: 240,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'espiga-roja',
    label: 'Espiga Roja',
    poblacion: 130,
    poblacionMax: 250,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'flor-de-ceniza',
    label: 'Flor de Ceniza',
    poblacion: 60,
    poblacionMax: 180,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'liquen-del-cauce',
    label: 'Liquen del Cauce',
    poblacion: 80,
    poblacionMax: 430,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'ofrendas-tumulos-honor',
    label: 'Ofrendas de los Túmulos del Honor',
    poblacion: 6,
    poblacionMax: 14,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'raiz-de-fuego',
    label: 'Raíz de Fuego',
    poblacion: 200,
    poblacionMax: 400,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'restos-personales-maktor',
    label: 'Restos personales de Maktor',
    poblacion: 2,
    poblacionMax: 5,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'salvia-del-polvo',
    label: 'Salvia del Polvo',
    poblacion: 110,
    poblacionMax: 240,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'sombra-de-kroj',
    label: 'Sombra de Kroj',
    poblacion: 700,
    poblacionMax: 1000,
    distribucion: { 'Margen Silencioso': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'cornante',
    label: 'Cornante',
    poblacion: 300,
    poblacionMax: 500,
    distribucion: { 'Ciénaga Troncal': 1 },
  },
];
