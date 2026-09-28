import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertirASqlite } from './schemaSqlite.js';

const prismaDir = path.resolve(import.meta.dirname, '../../prisma');

describe('convertirASqlite', () => {
  it('schema.sqlite.prisma está al día con schema.prisma (si falla: npm run schema:sqlite)', () => {
    const fuente = readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf-8');
    const generado = readFileSync(path.join(prismaDir, 'schema.sqlite.prisma'), 'utf-8');
    expect(generado).toBe(convertirASqlite(fuente));
  });

  it('cambia datasource, vectores y listas escalares; deja las relaciones', () => {
    const fuente = [
      'generator client {',
      '  provider        = "prisma-client-js"',
      '  previewFeatures = ["relationJoins"]',
      '}',
      '',
      'datasource db {',
      '  provider  = "postgresql"',
      '  url       = env("DATABASE_URL")',
      '  directUrl = env("DIRECT_URL")',
      '}',
      '',
      'enum Color {',
      '  ROJO',
      '}',
      '',
      'model A {',
      '  id        String   @id',
      '  tags      String[] @default([])',
      '  colores   Color[]  @default([ROJO])',
      '  hijos     B[]',
      '  alias     String[]',
      '  extra     Json     @default("{}")',
      '  embedding Unsupported("vector(768)")?',
      '}',
    ].join('\n');
    const r = convertirASqlite(fuente);
    expect(r).toContain('provider = "sqlite"');
    expect(r).not.toContain('directUrl');
    expect(r).not.toContain('relationJoins');
    expect(r).toMatch(/tags\s+Json\s+@default\(dbgenerated\("'\[\]'"\)\)/);
    expect(r).toContain(`@default(dbgenerated("'[\\"ROJO\\"]'"))`);
    expect(r).not.toContain(`'["ROJO"]'`);
    expect(r).toContain(`extra     Json     @default(dbgenerated("'{}'"))`);
    expect(r).toMatch(/hijos\s+B\[\]/);
    // Una lista sin default en Postgres se puede omitir al crear: en SQLite necesita `[]`.
    expect(r).toMatch(/alias\s+Json\s+@default\(dbgenerated\("'\[\]'"\)\)/);
    expect(r).toMatch(/embedding String\?/);
  });
});
