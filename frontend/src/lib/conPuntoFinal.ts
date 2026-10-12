/// P68 (QA-27): los `teaser` del catálogo se escriben sin punto final (también sirven de pista
/// suelta); en una tarjeta se leen como frase.
export function conPuntoFinal(texto: string): string {
  const t = texto.trimEnd()
  return /[.!?…»]$/.test(t) ? t : `${t}.`
}
