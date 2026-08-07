import { AXE_REPAIR_RECIPE, GARGANTUA_ARMOR_RECIPE, ANTIDOTE_RECIPE, IRON_INGOT_RECIPE, STONE_BLOCK_RECIPE, type CraftingRecipe } from './crafting.js';
import type { StartingAbility } from './startingAbilities.js';

/// Habilidades de OFICIO (idea aplazada 2026-07-28, retomada 2026-08-07): las recetas de
/// crafting.ts gateadas por `oficio`+`tier` se exponen como habilidad clicable de categoría
/// 'profesion' (2026-08-07: su propia pestaña "Profesiones" en el panel de Habilidades, distinta
/// de "Generales" y de "Combate" — nunca de combate en absoluto) en cuanto
/// el nivel de ESE oficio (professionProgress.ts) alcanza el `tier` de la receta — mismo patrón
/// que classAbilityUnlocksFor, pero por nivel de OFICIO en vez de nivel de personaje, y el
/// "nivel requerido" es directamente el `tier` ya existente de la receta (no hace falta un campo
/// nuevo). No sustituye el texto libre: detectsCraftIntent/canCraft no comprueban ningún estado
/// de desbloqueo, así que una receta sigue siendo crafteable por texto libre aunque su botón
/// todavía no haya aparecido — esto solo añade el atajo de un clic una vez demostrado ese nivel.
///
/// Las recetas SIN oficio (ahumar carne, antorcha de campo — "al alcance de cualquiera, sin
/// necesitar oficio") quedan fuera a propósito: no hay ningún nivel que alcanzar, nada que
/// desbloquear.
interface ProfessionAbilityUnlock {
  oficio: string;
  nivel: number;
  ability: StartingAbility;
}

function abilityFor(recipe: CraftingRecipe, name: string, icon: string, promptText: string): ProfessionAbilityUnlock {
  if (!recipe.oficio || !recipe.tier) throw new Error(`[professionAbilities] receta sin oficio/tier: ${recipe.key}`);
  return {
    oficio: recipe.oficio,
    nivel: recipe.tier,
    ability: { name, icon, description: recipe.resultDescription, promptText, category: 'profesion' },
  };
}

// promptText de cada una: una frase completa que ya dispara detectsCraftIntent de su propia
// receta (verbRegex+nounRegex), verificado a mano contra crafting.ts — el jugador puede pulsar el
// botón sin tener que redactar nada.
const PROFESSION_ABILITIES: ProfessionAbilityUnlock[] = [
  abilityFor(STONE_BLOCK_RECIPE, 'Tallar bloque de piedra', '🧱', 'Tallo piedra en bloques a golpes de maza y cincel.'),
  abilityFor(IRON_INGOT_RECIPE, 'Fundir lingote de hierro', '⚒️', 'Fundo mi mena de hierro en un lingote en la fragua del campamento.'),
  abilityFor(ANTIDOTE_RECIPE, 'Preparar antídoto', '🧪', 'Preparo un antídoto mezclando lo que llevo encima.'),
  abilityFor(AXE_REPAIR_RECIPE, 'Reparar hacha de guerra', '🔨', 'Reparo mi hacha de guerra rota en la fragua del campamento.'),
  abilityFor(GARGANTUA_ARMOR_RECIPE, 'Fabricar peto de gargantúa', '🛡️', 'Fabrico un peto de placas óseas de gargantúa en la fragua del campamento.'),
];

/// Qué habilidades de oficio se desbloquean exactamente al alcanzar `nivel` en `oficio` — llamar
/// una vez por cada nivel cruzado en el turno (mismo criterio que classAbilityUnlocksFor, para no
/// saltarse un desbloqueo si una tanda de XP grande adelanta varios niveles de golpe).
export function professionAbilityUnlocksFor(oficio: string, nivel: number): StartingAbility[] {
  return PROFESSION_ABILITIES.filter((u) => u.oficio === oficio && u.nivel === nivel).map((u) => u.ability);
}

/// Roster completo (todos los niveles/oficios) — para la Enciclopedia, mismo criterio que
/// allClassAbilityUnlocks.
export function allProfessionAbilityUnlocks(): ProfessionAbilityUnlock[] {
  return PROFESSION_ABILITIES;
}
