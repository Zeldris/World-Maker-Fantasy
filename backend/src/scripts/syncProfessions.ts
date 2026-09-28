/// Copia backend/src/data/professions.ts (fuente única de slugs de oficio, H-10) a
/// frontend/src/data/professions.ts. El repo no comparte código backend<->frontend, así que se
/// genera; professionsSync.test.ts falla si el fichero del frontend diverge.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROFESSIONS_SOURCE = path.resolve(here, '../data/professions.ts');
export const PROFESSIONS_FRONTEND_COPY = path.resolve(here, '../../../frontend/src/data/professions.ts');
export const GENERATED_HEADER =
  '// GENERADO desde backend/src/data/professions.ts con `npm run sync-professions` (backend). NO editar aquí.\n';

export function expectedFrontendContent(): string {
  return GENERATED_HEADER + readFileSync(PROFESSIONS_SOURCE, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(PROFESSIONS_FRONTEND_COPY, expectedFrontendContent());
  console.log(`Escrito ${PROFESSIONS_FRONTEND_COPY}`);
}
