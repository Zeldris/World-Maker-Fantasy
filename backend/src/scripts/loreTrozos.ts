import { CONFIG_RAG_POR_DEFECTO } from '../lib/ragConfig.js';

/// QA-167 (`/opt-ai`, 2026-10-20, peldaño 1 de la escalera del RAG): los fragmentos de `loreChunks.ts` llegan a 1.600
/// caracteres y mezclan varios temas (el de los Maktor cuenta dos guerras), así que su embedding queda lejos de una
/// pregunta concreta. Cada fragmento se indexa en trozos de ~400 caracteres cortados por frases, cada uno con el
/// título delante; la fila guarda el texto entero y `retrieveLore` se queda con el mejor trozo de cada título.
/// Medido con `rag-casos.jsonl` (16 casos): recall@4 0,750 → 0,875; con 250 sale igual y con 600, 0,812.
export const TAM_TROZO = CONFIG_RAG_POR_DEFECTO.tamTrozo;

/// `solape` (`QA-330`): cada trozo empieza repitiendo las últimas frases del anterior que quepan en esos caracteres
/// (nunca el trozo entero). Con 0, como siempre.
export function trozosParaIndexar(text: string, tam = TAM_TROZO, solape = 0): string[] {
  const unir = (frases: string[]) => frases.join(' ').trim();
  const trozos: string[] = [];
  let actual: string[] = [];
  for (const frase of text.split(/(?<=[.!?])\s+/)) {
    const hecho = unir(actual);
    if (hecho && hecho.length + frase.length > tam) {
      trozos.push(hecho);
      actual = [...arrastre(actual, solape), frase];
    } else {
      actual.push(frase);
    }
  }
  if (unir(actual)) trozos.push(unir(actual));
  return trozos;
}

/// Últimas frases de un trozo que caben en `solape` caracteres, sin llegar a ser el trozo entero.
function arrastre(frases: string[], solape: number): string[] {
  const elegidas: string[] = [];
  for (let i = frases.length - 1; i > 0; i--) {
    if (unirLargo([frases[i], ...elegidas]) > solape) break;
    elegidas.unshift(frases[i]);
  }
  return elegidas;
}

const unirLargo = (frases: string[]) => frases.join(' ').trim().length;
