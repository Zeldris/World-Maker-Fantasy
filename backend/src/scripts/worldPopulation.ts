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
    poblacionMax: 4500,
    distribucion: { 'Meseta del Orden': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'nabieus',
    label: 'Nabieus (Margen Silencioso)',
    poblacion: 2600,
    poblacionMax: 3000,
    distribucion: { 'Margen Silencioso': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'faerus',
    label: 'Faerus (Margen Silencioso)',
    poblacion: 1200,
    poblacionMax: 1500,
    distribucion: { 'Margen Silencioso': 1 },
  },
  // Los 3 clanes orcos son filas separadas a propósito (confirmado por la usuaria: son
  // sub-razas ya adaptadas a su región — biología distinta entre ellas, Maktor/Serhu vs. Helsig
  // vs. Goshg — que rara vez se desplazan salvo guerra o evento de mundo muy concreto).
  {
    targetType: 'RAZA',
    targetSlug: 'orcos-llanuras',
    label: 'Orcos del clan Maktor/Serhu (Llanuras del Viento Rojo)',
    poblacion: 800,
    poblacionMax: 1000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'orcos-cristal-helado',
    label: 'Orcos del clan Helsig (Cristal Helado)',
    poblacion: 400,
    poblacionMax: 500,
    distribucion: { 'Cristal Helado': 1 },
  },
  {
    targetType: 'RAZA',
    targetSlug: 'orcos-cienaga',
    label: 'Orcos del clan Goshg (Ciénaga Troncal)',
    poblacion: 600,
    poblacionMax: 750,
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
    poblacion: 4500,
    poblacionMax: 6000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'corretolvas',
    label: 'Corretolvas',
    poblacion: 3500,
    poblacionMax: 5000,
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
    poblacion: 2200,
    poblacionMax: 3000,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'espina-del-viento',
    label: 'Espina del Viento',
    poblacion: 1800,
    poblacionMax: 2500,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'cruzavientos',
    label: 'Cruzavientos',
    poblacion: 1100,
    poblacionMax: 1600,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'aullador-rojo',
    label: 'Aullador Rojo',
    poblacion: 900,
    poblacionMax: 1400,
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
    targetSlug: 'salamandra-de-escoria',
    label: 'Salamandra de Escoria',
    poblacion: 400,
    poblacionMax: 600,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'cornante',
    label: 'Cornante',
    poblacion: 300,
    poblacionMax: 500,
    distribucion: { 'Ciénaga Troncal': 1 },
  },
  {
    targetType: 'FAUNA',
    targetSlug: 'rondador-de-brasas',
    label: 'Rondador de Brasas',
    poblacion: 250,
    poblacionMax: 400,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
  // Gargantúa de Ceniza: la más controlada de todas a propósito — enorme, solo se caza en
  // cacería ritual de clan o cadáver ya muerto (ver harvest.ts), y sus placas óseas/huesos largos
  // son material de construcción pesado real (choza/peto, ver construction.ts/crafting.ts).
  {
    targetType: 'FAUNA',
    targetSlug: 'gargantua-de-ceniza',
    label: 'Gargantúa de Ceniza',
    poblacion: 60,
    poblacionMax: 100,
    distribucion: { 'Llanuras del Viento Rojo': 1 },
  },
];
