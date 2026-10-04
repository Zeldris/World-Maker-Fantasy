// Herencia de atributos (CR-13 paso 13a, hito 0.2 — decisión Q4 de la usuaria: «que los atributos
// del padre y la madre tengan algún efecto en el hijo, a modo de huella genética»).
//
// - Cada atributo del hijo = media de los del padre y la madre ± `VARIACION` (al azar).
// - **Huella:** el atributo más alto de cada progenitor pasa con un `PROB_HUELLA` de probabilidad,
//   con un +`BONO_HUELLA` sobre lo anterior.
// - Sin pareja conocida: los de alguien de su raza (base) con una variación de ±1.
//
// Siempre entre `ATRIBUTO_MIN` y `ATRIBUTO_MAX`. `magia` se hereda igual que el resto (un pueblo sin
// magia, con 0 en ambos padres, sigue en 0).

export type Atributos = Record<string, number>;

export const VARIACION = 2;
export const PROB_HUELLA = 0.5;
export const BONO_HUELLA = 1;
export const ATRIBUTO_MIN = 0;
export const ATRIBUTO_MAX = 20;

const acotar = (v: number) => Math.max(ATRIBUTO_MIN, Math.min(ATRIBUTO_MAX, v));
/// Entero al azar en [-n, n].
const variacion = (n: number, random: () => number) => Math.floor(random() * (2 * n + 1)) - n;

/// Atributo más alto (el primero en orden alfabético si empatan, para que sea determinista).
export function atributoMasAlto(a: Atributos): string | null {
  const claves = Object.keys(a).sort();
  if (claves.length === 0) return null;
  return claves.reduce((mejor, k) => (a[k]! > a[mejor]! ? k : mejor), claves[0]!);
}

export interface Herencia {
  atributos: Atributos;
  /// Atributos que pasaron como huella, y de quién.
  huellas: { atributo: string; de: 'padre' | 'madre' }[];
}

/// Atributos del hijo a partir de los de sus padres.
export function heredarAtributos(padre: Atributos, madre: Atributos, random: () => number): Herencia {
  const claves = [...new Set([...Object.keys(padre), ...Object.keys(madre)])].sort();
  const atributos: Atributos = {};
  for (const k of claves) {
    const media = Math.round(((padre[k] ?? 0) + (madre[k] ?? 0)) / 2);
    // Un 0 en los dos (magia de un pueblo sin ella) no se mueve.
    atributos[k] = (padre[k] ?? 0) === 0 && (madre[k] ?? 0) === 0 ? 0 : acotar(media + variacion(VARIACION, random));
  }
  const huellas: Herencia['huellas'] = [];
  for (const [de, progenitor] of [['padre', padre], ['madre', madre]] as const) {
    const k = atributoMasAlto(progenitor);
    if (k && random() < PROB_HUELLA) {
      atributos[k] = acotar(Math.max(atributos[k]!, progenitor[k]!) + BONO_HUELLA);
      huellas.push({ atributo: k, de });
    }
  }
  return { atributos, huellas };
}

/// Sin padres conocidos: los de alguien de su raza con ±1.
export function atributosSinPadres(base: Atributos, random: () => number): Atributos {
  const atributos: Atributos = {};
  for (const k of Object.keys(base).sort()) atributos[k] = base[k] === 0 ? 0 : acotar(base[k]! + variacion(1, random));
  return atributos;
}
