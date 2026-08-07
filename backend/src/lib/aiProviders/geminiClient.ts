import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/// Gemini (2026-08-07) — a diferencia de Cerebras/Mistral/SambaNova, su API no es OpenAI-compatible
/// (formato `generateContent` propio de Google: `system_instruction`/`contents`/`generationConfig`,
/// clave por query param en vez de Authorization Bearer), así que no puede reutilizar
/// callOpenAiCompatible — implementación propia, mismo contrato AiClient que el resto.
export const geminiClient: AiClient = {
  disponible: () => env.geminiApiKey.length > 0,
  getModelId: () => `gemini:${env.geminiModel}`,
  async complete(systemPrompt, userContent, maxTokens) {
    // Los modelos "flash" recientes de Gemini razonan internamente antes de responder (mismo
    // hallazgo que gpt-oss-120b en cerebrasClient.ts) — gastan buena parte del presupuesto de
    // tokens en un rastro de pensamiento invisible antes del texto final. Probado en vivo que
    // `generationConfig.thinkingConfig.thinkingBudget: 0` no está soportado en este modelo
    // (HTTP 400), así que se aplica la misma mitigación que ya usa Cerebras: presupuesto efectivo
    // mayor en vez de intentar desactivar el razonamiento.
    const maxTokensEfectivo = Math.max(maxTokens * 2, 1500);
    const url = `${BASE_URL}/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: maxTokensEfectivo, temperature: 0.7 },
      }),
    });

    const bodyText = await response.text();
    if (response.status === 429) {
      throw new Error('[GEMINI] Rate limit alcanzado (HTTP 429)');
    }
    if (!response.ok) {
      throw new Error(`[GEMINI] HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
    }

    const json = JSON.parse(bodyText) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`[GEMINI] Respuesta sin contenido: ${bodyText.slice(0, 300)}`);
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('[GEMINI] Respuesta cortada por límite de tokens (finishReason=MAX_TOKENS)');
    }
    return text;
  },
};
