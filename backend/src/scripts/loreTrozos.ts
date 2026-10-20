/// QA-167 (`/opt-ai`, 2026-10-20, peldaño 1 de la escalera del RAG): los fragmentos de `loreChunks.ts` llegan a 1.600
/// caracteres y mezclan varios temas (el de los Maktor cuenta dos guerras), así que su embedding queda lejos de una
/// pregunta concreta. Cada fragmento se indexa en trozos de ~400 caracteres cortados por frases, cada uno con el
/// título delante; la fila guarda el texto entero y `retrieveLore` se queda con el mejor trozo de cada título.
/// Medido con `rag-casos.jsonl` (16 casos): recall@4 0,750 → 0,875; con 250 sale igual y con 600, 0,812.
export const TAM_TROZO = 400;

export function trozosParaIndexar(text: string, tam = TAM_TROZO): string[] {
  const trozos: string[] = [];
  let actual = '';
  for (const frase of text.split(/(?<=[.!?])\s+/)) {
    if (actual && actual.length + frase.length > tam) {
      trozos.push(actual);
      actual = frase;
    } else {
      actual = `${actual} ${frase}`.trim();
    }
  }
  if (actual) trozos.push(actual);
  return trozos;
}
