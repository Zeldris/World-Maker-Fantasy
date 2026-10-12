/// Compartido entre HabilidadesPanel.tsx y SkillBarHud.tsx (2026-09-17, petición explícita de
/// Álvaro) — "Viajar" queda deshabilitada hasta que exista un sistema de monturas (todavía sin
/// implementar); el viaje real entre regiones ya no vive aquí, ahora es el icono de salida de
/// región del mapa de Zona (`ZonaSalidaModal.tsx`). Mismo criterio de nombre-fijo que
/// `PASSIVE_ABILITY_NAMES` (passiveAbilities.ts) — sin campo nuevo en el catálogo por una única
/// habilidad afectada.
export const ABILITIES_REQUIEREN_MONTURA = new Set(['Viajar'])
