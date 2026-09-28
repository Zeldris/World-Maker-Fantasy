import type { RecipeStatusInfo } from '../types'

/// Motivo por el que no se puede construir ahora, o null si se puede. 
export function cuartelBuildDisabledReason(status: RecipeStatusInfo | undefined, hasCuartel: boolean, needsCuartel: boolean, alreadyBuilt: boolean): string | null {
  if (alreadyBuilt) return 'Ya construido.'
  if (needsCuartel && !hasCuartel) return 'Necesitas un Cuartel avanzado en pie.'
  if (!status) return 'Cargando requisitos...'
  if (status.met) return null
  const parts: string[] = []
  const faltantes = status.ingredients.filter((i) => !i.met)
  if (faltantes.length > 0) parts.push(`Necesitas: ${faltantes.map((i) => `${i.label} ${i.tienes}/${i.necesitas}`).join(', ')}.`)
  if (status.missingRequisitos.length > 0) parts.push(`Falta: ${status.missingRequisitos.join(', ')}.`)
  if (status.blockedReason) parts.push(`${status.blockedReason[0].toUpperCase()}${status.blockedReason.slice(1)}.`)
  return parts.join(' ') || 'No cumples los requisitos ahora mismo.'
}
