// Ganadería (CR-55 paso 55a, hito 0.3 — decisiones de la ronda de CR-55 en plan-roadmap-0.3.md).
// Reglas puras, sin base de datos: las usan el ganado del Reino (un animal por fila) y el de las
// facciones (en agregado), con las mismas cifras (Q14: mismo sistema para todos).
//
// - **Etapas** por categoría de fauna, con ajuste por porte (Q13): cría, joven, adulto, vejez.
// - **Producción** por adulto y día, solo con ganadero (1 por cada 5 animales) y si el corral ha
//   comido (Q4, Q6, Q12). La vejez produce la mitad.
// - **Crías:** una por semana y corral con macho y hembra adultos, plaza libre y el corral comido.
// - **Hambre y sed** como la gente (Q6): tras 3 días sin forraje, un 10 % al día; tras 2 sin agua, un
//   20 %; primero las crías.
// - **Comida cruda** (Q15): `curaHambre` es la escala; 10 = 1 de comida del Reino.
//
// Cifras provisionales, a revisar por Álvaro (`propuestas-lore.md`, «Ganadería»).
import { DIAS_POR_ANIO } from './edades.js';

export type Etapa = 'CRIA' | 'JOVEN' | 'ADULTO' | 'VEJEZ';
export type Sexo = 'M' | 'F';
export type Dieta = 'HERBIVORO' | 'CARNIVORO';

/// Días en que acaba cada etapa (`cria` = empieza a ser joven, `adulto` = empieza a ser adulto…).
export interface Etapas {
  cria: number;
  adulto: number;
  vejez: number;
  esperanza: number;
}

const anios = (n: number) => n * DIAS_POR_ANIO;

/// Q13, por `Npc.faunaCategoria`.
export const ETAPAS_POR_CATEGORIA: Record<string, Etapas> = {
  BESTIONES: { cria: 30, adulto: anios(1), vejez: anios(12), esperanza: anios(15) },
  ZANCUDOS: { cria: 15, adulto: 60, vejez: anios(5), esperanza: anios(6) },
  ACECHANTES: { cria: 30, adulto: anios(1), vejez: anios(8), esperanza: anios(10) },
  RONDINES: { cria: 20, adulto: 90, vejez: anios(6), esperanza: anios(8) },
  // CR-56: categorías de las especies de guardia.
  CORVENES: { cria: 20, adulto: 90, vejez: anios(6), esperanza: anios(8) },
  MUDOS_SALVAJE: { cria: 30, adulto: anios(1), vejez: anios(10), esperanza: anios(12) },
};
/// Ajuste por porte: la Gargantúa es un Bestión, pero tarda años en crecer.
export const ETAPAS_POR_ESPECIE: Record<string, Etapas> = {
  'gargantua-de-ceniza': { cria: anios(1), adulto: anios(4), vejez: anios(40), esperanza: anios(50) },
};
const ETAPAS_POR_DEFECTO = ETAPAS_POR_CATEGORIA.BESTIONES!;

export function etapasDe(especie: string, categoria: string | null | undefined): Etapas {
  return ETAPAS_POR_ESPECIE[especie] ?? ETAPAS_POR_CATEGORIA[categoria ?? ''] ?? ETAPAS_POR_DEFECTO;
}

export function etapaDe(e: Etapas, edadDias: number): Etapa {
  if (edadDias < e.cria) return 'CRIA';
  if (edadDias < e.adulto) return 'JOVEN';
  if (edadDias < e.vejez) return 'ADULTO';
  return 'VEJEZ';
}

export interface Produccion {
  itemSlug: string;
  /// Cada cuántos días produce (contando desde el día 0 de la partida).
  cadaDias: number;
  /// Unidades por animal esos días (1 si no se dice).
  cantidad?: number;
}

export interface EspecieGanado {
  dieta: Dieta;
  produccion: Produccion[];
  /// Escalón mínimo de corral (1 Taller, 2 Obrador, 3 Gran obrador) por su tamaño.
  escalonMinimo: number;
}

