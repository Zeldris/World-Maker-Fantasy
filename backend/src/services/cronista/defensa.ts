// CR-65 (hito 0.3, Fase E): defensa del Reino y milicia — reglas puras. Decisiones Q1-Q10 de la
// ronda de detalle en `docs/producto/plan-roadmap-0.3.md`, contrastadas con los juegos de
// referencia (X4 marca el camino):
//
// - Módulos de defensa por asentamiento (X4: el núcleo de una estación y sus módulos): la Capital
//   (Ayuntamiento) y cada Cuartel Avanzado. Cada asentamiento se defiende con lo suyo.
// - Empalizada: cobertura de D&D (+2 media, +5 tres cuartos) y aguante del módulo (casco de X4).
// - Torre de vigía: radar (alcance de satélite de X4) y +2 al tirar desde lo alto (BG3).
// - Armería: equipos de la milicia (Manor Lords, Bellwright).
// - Barracón: plazas de guarnición (X4: subordinados asignados a defender una estación) y moral.

export const MODULOS_DEFENSA = ['empalizada', 'torre-vigia', 'armeria', 'barracon'] as const;
export type ModuloDefensa = (typeof MODULOS_DEFENSA)[number];

/// Q4: cobertura a la tirada de defensa de quien defiende, por escalón de la Empalizada.
export const COBERTURA_EMPALIZADA = [0, 2, 2, 5] as const;
/// Q4: asaltos perdidos que aguanta la Empalizada antes de caer, por escalón.
export const AGUANTE_EMPALIZADA = [0, 1, 2, 3] as const;
/// Q5: tramos de camino que alcanza el radar de la Torre, por escalón (sin vigía dentro, 1).
export const RADIO_TORRE = [0, 1, 2, 3] as const;
/// Q5: bono al tirar desde la Torre (terreno elevado de BG3).
export const BONO_ALTURA_TORRE = 2;
/// Q6: equipos de milicia que guarda la Armería, por escalón.
export const EQUIPOS_ARMERIA = [0, 5, 10, 20] as const;
/// Q6: los milicianos pelean como soldados genéricos con este nivel de menos.
export const NIVEL_MENOS_MILICIA = 2;
/// Q7: plazas de guarnición (soldados y vigías asignados) por escalón del Barracón; sin Barracón, 3.
export const PLAZAS_BARRACON = [3, 5, 10, 20] as const;
/// Q7: bono a la moral de la guarnición al defender, por escalón del Barracón.
export const MORAL_BARRACON = [0, 1, 2, 3] as const;
/// Q1: módulos de defensa que caben en un Cuartel Avanzado sin mejorar (cifra provisional); el
/// Cuartel de Guerra suma su `cuartelUpgradeBonus.defensa`.
export const CUPO_DEFENSA_CUARTEL_BASE = 2;

const escalon = (tier: number | null | undefined): number => Math.max(0, Math.min(3, tier ?? 0));

/// Módulo de defensa de un `Building.recipeKey` (las mejoras no cambian la clave), o null.
export function moduloDeRecipeKey(recipeKey: string | null | undefined): ModuloDefensa | null {
  return (MODULOS_DEFENSA as readonly string[]).includes(recipeKey ?? '') ? (recipeKey as ModuloDefensa) : null;
}

/// Lo que da la defensa de un asentamiento: escalón de cada módulo (0 = no lo tiene) y si la
/// Empalizada está caída.
export interface ModulosAsentamiento {
  empalizada: number;
  torre: number;
  armeria: number;
  barracon: number;
  empalizadaCaida?: boolean;
  vigiaEnTorre?: boolean;
}

export interface EfectoDefensa {
  cobertura: number;
  radioTramos: number;
  bonoAltura: number;
  equiposMilicia: number;
  plazasGuarnicion: number;
  bonoMoral: number;
  aguante: number;
}

/// Puro: lo que suman los módulos de un asentamiento.
export function efectoDefensa(m: ModulosAsentamiento): EfectoDefensa {
  const torre = escalon(m.torre);
  return {
    cobertura: m.empalizadaCaida ? 0 : COBERTURA_EMPALIZADA[escalon(m.empalizada)],
    aguante: AGUANTE_EMPALIZADA[escalon(m.empalizada)],
    radioTramos: torre === 0 ? 0 : m.vigiaEnTorre ? RADIO_TORRE[torre] : 1,
    bonoAltura: torre > 0 ? BONO_ALTURA_TORRE : 0,
    equiposMilicia: EQUIPOS_ARMERIA[escalon(m.armeria)],
    plazasGuarnicion: PLAZAS_BARRACON[escalon(m.barracon)],
    bonoMoral: MORAL_BARRACON[escalon(m.barracon)],
  };
}

/// Puro (Q4): la Empalizada tras perder un asalto: suma un golpe y cae al llegar a su aguante.
export function golpeAEmpalizada(tier: number, golpes: number): { golpes: number; caida: boolean } {
  const g = golpes + 1;
  return { golpes: g, caida: g >= AGUANTE_EMPALIZADA[escalon(tier)] };
}
