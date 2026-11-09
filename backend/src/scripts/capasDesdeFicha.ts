import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/// IMG-54, paso 6: escribe en una ficha el bloque `capas` que redacta el modelo local, bajo la clave `capasIA`, para
/// compararlo con el escrito a mano (`python3 image-generator/scripts/capas.py <ficha> --bloque capasIA --hibrida`).
/// Toma de la ficha `canon` (lore, y el canon de la variante si hay), `nombre`, `tipo` y `region`; sin base de datos
/// ni RAG. Uso: npx tsx src/scripts/capasDesdeFicha.ts <ficha.json> [--variante macho]

const args = process.argv.slice(2);
const iv = args.indexOf('--variante');
const variante = iv >= 0 ? args[iv + 1] : undefined;
if (iv >= 0) args.splice(iv, 2);
const ruta = args[0];
if (!ruta) {
  console.error('Uso: npx tsx src/scripts/capasDesdeFicha.ts <ficha.json> [--variante x]');
  process.exit(2);
}

// `lib/ollama.ts` importa `config/env.ts`, que exige DATABASE_URL aunque aquí no se abra ninguna conexión.
process.env.DATABASE_URL ??= 'postgresql://sin-base-de-datos';
const { generarCapas, modeloImagePrompt } = await import('../services/imagePromptCapas.js').then(async (m) => ({
  ...m,
  ...(await import('../services/imagePromptGenerator.js')),
}));

const absoluta = path.resolve(ruta);
const crudo = readFileSync(absoluta, 'utf8');
const ficha = JSON.parse(crudo) as Record<string, any>;
const canonVariante = variante ? (ficha.variantes?.[variante]?.canon as string | undefined) : undefined;
const lore = [ficha.canon, canonVariante].filter(Boolean).join('\n');
if (!lore || !ficha.tipo || !ficha.nombre) {
  console.error('La ficha necesita «canon», «tipo» y «nombre»');
  process.exit(2);
}

const { capas, prompt } = await generarCapas(ficha.tipo, ficha.nombre, lore, { region: ficha.region });
const modelo = modeloImagePrompt();
ficha.capasIA = { notas: `IMG-54 paso 6: escrito por ${modelo}, ${new Date().toISOString().slice(0, 10)}`, ...capas };
writeFileSync(absoluta, `${JSON.stringify(ficha, null, 2)}\n`, 'utf8');
console.log(prompt);
console.log(`\ncapasIA escrito en ${absoluta}`);
