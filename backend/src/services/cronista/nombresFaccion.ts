// Nombres de las facciones nacidas de una escisión (CR-11, hito 0.2). Siguen la costumbre de cada
// pueblo (`docs/rpgtarkor/lore-mundo/clanes-orcos.md`, `lenguas-helek.md`); tabla PROVISIONAL hasta
// que Álvaro valide la propuesta de `docs/borradores-opencode/propuestas-lore.md` (2026-10-04).
// Cuando exista el generador de nombres (CR-13) podrá ampliarla.

export interface NombreDeFaccion {
  nombre: string;
  /// Traducción o explicación, para la descripción de la facción (como hace el lore).
  traduccion: string;
}

/// Nabieus: sus clanes son «el fin de algo» (Keseg Sael, Keseg Prisilke); nunca se repite raíz.
export const PALABRAS_NABIEUS: [string, string][] = [
  ['Tannis', 'el fin de la mentira'],
  ['Karo', 'el fin de la carta'],
  ['Tovh', 'el fin de la mano abierta'],
  ['Vhurne', 'el fin de la reunión'],
];

/// Faerus: Feg («manada») + una palabra concreta suya, como Feg Ger («manada roja»).
export const PALABRAS_FAERUS: [string, string][] = [
  ['Sil', 'manada del fuego'],
  ['Kegi', 'manada de la arena'],
  ['Krul', 'manada del colmillo'],
  ['Nur', 'manada de los heridos'],
];

/// Orcos: el clan toma el nombre de quien encabeza la escisión, sin su vocal final y con la
/// terminación de los clanes emigrados — Helsa → Hels**ig**, Gosha → Gos**hg**.
function nombresOrcos(lider: string): NombreDeFaccion[] {
  const nombre = lider.trim().split(/\s+/)[0]!;
  const raiz = nombre.replace(/[aeiouáéíóú]+$/i, '');
  return [`${raiz}ig`, `${raiz}g`].map((n) => ({ nombre: `Clan ${n}`, traduccion: `«de ${nombre}», como Helsig de Helsa` }));
}

/// Primer nombre libre para una escisión de esa raza, o null si ese pueblo no se escinde (los
/// goirntes, hasta que Álvaro decida cómo se nombraría) o ya no quedan nombres.
export function nombreDeEscision(raza: string, lider: string, usados: Set<string>): NombreDeFaccion | null {
  const candidatos: NombreDeFaccion[] =
    raza === 'orcos' ? nombresOrcos(lider)
    : raza === 'nabieus' ? PALABRAS_NABIEUS.map(([p, t]) => ({ nombre: `Keseg ${p}`, traduccion: t }))
    : raza === 'faerus' ? PALABRAS_FAERUS.map(([p, t]) => ({ nombre: `Feg ${p}`, traduccion: t }))
    : [];
  return candidatos.find((c) => !usados.has(c.nombre)) ?? null;
}
