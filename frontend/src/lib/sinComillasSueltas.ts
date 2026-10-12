/// P14 (QA-27, y G27 de la Fase G del 0.1): las acciones que arma el juego llevan los nombres entre
/// comillas simples («Salgo a cazar y ataco a 'Guchapo'.», «…, contra 'Guchapo #1'.», una habilidad
/// de oficio entera entre comillas). El backend las necesita para analizar el texto, pero en el
/// diario se leían como comillas sueltas alrededor del chip. Se quitan solo al pintar, y solo las
/// que abren tras espacio o inicio y cierran antes de espacio, puntuación o final: los apóstrofos de
/// los nombres (Vash'grath, Terk'ikar) no se tocan.
const COMILLAS_QUE_ENVUELVEN = /(^|[\s(,])'([^'\n]+)'(?=[\s.,;:)!?]|$)/g

export function sinComillasSueltas(texto: string): string {
  return texto.replace(COMILLAS_QUE_ENVUELVEN, '$1$2')
}
