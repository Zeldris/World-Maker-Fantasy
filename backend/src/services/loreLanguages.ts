/// Nombres de catálogo por idioma de raza (2026-08-31, "Trabajador de Reino" — Karot Veku necesita
/// un nombre propio en Kektira para su Ayuntamiento cuando el jugador es orco, y en lengua común
/// para cualquier otra raza). Generaliza un patrón que ya existía por duplicado, binario
/// (`raza === 'orcos' ? X : Y`) en `worldClock.ts` (`estacionNombreFor`/`climaNombreFor`) a un mapa
/// real `Record<Raza, string>` con fallback a lengua común — la propia usuaria confirmó la
/// intención real del proyecto: "cada raza irá creando 'idiomas' básicos... según avanzamos el
/// lore", así que un ternario de 2 ramas se quedaría corto en cuanto exista el primer nombre real
/// en Goirnte/Nabieus/Faerus. Este archivo NO migra `worldClock.ts` (fuera de alcance de esta
/// pasada, sin necesidad real todavía — solo Kektira existe hoy) — es la base para el próximo caso
/// nuevo, empezando por el nombre de Karot Veku.
export type Raza = 'orcos' | 'goirntes' | 'nabieus' | 'faerus';

const RAZAS_VALIDAS = new Set<Raza>(['orcos', 'goirntes', 'nabieus', 'faerus']);

function normalizeRaza(raza: string | null | undefined): Raza | null {
  return raza && RAZAS_VALIDAS.has(raza as Raza) ? (raza as Raza) : null;
}

/// Entrada de nombre por idioma: `comun` es OBLIGATORIO (fallback universal, cualquier raza sin
/// nombre propio en su idioma cae aquí — incluye razas de fuera de Berig, `raza: null`, o una raza
/// de Berig que todavía no tiene nombre propio para este concepto). Las demás son opcionales: hoy
/// solo `orcos` (Kektira) tiene nombres reales en el proyecto — el resto se añaden según se escriba
/// lore nuevo, sin tocar la forma del tipo.
export interface NombrePorIdioma {
  comun: string;
  orcos?: string;
  goirntes?: string;
  nabieus?: string;
  faerus?: string;
}

/// `raza` del PERSONAJE JUGABLE (`Save.raza`/`Npc.raza`), no de la entidad nombrada — mismo criterio
/// que `estacionNombreFor`: el idioma en que se narra depende de quién lo lee/vive, no de a qué
/// pertenece lo nombrado (un Ayuntamiento del Clan Serhu se narra en Kektira para un jugador orco,
/// en lengua común para cualquier otro, aunque el edificio en sí sea orco en los dos casos).
export function nombrePorIdiomaFor(entry: NombrePorIdioma, raza: string | null | undefined): string {
  const normalizada = normalizeRaza(raza);
  if (normalizada && entry[normalizada]) return entry[normalizada] as string;
  return entry.comun;
}
