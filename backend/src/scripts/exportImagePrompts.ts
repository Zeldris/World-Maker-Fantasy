import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { loreContextFor } from '../services/imagePromptContext.js';
import type { ImagePromptEntityType, ImagePromptSizeProfile } from '../services/imagePromptGenerator.js';

/// Vuelca todos los prompts de imagen ya generados (tabla ImagePrompt, ver checklist 2026-07-21/22
/// punto 7) a un archivo de texto legible — título (nombre real de la entrada) + un bloque por
/// perfil de talla (thumbnail/banner) que ya tenga prompt, agrupado por tipo. La base de datos
/// sigue siendo la fuente de verdad; esto es solo una exportación de lectura para copiar/pegar en
/// un generador de imágenes externo.
/// Uso: npm run export-image-prompts

const WORLD_SLUG = 'helek-sirik';
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../../output/image-prompts.md');

const SECTION_LABEL: Record<ImagePromptEntityType, string> = {
  npc: 'NPCs',
  item: 'Objetos',
  fauna: 'Fauna y flora',
  ability: 'Habilidades',
  raza: 'Razas',
  personaje: 'Personajes jugables',
  location: 'Lugares',
  construccion: 'Construcciones',
  faction: 'Facciones',
  historia: 'Historia',
  crafteo: 'Crafteo',
  zona: 'Zonas navegables',
};

const SIZE_PROFILE_LABEL: Record<ImagePromptSizeProfile, string> = {
  thumbnail: 'Miniatura (icono cuadrado, cuadrícula)',
  banner: 'Banner (detalle, formato ancho)',
  mapa: 'Mapa de zona (vista aérea navegable, 800x600)',
};

async function main() {
  const world = await prisma.world.findUnique({ where: { slug: WORLD_SLUG } });
  if (!world) {
    throw new Error(`No existe el mundo "${WORLD_SLUG}".`);
  }

  const prompts = await prisma.imagePrompt.findMany({ where: { worldId: world.id } });
  if (prompts.length === 0) {
    console.log('Todavía no hay ningún prompt generado — genera alguno primero (Enciclopedia → "Generar prompt de imagen", o npm run seed-image-prompts).');
    return;
  }

  interface Entry {
    title: string;
    entitySlug: string;
    variants: { sizeProfile: ImagePromptSizeProfile; prompt: string; provider: string }[];
  }
  const byType = new Map<ImagePromptEntityType, Map<string, Entry>>();

  for (const row of prompts) {
    const entityType = row.entityType as ImagePromptEntityType;
    const sizeProfile = row.sizeProfile as ImagePromptSizeProfile;
    const subject = await loreContextFor(world.id, entityType, row.entitySlug);
    const title = subject?.name ?? row.entitySlug;

    const entriesByType = byType.get(entityType) ?? new Map<string, Entry>();
    const entry = entriesByType.get(row.entitySlug) ?? { title, entitySlug: row.entitySlug, variants: [] };
    entry.variants.push({ sizeProfile, prompt: row.prompt, provider: row.provider });
    entriesByType.set(row.entitySlug, entry);
    byType.set(entityType, entriesByType);
  }

  const sections = (Object.keys(SECTION_LABEL) as ImagePromptEntityType[])
    .filter((type) => byType.has(type))
    .map((type) => {
      const entries = [...(byType.get(type)?.values() ?? [])].sort((a, b) => a.title.localeCompare(b.title));
      const body = entries
        .map((e) => {
          const variantsBlock = [...e.variants]
            .sort((a, b) => a.sizeProfile.localeCompare(b.sizeProfile))
            .map(
              (v) =>
                // Nombre de archivo real (checklist 2026-07-21/22, subida manual de imágenes):
                // guarda el resultado como uploads/images/<tipo>/<este-nombre>, servido por
                // @fastify/static (ver lib/imageAssets.ts) — mismo entitySlug que ya usa
                // ImagePrompt, así que no hace falta calcularlo a mano por entrada.
                `**${SIZE_PROFILE_LABEL[v.sizeProfile]}** — guardar como \`uploads/images/${type}/${e.entitySlug}-${v.sizeProfile}.png\`\n${v.prompt}\n\n*Proveedor: ${v.provider}*`,
            )
            .join('\n\n');
          return `### ${e.title}\n\n${variantsBlock}`;
        })
        .join('\n\n');
      return `## ${SECTION_LABEL[type]}\n\n${body}`;
    });

  const content = `# Prompts de imagen — ${world.name}\n\nGenerado: ${new Date().toISOString()}\n\n${sections.join('\n\n---\n\n')}\n`;

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, content, 'utf-8');
  console.log(`${prompts.length} prompts exportados (${sections.length} categorías) a ${OUTPUT_PATH}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
