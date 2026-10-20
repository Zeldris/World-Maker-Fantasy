// QA-143: interpreta los argumentos de `darReino.ts` (puro, para probarlo sin base).
export type PeticionReino = {
  comida: number;
  bebida: number;
  /// Goirnos de la bolsa del personaje (`Save.goirnos`).
  goirnos: number;
  /// Goirnos del tesoro del Reino (`KingdomStats.riqueza`).
  tesoro: number;
  /// Objetos del Almacén del Reino (`AlmacenItem`).
  almacen: { slug: string; cantidad: number }[];
};

const NUMERICOS = ['comida', 'bebida', 'goirnos', 'tesoro'] as const;

/// `comida=60 goirnos=300 tesoro=200 almacen:cuerdas:10`. Los números son lo que se SUMA a lo que ya hay.
export function parsearPeticionReino(args: string[]): PeticionReino | { error: string } {
  const p: PeticionReino = { comida: 0, bebida: 0, goirnos: 0, tesoro: 0, almacen: [] };
  if (args.length === 0) return { error: 'No se ha pedido nada.' };
  for (const arg of args) {
    if (arg.startsWith('almacen:')) {
      const [, slug, n] = arg.split(':');
      const cantidad = Number(n ?? 1);
      if (!slug || !Number.isInteger(cantidad) || cantidad < 1) return { error: `«${arg}»: falta el slug o la cantidad no vale.` };
      p.almacen.push({ slug, cantidad });
      continue;
    }
    const [clave, valor] = arg.split('=');
    const n = Number(valor);
    if (!(NUMERICOS as readonly string[]).includes(clave ?? '') || !Number.isInteger(n) || n < 1) return { error: `«${arg}»: no es comida=N, bebida=N, goirnos=N, tesoro=N ni almacen:<slug>:<n>.` };
    p[clave as (typeof NUMERICOS)[number]] = n;
  }
  return p;
}
