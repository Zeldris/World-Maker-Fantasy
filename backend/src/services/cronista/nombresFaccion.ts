// Nombres de las facciones nacidas de una escisión (CR-11, hito 0.2). Siguen la costumbre de cada
// pueblo (`docs/rpgtarkor/lore-mundo/clanes-orcos.md`, `lenguas-helek.md`); tabla aprobada en
// `docs/borradores-opencode/propuestas-aprobadas.md` (CR-43). Fuera quedan los nombres que chocaban
// con el canon: Keseg'Vhurne (el cónclave), Feg'nur (el tabú) y Kegi (el poblado de Feg Ger).

export interface NombreDeFaccion {
  nombre: string;
  /// Traducción o explicación, para la descripción de la facción (como hace el lore).
  traduccion: string;
}

/// Nabieus: sus clanes son «el fin de algo» (Keseg Sael, Keseg Prisilke); nunca se repite raíz.
export const PALABRAS_NABIEUS: [string, string][] = [
  ['Tannis', 'el fin de la mentira'],
  ['Karo', 'el fin de la carta'],
  ['Tovh', 'el fin de la palma'],
];

/// Faerus: Feg («manada») + una palabra concreta suya, como Feg Ger («manada roja»).
export const PALABRAS_FAERUS: [string, string][] = [
  ['Sil', 'manada del fuego'],
  ['Krul', 'manada del colmillo'],
  ['Leshra', 'manada del ave de noche'],
  ['Ashi', 'manada que huele'],
];

/// Goirntes: no hay más Imperio que el suyo; la escisión se nombra, como Los del Obelisco, por
/// aquello a lo que se aferra frente al resto. En lengua común.
export const NOMBRES_GOIRNTES: [string, string][] = [
  ['Los del Edicto', 'se aferran al edicto frente al resto del Imperio'],
  ['Los de la Estela', 'se aferran a la estela de la ley frente al resto del Imperio'],
  ['Los del Tributo', 'se aferran al tributo frente al resto del Imperio'],
  ['Los del Vresk', 'se aferran a su ciudad-fortaleza frente al resto del Imperio'],
];

/// Orcos: el clan toma el nombre de quien encabeza la escisión, sin su vocal final y con la
/// terminación de los clanes emigrados — Helsa → Hels**ig**, Gosha → Gos**hg**.
function nombresOrcos(lider: string): NombreDeFaccion[] {
  const nombre = lider.trim().split(/\s+/)[0]!;
  const raiz = nombre.replace(/[aeiouáéíóú]+$/i, '');
  return [`${raiz}ig`, `${raiz}g`].map((n) => ({ nombre: `Clan ${n}`, traduccion: `«de ${nombre}», como Helsig de Helsa` }));
}

/// Primer nombre libre para una escisión de esa raza, o null si ya no quedan nombres.
export function nombreDeEscision(raza: string, lider: string, usados: Set<string>): NombreDeFaccion | null {
  const candidatos: NombreDeFaccion[] =
    raza === 'orcos' ? nombresOrcos(lider)
    : raza === 'nabieus' ? PALABRAS_NABIEUS.map(([p, t]) => ({ nombre: `Keseg ${p}`, traduccion: t }))
    : raza === 'faerus' ? PALABRAS_FAERUS.map(([p, t]) => ({ nombre: `Feg ${p}`, traduccion: t }))
    : raza === 'goirntes' ? NOMBRES_GOIRNTES.map(([nombre, traduccion]) => ({ nombre, traduccion }))
    : [];
  return candidatos.find((c) => !usados.has(c.nombre)) ?? null;
}
