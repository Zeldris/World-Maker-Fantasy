/// P303: la línea bajo el título de la ficha del rival es el cargo («Terk'ikar del Clan Serhu»), no el
/// nombre. Sin repetir la facción si el cargo ya la nombra y en minúsculas (antes en mayúsculas leía como
/// un título con otro nombre).
export function metaDeRival(npc: { role: string; faction?: string | null; level: number }): string {
  const faccion = npc.faction && !npc.role.toLowerCase().includes(npc.faction.toLowerCase()) ? ` — ${npc.faction}` : ''
  return `${npc.role}${faccion} · nivel ${npc.level}`
}
