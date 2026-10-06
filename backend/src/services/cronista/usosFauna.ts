// Usos de la fauna (CR-56 paso 56a, hito 0.3 — Q10 de la Fase D y Q1 de la ronda de CR-56). Qué hace
// cada especie domesticable: producir, guardar el Reino, acompañar a un Domador o servir de montura
// (la montura se aplica con `CR-57`). Reglas de la Fase D:
// - guardia: depredador o bestia territorial con Fuerza + Constitución ≥ 14;
// - compañero: especie domesticable que vale en combate o como explorador;
// - solo caza: las especies con domesticable 0 % (no aparecen aquí).
// Provisional hasta que Álvaro revise (`propuestas-lore.md`).

export type Pueblo = 'orcos' | 'faerus' | 'nabieus' | 'goirntes';

export interface UsosEspecie {
  produccion?: string;
  sacrificio?: true;
  guardia?: true;
  /// Compañero de Domador; `explorador` si vale sobre todo para explorar (vuela).
  companero?: 'combate' | 'explorador';
  /// Pueblos que pueden montarla (`CR-57`).
  montura?: Pueblo[];
  /// Uso por decidir (a Álvaro).
  pendiente?: string;
}

const TODOS: Pueblo[] = ['orcos', 'faerus', 'nabieus', 'goirntes'];

export const USOS_FAUNA: Record<string, UsosEspecie> = {
  murgol: { produccion: 'leche y lana', sacrificio: true, montura: TODOS },
  corretolvas: { produccion: 'huevos y plumas', sacrificio: true },
  coracelo: { sacrificio: true, pendiente: 'qué fibra da' },
  cuernahoja: { sacrificio: true, montura: ['nabieus', 'faerus'] },
  'gargantua-de-ceniza': { sacrificio: true, guardia: true, montura: TODOS },
  canizor: { guardia: true, companero: 'combate', montura: ['nabieus', 'faerus'] },
  'rondador-de-brasas': { guardia: true, companero: 'combate' },
  cruzavientos: { guardia: true, companero: 'explorador' },
  'salamandra-de-escoria': { guardia: true, companero: 'combate' },
  'aullador-rojo': { companero: 'combate' },
  'zense-ceniza': { companero: 'explorador' },
  guchapo: { pendiente: 'si da agua' },
  'corredor-de-cauce': { montura: ['faerus', 'nabieus', 'goirntes'] },
};

export function esGuardia(especie: string): boolean {
  return !!USOS_FAUNA[especie]?.guardia;
}

export function esCompanero(especie: string): boolean {
  return !!USOS_FAUNA[especie]?.companero;
}

const NOMBRE_PUEBLO: Record<Pueblo, string> = { orcos: 'orcos', faerus: 'Faerus', nabieus: 'Nabieus', goirntes: 'Goirntes' };

/// Lista legible de usos, para la Enciclopedia: «guardia · compañero · montura (Nabieus y Faerus)».
export function usosLegibles(especie: string): string[] {
  const u = USOS_FAUNA[especie];
  if (!u) return [];
  const r: string[] = [];
  if (u.produccion) r.push(`producción (${u.produccion})`);
  if (u.sacrificio) r.push('carne y pieles al sacrificarla');
  if (u.guardia) r.push('guardia del Reino');
  if (u.companero) r.push(u.companero === 'explorador' ? 'compañero explorador' : 'compañero de combate');
  if (u.montura) r.push(`montura (${u.montura.length === 4 ? 'todos los pueblos' : u.montura.map((p) => NOMBRE_PUEBLO[p]).join(' y ')})`);
  if (u.pendiente) r.push(`por saber: ${u.pendiente}`);
  return r;
}
