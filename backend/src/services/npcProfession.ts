/// Nivel de oficio de los NPC de facción (docs/producto/plan-roadmap-oct-2026.md § 13-A, H-8).
/// Helpers PUROS sobre `NpcProfessionProgress`/`NpcProfessionPotential`: el tope de
/// `nivelMaximo` no es un CHECK de SQL, se aplica aquí al leer/escribir (mismo criterio que el
/// resto de invariantes del schema). Reutiliza `professionLevelForXp` — un solo camino de código
/// para subir de nivel de oficio en todo el proyecto.

import { professionLevelForXp, xpForProfessionLevel } from './professionProgress.js';

export interface NpcProfessionProgressLike {
  nivel: number;
  xp: number;
}

export interface NpcProfessionPotentialLike {
  nivelMaximo: number;
}

/// Nivel con el que el NPC puede ejercer el oficio: el del progreso acotado por `nivelMaximo`.
/// Sin fila de potencial = no puede ejercerlo (0). Sin progreso pero con potencial = nivel 1.
export function nivelEfectivo(
  progress: NpcProfessionProgressLike | null | undefined,
  potential: NpcProfessionPotentialLike | null | undefined,
): number {
  if (!potential || potential.nivelMaximo < 1) return 0;
  const nivel = progress ? Math.max(1, progress.nivel) : 1;
  return Math.min(nivel, potential.nivelMaximo);
}

/// Suma `xpGanada` (>= 0; lo negativo se ignora) al progreso. El nivel resultante nunca pasa del
/// tope: si el XP acumulado lo superaría, el XP se recorta al mínimo del último nivel permitido
/// (no se acumula XP "de más" por encima del tope). Sin potencial no se aplica nada.
export function aplicarXpNpc(
  progress: NpcProfessionProgressLike,
  potential: NpcProfessionPotentialLike | null | undefined,
  xpGanada: number,
): NpcProfessionProgressLike {
  if (!potential || potential.nivelMaximo < 1) return { nivel: progress.nivel, xp: progress.xp };
  const ganada = Math.max(0, Math.trunc(xpGanada));
  let xp = progress.xp + ganada;
  let nivel = professionLevelForXp(xp);
  if (nivel > potential.nivelMaximo) {
    nivel = potential.nivelMaximo;
    // XP máxima que sigue dentro del tope = mínimo del nivel siguiente - 1.
    xp = Math.min(xp, xpForProfessionLevel(nivel + 1) - 1);
  }
  return { nivel, xp };
}