/// Q10 de la Fase D y Q4 de CR-55. El Corredor de Cauce nunca es ganado.
/// Ajuste de 55f (libertad de la usuaria para que el ganado sustente): el Múrgol da 3 de leche al día
/// y el Corretolvas un huevo al día, para que un ganadero alimente más que la comida pasiva.
export const ESPECIES_GANADO: Record<string, EspecieGanado> = {
  murgol: { dieta: 'HERBIVORO', produccion: [{ itemSlug: 'leche-murgol', cadaDias: 1, cantidad: 3 }, { itemSlug: 'lana-murgol', cadaDias: 3 }], escalonMinimo: 1 },
  corretolvas: { dieta: 'HERBIVORO', produccion: [{ itemSlug: 'huevo-corretolvas', cadaDias: 1 }, { itemSlug: 'plumas-rojizas', cadaDias: 2 }], escalonMinimo: 1 },
  // Su «fibra» espera a Álvaro: hasta entonces no produce.
  coracelo: { dieta: 'HERBIVORO', produccion: [], escalonMinimo: 1 },
  cuernahoja: { dieta: 'HERBIVORO', produccion: [], escalonMinimo: 1 },
  canizor: { dieta: 'CARNIVORO', produccion: [], escalonMinimo: 1 },
  'gargantua-de-ceniza': { dieta: 'HERBIVORO', produccion: [], escalonMinimo: 3 },
  // CR-56 (Q2): especies de guardia, en su corral; no producen ni necesitan ganadero.
  'rondador-de-brasas': { dieta: 'CARNIVORO', produccion: [], escalonMinimo: 1 },
  cruzavientos: { dieta: 'CARNIVORO', produccion: [], escalonMinimo: 1 },
  'salamandra-de-escoria': { dieta: 'CARNIVORO', produccion: [], escalonMinimo: 1 },
};

export function esGanado(especie: string): boolean {
  return especie in ESPECIES_GANADO;
}

/// Plazas del corral por escalón (Q9 de la Fase D).
export const PLAZAS_CORRAL: Record<number, number> = { 1: 6, 2: 12, 3: 20 };
export function plazasCorral(escalon: number | null | undefined): number {
  return PLAZAS_CORRAL[escalon ?? 1] ?? PLAZAS_CORRAL[1]!;
}
/// Animales que cuida cada ganadero (Q12).
export const ANIMALES_POR_GANADERO = 5;

export interface Animal {
  especie: string;
  sexo: Sexo;
  /// Edad en días.
  edadDias: number;
}

export interface ConsumoDia {
  forraje: number;
  /// Comida del Reino (carnívoros: 1 cada 2 días).
  comida: number;
  agua: number;
}

/// Pastoreo (55f): en una región con pasto natural los herbívoros pastan y comen la mitad de forraje.
export const REGIONES_CON_PASTO = new Set(['Las Llanuras del Viento Rojo']);
export function hayPasto(region: string | null | undefined): boolean {
  return !!region && REGIONES_CON_PASTO.has(region);
}

/// Lo que come y bebe un animal en un día (`dia` = día de la partida, para «cada 2 días»). La cría
/// come la mitad de forraje; con pasto, la mitad otra vez.
export function consumoAnimal(a: Animal, etapa: Etapa, dia: number, pasto = false): ConsumoDia {
  const esp = ESPECIES_GANADO[a.especie];
  const factor = etapa === 'CRIA' ? 0.5 : 1;
  if (esp?.dieta === 'CARNIVORO') return { forraje: 0, comida: dia % 2 === 0 ? factor : 0, agua: 1 };
  return { forraje: factor * (pasto ? 0.5 : 1), comida: 0, agua: 1 };
}

/// Lo que comen todos en un día, redondeado hacia arriba.
export function consumoCorral(animales: { a: Animal; etapa: Etapa }[], dia: number, pasto = false): ConsumoDia {
  const t = { forraje: 0, comida: 0, agua: 0 };
  for (const { a, etapa } of animales) {
    const c = consumoAnimal(a, etapa, dia, pasto);
    t.forraje += c.forraje;
    t.comida += c.comida;
    t.agua += c.agua;
  }
  return { forraje: Math.ceil(t.forraje), comida: Math.ceil(t.comida), agua: Math.ceil(t.agua) };
}

