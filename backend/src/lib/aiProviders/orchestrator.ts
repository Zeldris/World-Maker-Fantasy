import { ollamaGenerate } from '../ollama.js';
import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';
import { cerebrasClient } from './cerebrasClient.js';
import { mistralClient } from './mistralClient.js';
import { sambanovaClient } from './sambanovaClient.js';
import { cloudflareClient } from './cloudflareClient.js';
import { geminiClient } from './geminiClient.js';
import { groqClient } from './groqClient.js';

/// Rotación con failover entre proveedores cloud gratuitos, mismo patrón que AiOrchestrator.java
/// de VeriNews_AI: orden de preferencia fijo, el que no tenga clave se salta (`disponible()`), y
/// si uno falla (rate limit, error 5xx, red) se reintenta con el siguiente antes de rendirse. Sin
/// round-robin real entre llamadas (a diferencia de VeriNews): este orquestador solo se usa desde
/// un script de siembra por lotes, no hay tráfico concurrente que repartir — siempre empieza por
/// el primero disponible, más simple y suficiente para este caso de uso.
///
/// Si todos los proveedores cloud fallan o ninguno tiene clave configurada, cae a Ollama local
/// (qwen2.5:1.5b-instruct, el mismo modelo "cronista" que ya usa el resto del proyecto) — la
/// generación de prompts de imagen nunca depende de tener claves cloud configuradas.
// Gemini/Groq añadidos al final (2026-08-07, petición explícita de ampliar la rotación) — se
// mantiene el orden ya validado de los 4 primeros sin tocar el comportamiento existente.
const CLOUD_ROTATION: AiClient[] = [cerebrasClient, mistralClient, sambanovaClient, cloudflareClient, geminiClient, groqClient];

export interface PromptCompletion {
  text: string;
  provider: string;
}

export async function completeWithFallback(systemPrompt: string, userContent: string, maxTokens: number): Promise<PromptCompletion> {
  const disponibles = CLOUD_ROTATION.filter((c) => c.disponible());
  const erroresPrevios: string[] = [];

  for (const cliente of disponibles) {
    try {
      const text = await cliente.complete(systemPrompt, userContent, maxTokens);
      return { text: text.trim(), provider: cliente.getModelId() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      erroresPrevios.push(msg);
      console.warn(`[AI-PROMPTS] ${cliente.getModelId()} falló, probando siguiente proveedor: ${msg}`);
    }
  }

  if (disponibles.length === 0) {
    console.warn('[AI-PROMPTS] Ningún proveedor cloud tiene API key configurada — usando Ollama local.');
  } else {
    console.warn(`[AI-PROMPTS] Los ${disponibles.length} proveedores cloud disponibles fallaron — usando Ollama local.`);
  }

  const result = await ollamaGenerate({
    model: env.ollamaModelCronista,
    system: systemPrompt,
    prompt: userContent,
    maxTokens,
    timeoutMs: 60_000,
    tarea: 'prompts_imagen',
  });
  return { text: result.text.trim(), provider: `ollama:${env.ollamaModelCronista}` };
}

/// Hermana de completeWithFallback (2026-08-07, plan "IA local propia") para el script de
/// destilación (generate-distillation-dataset.ts): reutiliza el MISMO orden de CLOUD_ROTATION
/// (fuente única de verdad, para que ambas funciones nunca se desincronicen si algún día se
/// retoca ese orden) pero NUNCA cae al Ollama local — aceptar una respuesta del modelo pequeño
/// como material de entrenamiento arruinaría el propósito de destilar desde un profesor mejor.
/// Devuelve null si ningún proveedor cloud está configurado o todos fallan para esta llamada
/// (rate limit, cuota agotada, red) — el llamador decide si descarta el ejemplo o reintenta.
export async function completeCloudOnly(systemPrompt: string, userContent: string, maxTokens: number): Promise<PromptCompletion | null> {
  const disponibles = CLOUD_ROTATION.filter((c) => c.disponible());

  for (const cliente of disponibles) {
    try {
      const text = await cliente.complete(systemPrompt, userContent, maxTokens);
      return { text: text.trim(), provider: cliente.getModelId() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DISTILLATION] ${cliente.getModelId()} falló, probando siguiente proveedor: ${msg}`);
    }
  }

  return null;
}
