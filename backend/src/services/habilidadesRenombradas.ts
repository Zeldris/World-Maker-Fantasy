/// P100 (QA-27): habilidades renombradas en el catálogo (nombre viejo → nuevo). Las partidas las
/// identifican por nombre, así que todo lo que compara nombres pasa por aquí.
export const HABILIDADES_RENOMBRADAS: Readonly<Record<string, string>> = { 'Analisis Salvaje': 'Análisis Salvaje' };

export function nombreActualDeHabilidad(nombre: string): string {
  return HABILIDADES_RENOMBRADAS[nombre] ?? nombre;
}
