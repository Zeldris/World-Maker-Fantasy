import type { Prisma, PrismaClient } from '@prisma/client';

/// P100 (QA-27): habilidades renombradas en el catálogo (nombre viejo → nuevo). Las partidas las
/// identifican por nombre, así que todo lo que compara nombres pasa por aquí.
export const HABILIDADES_RENOMBRADAS: Readonly<Record<string, string>> = { 'Analisis Salvaje': 'Análisis Salvaje' };

/// QA-240: renombres que dependen de la clase — habilidades que se repetían entre clases (o dentro de
/// la misma: el Asesino Selecto tenía dos «Golpe Certero»). Cada entrada vale para su clase y, si la
/// lleva, solo para esa especialización. `descripcion`, la del catálogo: distingue la fila de
/// `SavedAction` cuando una partida tiene dos con el mismo nombre viejo; donde solo se guarda el
/// nombre (barras, activas), gana la entrada sin `descripcion`.
interface RenombrePorClase { clase: string; especializacion?: string; viejo: string; nuevo: string; descripcion?: string }
export const HABILIDADES_RENOMBRADAS_POR_CLASE: readonly RenombrePorClase[] = [
  { clase: 'ASESINO', viejo: 'Golpe Certero', nuevo: 'Golpe Oportuno' },
  { clase: 'ASESINO', especializacion: 'ASESINO_SELECTO', viejo: 'Golpe Certero', nuevo: 'Golpe a la Marca', descripcion: 'Un golpe directo al objetivo marcado, sin desperdiciar ni un movimiento.' },
  { clase: 'CAZADOR', especializacion: 'INSTINTIVO', viejo: 'Instinto Asesino', nuevo: 'Reflejo Primario' },
  { clase: 'DRUIDA', especializacion: 'SALVAJE', viejo: 'Instinto Asesino', nuevo: 'Arrebato Salvaje' },
  { clase: 'GUERRERO', especializacion: 'ESPECIALISTA', viejo: 'Golpe Adaptado', nuevo: 'Golpe Llano' },
  { clase: 'CAZADOR', especializacion: 'TIRADOR', viejo: 'Tiro Inmovilizador', nuevo: 'Tiro a la Pata' },
  { clase: 'CAZADOR', especializacion: 'TIRADOR', viejo: 'Tiro Múltiple', nuevo: 'Tiro Pasante' },
  { clase: 'ARQUERO', especializacion: 'MAESTRO_BALLESTERO', viejo: 'Postura de Tirador', nuevo: 'Postura de Ballestero' },
];

/// La clase y la especialización de la partida, para los renombres por clase.
export interface ContextoDeClase { clase: string | null; especializacion: string | null }

function renombresDe(ctx: ContextoDeClase | undefined): RenombrePorClase[] {
  if (!ctx?.clase) return [];
  return HABILIDADES_RENOMBRADAS_POR_CLASE.filter((r) => r.clase === ctx.clase && (!r.especializacion || r.especializacion === ctx.especializacion));
}

export function nombreActualDeHabilidad(nombre: string, ctx?: ContextoDeClase, descripcion?: string): string {
  const global = HABILIDADES_RENOMBRADAS[nombre];
  if (global) return global;
  const candidatos = renombresDe(ctx).filter((r) => r.viejo === nombre);
  const elegido = candidatos.find((r) => descripcion !== undefined && r.descripcion === descripcion) ?? candidatos.find((r) => !r.descripcion);
  return elegido?.nuevo ?? nombre;
}

/// QA-68: los campos que guardan el nombre de una habilidad. En el esquema llevan la marca
/// «Guarda nombres de habilidad (QA-68)» justo encima; `habilidadesRenombradas.test.ts` exige que
/// las marcas y esta lista coincidan, y `RENOMBRAR` (abajo) exige una función por campo, así que un
/// campo nuevo no se puede quedar sin renombrar.
export const CAMPOS_CON_NOMBRE_DE_HABILIDAD = ['SavedAction.name', 'Save.activeCombatAbilityNames', 'SkillBar.abilityNames', 'NpcState.abilityUsesThisEncounter'] as const;

