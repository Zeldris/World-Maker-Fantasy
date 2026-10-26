// QA-143: interpreta los argumentos de `darReino.ts` (puro, para probarlo sin base).
import { TIER_MAXIMO_PERSONAJE } from '../services/construction.js';

/// QA-260: quién levanta una obra de ese tier. El personaje llega hasta `TIER_MAXIMO_PERSONAJE`; más (la Jaula grande,
/// tier 6), solo la Casa de obras. `dar-reino` usa la misma comprobación del juego con ese `quien`, sin pasar por la cola
/// de la Casa (constructores, nivel de la Casa, días de obra): es una herramienta de preparación.
export function quienLevanta(tier: number): 'personaje' | 'casa-de-obras' {
  return tier > TIER_MAXIMO_PERSONAJE ? 'casa-de-obras' : 'personaje';
}

export type PeticionReino = {
  comida: number;
  bebida: number;
  /// Goirnos de la bolsa del personaje (`Save.goirnos`).
  goirnos: number;
  /// Goirnos del tesoro del Reino (`KingdomStats.riqueza`).
  tesoro: number;
  /// Objetos del Almacén del Reino (`AlmacenItem`).
  almacen: { slug: string; cantidad: number }[];
  /// Claves de receta (`ConstructionRecipe.key`) de edificios ya terminados que se añaden al Reino.
  edificios: string[];
};

const NUMERICOS = ['comida', 'bebida', 'goirnos', 'tesoro'] as const;

/// `comida=60 goirnos=300 tesoro=200 almacen:cuerdas:10`. Los números son lo que se SUMA a lo que ya hay.
export function parsearPeticionReino(args: string[]): PeticionReino | { error: string } {
  const p: PeticionReino = { comida: 0, bebida: 0, goirnos: 0, tesoro: 0, almacen: [], edificios: [] };
  if (args.length === 0) return { error: 'No se ha pedido nada.' };
  for (const arg of args) {
    if (arg.startsWith('almacen:')) {
      const [, slug, n] = arg.split(':');
      const cantidad = Number(n ?? 1);
      if (!slug || !Number.isInteger(cantidad) || cantidad < 1) return { error: `«${arg}»: falta el slug o la cantidad no vale.` };
      p.almacen.push({ slug, cantidad });
      continue;
    }
    if (arg.startsWith('edificio:')) {
      const clave = arg.slice('edificio:'.length);
      if (!/^[a-z0-9-]+$/.test(clave)) return { error: `«${arg}»: falta la clave de receta (p. ej. edificio:granero).` };
      p.edificios.push(clave);
      continue;
    }
    const [clave, valor] = arg.split('=');
    const n = Number(valor);
    if (!(NUMERICOS as readonly string[]).includes(clave ?? '') || !Number.isInteger(n) || n < 1) return { error: `«${arg}»: no es comida=N, bebida=N, goirnos=N, tesoro=N almacen:<slug>:<n> ni edificio:<receta>.` };
    p[clave as (typeof NUMERICOS)[number]] = n;
  }
  return p;
}

const LIENZO = { ancho: 800, alto: 600 };
const PASO = 60;

/// Posición junto al Ayuntamiento (anillos de `PASO` px, dentro del lienzo 800×600) que no coincide con
/// ninguna ya ocupada. Sin Ayuntamiento posicionado devuelve null (el edificio queda sin posición).
export function posicionJuntoAlAyuntamiento(ayto: { x: number | null; y: number | null }, ocupadas: { x: number | null; y: number | null }[]): { x: number; y: number } | null {
  if (ayto.x == null || ayto.y == null) return null;
  const usada = (x: number, y: number) => ocupadas.some((o) => o.x != null && o.y != null && Math.abs(o.x - x) < PASO / 2 && Math.abs(o.y - y) < PASO / 2);
  for (let anillo = 1; anillo <= 10; anillo++) {
    for (let dy = -anillo; dy <= anillo; dy++) {
      for (let dx = -anillo; dx <= anillo; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== anillo) continue;
        const x = ayto.x + dx * PASO;
        const y = ayto.y + dy * PASO;
        if (x < 0 || y < 0 || x > LIENZO.ancho || y > LIENZO.alto || usada(x, y)) continue;
        return { x, y };
      }
    }
  }
  return null;
}

/// Primer tope que se pasaría con lo pedido, o null.
export function primerExcesoDeTope(
  suma: { comida: number; bebida: number; materiales: number },
  actual: { comida: number; bebida: number; materiales: number },
  topes: { comida: number; bebida: number; materiales: number },
): string | null {
  const nombres = { comida: 'comida', bebida: 'bebida', materiales: 'materiales del Almacén (RECURSO)' } as const;
  for (const k of ['comida', 'bebida', 'materiales'] as const) {
    if (suma[k] > 0 && actual[k] + suma[k] > topes[k]) return `${nombres[k]}: ${actual[k]} + ${suma[k]} pasa del tope de ${topes[k]} (hueco ${Math.max(0, topes[k] - actual[k])}).`;
  }
  return null;
}