/// Producción del día de un grupo de animales de una especie: los adultos producen entero y la vejez
/// la mitad, hasta lo que cubren los ganaderos (`ganaderos × 5`, los más productivos primero). Sin
/// haber comido, nada.
export function produccionDelDia(
  especie: string,
  etapas: Etapa[],
  ganaderos: number,
  dia: number,
  comido: boolean,
): Record<string, number> {
  const esp = ESPECIES_GANADO[especie];
  if (!esp || !comido || ganaderos <= 0) return {};
  const cubiertos = ganaderos * ANIMALES_POR_GANADERO;
  const adultos = etapas.filter((e) => e === 'ADULTO').length;
  const viejos = etapas.filter((e) => e === 'VEJEZ').length;
  const adultosCubiertos = Math.min(adultos, cubiertos);
  const viejosCubiertos = Math.min(viejos, cubiertos - adultosCubiertos);
  // Producción en unidades enteras: la vejez suma medio animal.
  const productores = adultosCubiertos + viejosCubiertos / 2;
  const r: Record<string, number> = {};
  for (const p of esp.produccion) {
    if (dia % p.cadaDias !== 0) continue;
    const n = Math.floor(productores * (p.cantidad ?? 1));
    if (n > 0) r[p.itemSlug] = (r[p.itemSlug] ?? 0) + n;
  }
  return r;
}

/// ¿Nace una cría esta semana? Hace falta macho y hembra adultos (no viejos), plaza libre y que el
/// corral haya comido.
export function tocaCria(animales: { a: Animal; etapa: Etapa }[], plazas: number, comido: boolean): boolean {
  if (!comido || animales.length >= plazas) return false;
  const adultos = animales.filter((x) => x.etapa === 'ADULTO');
  return adultos.some((x) => x.a.sexo === 'M') && adultos.some((x) => x.a.sexo === 'F');
}

/// Fracción que muere hoy por hambre o sed (Q6): hambre desde el día 3 sin comer, un 10 %; sed desde
/// el día 2 sin beber, un 20 %. Se suman.
export function fraccionQueMuere(diasSinComer: number, diasSinBeber: number): number {
  return (diasSinComer >= 3 ? 0.1 : 0) + (diasSinBeber >= 2 ? 0.2 : 0);
}

/// Cuántos mueren de `total` con esa fracción (al menos 1 si hay fracción y animales).
export function muertesPorCarencia(total: number, fraccion: number): number {
  if (total <= 0 || fraccion <= 0) return 0;
  return Math.min(total, Math.max(1, Math.round(total * fraccion)));
}

/// Probabilidad de morir de viejo en un día, con la curva de la gente (`edades.ts`): 0 antes de la
/// vejez; crece con el cuadrado de lo vivido en vejez frente al 40 % de la esperanza, más un 2 %
/// anual de base.
export function probMuerteDeViejoPorDia(e: Etapas, edadDias: number): number {
  if (edadDias < e.vejez) return 0;
  const anual = Math.min(1, ((edadDias - e.vejez) / (0.4 * e.esperanza)) ** 2 + 0.02);
  return anual / DIAS_POR_ANIO;
}

/// Sacrificar (Q8): los adultos y viejos dan el rendimiento entero; los jóvenes, la mitad; las crías,
/// nada.
export function factorSacrificio(etapa: Etapa): number {
  return etapa === 'CRIA' ? 0 : etapa === 'JOVEN' ? 0.5 : 1;
}

// ── Comida cruda (Q15) ───────────────────────────────────────────────────────────────────────

/// `curaHambre` que vale 1 de comida del Reino o de una facción (una boca al día).
export const CURA_HAMBRE_POR_COMIDA = 10;

/// Valor de la comida cruda por tipo (Q15). Lo que no está aquí y no tiene `curaHambre` no alimenta.
const VALOR_CRUDO_POR_SLUG: Record<string, number> = {
  'leche-murgol': 4,
  'huevo-celubia': 4,
  'huevo-corretolvas': 4,
  boungo: 4,
  'miel-lebude': 4,
  'trigo-escarlata': 3,
  'bulbo-de-turbera': 3,
  'liquen-escarcha': 3,
  'carnosa-de-tocon': 3,
  'rugoconcha-marisco': 6,
};

/// `curaHambre` de un comestible crudo: el del catálogo si lo tiene; si no, el de la tabla (la carne
/// cruda, 8).
export function valorCrudo(slug: string, curaHambre: number | null | undefined): number {
  if (curaHambre != null && curaHambre > 0) return curaHambre;
  if (slug in VALOR_CRUDO_POR_SLUG) return VALOR_CRUDO_POR_SLUG[slug]!;
  if (slug.startsWith('carne-')) return 8;
  return 0;
}

/// Comida (del Reino o de una facción) que dan `cantidad` unidades con ese `curaHambre`.
export function comidaDe(curaHambre: number, cantidad: number): number {
  return Math.floor((curaHambre * cantidad) / CURA_HAMBRE_POR_COMIDA);
}
