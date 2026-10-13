import type { Prisma, PrismaClient } from '@prisma/client';

/// P100 (QA-27): habilidades renombradas en el catálogo (nombre viejo → nuevo). Las partidas las
/// identifican por nombre, así que todo lo que compara nombres pasa por aquí.
export const HABILIDADES_RENOMBRADAS: Readonly<Record<string, string>> = { 'Analisis Salvaje': 'Análisis Salvaje' };

export function nombreActualDeHabilidad(nombre: string): string {
  return HABILIDADES_RENOMBRADAS[nombre] ?? nombre;
}

/// QA-68: los campos que guardan el nombre de una habilidad. En el esquema llevan la marca
/// «Guarda nombres de habilidad (QA-68)» justo encima; `habilidadesRenombradas.test.ts` exige que
/// las marcas y esta lista coincidan, y `RENOMBRAR` (abajo) exige una función por campo, así que un
/// campo nuevo no se puede quedar sin renombrar.
export const CAMPOS_CON_NOMBRE_DE_HABILIDAD = ['SavedAction.name', 'Save.activeCombatAbilityNames', 'SkillBar.abilityNames', 'NpcState.abilityUsesThisEncounter'] as const;

type Db = PrismaClient | Prisma.TransactionClient;
const VIEJOS = Object.keys(HABILIDADES_RENOMBRADAS);

/// Una función por campo: renombra lo de esta partida y dice si cambió algo.
const RENOMBRAR: Record<(typeof CAMPOS_CON_NOMBRE_DE_HABILIDAD)[number], (db: Db, saveId: string) => Promise<boolean>> = {
  'SavedAction.name': async (db, saveId) => {
    const filas = await db.savedAction.findMany({ where: { saveId, name: { in: VIEJOS } }, select: { id: true, name: true } });
    for (const f of filas) await db.savedAction.update({ where: { id: f.id }, data: { name: nombreActualDeHabilidad(f.name) } });
    return filas.length > 0;
  },
  'Save.activeCombatAbilityNames': async (db, saveId) => {
    const save = await db.save.findFirst({ where: { id: saveId, activeCombatAbilityNames: { hasSome: VIEJOS } }, select: { activeCombatAbilityNames: true } });
    if (save) await db.save.update({ where: { id: saveId }, data: { activeCombatAbilityNames: save.activeCombatAbilityNames.map(nombreActualDeHabilidad) } });
    return !!save;
  },
  'SkillBar.abilityNames': async (db, saveId) => {
    const barras = await db.skillBar.findMany({ where: { saveId, abilityNames: { hasSome: VIEJOS } }, select: { id: true, abilityNames: true } });
    for (const b of barras) await db.skillBar.update({ where: { id: b.id }, data: { abilityNames: b.abilityNames.map(nombreActualDeHabilidad) } });
    return barras.length > 0;
  },
  // Contador de usos por combate: `nombre de habilidad → veces usada`, también las de la jugadora.
  'NpcState.abilityUsesThisEncounter': async (db, saveId) => {
    const filas = await db.$queryRaw<{ id: string; usos: Record<string, number> }[]>`
      SELECT id, "abilityUsesThisEncounter" AS usos FROM "NpcState"
      WHERE "saveId" = ${saveId} AND "abilityUsesThisEncounter" ?| ${VIEJOS}::text[]`;
    for (const f of filas) {
      const usos: Record<string, number> = {};
      for (const [nombre, veces] of Object.entries(f.usos)) usos[nombreActualDeHabilidad(nombre)] = (usos[nombreActualDeHabilidad(nombre)] ?? 0) + veces;
      await db.npcState.update({ where: { id: f.id }, data: { abilityUsesThisEncounter: usos } });
    }
    return filas.length > 0;
  },
};

/// Aplica los renombres en todos los campos de la partida (al cargarla, `detail.ts`). Devuelve si
/// cambió algo, para releer lo que haga falta.
export async function renombrarHabilidadesDePartida(db: Db, saveId: string): Promise<boolean> {
  let cambio = false;
  for (const campo of CAMPOS_CON_NOMBRE_DE_HABILIDAD) cambio = (await RENOMBRAR[campo](db, saveId)) || cambio;
  return cambio;
}
