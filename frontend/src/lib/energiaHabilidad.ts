/// P101 (QA-27): lo que cuesta y recupera de energía una habilidad de combate, para su ficha.
export function textoEnergiaHabilidad(coste: number, recupera: number): string {
  const partes = [coste > 0 ? `cuesta ${coste} de energía` : 'no cuesta energía']
  if (recupera > 0) partes.push(`recupera ${recupera}`)
  const texto = partes.join(' y ')
  return `⚡ ${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
}
