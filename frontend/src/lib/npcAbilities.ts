import type { Attribute } from '../types'
import type { EnciclopediaResponse, EnciclopediaAtaqueBase } from './api'
import type { EnciclopediaLinkTarget } from './enciclopediaIndex'
import { abilityToDetailTarget, razaToDetailTarget } from './enciclopediaTargets'

export interface ResolvedAbility {
  icon: string
  name: string
  description: string
  /// Rediseño del turno de combate (2026-07-28) — "tipo" de la habilidad (rueda de debilidades
  /// en el backend, color en la UI aquí).
  preferredAttribute: Attribute
  /// Rediseño de la vista de combate (2026-07-28, petición explícita: "un icono... para
  /// consultarlo en la enciclopedia") — undefined cuando no hay una página propia a la que
  /// enlazar (Ataque base es calculado, no una entidad de catálogo real).
  detailTarget?: EnciclopediaLinkTarget
}

/// Fuente mínima para resolver la lista de habilidades a mostrar en la ficha de combate de un
/// enemigo — tanto `EnciclopediaNpcInfo` (humanoide) como `EnciclopediaFaunaFloraInfo` (fauna)
/// satisfacen esta forma estructuralmente, así que `resolveCombatAbilities` sirve para los dos sin
/// distinguir el tipo de origen.
export interface CombatAbilitySource {
  level?: number
  ataqueBase: EnciclopediaAtaqueBase | null
  raza?: string | null
  clase?: string | null
  habilidadesRaciales?: { icon: string; name: string; description: string; categoria: 'ataque' | 'defensa' | 'utilidad'; preferredAttribute: Attribute }[]
  /// Página a la que enlazan las habilidades raciales DE FAUNA (`habilidadesRaciales`) — no tienen
  /// catálogo propio independiente, viven en la misma fila que la ficha de la propia fauna, así
  /// que "consultar en la enciclopedia" abre esa misma página.
  selfTarget?: EnciclopediaLinkTarget
}

/// Rediseño de la vista de combate (2026-07-28) — combina, en orden: Ataque base (siempre
/// presente) + habilidades de clase desbloqueadas hasta su nivel (solo humanoides con `clase`,
/// reutiliza `enciclopedia.classes` tal cual la ve la Enciclopedia) + su única habilidad racial
/// (humanoides con `raza`, sale de `enciclopedia.razas`) + hasta 6 habilidades raciales propias
/// (solo fauna, ya vienen resueltas en `habilidadesRaciales`). Nunca inventa nada nuevo — todo
/// sale de catálogos que la propia Enciclopedia ya sirve.
export function resolveCombatAbilities(source: CombatAbilitySource, enciclopedia: EnciclopediaResponse): ResolvedAbility[] {
  const abilities: ResolvedAbility[] = []

  if (source.ataqueBase) {
    const { icon, name, description, preferredAttribute } = source.ataqueBase
    abilities.push({ icon, name, description, preferredAttribute })
  }

  if (source.clase) {
    const clase = enciclopedia.classes.find((c) => c.name === source.clase)
    if (clase) {
      const level = source.level ?? Infinity
      for (const unlock of clase.unlocks) {
        if (unlock.level <= level) {
          const { icon, name, description, preferredAttribute } = unlock.ability
          abilities.push({ icon, name, description, preferredAttribute, detailTarget: abilityToDetailTarget(unlock.ability, `Nivel ${unlock.level}`) })
        }
      }
    }
  }

  if (source.raza) {
    const raza = enciclopedia.razas.find((r) => r.slug === source.raza)
    if (raza) {
      const { icon, name, description, preferredAttribute } = raza.habilidadRacial
      abilities.push({ icon, name, description, preferredAttribute, detailTarget: razaToDetailTarget(raza) })
    }
  }

  if (source.habilidadesRaciales) {
    for (const { icon, name, description, preferredAttribute } of source.habilidadesRaciales) {
      abilities.push({ icon, name, description, preferredAttribute, detailTarget: source.selfTarget })
    }
  }

  return abilities
}
