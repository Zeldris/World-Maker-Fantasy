import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { convertirASqlite } from '../lib/schemaSqlite.js';

/// `npm run schema:sqlite` — regenera prisma/schema.sqlite.prisma desde schema.prisma (ver
/// comentario de `convertirASqlite`). Correr tras cualquier cambio de schema.prisma; el test
/// `schemaSqlite.test.ts` avisa si se olvida.
const dir = path.resolve(import.meta.dirname, '../../prisma');
const salida = convertirASqlite(readFileSync(path.join(dir, 'schema.prisma'), 'utf-8'));
writeFileSync(path.join(dir, 'schema.sqlite.prisma'), salida);
console.log('prisma/schema.sqlite.prisma regenerado.');
