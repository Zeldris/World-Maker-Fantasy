/// P100 (QA-27): habilidades renombradas en el catálogo (nombre viejo → nuevo). Las partidas las
/// identifican por nombre, así que todo lo que compara nombres pasa por aquí.
///
/// QA-68: un renombre se aplica en TODOS los campos que guardan el nombre de una habilidad
/// (`detail.ts` los reescribe al cargar la partida). En el esquema llevan «por NOMBRE de
/// `SavedAction`»; `habilidadesRenombradas.test.ts` falla si aparece uno que no esté en esta lista.
export const CAMPOS_CON_NOMBRE_DE_HABILIDAD = ['SavedAction.name', 'Save.activeCombatAbilityNames', 'SkillBar.abilityNames'] as const;

export const HABILIDADES_RENOMBRADAS: Readonly<Record<string, string>> = { 'Analisis Salvaje': 'Análisis Salvaje' };

export function nombreActualDeHabilidad(nombre: string): string {
  return HABILIDADES_RENOMBRADAS[nombre] ?? nombre;
}
