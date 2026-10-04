import type { NpcInScene } from './npcScene.js';

/// Menú contextual de interacción con NPC (2026-09-06, "hay que mirar bien cuándo y cómo lanzamos
/// el interactuar... en vez de depender de una habilidad suelta") — sustituye "Aprender oficio"
/// como habilidad genérica de la barra por un menú que solo ofrece lo que ESTE NPC concreto puede
/// dar, calculado a partir de `Npc.interactionTypes` (catálogo, multivaluado) + estado real de la
/// partida. Función pura, sin acceso a BD — el caller (`turnResolution.ts`) resuelve de antemano
/// cualquier dato que dependa de una consulta (p. ej. si hay una misión ofertada de este NPC).
export interface NpcInteractionOptionsParams {
  /// true si `Save.pendingQuestOfferInfo` está activa y fue generada por ESTE NPC en el turno/
  /// conversación en curso — el caller decide esto (hoy solo Gistera Koh dispara una oferta real,
  /// ver `turnResolution.ts` § gisteraSePresentaEsteTurno), esta función no reimplementa ese cálculo.
  hayMisionOfertadaDeEsteNpc: boolean;
  /// Título de la misión ofertada, solo si `hayMisionOfertadaDeEsteNpc` es true — se usa para
  /// componer la etiqueta `'Misión: <título>'`.
  tituloMisionOfertada?: string;
}

const CONDICIONES_CAPTURABLES = new Set(['GRAVE', 'CONVALECIENTE']);

/// CR-12: un malherido tiene menú aunque no tenga `interactionTypes` (para poder ayudarle).
export function estaMalherido(npc: Pick<NpcInScene, 'condicionFisica'>): boolean {
  return CONDICIONES_CAPTURABLES.has(npc.condicionFisica);
}

/// Opciones del menú contextual para este NPC concreto, en el orden en que deben mostrarse.
/// `[]` no debería ocurrir en la práctica (el caller ya exige `interactionTypes.length > 0` antes
/// de llamar aquí), pero la función no asume eso por sí misma.
export function opcionesDisponiblesPara(npc: NpcInScene, params: NpcInteractionOptionsParams): string[] {
  if (npc.interactionTypes.length === 0 && !estaMalherido(npc)) return [];

  const opciones: string[] = ['Charlar'];

  if (npc.interactionTypes.includes('MAESTRO_OFICIO') && npc.teachesProfession) {
    opciones.push('Aprender profesión');
  }

  if (npc.interactionTypes.includes('NPC_MISION') && params.hayMisionOfertadaDeEsteNpc) {
    opciones.push(`Misión: ${params.tituloMisionOfertada ?? 'oferta pendiente'}`);
  }

  // Reclutar (2026-09-06, alcance de esta pieza) — solo el camino ya existente de tameo tras
  // combate (mismo criterio que `GET /saves/:id/capturables`, companeros.ts). El reclutamiento
  // pacífico por conversación con facciones amistosas/sin facción (idea explícita de la usuaria:
  // tiradas de convencimiento según si al NPC "le gusta lo que dices") queda para una pieza futura
  // que diseñe esa mecánica de persuasión de cero — no existe todavía ninguna habilidad de utilidad
  // de ese tipo en el catálogo.
  // Ayudar (CR-12, 2026-10-04): atender a un malherido (p. ej. el herido de un campo de batalla del
  // narrador de fondo) para que vuelva con los suyos; su facción lo agradece (`ayudarNpc.ts`).
  if (CONDICIONES_CAPTURABLES.has(npc.condicionFisica)) opciones.push('Ayudar');

  if (CONDICIONES_CAPTURABLES.has(npc.condicionFisica) && npc.capturable) {
    opciones.push('Reclutar');
  }

  opciones.push('Combatir', 'Salir');
  return opciones;
}
