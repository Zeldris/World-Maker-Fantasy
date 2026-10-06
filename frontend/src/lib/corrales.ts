// CR-55: textos de Reino › Corrales (puro, para poder probarlo).
import type { AnimalDeCorral, EtapaAnimal } from './api'

export const ETAPA_LABEL: Record<EtapaAnimal, string> = { CRIA: 'cría', JOVEN: 'joven', ADULTO: 'adulto', VEJEZ: 'viejo' }
const SIGUIENTE: Record<EtapaAnimal, string | null> = { CRIA: 'joven', JOVEN: 'adulto', ADULTO: 'viejo', VEJEZ: null }
export const ESCALON_LABEL: Record<number, string> = { 1: 'Taller', 2: 'Obrador', 3: 'Gran obrador' }

/// «♀ adulto · viejo en 40 días».
export function lineaDeAnimal(a: AnimalDeCorral): string {
  const sexo = a.sexo === 'M' ? '♂' : '♀'
  const siguiente = SIGUIENTE[a.etapa]
  const plazo = siguiente && a.diasParaSiguiente !== null ? ` · ${siguiente} en ${a.diasParaSiguiente} ${a.diasParaSiguiente === 1 ? 'día' : 'días'}` : ''
  return `${sexo} ${ETAPA_LABEL[a.etapa]}${plazo}`
}

/// Cuántos hay de cada sexo y etapa: «3 ♂ · 5 ♀ · 2 crías».
export function resumenDeCorral(animales: AnimalDeCorral[]): string {
  const adultos = animales.filter((a) => a.etapa !== 'CRIA')
  const machos = adultos.filter((a) => a.sexo === 'M').length
  const hembras = adultos.length - machos
  const crias = animales.length - adultos.length
  const partes = [`${machos} ♂`, `${hembras} ♀`]
  if (crias > 0) partes.push(`${crias} ${crias === 1 ? 'cría' : 'crías'}`)
  return partes.join(' · ')
}

/// Aviso de hambre o sed del ganado (null si están bien).
export function avisoDeCarencia(diasSinComer: number, diasSinBeber: number): string | null {
  if (diasSinComer === 0 && diasSinBeber === 0) return null
  const partes: string[] = []
  if (diasSinComer > 0) partes.push(`${diasSinComer} ${diasSinComer === 1 ? 'día' : 'días'} sin forraje`)
  if (diasSinBeber > 0) partes.push(`${diasSinBeber} ${diasSinBeber === 1 ? 'día' : 'días'} sin agua`)
  return `El ganado lleva ${partes.join(' y ')}: no produce ni cría${diasSinComer >= 3 || diasSinBeber >= 2 ? ', y ya mueren animales' : ''}.`
}
