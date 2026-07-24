import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { generateImagePrompt, type ImagePromptEntityType, type ImagePromptSizeProfile } from '../services/imagePromptGenerator.js';
import { loreContextFor } from '../services/imagePromptContext.js';
import { allClassAbilityUnlocks } from '../services/classAbilities.js';
import { startingAbilitiesFor } from '../services/startingAbilities.js';
import { slugify } from '../lib/slugify.js';
import { BERIG_RAZAS, BERIG_PERSONAJES } from '../services/berigLore.js';
import { CONSTRUCTION_RECIPES } from '../services/construction.js';

/// Siembra por lotes los prompts de imagen (checklist 2026-07-21/22, punto 7) para NPCs, objetos,
/// fauna/flora y habilidades de clase, en sus DOS perfiles de talla (thumbnail/banner, ver
/// imagePromptGenerator.ts) — rotación cloud con fallback a Ollama (lib/aiProviders/orchestrator.ts).
/// Uso puntual (p.ej. tras una ronda grande de contenido nuevo): el mecanismo principal es bajo
/// demanda, 1 a 1 (POST /world/:slug/image-prompt, ver routes/world.ts) — este script sigue aquí
/// para cuando de verdad haga falta generar muchas de golpe. Idempotente por (tipo, slug, perfil):
/// se salta cualquier combinación que ya tenga prompt guardado, salvo --force.
/// Uso: npm run seed-image-prompts [-- --force]

const WORLD_SLUG = 'helek-sirik';
const FORCE = process.argv.includes('--force');
const SIZE_PROFILES: ImagePromptSizeProfile[] = ['thumbnail', 'banner'];

async function seedOne(worldId: string, entityType: ImagePromptEntityType, entitySlug: string, sizeProfile: ImagePromptSizeProfile) {
  if (!FORCE) {
    const existing = await prisma.imagePrompt.findUnique({
      where: { worldId_entityType_entitySlug_sizeProfile: { worldId, entityType, entitySlug, sizeProfile } },
    });
    if (existing) {
      console.log(`  [saltado, ya existe] ${entityType}/${entitySlug}/${sizeProfile}`);
      return;
    }
  }

  const subject = await loreContextFor(worldId, entityType, entitySlug);
  if (!subject) {
    console.error(`  [ERROR] ${entityType}/${entitySlug}/${sizeProfile}: no encontrado`);
    return;
  }

  try {
    const { prompt, provider } = await generateImagePrompt(entityType, subject.name, subject.loreContext, sizeProfile);
    await prisma.imagePrompt.upsert({
      where: { worldId_entityType_entitySlug_sizeProfile: { worldId, entityType, entitySlug, sizeProfile } },
      update: { prompt, provider },
      create: { worldId, entityType, entitySlug, sizeProfile, prompt, provider },
    });
    console.log(`  [ok, ${provider}] ${entityType}/${entitySlug}/${sizeProfile}`);
  } catch (err) {
    console.error(`  [ERROR] ${entityType}/${entitySlug}/${sizeProfile}: ${err instanceof Error ? err.message : err}`);
  }
}

async function seedBoth(worldId: string, entityType: ImagePromptEntityType, entitySlug: string) {
  for (const sizeProfile of SIZE_PROFILES) {
    await seedOne(worldId, entityType, entitySlug, sizeProfile);
  }
}

async function main() {
  const world = await prisma.world.findUnique({ where: { slug: WORLD_SLUG } });
  if (!world) {
    throw new Error(`No existe el mundo "${WORLD_SLUG}" — correr antes npm run reindex-lore / npm run seed-catalog.`);
  }
  const worldId = world.id;
  console.log(`Sembrando prompts de imagen para el mundo "${world.name}"${FORCE ? ' (--force: regenerando todo)' : ''}...`);

  const [npcs, items, yields, locations] = await Promise.all([
    prisma.npc.findMany({ where: { worldId } }),
    prisma.itemCatalog.findMany({ where: { worldId } }),
    prisma.harvestYield.findMany({ where: { worldId } }),
    prisma.location.findMany({ where: { worldId } }),
  ]);

  // Misma exclusión que /world/:slug/enciclopedia (world.ts): la fauna cazable se siembra también
  // como Npc PLANTILLA para el motor de escena, no se ilustra dos veces.
  const sourceSlugs = new Set(yields.map((y) => y.sourceSlug));
  const npcsToIllustrate = npcs.filter((n) => !sourceSlugs.has(n.slug));

  console.log(`  NPCs (${npcsToIllustrate.length})...`);
  for (const npc of npcsToIllustrate) {
    await seedBoth(worldId, 'npc', npc.slug);
  }

  console.log(`  Objetos (${items.length})...`);
  for (const item of items) {
    await seedBoth(worldId, 'item', item.slug);
  }

  console.log(`  Fauna y flora (${sourceSlugs.size})...`);
  for (const sourceSlug of sourceSlugs) {
    await seedBoth(worldId, 'fauna', sourceSlug);
  }

  console.log(`  Razas (${BERIG_RAZAS.length})...`);
  for (const raza of BERIG_RAZAS) {
    await seedBoth(worldId, 'raza', raza.slug);
  }

  console.log(`  Personajes jugables (${BERIG_PERSONAJES.length})...`);
  for (const personaje of BERIG_PERSONAJES) {
    await seedBoth(worldId, 'personaje', personaje.slug);
  }

  console.log(`  Lugares (${locations.length})...`);
  for (const location of locations) {
    await seedBoth(worldId, 'location', location.slug);
  }

  console.log(`  Construcciones (${CONSTRUCTION_RECIPES.length})...`);
  for (const recipe of CONSTRUCTION_RECIPES) {
    await seedBoth(worldId, 'construccion', recipe.key);
  }

  const classUnlocks = allClassAbilityUnlocks();
  const startingAbilities = startingAbilitiesFor('Gorhorn');
  console.log(`  Habilidades (${classUnlocks.length + startingAbilities.length})...`);
  for (const ability of startingAbilities) {
    await seedBoth(worldId, 'ability', slugify(ability.name));
  }
  for (const { ability } of classUnlocks) {
    await seedBoth(worldId, 'ability', slugify(ability.name));
  }

  console.log('Listo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
