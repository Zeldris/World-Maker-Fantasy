import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildNarrationPrompt } from '../services/narrador.js';

/// Fuente única del texto SYSTEM del Modelfile (2026-08-11, captura en vivo de pares DPO) —
/// antes vivía duplicado como función privada de generate-distillation-dataset.ts; se extrae aquí
/// para que el generador sintético y el servicio de captura en vivo (liveTeacherCapture.ts) lean
/// EXACTAMENTE el mismo texto, en vez de arriesgarse a que una tercera copia se desincronice del
/// Modelfile real si alguien lo edita.
export function readModelfileSystemPrompt(): string {
  const modelfilePath = path.resolve(import.meta.dirname, '../../Modelfile');
  const content = readFileSync(modelfilePath, 'utf-8');
  const match = content.match(/SYSTEM\s+"""([\s\S]*?)"""/);
  if (!match) throw new Error('[modelfileSystemPrompt] no se pudo extraer el bloque SYSTEM de backend/Modelfile');
  return match[1].trim();
}

/// Envoltorio de instrucción de formato que ya usaba generate-distillation-dataset.ts
/// (`buildTeacherMessages`) — los proveedores cloud no tienen JSON forzado por gramática como
/// Ollama (`format` real), así que hace falta pedírselo explícitamente en el propio texto, con el
/// JSON Schema completo incluido. Misma función, ahora recibe el `ctx` real de `buildNarrationPrompt`
/// directamente en vez de exigir un `DistillationScenario` — el servicio de captura en vivo nunca
/// tiene uno de esos, solo el `ctx` real del turno.
export function buildTeacherUserContent(ctx: Parameters<typeof buildNarrationPrompt>[0]): string {
  const { prompt, format } = buildNarrationPrompt(ctx);
  return `${prompt}

Responde SOLO con un JSON válido, sin texto fuera del JSON, que cumpla EXACTAMENTE este JSON Schema — los campos con "enum" solo pueden tomar uno de esos valores exactos, nunca otro distinto ni inventado:
${JSON.stringify(format, null, 2)}`;
}
