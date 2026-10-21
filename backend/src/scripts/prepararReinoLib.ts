// 3.2 (2026-10-21): interpreta los pasos de `prepararReino.ts` (puro, para probarlo sin base).
export type PasoReino =
  | { tipo: 'subditos'; pueblo: string; n: number; rol: string | null }
  | { tipo: 'reclutar'; npcSlug: string }
  | { tipo: 'guarnicion' }
  | { tipo: 'milicia'; n: number }
  | { tipo: 'relacion'; facSlug: string; evento: string; n: number }
  | { tipo: 'combate'; npcSlugs: string[] };

export const EVENTOS_RELACION = ['EXPANSION_TERRITORIAL_AGRESIVA', 'BAJA_DE_GUERRA', 'SABOTAJE_DIPLOMATICO'] as const;

/// `subditos:orcos:3[:soldado]`, `reclutar:<npc>`, `guarnicion`, `milicia:<n>`, `relacion:<faccion>:<EVENTO>:<n>`
/// (la facción presiona al Reino), `combate:<npc>,<npc>…`. Se ejecutan en el orden dado.
export function parsearPasosReino(args: string[]): PasoReino[] | { error: string } {
  if (args.length === 0) return { error: 'No se ha pedido nada.' };
  const pasos: PasoReino[] = [];
  for (const arg of args) {
    const [clave, ...r] = arg.split(':');
    const entero = (t: string | undefined) => (t != null && /^\d+$/.test(t) && Number(t) >= 1 ? Number(t) : null);
    if (clave === 'subditos') {
      const n = entero(r[1]);
      if (!r[0] || n == null) return { error: `«${arg}»: falta subditos:<pueblo>:<n>[:<rol>].` };
      pasos.push({ tipo: 'subditos', pueblo: r[0], n, rol: r[2] ?? null });
    } else if (clave === 'reclutar') {
      if (!r[0]) return { error: `«${arg}»: falta reclutar:<slug del NPC>.` };
      pasos.push({ tipo: 'reclutar', npcSlug: r[0] });
    } else if (clave === 'guarnicion' && r.length === 0) {
      pasos.push({ tipo: 'guarnicion' });
    } else if (clave === 'milicia') {
      const n = entero(r[0]);
      if (n == null) return { error: `«${arg}»: falta milicia:<n>.` };
      pasos.push({ tipo: 'milicia', n });
    } else if (clave === 'relacion') {
      const n = entero(r[2]);
      if (!r[0] || !(EVENTOS_RELACION as readonly string[]).includes(r[1] ?? '') || n == null) return { error: `«${arg}»: falta relacion:<facción>:<${EVENTOS_RELACION.join('|')}>:<n>.` };
      pasos.push({ tipo: 'relacion', facSlug: r[0], evento: r[1]!, n });
    } else if (clave === 'combate') {
      const npcSlugs = (r[0] ?? '').split(',').filter(Boolean);
      if (npcSlugs.length === 0) return { error: `«${arg}»: falta combate:<npc>,<npc>…` };
      pasos.push({ tipo: 'combate', npcSlugs });
    } else {
      return { error: `«${arg}»: paso desconocido.` };
    }
  }
  return pasos;
}
