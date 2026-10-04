// Edad, madurez y vejez (CR-13 paso 13b, hito 0.2 — decisiones Q6, Q7 y Q8 de la usuaria, con
// Medieval Dynasty de referencia). Puro, sin base de datos.
//
// - Un año de ficción son 120 días (`worldClock.ts`).
// - **Madurez:** los atributos que cuentan crecen del 40 % al nacer al 100 % a la edad de madurez de
//   su raza. Antes de madurar no trabaja, no combate y no puede ser líder ni heredero.
// - **Vejez:** desde el 80 % de la esperanza de vida, −1 a fuerza, destreza y constitución por año, y
//   cada día una probabilidad creciente de morir de viejo.
// - **Edades del catálogo:** provisionales y deterministas por `slug` (adultos entre la madurez y el
//   70 % de su esperanza de vida; los líderes, entre el 50 % y el 70 %), hasta que Álvaro las fije.
//
// Las cifras de razas son provisionales salvo la madurez orca (10 años, canon de `clanes-orcos.md`);
// propuesta pendiente en `docs/borradores-opencode/propuestas-lore.md`.
import type { Atributos } from './herencia.js';

export const DIAS_POR_ANIO = 120;
export const MINUTOS_POR_ANIO = DIAS_POR_ANIO * 1440;

export interface CicloVital {
  madurez: number;
  esperanza: number;
}

export const CICLO_VITAL: Record<string, CicloVital> = {
  orcos: { madurez: 10, esperanza: 60 },
  faerus: { madurez: 8, esperanza: 40 },
  nabieus: { madurez: 14, esperanza: 90 },
  goirntes: { madurez: 16, esperanza: 70 },
};
const CICLO_POR_DEFECTO: CicloVital = { madurez: 14, esperanza: 70 };

export function cicloVital(raza: string | null | undefined): CicloVital {
  return CICLO_VITAL[raza ?? ''] ?? CICLO_POR_DEFECTO;
}

/// Atributos al nacer, como fracción de los de adulto.
export const FACTOR_AL_NACER = 0.4;
/// Desde qué fracción de la esperanza de vida empieza la vejez.
export const INICIO_VEJEZ = 0.8;
/// Atributos que pierden 1 por año de vejez.
export const ATRIBUTOS_QUE_ENVEJECEN = ['fuerza', 'destreza', 'constitucion'];

/// 0-1 estable a partir de un texto (FNV-1a).
function hash01(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/// Edad provisional (años) de un NPC del catálogo sin fecha de nacimiento.
export function edadProvisional(slug: string, raza: string | null | undefined, esLider: boolean): number {
  const { madurez, esperanza } = cicloVital(raza);
  const u = hash01(slug);
  const [desde, hasta] = esLider ? [0.5 * esperanza, 0.7 * esperanza] : [madurez, 0.7 * esperanza];
  return Math.floor(desde + u * (hasta - desde));
}

/// Minuto de nacimiento: el guardado o, en el catálogo, el que da su edad provisional en el día 0.
export function nacidoEnDe(npc: { slug: string; raza: string | null; nacidoEn: number | null }, esLider = false): number {
  return npc.nacidoEn ?? -edadProvisional(npc.slug, npc.raza, esLider) * MINUTOS_POR_ANIO;
}

/// Edad en años cumplidos en el minuto `ahora`.
export function edadEnAnios(nacidoEn: number, ahora: number): number {
  return Math.max(0, Math.floor((ahora - nacidoEn) / MINUTOS_POR_ANIO));
}

export function esAdulto(raza: string | null | undefined, edad: number): boolean {
  return edad >= cicloVital(raza).madurez;
}

/// Atributos que cuentan a una edad, a partir de los de adulto.
export function atributosPorEdad(potenciales: Atributos, raza: string | null | undefined, edad: number): Atributos {
  const { madurez, esperanza } = cicloVital(raza);
  const crecimiento = edad >= madurez ? 1 : FACTOR_AL_NACER + (1 - FACTOR_AL_NACER) * (edad / madurez);
  const anosDeVejez = Math.max(0, edad - Math.floor(INICIO_VEJEZ * esperanza));
  const resultado: Atributos = {};
  for (const [k, v] of Object.entries(potenciales)) {
    const conEdad = Math.round(v * crecimiento) - (ATRIBUTOS_QUE_ENVEJECEN.includes(k) ? anosDeVejez : 0);
    resultado[k] = Math.max(v === 0 ? 0 : 1, conEdad);
  }
  return resultado;
}

/// Probabilidad de morir de viejo en un día: 0 antes de la vejez; crece con el cuadrado de los años
/// de vejez, hasta ser segura (por año) al pasar un 40 % de la esperanza de vida de ella.
export function probMuerteDeViejoPorDia(raza: string | null | undefined, edad: number): number {
  const { esperanza } = cicloVital(raza);
  const inicio = INICIO_VEJEZ * esperanza;
  if (edad < inicio) return 0;
  const anual = Math.min(1, ((edad - inicio) / (0.4 * esperanza)) ** 2 + 0.02);
  return anual / DIAS_POR_ANIO;
}
