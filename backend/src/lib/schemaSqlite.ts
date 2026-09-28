/// Genera el schema de SQLite a partir de `prisma/schema.prisma` (2026-09-28, instalador de
/// escritorio). Decisión: UN solo modelo de datos fuente — el de Postgres, el de siempre — y el de
/// SQLite se deriva de él en el build, nunca se edita a mano. Así no se bifurca el modelo (un campo
/// nuevo en desarrollo llega solo al instalador) y `schemaSqlite.test.ts` falla si alguien cambia
/// `schema.prisma` sin regenerar (`npm run schema:sqlite`).
///
/// Solo tres diferencias reales entre los dos motores, todas mecánicas:
/// 1. `datasource`: provider `sqlite`, sin `directUrl` (eso es del pooler de Supabase).
/// 2. `Unsupported("vector(768)")` (pgvector) → `String` con el embedding en JSON. La similitud se
///    calcula en JS (`vectores.ts`): con cientos de filas por partida no hace falta índice.
/// 3. Listas escalares (`String[]`, `Enum[]`) → `Json`. Prisma no tiene listas escalares en SQLite,
///    pero un campo `Json` que guarda un array se lee y se escribe como el array de siempre, así que
///    el código que asigna o lee estos campos funciona sin cambios. Solo el operador `push` (propio
///    de listas) no existe en `Json` — ver `npcsRetiredForever` en turnResolution.ts/quests.ts.
/// Además se quita `previewFeatures = ["relationJoins"]`, que solo existe para Postgres/MySQL.
/// Valor por defecto de un campo `Json` en SQLite. Prisma 6.19 escribe `@default("{}")` de un
/// `Json` en SQLite como `DEFAULT {}` SIN comillas, y SQLite rechaza la tabla entera
/// ("unrecognized token: {") — visto al crear la base de datos con `db push`. `dbgenerated` hace
/// que Prisma copie el literal SQL tal cual, ya entrecomillado.
function defaultJsonSqlite(json: string): string {
  return `@default(dbgenerated(${JSON.stringify(`'${json.replaceAll("'", "''")}'`)}))`;
}

/// `@default([TERRESTRE])` → el mismo array como texto JSON.
function defaultLista(items: string): string {
  const valores = items
    .split(',')
    .map((v) => v.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
  return defaultJsonSqlite(JSON.stringify(valores));
}

export function convertirASqlite(schema: string): string {
  const enums = new Set([...schema.matchAll(/^enum\s+(\w+)/gm)].map((m) => m[1]));
  const escalares = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Decimal', 'BigInt', ...enums]);

  const sinDatasource = schema.replace(
    /datasource db \{[\s\S]*?\n\}/,
    'datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}',
  );

  const lineas = sinDatasource.split('\n').flatMap((linea) => {
    if (/^\s*previewFeatures\s*=\s*\["relationJoins"\]\s*$/.test(linea)) return [];
    const vector = linea.replace(/Unsupported\("vector\(768\)"\)\?/, 'String?');
    if (vector !== linea) return [vector];
    // Campo de modelo: `  nombre  Tipo[]  @atributos...`
    const campo = linea.match(/^(\s+\w+\s+)(\w+)\[\](.*)$/);
    if (campo && escalares.has(campo[2])) {
      const [, inicio, tipo, resto] = campo;
      // Se conserva el ancho de la columna de tipos para que el diff con el original se lea bien.
      const nuevoTipo = 'Json'.padEnd(tipo.length + 2);
      // En Postgres una lista escalar sin `@default` se puede omitir al crear (queda vacía); un
      // `Json` sin default sería obligatorio — visto en zonePoints.integration.test.ts creando un
      // `Location` sin `aliases`. Toda lista recibe `[]` por defecto para conservar ese contrato.
      const conDefault = /@default\(\[/.test(resto)
        ? resto.replace(/@default\(\[(.*?)\]\)/, (_, items: string) => defaultLista(items))
        : `${defaultLista('')} ${resto.trim()}`;
      return [`${inicio}${nuevoTipo}${conDefault}`.trimEnd()];
    }
    // Campos que ya eran `Json` con valor por defecto (p. ej. `@default("{}")`).
    const json = linea.match(/^(\s+\w+\s+Json\??\s+.*)@default\("((?:[^"\\]|\\.)*)"\)(.*)$/);
    if (json) {
      const [, antes, valor, despues] = json;
      return [`${antes}${defaultJsonSqlite(JSON.parse(`"${valor}"`))}${despues}`];
    }
    return [linea];
  });

  const cabecera = [
    '// GENERADO a partir de schema.prisma por `npm run schema:sqlite` — NO EDITAR A MANO.',
    '// Schema de SQLite para el juego empaquetado (instalador de escritorio); ver src/lib/schemaSqlite.ts.',
    '',
  ];
  return [...cabecera, ...lineas].join('\n');
}
