// 3.2 (2026-10-21): interpreta los pasos de `prepararReino.ts` (puro, para probarlo sin base).
export type PasoReino =
  | { tipo: 'subditos'; pueblo: string; n: number; rol: string | null }
  | { tipo: 'reclutar'; npcSlug: string }
  | { tipo: 'guarnicion' }
  | { tipo: 'milicia'; n: number }
  | { tipo: 'relacion'; facSlug: string; evento: string; n: number }
  | { tipo: 'combate'; npcSlugs: string[] }
  | { tipo: 'ganado'; especie: string; n: number }
  | { tipo: 'convaleciente'; npcSlug: string; enCombate: boolean }
  | { tipo: 'lider-muere'; facSlug: string }
  | { tipo: 'alianza'; facA: string; facB: string }
  | { tipo: 'vasallo-paga'; vasalloSlug: string }
  | { tipo: 'domable'; especie: string }
  | { tipo: 'domador'; nivel: number }
  | { tipo: 'punto-retirado'; especie: string; n: number | null }
  | { tipo: 'sin-aliados' };

export const EVENTOS_RELACION = ['EXPANSION_TERRITORIAL_AGRESIVA', 'BAJA_DE_GUERRA', 'SABOTAJE_DIPLOMATICO'] as const;

/// `subditos:orcos:3[:soldado]`, `reclutar:<npc>`, `guarnicion`, `milicia:<n>`, `relacion:<faccion>:<EVENTO>:<n>`
/// (la facción presiona al Reino), `combate:<npc>,<npc>…`, `ganado:<especie>:<n>` (n animales adultos al corral, alternando macho y hembra), `convaleciente:<npc>[:combate]` (el NPC queda CONVALECIENTE en el lugar actual, como tras ganarle un combate; con `:combate`, además el combate sigue sin resolver y sale la tarjeta Matar/Capturar/Clemente, QA-265),
/// `lider-muere:<facción>` (QA-263, CR-43: el líder muere de viejo y la facción queda con dos candidatos), `alianza:<A>:<B>`
/// (P247: alianza, ruptura y alianza nueva de las dos facciones) y `vasallo-paga:<vasallo>` (P314: fondos para la cuota entera sin saldar la deuda).
/// `domable:<especie>` (QA-264, CR-55: un animal de ganado atado en una Jaula libre, a falta de ganar su confianza y llevarlo «Al corral») y
/// `domador:<nivel>` (CR-56: la jugadora, Cazador, sube a ese nivel, de 10 a 19, y elige la especialización Domador). `punto-retirado:<especie>[:<n>]` (QA-266, P313: un punto de fauna retirado que aún tiene n presas, 3 si no se dice; estado sintético para la defensa de `opcionesDePartida`). `sin-aliados` (QA-266, P128: los compañeros salen del Grupo 1 a otro grupo, así el combate se abre solo con la jugadora). Se ejecutan en el orden dado.
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
    } else if (clave === 'ganado') {
      const n = entero(r[1]);
      if (!r[0] || n == null) return { error: `«${arg}»: falta ganado:<especie>:<n>.` };
      pasos.push({ tipo: 'ganado', especie: r[0], n });
    } else if (clave === 'convaleciente') {
      if (!r[0] || r.length > 2 || (r[1] != null && r[1] !== 'combate')) return { error: `«${arg}»: falta convaleciente:<slug del NPC>[:combate].` };
      pasos.push({ tipo: 'convaleciente', npcSlug: r[0], enCombate: r[1] === 'combate' });
    } else if (clave === 'lider-muere') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta lider-muere:<slug de la facción>.` };
      pasos.push({ tipo: 'lider-muere', facSlug: r[0] });
    } else if (clave === 'alianza') {
      if (!r[0] || !r[1] || r.length > 2) return { error: `«${arg}»: falta alianza:<facción A>:<facción B>.` };
      pasos.push({ tipo: 'alianza', facA: r[0], facB: r[1] });
    } else if (clave === 'vasallo-paga') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta vasallo-paga:<slug del vasallo>.` };
      pasos.push({ tipo: 'vasallo-paga', vasalloSlug: r[0] });
    } else if (clave === 'domable') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta domable:<especie de ganado>.` };
      pasos.push({ tipo: 'domable', especie: r[0] });
    } else if (clave === 'sin-aliados' && r.length === 0) {
      pasos.push({ tipo: 'sin-aliados' });
    } else if (clave === 'punto-retirado') {
      const n = r[1] === undefined ? null : entero(r[1]);
      if (!r[0] || r.length > 2 || (r[1] !== undefined && (n == null || n > 20))) return { error: `«${arg}»: falta punto-retirado:<especie>[:<n>], con n de 1 a 20.` };
      pasos.push({ tipo: 'punto-retirado', especie: r[0], n });
    } else if (clave === 'domador') {
      const nivel = entero(r[0]);
      if (nivel == null || r.length > 1 || nivel < 10 || nivel > 19) return { error: `«${arg}»: falta domador:<nivel>, de 10 a 19 (desde el 20 cambian las habilidades de arma).` };
      pasos.push({ tipo: 'domador', nivel });
    } else {
      return { error: `«${arg}»: paso desconocido.` };
    }
  }
  return pasos;
}
