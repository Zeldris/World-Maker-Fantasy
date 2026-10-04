// Generador de nombres (CR-13 paso 13a, hito 0.2 — roadmap-cronista.md § 12.3 y decisión Q3 de la
// usuaria). Nombres propios por sílabas, con el sonido de los nombres que ya existen en el catálogo y
// las raíces de `docs/canon-opencode/01-lenguas.md` para cada pueblo:
//
// | Pueblo | Ejemplos del catálogo | Patrón |
// |---|---|---|
// | Orcos (Kektira) | Brenka, Doshka, Dulgren, Hagar Kiugh, Gistera Koh | Consonantes duras; ellas suelen acabar en -a; a veces un apellido corto (-gh, -h, -k) |
// | Faerus (Feg) | Gero, Kiri, Lusa, Tasko, Yeru | Dos sílabas abiertas, sin apellido |
// | Nabieus (Naebius) | Aven Tessk, Ilka Dren, Sella Marn | Nombre suave y apellido seco de una sílaba |
// | Goirntes (Kerost) | Kael Dorn, Tarsen Vold | Nombre y apellido secos, consonantes cortadas |
//
// Determinista: el azar lo da quien llama (semilla por partida). Nunca repite un nombre de `usados`
// (los de la partida y del catálogo) y cada palabra mide entre 3 y 12 letras. Los nombres se quedan en
// la partida: no se proponen como lore.

export type Genero = 'M' | 'F';

const elegir = <T>(lista: readonly T[], random: () => number): T => lista[Math.floor(random() * lista.length)]!;
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Fonetica {
  /// Nombre propio según el género.
  nombre: (genero: Genero, random: () => number) => string;
  /// Apellido (o null si este pueblo no usa).
  apellido: ((random: () => number) => string) | null;
  /// Probabilidad de llevar apellido.
  probApellido: number;
}

const FONETICA: Record<string, Fonetica> = {
  orcos: {
    nombre: (genero, random) => {
      const inicio = elegir(['Br', 'Dr', 'Gr', 'Kr', 'D', 'G', 'K', 'H', 'T', 'Th', 'V', 'R', 'M', 'Sh', 'Gh'], random);
      const v1 = elegir(['a', 'o', 'u', 'e', 'i'], random);
      const medio = elegir(['rk', 'sh', 'g', 'lg', 'rn', 'k', 'ld', 'gr', 'r', 'th'], random);
      const v2 = elegir(['a', 'o', 'e', 'u'], random);
      // Ellas acaban en vocal (Brenka, Doshka, Gistera); ellos en consonante dura (Dulgren, Hagar).
      const fin = genero === 'F' ? elegir(['a', 'ka', 'ra', 'sha'], random) : elegir(['g', 'k', 'r', 'rn', 'gh', 'th', 'n'], random);
      return capitalizar(`${inicio}${v1}${medio}${genero === 'F' ? '' : v2}${fin}`);
    },
    apellido: (random) => capitalizar(`${elegir(['K', 'V', 'T', 'R', 'G', 'D'], random)}${elegir(['o', 'iu', 'a', 'u', 'e'], random)}${elegir(['gh', 'h', 'k', 'rk'], random)}`),
    probApellido: 0.35,
  },
  faerus: {
    nombre: (genero, random) => {
      const s1 = `${elegir(['G', 'H', 'K', 'L', 'T', 'Y', 'R', 'S', 'N', 'M'], random)}${elegir(['a', 'e', 'i', 'o', 'u'], random)}`;
      const s2 = `${elegir(['r', 'k', 's', 'l', 'n', 'sk', 'lk'], random)}${genero === 'F' ? elegir(['a', 'i'], random) : elegir(['o', 'u', 'e'], random)}`;
      return `${s1}${s2}`;
    },
    apellido: null,
    probApellido: 0,
  },
  nabieus: {
    nombre: (genero, random) => {
      const inicio = elegir(['A', 'I', 'E', 'Se', 'Ve', 'Le', 'Ta', 'Ka', 'Ne', 'Va'], random);
      const fin = genero === 'F' ? elegir(['lla', 'lka', 'ssa', 'ra', 'na', 'ria'], random) : elegir(['ven', 'rin', 'lan', 'th', 'ssk', 'ren'], random);
      return `${inicio}${fin}`;
    },
    apellido: (random) => {
      const r = elegir(['r', ''], random);
      // Sin dos erres en una sílaba («Trarn»).
      const fin = elegir(r ? ['ssk', 'n', 'sk', 'th'] : ['ssk', 'n', 'rn', 'sk', 'th'], random);
      return capitalizar(`${elegir(['T', 'D', 'M', 'K', 'S', 'V'], random)}${r}${elegir(['e', 'a', 'i'], random)}${fin}`);
    },
    probApellido: 1,
  },
  goirntes: {
    nombre: (genero, random) => {
      const inicio = elegir(['Ka', 'Ta', 'Vra', 'Yo', 'Do', 'Sa', 'Ve', 'Te', 'Ar', 'Ho'], random);
      const fin = genero === 'F' ? elegir(['venne', 'ria', 'sa', 'nne', 'lde'], random) : elegir(['el', 'rsen', 'sk', 'rn', 'lt', 'nd'], random);
      return `${inicio}${fin}`;
    },
    apellido: (random) => {
      const inicio = elegir(['D', 'V', 'T', 'K', 'S', 'Br'], random);
      const fin = elegir(inicio === 'Br' ? ['ld', 'l', 'nd'] : ['rn', 'ld', 'l', 'nd', 'rk'], random);
      return capitalizar(`${inicio}${elegir(['o', 'a', 'e'], random)}${fin}`);
    },
    probApellido: 1,
  },
};

/// Palabras que no deben salir como nombre (malsonantes o demasiado reales).
const PROHIBIDOS = new Set(['puta', 'puto', 'coño', 'mierda', 'kaka', 'caca', 'nazi', 'dios', 'satan']);

export function nombreValido(nombre: string, usados: ReadonlySet<string>): boolean {
  const partes = nombre.split(' ');
  if (partes.some((p) => p.length < 3 || p.length > 12)) return false;
  if (partes.some((p) => PROHIBIDOS.has(p.toLowerCase()))) return false;
  return !usados.has(nombre.toLowerCase());
}

/// Nombre nuevo para alguien de `raza` y `genero`. `usados`: nombres ya en uso (en minúsculas).
/// Para una raza sin fonética propia usa la orca (la más rica del catálogo). Tras muchos intentos
/// fallidos, añade un apellido y, si aun así está usado, un ordinal (II, III…): siempre es nuevo.
export function generarNombre(raza: string | null, genero: Genero, random: () => number, usados: ReadonlySet<string> = new Set()): string {
  const f = FONETICA[raza ?? ''] ?? FONETICA.orcos!;
  for (let intento = 0; intento < 60; intento++) {
    const nombre = f.nombre(genero, random);
    const conApellido = f.apellido && random() < f.probApellido ? `${nombre} ${f.apellido(random)}` : nombre;
    if (nombreValido(conApellido, usados)) return conApellido;
  }
  const base = `${f.nombre(genero, random)} ${(f.apellido ?? FONETICA.orcos!.apellido!)(random)}`;
  if (!usados.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const conOrdinal = `${base} ${ORDINALES[n] ?? n}`;
    if (!usados.has(conOrdinal.toLowerCase())) return conOrdinal;
  }
}

const ORDINALES: Record<number, string> = { 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X' };
