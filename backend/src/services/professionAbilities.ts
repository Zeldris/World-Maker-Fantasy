import {
  AXE_REPAIR_RECIPE,
  GARGANTUA_ARMOR_RECIPE,
  ANTIDOTE_RECIPE,
  IRON_INGOT_RECIPE,
  STONE_BLOCK_RECIPE,
  FIRST_AID_BANDAGE_RECIPE,
  RED_SPIKE_INFUSION_RECIPE,
  BASIC_POULTICE_RECIPE,
  COMPLETE_POULTICE_RECIPE,
  CUERDAS_RECIPE,
  type CraftingRecipe,
} from './crafting.js';
import { CHOZA_RECIPE, type ConstructionRecipe } from './construction.js';
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
///
/// Excepción de categoría (2026-08-13): las recetas de construction.ts con oficio (`buildAbilityFor`
/// más abajo, hoy solo la Choza) siguen el MISMO desbloqueo por nivel de oficio, pero su
/// `ability.category` es 'reino', no 'profesion' — tienen su propia pestaña "Reino" en el panel de
/// Habilidades junto a Campamento/Ayuntamiento (startingAbilities.ts, sin oficio), porque
/// "edificar algo del mundo persistente" es un concepto distinto de "craftear un objeto propio".
export interface ProfessionAbilityUnlock {
  oficio: string;
  nivel: number;
  /// `recipe.key` (crafting.ts o construction.ts) — para enlazar desde la ficha de la habilidad a
  /// su entrada real en la Enciclopedia (rediseño de profesiones 2026-08-07). El slug completo es
  /// `${recipeCategory}:${recipeKey}` — ver `recipeCategory` justo debajo.
  recipeKey: string;
  /// Qué sección de la Enciclopedia indexa esta receta ('crafteo' para crafting.ts, 'construccion'
  /// para construction.ts — mismo `entityType` que enciclopediaTargets.ts usa al construir
  /// `bySlugKey`). Añadido 2026-08-13 al sumar la Choza (construction.ts) a este roster: antes
  /// todas las entradas eran de crafteo y DetailModal.tsx daba el prefijo por hecho.
  recipeCategory: 'crafteo' | 'construccion';
  ability: StartingAbility;
}

function abilityFor(recipe: CraftingRecipe, name: string, icon: string, promptText: string): ProfessionAbilityUnlock {
  if (!recipe.oficio || !recipe.tier) throw new Error(`[professionAbilities] receta sin oficio/tier: ${recipe.key}`);
  return {
    oficio: recipe.oficio,
    nivel: recipe.tier,
    recipeKey: recipe.key,
    recipeCategory: 'crafteo',
    ability: { name, icon, description: recipe.resultDescription, promptText, category: 'profesion' },
  };
}

// Edificios de construction.ts con oficio+tier propios (2026-08-13, petición explícita: "hay que
// añadir también los edificios como habilidades de construcción, al igual que el resto de
// elementos de profesiones") — mismo patrón que abilityFor, pero para ConstructionRecipe. Solo
// cubre recetas CON oficio: las que no lo llevan (Campamento, Ayuntamiento — "cualquiera puede
// intentarlo, no hace falta un gremio", ver construction.ts) van como habilidad de categoría
// 'reino' en startingAbilities.ts en vez de aquí, porque no hay ningún nivel de oficio que
// desbloquearlas. `ability.category` es 'reino', no 'profesion' (misma petición, extendida el
// mismo día: "hay que añadir un tab en habilidades para las habilidades de reino") — su propia
// pestaña, distinta de "Profesiones", aunque el desbloqueo siga dependiendo del nivel de oficio.
function buildAbilityFor(recipe: ConstructionRecipe, name: string, icon: string, promptText: string): ProfessionAbilityUnlock {
  if (!recipe.oficio || !recipe.tier) throw new Error(`[professionAbilities] receta de construcción sin oficio/tier: ${recipe.key}`);
  return {
    oficio: recipe.oficio,
    nivel: recipe.tier,
    recipeKey: recipe.key,
    recipeCategory: 'construccion',
    ability: { name, icon, description: recipe.description, promptText, category: 'reino' },
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
  abilityFor(FIRST_AID_BANDAGE_RECIPE, 'Atar vendaje improvisado', '🩹', 'Ato un vendaje improvisado con mi manojo de salvia del polvo.'),
  abilityFor(RED_SPIKE_INFUSION_RECIPE, 'Preparar infusión de espiga roja', '☕', 'Preparo una infusión de espiga roja.'),
  abilityFor(BASIC_POULTICE_RECIPE, 'Preparar cataplasma básica de salvia', '🌿', 'Preparo una cataplasma básica de salvia.'),
  abilityFor(COMPLETE_POULTICE_RECIPE, 'Preparar cataplasma completa de salvia y ceniza', '✨', 'Preparo una cataplasma completa de salvia y ceniza.'),
  // Bug real (pendiente 2026-08-27, "la cuerda no craftea para orcos de las Llanuras" — investigado
  // 2026-08-28): CUERDAS_RECIPE (crafting.ts) SÍ funciona por texto libre desde que se creó
  // (commit 1aa94f3, 2026-08-26) — `canCraft`/`detectDeterministicCraft` verificados aparte, sin
  // ningún bloqueo real. Lo que faltaba era darla de alta AQUÍ: sin esta entrada, nunca aparecía el
  // botón de un clic en Habilidades → Profesiones, así que quien no supiera la frase exacta de texto
  // libre la veía como "no craftea" — mismo patrón ya documentado en el comentario de cabecera de
  // este archivo ("una receta sigue siendo crafteable por texto libre aunque su botón todavía no
  // haya aparecido").
  abilityFor(CUERDAS_RECIPE, 'Trenzar cuerdas', '🪢', 'Trenzo un par de cuerdas con la fibra que llevo encima.'),
  buildAbilityFor(CHOZA_RECIPE, 'Construir choza de piel y hueso', '🛖', 'Construyo una choza de piel y hueso con los materiales que llevo.'),
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
