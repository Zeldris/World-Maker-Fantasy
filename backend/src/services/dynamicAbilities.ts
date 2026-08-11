import type { Prisma, AbilityEffect, AbilityRol, EquipSlot } from '@prisma/client';
import { BERIG_RAZAS } from './berigLore.js';
import { weaponAbilitiesFor, type EquippedWeaponSlot } from './weaponAbilities.js';
import { ENERGY_COST_BASICA, ENERGY_COST_AVANZADA, ENERGY_COST_ATAQUE_BASICO } from './energy.js';

/// Deuda técnica (2026-07-30, "control de deuda técnica"): este bloque ("qué armas llevas
/// equipadas ahora mismo → su `tipoArma` real del catálogo → `EquippedWeaponSlot[]`") estaba
/// copiado casi literal 3 veces en routes/saves.ts (creación de partida, /restart, equipar) —
/// cualquier cambio futuro (p.ej. un tercer hueco de arma) habría que aplicarlo en los 3 sitios
/// a mano. Centralizado aquí, junto al resto de lógica de habilidades dinámicas que ya consume
/// su resultado.
export async function resolveEquippedWeaponSlots(
  tx: Prisma.TransactionClient,
  worldId: string,
  inventoryItems: { slot: EquipSlot | null; catalogSlug: string | null }[],
): Promise<EquippedWeaponSlot[]> {
  const equipped = inventoryItems.filter((i) => i.slot === 'ARMA_PRINCIPAL' || i.slot === 'ARMA_SECUNDARIA');
  const slugs = [...new Set(equipped.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
  const catalogRows = slugs.length
    ? await tx.itemCatalog.findMany({ where: { worldId, slug: { in: slugs } }, select: { slug: true, tipoArma: true } })
    : [];
  const tipoArmaBySlug = new Map(catalogRows.map((c) => [c.slug, c.tipoArma]));
  return equipped.map((i) => ({ slot: i.slot!, tipoArma: (i.catalogSlug ? tipoArmaBySlug.get(i.catalogSlug) : null) ?? null }));
}

/// Habilidades raciales + de arma del JUGADOR (2026-07-29, sistema de habilidades por arma —
/// hasta ahora el personaje jugable no tenía ninguna de las dos: la racial nunca se le mostraba
/// [solo se calculaba para NPCs] y no existía ningún concepto de "arma equipada" con mecánica
/// propia). A diferencia de las 4 de clase (SavedAction fijas, `isStarting`), estas se
/// RECALCULAN cada vez que cambia el equipo o el nivel — `syncDynamicCombatAbilities` borra las
/// anteriores (`isDynamic: true`) y crea las que tocan ahora mismo.
export interface DynamicAbilityData {
  name: string;
  icon: string;
  description: string;
  promptText: string;
  preferredAttribute: string;
  effect: AbilityEffect;
  /// Rediseño de combate (2026-08-09) — ver `enum AbilityRol` (schema.prisma). Las raciales son
  /// trivialmente 'ataque'/'defensa' según el slot del que vienen; las de arma ya traían su
  /// propio `WeaponAbility.rol` (weaponAbilities.ts), antes descartado al llegar aquí.
  rol: AbilityRol;
  /// Sistema de fatiga (2026-07-29) — coste fijo por tramo (energy.ts): las raciales cuestan
  /// ENERGY_COST_BASICA, la de arma avanzada ENERGY_COST_AVANZADA, y desde 2026-07-31 Ataque
  /// Básico (el único genérico que pasa por aquí) cuesta ENERGY_COST_ATAQUE_BASICO.
  energyCost: number;
  /// Rediseño 2026-07-31 — ver StartingAbility.energyRegen/WeaponAbility.energyRegen. Siempre 0
  /// aquí (ninguna dinámica regenera; el único genérico de este set, Ataque Básico, solo cuesta).
  energyRegen: number;
  /// Ver WeaponAbility.isGeneric — solo true para Ataque Básico (el resto, incluidas las
  /// raciales, son habilidades reales).
  isGeneric: boolean;
  /// Ver WeaponAbility.dualWield (2026-07-31) — true cuando la real de ataque colapsó por llevar
  /// la misma categoría en las dos manos. Siempre false en raciales.
  dualWield: boolean;
}

export function dynamicCombatAbilitiesFor(raza: string | null, level: number, equipped: EquippedWeaponSlot[]): DynamicAbilityData[] {
  const abilities: DynamicAbilityData[] = [];

  if (raza) {
    const razaInfo = BERIG_RAZAS.find((r) => r.slug === raza);
    if (razaInfo) {
      const { ataque, defensa } = razaInfo.habilidadesRaciales;
      abilities.push({ ...ataque, preferredAttribute: ataque.preferredAttribute, effect: 'ATAQUE', rol: 'ataque', energyCost: ENERGY_COST_BASICA, energyRegen: 0, isGeneric: false, dualWield: false });
      abilities.push({ ...defensa, preferredAttribute: defensa.preferredAttribute, effect: 'AGUANTE', rol: 'defensa', energyCost: ENERGY_COST_BASICA, energyRegen: 0, isGeneric: false, dualWield: false });
    }
  }

  for (const w of weaponAbilitiesFor(equipped, level)) {
    abilities.push({
      name: w.name,
      icon: w.icon,
      description: w.description,
      promptText: w.promptText,
      preferredAttribute: w.attribute,
      effect: w.rol === 'defensa' ? 'AGUANTE' : 'ATAQUE',
      rol: w.rol,
      energyCost: w.isGeneric ? ENERGY_COST_ATAQUE_BASICO : w.tier === 'avanzada' ? ENERGY_COST_AVANZADA : ENERGY_COST_BASICA,
      energyRegen: w.energyRegen,
      isGeneric: w.isGeneric,
      dualWield: w.dualWield,
    });
  }

  return abilities;
}

/// Borra las dinámicas anteriores y crea las que tocan ahora — determinista, se llama al crear
/// la partida, al equipar/quitar un arma y al cruzar el nivel de la avanzada (20). Idempotente:
/// llamarla sin que nada haya cambiado deja el mismo resultado.
export async function syncDynamicCombatAbilities(
  tx: Prisma.TransactionClient,
  saveId: string,
  raza: string | null,
  level: number,
  equipped: EquippedWeaponSlot[],
): Promise<void> {
  await tx.savedAction.deleteMany({ where: { saveId, isDynamic: true } });
  const abilities = dynamicCombatAbilitiesFor(raza, level, equipped);
  if (abilities.length === 0) return;
  await tx.savedAction.createMany({
    data: abilities.map((a) => ({
      saveId,
      name: a.name,
      promptText: a.promptText,
      icon: a.icon,
      description: a.description,
      category: 'combate',
      isStarting: true,
      isDynamic: true,
      effect: a.effect,
      rol: a.rol,
      preferredAttribute: a.preferredAttribute,
      energyCost: a.energyCost,
      energyRegen: a.energyRegen,
      isGeneric: a.isGeneric,
      dualWield: a.dualWield,
    })),
  });
}
