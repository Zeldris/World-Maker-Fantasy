/// Interacción con un NPC/fauna ya incapacitado o muerto, FUERA de un combate activo (docs/19-post-
/// combate-y-recompensas-mision.md pieza 2, decisión explícita de la usuaria, 2026-08-13) — a
/// diferencia del validador de grounding (playerActionValidation.ts), esto no rechaza nada: es un
/// atajo mecánico legítimo. Si el jugador nombra específicamente en su acción a alguien ya resuelto
/// que sigue en escena, no hay nada nuevo que narrar (ya está todo decidido) — el turno se corta
/// con la ficha mecánica (Saquear/Decapitar/Salir), la misma información que ya usa la pantalla de
/// "Victoria" de combate, sin gastar generación en una prosa que no aportaría nada.
import { normalizeText, matchesAliasBoundary } from './travel.js';

export interface PostCombatInteractionCandidate {
  slug: string;
  name: string;
  condicionFisica: string;
  saqueado: boolean;
}

export interface PostCombatInteractionTarget {
  slug: string;
  name: string;
  condicionFisica: 'INCAPACITADO' | 'MUERTO';
  saqueado: boolean;
}

/// Solo por NOMBRE (no el alias completo de catálogo) — igual que `explicitTarget` en turn.ts para
/// un objetivo citado entre comillas; suficiente para un atajo mecánico opcional, sin necesitar una
/// consulta nueva a la lista de aliases de cada NPC.
export function detectsPostCombatInteraction(action: string, npcsInScene: PostCombatInteractionCandidate[]): PostCombatInteractionTarget | null {
  const normalizedAction = normalizeText(action);
  const target = npcsInScene.find(
    (n) => (n.condicionFisica === 'INCAPACITADO' || n.condicionFisica === 'MUERTO') && matchesAliasBoundary(normalizedAction, normalizeText(n.name)),
  );
  if (!target) return null;
  return { slug: target.slug, name: target.name, condicionFisica: target.condicionFisica as 'INCAPACITADO' | 'MUERTO', saqueado: target.saqueado };
}
