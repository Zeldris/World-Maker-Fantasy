// CR-50 (hito 0.3, Fase E): campamentos de bandidos — semillas y reglas puras. Decisiones Q1-Q9 de
// la ronda de detalle en `docs/producto/plan-roadmap-0.3.md` (X4 marca el camino: bases piratas que
// se asientan donde no hay dueño y se rehacen; Bellwright: cabecilla con nombre y refuerzos).

/// Q1: quién ocupa los campamentos. **Semillas, no código:** la usuaria añadirá razas «poco
/// civilizadas» (el ejemplo eran los Murlocks de WoW) con sus propuestas de lore; para que una raza
/// ocupe campamentos basta con una fila aquí y su NPC plantilla en el catálogo. Provisionales: los
/// renegados de 49c (`propuestas-lore.md`, sin revisar por Álvaro). Una región sin ocupantes no
/// tiene campamentos.
export interface OcupanteCampamento {
  /// Identificador estable (se guarda en `Campamento.ocupante`).
  slug: string;
  /// NPC plantilla del catálogo: atributos, nivel y nombre de sus bandidos.
  npcSlug: string;
  /// Pueblo para la base de atributos de los genéricos (`baseDePueblo`).
  pueblo: string;
  /// Regiones donde puede asentarse.
  regiones: string[];
  /// Nombre del grupo («Renegados goirntes»).
  grupo: string;
  /// Nombre del cabecilla.
  cabecilla: string;
  /// Peso en el sorteo entre los ocupantes de una región.
  peso: number;
  /// Nivel de sus bandidos (el cabecilla, +2). Las plantillas de 49c son de nivel 1 (eran de prueba);
  /// 3, como un soldado genérico, provisional.
  nivel: number;
}

export const OCUPANTES_CAMPAMENTO: OcupanteCampamento[] = [
  { slug: 'renegados-goirntes', npcSlug: 'goirnte-renegado', pueblo: 'goirntes', regiones: ['Las Llanuras del Viento Rojo', 'La Meseta del Orden'], grupo: 'Renegados goirntes', cabecilla: 'Cabecilla de los renegados', peso: 1, nivel: 3 },
  { slug: 'faerus-erraticos', npcSlug: 'faerus-erratico', pueblo: 'faerus', regiones: ['Las Llanuras del Viento Rojo'], grupo: 'Faerus erráticos', cabecilla: 'Cabecilla errático', peso: 1, nivel: 3 },
  { slug: 'nabieus-enloquecidos', npcSlug: 'nabieus-enloquecido', pueblo: 'nabieus', regiones: ['El Margen Silencioso', 'Las Llanuras del Viento Rojo'], grupo: 'Nabieus enloquecidos', cabecilla: 'Cabecilla enloquecido', peso: 1, nivel: 3 },
];

/// Q2: el primer campamento de cada región aparece este día; uno destruido se rehace a los 20.
export const DIA_PRIMER_CAMPAMENTO = 10;
export const DIAS_PARA_REHACERSE = 20;
/// Q3: gente inicial (6-9), refuerzo cada 3 días hasta el tope, que crece hasta 12.
export const GENTE_INICIAL_MIN = 6;
export const GENTE_INICIAL_MAX = 9;
export const DIAS_POR_REFUERZO = 3;
export const TOPE_MAX_CAMPAMENTO = 12;
/// Q3: el cabecilla tiene este nivel de más que sus bandidos.
export const NIVEL_MAS_CABECILLA = 2;

export function ocupanteDe(slug: string): OcupanteCampamento | undefined {
  return OCUPANTES_CAMPAMENTO.find((o) => o.slug === slug);
}

/// Puro: las regiones que tienen ocupantes.
export function regionesConCampamentos(): string[] {
  return [...new Set(OCUPANTES_CAMPAMENTO.flatMap((o) => o.regiones))].sort();
}

/// Puro (Q2): ¿toca levantar un campamento en una región sin ninguno activo?
export function tocaCampamento(dia: number, ultimoCaidoDia: number | null): boolean {
  if (dia < DIA_PRIMER_CAMPAMENTO) return false;
  return ultimoCaidoDia === null || dia - ultimoCaidoDia >= DIAS_PARA_REHACERSE;
}

/// Puro: sorteo por peso entre los ocupantes de una región.
export function elegirOcupante(region: string, random: () => number): OcupanteCampamento | null {
  const aqui = OCUPANTES_CAMPAMENTO.filter((o) => o.regiones.includes(region) && o.peso > 0);
  const total = aqui.reduce((s, o) => s + o.peso, 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const o of aqui) {
    r -= o.peso;
    if (r < 0) return o;
  }
  return aqui[aqui.length - 1]!;
}

/// Puro: gente con la que arranca.
export function genteInicial(random: () => number): number {
  return GENTE_INICIAL_MIN + Math.floor(random() * (GENTE_INICIAL_MAX - GENTE_INICIAL_MIN + 1));
}

/// Puro (Q3): refuerzos de un campamento hasta el día `dia`: uno cada 3 días mientras le falte gente.
export function refuerzos(c: { gente: number; tope: number; ultimoRefuerzoDia: number }, dia: number): { gente: number; ultimoRefuerzoDia: number } {
  if (c.gente >= c.tope) return { gente: c.gente, ultimoRefuerzoDia: dia };
  const llegan = Math.floor((dia - c.ultimoRefuerzoDia) / DIAS_POR_REFUERZO);
  if (llegan <= 0) return { gente: c.gente, ultimoRefuerzoDia: c.ultimoRefuerzoDia };
  const gente = Math.min(c.tope, c.gente + llegan);
  return { gente, ultimoRefuerzoDia: gente >= c.tope ? dia : c.ultimoRefuerzoDia + llegan * DIAS_POR_REFUERZO };
}

/// Puro (Q3): el tope sube uno con cada asalto con éxito, hasta 12.
export function topeTrasExito(tope: number): number {
  return Math.min(TOPE_MAX_CAMPAMENTO, tope + 1);
}