type Db = PrismaClient | Prisma.TransactionClient;

/// Una función por campo: renombra lo de esta partida y dice si cambió algo. `viejos`: los nombres
/// que se renombran en esta partida (los globales y los de su clase).
const RENOMBRAR: Record<(typeof CAMPOS_CON_NOMBRE_DE_HABILIDAD)[number], (db: Db, saveId: string, ctx: ContextoDeClase, viejos: string[]) => Promise<boolean>> = {
  'SavedAction.name': async (db, saveId, ctx, viejos) => {
    const filas = await db.savedAction.findMany({ where: { saveId, name: { in: viejos } }, select: { id: true, name: true, description: true } });
    for (const f of filas) await db.savedAction.update({ where: { id: f.id }, data: { name: nombreActualDeHabilidad(f.name, ctx, f.description) } });
    return filas.length > 0;
  },
  'Save.activeCombatAbilityNames': async (db, saveId, ctx, viejos) => {
    const save = await db.save.findFirst({ where: { id: saveId, activeCombatAbilityNames: { hasSome: viejos } }, select: { activeCombatAbilityNames: true } });
    if (save) await db.save.update({ where: { id: saveId }, data: { activeCombatAbilityNames: save.activeCombatAbilityNames.map((n) => nombreActualDeHabilidad(n, ctx)) } });
    return !!save;
  },
  'SkillBar.abilityNames': async (db, saveId, ctx, viejos) => {
    const barras = await db.skillBar.findMany({ where: { saveId, abilityNames: { hasSome: viejos } }, select: { id: true, abilityNames: true } });
    for (const b of barras) await db.skillBar.update({ where: { id: b.id }, data: { abilityNames: b.abilityNames.map((n) => nombreActualDeHabilidad(n, ctx)) } });
    return barras.length > 0;
  },
  // Contador de usos por combate: `nombre de habilidad → veces usada`, también las de la jugadora.
  // Con la clase de la partida, aunque la fila sea de un NPC de otra clase: el contador se reinicia
  // en cada combate, así que un nombre mal casado solo cambia ese combate.
  'NpcState.abilityUsesThisEncounter': async (db, saveId, ctx, viejos) => {
    const filas = await db.$queryRaw<{ id: string; usos: Record<string, number> }[]>`
      SELECT id, "abilityUsesThisEncounter" AS usos FROM "NpcState"
      WHERE "saveId" = ${saveId} AND "abilityUsesThisEncounter" ?| ${viejos}::text[]`;
    for (const f of filas) {
      const usos: Record<string, number> = {};
      for (const [nombre, veces] of Object.entries(f.usos)) {
        const actual = nombreActualDeHabilidad(nombre, ctx);
        usos[actual] = (usos[actual] ?? 0) + veces;
      }
      await db.npcState.update({ where: { id: f.id }, data: { abilityUsesThisEncounter: usos } });
    }
    return filas.length > 0;
  },
};

/// Aplica los renombres en todos los campos de la partida (al cargarla, `detail.ts`). Devuelve si
/// cambió algo, para releer lo que haga falta.
export async function renombrarHabilidadesDePartida(db: Db, saveId: string): Promise<boolean> {
  const save = await db.save.findUnique({ where: { id: saveId }, select: { clase: true, especializacion: true } });
  const ctx: ContextoDeClase = { clase: save?.clase ?? null, especializacion: save?.especializacion ?? null };
  const viejos = [...new Set([...Object.keys(HABILIDADES_RENOMBRADAS), ...renombresDe(ctx).map((r) => r.viejo)])];
  let cambio = false;
  for (const campo of CAMPOS_CON_NOMBRE_DE_HABILIDAD) cambio = (await RENOMBRAR[campo](db, saveId, ctx, viejos)) || cambio;
  return cambio;
}
