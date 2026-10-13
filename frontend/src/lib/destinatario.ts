/// P141 (QA-27): a quién se dirige «Responder». Un NPC sin descubrir llega como «Orco desconocido» u
/// «Orca desconocida» (`nombreOcultoPorRaza`, backend): no es un nombre propio, va con artículo y en
/// minúscula («Le digo al orco desconocido:»). «Alguien», igual. Un nombre propio, tal cual.
export function aQuienSeDirige(nombre: string): string {
  const oculto = /^(\S+) (desconocid([oa]))$/.exec(nombre)
  if (oculto) return `${oculto[3] === 'a' ? 'a la' : 'al'} ${oculto[1].toLowerCase()} ${oculto[2]}`
  if (nombre === 'Alguien') return 'a alguien'
  return `a ${nombre}`
}
