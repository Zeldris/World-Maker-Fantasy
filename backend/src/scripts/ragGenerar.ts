/// Lógica pura de `rag-generar-casos.ts` (`QA-331`, T3 del GVE): casos del RAG generados con un modelo local a
/// partir de los fragmentos de `loreChunks.ts`. Sin BD ni Ollama, para poder probarla.
///
/// Cada fragmento da 2-3 preguntas, cada una en pareja es/en con el mismo esperado (el título del fragmento). Las
/// preguntas que copian 4 palabras seguidas del fragmento o de su título se descartan: medirían el parecido de
/// texto, no la recuperación. Nada sale de partidas reales: solo del lore indexado.

import type { CasoRag } from './ragEval.js';

export interface FragmentoLore {
  title: string;
  text: string;
}

export interface PreguntaGenerada {
  es: string;
  en: string;
}

/// Versión del prompt: cambia si cambia el texto de `promptGeneracion`, y va al manifiesto.
export const VERSION_PROMPT = 1;

export const ESQUEMA_PREGUNTAS = {
  type: 'object',
  properties: {
    preguntas: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: { es: { type: 'string' }, en: { type: 'string' } },
        required: ['es', 'en'],
      },
    },
  },
  required: ['preguntas'],
} as const;

export function promptGeneracion(f: FragmentoLore): string {
  return [
    'Eres quien prepara un banco de pruebas para el buscador de lore de un juego de rol de fantasía.',
    'Lee el fragmento y escribe 2 o 3 preguntas distintas que un jugador haría en la partida y que este fragmento responde.',
    'Reglas:',
    '- Escribe como habla un jugador: corto, directo, a veces en primera persona («le pregunto al orco…», «busco…»).',
    '- NO copies frases del fragmento ni de su título: usa otras palabras. Nunca repitas 4 palabras seguidas del texto.',
    '- Puedes nombrar personas, lugares o clanes por su nombre propio.',
    '- Cada pregunta, en español (`es`) y su traducción natural al inglés (`en`), con los nombres propios sin traducir.',
    'Devuelve solo el JSON pedido.',
    '',
    `Título: ${f.title}`,
    `Fragmento: ${f.text}`,
  ].join('\n');
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabras = (s: string) => sinTildes(s.toLowerCase()).match(/[a-z0-9ñ]+/g) ?? [];

export function slug(s: string, max = 40): string {
  return palabras(s).join('-').slice(0, max).replace(/-+$/, '');
}

/// Si `pregunta` repite `n` palabras seguidas de alguno de los `textos` (sin mayúsculas ni tildes).
export function copiaDelTexto(pregunta: string, textos: string[], n = 4): boolean {
  const grupos = (ps: string[]) => ps.slice(0, Math.max(0, ps.length - n + 1)).map((_, i) => ps.slice(i, i + n).join(' '));
  const delTexto = new Set(textos.flatMap((t) => grupos(palabras(t))));
  return grupos(palabras(pregunta)).some((g) => delTexto.has(g));
}

/// Número en [0, 1) fijo para `semilla` + `clave` (FNV-1a de 32 bits).
export function azarFijo(semilla: number, clave: string): number {
  let h = 0x811c9dc5;
  for (const c of `${semilla}:${clave}`) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 2 ** 32;
}

export interface Descarte {
  title: string;
  pregunta: string;
  motivo: 'copia' | 'repetida' | 'vacia';
}

/// Parejas de casos (es + en) de un fragmento. `vistas` guarda las preguntas ya usadas, para no repetirlas.
export function parejasDelFragmento(
  f: FragmentoLore,
  preguntas: PreguntaGenerada[],
  vistas: Set<string>,
  origen: 'A' | 'B' = 'B',
): { casos: CasoRag[]; descartes: Descarte[] } {
  const casos: CasoRag[] = [];
  const descartes: Descarte[] = [];
  for (const p of preguntas) {
    const es = p.es?.trim() ?? '';
    const en = p.en?.trim() ?? '';
    const clave = palabras(es).join(' ');
    if (!es || !en) descartes.push({ title: f.title, pregunta: es || en, motivo: 'vacia' });
    else if (copiaDelTexto(es, [f.text, f.title]) || copiaDelTexto(en, [f.text, f.title]))
      descartes.push({ title: f.title, pregunta: es, motivo: 'copia' });
    else if (vistas.has(clave) || vistas.has(palabras(en).join(' ')))
      descartes.push({ title: f.title, pregunta: es, motivo: 'repetida' });
    else {
      vistas.add(clave);
      vistas.add(palabras(en).join(' '));
      const pair_id = `${origen.toLowerCase()}-${slug(f.title)}-${casos.length / 2 + 1}`;
      const base = { esperados: [f.title], origen, causa: null, debe_pasar: origen === 'A', pair_id };
      casos.push({ id: pair_id, lang: 'es', pregunta: es, ...base }, { id: `${pair_id}-en`, lang: 'en', pregunta: en, ...base });
    }
  }
  return { casos, descartes };
}

/// Reparte las parejas B: unas `nA` pasan a borrador A (la primera pareja de fragmentos elegidos al azar fijo),
/// y del resto, una fracción va a la reserva (lote aparte que no se mira al ajustar el RAG). Por pareja, nunca
/// partiendo una.
export function repartir(
  casos: CasoRag[],
  semilla: number,
  { nA = 0, fraccionReserva = 0.15 }: { nA?: number; fraccionReserva?: number } = {},
): { b: CasoRag[]; reserva: CasoRag[]; a: CasoRag[] } {
  const parejas = [...new Set(casos.map((c) => c.pair_id!))];
  const primeras = parejas.filter((p) => p.endsWith('-1'));
  const aElegidas = new Set(
    [...primeras].sort((x, y) => azarFijo(semilla, `a:${x}`) - azarFijo(semilla, `a:${y}`)).slice(0, nA),
  );
  const destino = (p: string) => (aElegidas.has(p) ? 'a' : azarFijo(semilla, p) < fraccionReserva ? 'reserva' : 'b');
  const a = casos
    .filter((c) => destino(c.pair_id!) === 'a')
    .map((c) => {
      const pair_id = `a-${c.pair_id!.slice(2)}`;
      return { ...c, id: c.lang === 'en' ? `${pair_id}-en` : pair_id, pair_id, origen: 'A', debe_pasar: true };
    });
  return {
    b: casos.filter((c) => destino(c.pair_id!) === 'b'),
    reserva: casos.filter((c) => destino(c.pair_id!) === 'reserva'),
    a,
  };
}

export const jsonl = (casos: CasoRag[]) => casos.map((c) => JSON.stringify(c)).join('\n') + (casos.length ? '\n' : '');
