/// Cuántas acciones de la jugadora (fuera de combate) cierran un capítulo de la historia. Espejo de
/// `TURNS_PER_CHAPTER` en `backend/src/services/chapterSummary.ts`: si cambia allí, cambia aquí (solo es el texto).
export const ACCIONES_POR_CAPITULO = 15

/// Etiqueta con la que el backend marca el hito de cierre de capítulo (`HITO_LABEL.capitulo`, progression.ts).
const ETIQUETA_CAPITULO = 'Capítulo completado'

/// P306/P307 (decidido por la usuaria, 2026-10-26): la tarjeta «Capítulo completado» no se leía como lo que es (el
/// cierre automático de un capítulo cada N acciones) sino como un premio por la última acción. Devuelve la frase que
/// la explica, o null si el hito no necesita explicación.
export function notaDeHito(etiqueta: string | null | undefined): string | null {
  if (etiqueta !== ETIQUETA_CAPITULO) return null
  return `Cada ${ACCIONES_POR_CAPITULO} acciones se cierra un capítulo de la historia y se resume; no es un premio por esta última acción.`
}
