/// Motor de facciones estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.2, 2026-09-21) — "el mismo
/// modelo representa el reino de X, sea X el jugador o una facción NPC". `Building`/`Territory`/
/// `KingdomStats` tienen `saveId`/`factionId` opcionales; la invariante real ("exactamente uno
/// relleno, nunca ambos, nunca ninguno") se valida SOLO en servicio — Prisma no expresa XOR nativo
/// entre dos campos opcionales, y el proyecto no usa CHECK constraints hoy en ningún otro sitio
/// (mismo criterio laxo que `ZonePoint`/`Npc.faction`, decisión explícita de la autora).
export interface ReinoOwner {
  saveId?: string | null;
  factionId?: string | null;
}

/// Lanza si el propietario no es exactamente uno de los dos — llamar antes de cualquier
/// create/update de Building/Territory/KingdomStats. `context` es solo para el mensaje de error
/// (qué llamada lo detectó), no cambia el comportamiento.
export function assertExactlyOneOwner(owner: ReinoOwner, context: string): void {
  const hasSave = Boolean(owner.saveId);
  const hasFaction = Boolean(owner.factionId);
  if (hasSave === hasFaction) {
    throw new Error(
      `${context}: se esperaba exactamente un propietario (saveId O factionId), recibido saveId=${owner.saveId ?? 'null'} factionId=${owner.factionId ?? 'null'}`,
    );
  }
}

/// Clave real de `KingdomStats.ownerKey` (sustituye al viejo `saveId @unique` como pivote de
/// `findUnique`/`update`) — determinista a partir del mismo `ReinoOwner` de arriba. Llamar SIEMPRE
/// tras `assertExactlyOneOwner` (no repite la validación, asume que ya se hizo).
export function ownerKeyFor(owner: ReinoOwner): string {
  return owner.saveId ? `save:${owner.saveId}` : `faction:${owner.factionId}`;
}
