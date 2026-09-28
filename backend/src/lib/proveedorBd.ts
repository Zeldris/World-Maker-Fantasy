/// Qué base de datos usa este proceso (2026-09-28, instalador de escritorio — ver
/// docs/02-migracion-postgres-a-sqlite.md del repo Instalador-WMF-Tarkor). Desarrollo sigue en
/// Postgres; el juego empaquetado usa un fichero SQLite local (`DATABASE_URL="file:..."`). Solo
/// tres sitios necesitan saberlo: los embeddings (pgvector no existe en SQLite, ver
/// `vectores.ts`), el candado de fila (`lockRowForUpdate`, SQLite no tiene `FOR UPDATE`) y las
/// transacciones (SQLite admite un solo escritor, ver `prisma.ts`). Todo lo demás es SQL genérico
/// que Prisma traduce igual para los dos.
export const esSqlite = (process.env.DATABASE_URL ?? '').startsWith('file:');
