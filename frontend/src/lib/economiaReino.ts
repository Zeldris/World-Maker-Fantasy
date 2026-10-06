import type { EconomiaReino } from './api'

// CR-53 (hito 0.3): avisos de la economía de supervivencia del Reino.

/// Puro: lo que va mal ahora mismo, en frases cortas.
export function avisosDeEconomia(e: EconomiaReino): string[] {
  const avisos: string[] = []
  if (e.diasSed > 0) avisos.push(`${e.diasSed === 1 ? 'Un día' : `${e.diasSed} días`} sin agua: a los 2 la sed empieza a matar.`)
  if (e.diasHambre > 0) avisos.push(`${e.diasHambre === 1 ? 'Un día' : `${e.diasHambre} días`} sin comida: a los 3 el hambre empieza a matar.`)
  if (e.diasSinCobrar > 0) avisos.push(`${e.diasSinCobrar === 1 ? 'Un día' : `${e.diasSinCobrar} días`} sin pagar los sueldos: a los 7 empiezan a desertar.`)
  if (e.aguaDia < e.bocas) avisos.push('Entra menos agua de la que se bebe: construye un Pozo.')
  if (e.sinHerramienta) avisos.push(`${e.sinHerramienta} trabajador${e.sinHerramienta === 1 ? '' : 'es'} sin herramienta: producen la mitad.`)
  if (e.sinArma) avisos.push(`${e.sinArma} soldado${e.sinArma === 1 ? '' : 's'} sin arma: cuentan la mitad en la defensa.`)
  return avisos
}
