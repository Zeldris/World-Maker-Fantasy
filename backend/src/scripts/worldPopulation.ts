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
    // Renombrado 2026-09-02: "Buitre Cenizo" → "Zense Ceniza" (nombres de fauna sin palabras
    // reales de la Tierra). Slug sin cambiar.
    label: 'Zense Ceniza',
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
    // Renombrado (2026-09-02, generalización a toda la región árida) — de "Roca de Los Pilares
    // Rotos" a "Roca de Llanura Roja", coherente con el ItemCatalog.
    label: 'Roca de Llanura Roja (piedra)',
    poblacion: 4000,
    poblacionMax: 4000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // Junba Verde/Temune (zona 15 del repaso, Playa de Ceniza Blanca, 2026-09-02).
  {
    targetType: 'RECURSO',
    targetSlug: 'junba-verde',
    label: 'Madera Jumba',
    poblacion: 3000,
    poblacionMax: 3000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'junba-verde-resina-fuente',
    label: 'Resina Jumba Verde',
    poblacion: 1500,
    poblacionMax: 1500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'temune',
    label: 'Algas Temune',
    poblacion: 2500,
    poblacionMax: 2500,
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
  // Múrgoles domados del Campamento del Clan Serhu (2026-08-24, Grupo 3 § 27 recursos/materiales
  // sin receta) — cifra pequeña a propósito: es un recinto real dentro de la empalizada, no una
  // población salvaje (mismo eje separado del `murgol` FAUNA de arriba, 2800/4000).
  {
    targetType: 'RECURSO',
    targetSlug: 'murgoles-domados-campamento',
    label: 'Múrgoles domados (Campamento del Clan Serhu)',
    poblacion: 20,
    poblacionMax: 30,
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

  // --- Ampliación de lore 2026-08-21 — 14 fauna nuevas de Las Llanuras del Viento Rojo ---
  {
    targetType: 'FAUNA',
    targetSlug: 'gesgurio',
    label: 'Gesgurio',
    poblacion: 2000,
    poblacionMax: 3500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'kirelon-arenoso',
    label: 'Kirelon Arenoso',
    poblacion: 150,
    poblacionMax: 500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'ruptidar',
    label: 'Ruptidar',
    poblacion: 5000,
    poblacionMax: 8000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'ferike',
    label: 'Ferike',
    poblacion: 300,
    poblacionMax: 700,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'guchapo',
    label: 'Guchapo',
    poblacion: 800,
    poblacionMax: 1500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'lebude',
    label: 'Lebude',
    poblacion: 3000,
    poblacionMax: 6000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'escorante',
    label: 'Escorante',
    poblacion: 1200,
    poblacionMax: 2500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'jusha-esmeralda',
    label: 'Jusha Esmeralda',
    poblacion: 300,
    poblacionMax: 700,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'miruina',
    label: 'Miruina',
    poblacion: 600,
    poblacionMax: 1200,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'quio',
    label: 'Quio',
    poblacion: 4000,
    poblacionMax: 7000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'tura-jusha',
    label: 'Tura Jusha',
    poblacion: 500,
    poblacionMax: 1000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'cuernahoja',
    label: 'Cuernahoja',
    poblacion: 2000,
    poblacionMax: 4000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'imanio',
    label: 'Imanio',
    poblacion: 400,
    poblacionMax: 900,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'nuente',
    label: 'Nuente',
    poblacion: 250,
    poblacionMax: 600,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // --- Recursos MINERIA/TALA/EXTRACCION de la sesión de lore 2026-08-21, hallazgo real al aplicar
  // el análisis de réplica entre zonas (2026-08-22): estos 10 `sourceSlug` ya tenían HarvestYield
  // en worldCatalog.ts pero ninguna fila aquí — a diferencia del bucket PASIVO (discovery.ts, que
  // no necesita `WorldPopulation`), MINERIA/TALA/EXTRACCION pasan por `candidateSourcesFor`
  // (recolectar.ts), que solo ofrece una fuente si existe una fila `WorldPopulation` con
  // `poblacion > 0` — sin ella, estos 10 recursos nunca podían salir como candidatos en NINGUNA
  // zona, con independencia de terreno o región (ver harvestSourceTerrainTag para las etiquetas
  // añadidas en la misma pasada). Cifras calibradas contra las ya existentes de esta misma lista
  // (roca-pilares-rotos 4000, veta-hierro-pilares-rotos 600, matorral-de-cuerno 400/500, arena-iman
  // 500/750): madera en volumen alto, resina/flor de extracción más baja, minerales de tier 5+
  // (Yerreo, Fercaneo) deliberadamente los más escasos de toda la lista.
  {
    targetType: 'RECURSO',
    targetSlug: 'lucre-blanco',
    label: 'Madera de Lucre Blanco (Los Pilares Rotos)',
    poblacion: 260,
    poblacionMax: 380,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'resina-lucre-blanco-fuente',
    label: 'Resina de Lucre Blanco',
    poblacion: 90,
    poblacionMax: 150,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'telda-comun',
    label: 'Madera de Telda (El Pozo de Cauce Viejo)',
    poblacion: 300,
    poblacionMax: 450,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'telda-ceniza',
    label: 'Madera de Telda (El Cruce de las Cenizas)',
    poblacion: 260,
    poblacionMax: 400,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'resina-telda-fuente',
    label: 'Resina Telda Gris',
    poblacion: 90,
    poblacionMax: 150,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'flor-salvatura',
    label: 'Flor Salvatura',
    poblacion: 100,
    poblacionMax: 170,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'volcanita',
    label: 'Volcanita',
    poblacion: 220,
    poblacionMax: 340,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'rovalnica',
    label: 'Rovalnica',
    poblacion: 260,
    poblacionMax: 400,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'fercaneo',
    label: 'Fercaneo',
    poblacion: 35,
    poblacionMax: 60,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'yerreo',
    label: 'Mena de Yerreo (La Hondonada del Eco)',
    poblacion: 40,
    poblacionMax: 70,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // --- La Sabana Alta (zona 14 del repaso "zona por zona", añadido 2026-08-22) ---
  {
    targetType: 'FAUNA',
    targetSlug: 'towrgu',
    label: 'Towrgu',
    poblacion: 350,
    poblacionMax: 750,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'coracelo',
    label: 'Coracelo',
    poblacion: 700,
    poblacionMax: 1300,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'telda-atardecer',
    label: 'Madera de Telda Atardecer (La Sabana Alta)',
    poblacion: 200,
    poblacionMax: 320,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'resina-telda-atardecer-fuente',
    label: 'Resina de Telda Atardecer',
    poblacion: 80,
    poblacionMax: 140,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RECURSO',
    targetSlug: 'roca-luclara',
    label: 'Roca Luclara',
    poblacion: 220,
    poblacionMax: 350,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },

  // Peces y marisco de Playa de Ceniza Blanca (zona 15 del repaso, 2026-09-02, profesión
  // "pescador") — mismo `targetType: 'FAUNA'` que el resto de fauna real (aullador-rojo, etc.),
  // NUNCA depletado por Pescar/Buscar (esos no matan, ver comentario de `esFaunaMetodo`,
  // recolectar.ts) — la cifra aquí es solo el gate "hay peces en esta costa", no un contador que
  // baje con cada captura. Jashil/Negueo: "muy abundante"/pez común de toda la costa → población
  // alta (800-1500, igual de orden de magnitud que otra fauna abundante como Aullador Rojo).
  // Bulco de Arena: caracol de marea, igual de común → misma franja alta. Toluh: "pez migratorio
  // de gran tamaño... muy apreciado por lo raro que es dar con uno" → población baja (80-150,
  // orden de magnitud de Rondador de Brasas/Canizor, la fauna más rara ya sembrada) — su
  // disponibilidad REAL por estación (solo otoño) vive en `HarvestYield.estacionRequerida`, no
  // aquí (`WorldPopulation` no tiene campo de estación, ver schema.prisma).
  {
    targetType: 'FAUNA',
    targetSlug: 'jashil-verde',
    label: 'Jashil Verde',
    poblacion: 1200,
    poblacionMax: 2000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'jashil-rojo',
    label: 'Jashil Rojo',
    poblacion: 1200,
    poblacionMax: 2000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'toluh',
    label: 'Toluh',
    poblacion: 120,
    poblacionMax: 200,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'negueo-turquesa',
    label: 'Negueo Turquesa',
    poblacion: 900,
    poblacionMax: 1600,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'negueo-solar',
    label: 'Negueo Solar',
    poblacion: 900,
    poblacionMax: 1600,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'bulco-de-arena',
    label: 'Bulco de Arena',
    poblacion: 1500,
    poblacionMax: 2500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },

  // --- Los Acantilados Partidos (2026-09-02, sesión "categorías de raza de fauna") — cifras
  // dadas por la usuaria: Celubia ~400-700 (ave rapaz, población media), Terkash ~200-400 (más
  // raro, territorial, un ejemplar por grieta).
  {
    targetType: 'FAUNA',
    targetSlug: 'celubia-palida',
    label: 'Celubia Pálida',
    poblacion: 400,
    poblacionMax: 700,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'terkash',
    label: 'Terkash',
    poblacion: 200,
    poblacionMax: 400,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
];
