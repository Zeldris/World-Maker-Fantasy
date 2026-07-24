/// Extractor incremental del campo "narration" dentro de un JSON todavía a medio generar
/// (roadmap de velocidad, 2026-07-20, punto 13 — streaming). `narrateAction` pide salida
/// estructurada (`format`) porque el backend necesita "newItem"/"hito"/"combateIniciado"/etc.,
/// no solo prosa — pero eso significa que lo que Ollama transmite token a token es el JSON
/// entero, no texto narrable directamente. Medido en vivo contra el modelo real (2026-07-20):
/// con "narration" como PRIMERA propiedad del schema, el motor de gramática de Ollama genera
/// siempre `{"narration": "..."` como prefijo, en ese orden — así que se puede extraer el
/// valor de esa cadena JSON según va llegando, sin esperar a que el objeto entero esté completo.
///
/// Puro y sin estado propio: recibe TODO el texto crudo acumulado hasta ahora (no solo el
/// delta) y devuelve el valor ya decodificado (escapes JSON resueltos) más si la cadena ya se
/// cerró. Re-derivar desde cero en cada chunk es O(n) sobre un texto de ~cientos de caracteres
/// — trivial en coste, y evita tener que mantener estado de escape a medio resolver entre llamadas.
export function extractStreamingNarration(rawText: string): { value: string; closed: boolean } {
  const keyIdx = rawText.indexOf('"narration"');
  if (keyIdx === -1) return { value: '', closed: false };

  const colonIdx = rawText.indexOf(':', keyIdx);
  if (colonIdx === -1) return { value: '', closed: false };

  let i = colonIdx + 1;
  while (i < rawText.length && /\s/.test(rawText[i])) i++;
  if (i >= rawText.length || rawText[i] !== '"') return { value: '', closed: false };
  i++; // primer carácter tras la comilla de apertura

  const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
  let value = '';
  while (i < rawText.length) {
    const ch = rawText[i];
    if (ch === '"') return { value, closed: true };
    if (ch === '\\') {
      const next = rawText[i + 1];
      if (next === undefined) break; // escape cortado a mitad de chunk — esperar más datos
      if (next === 'u') {
        const hex = rawText.slice(i + 2, i + 6);
        if (hex.length < 4) break; // \uXXXX incompleto todavía
        value += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      value += ESCAPES[next] ?? next;
      i += 2;
      continue;
    }
    value += ch;
    i++;
  }
  return { value, closed: false };
}
