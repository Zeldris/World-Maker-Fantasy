import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';

/// Cloudflare Workers AI no es OpenAI-compatible en la ruta (cuelga del account id) ni en la
/// respuesta (`result.response` en vez de `choices[0].message.content`) — cliente aparte en vez
/// de reutilizar openAiCompatibleClient.ts.
export const cloudflareClient: AiClient = {
  disponible: () => env.cloudflareApiKey.length > 0 && env.cloudflareAccountId.length > 0,
  getModelId: () => `cloudflare:${env.cloudflareModel}`,
  async complete(systemPrompt, userContent, maxTokens) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${env.cloudflareModel}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.cloudflareApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
      }),
    });

    const bodyText = await response.text();
    if (response.status === 429) {
      throw new Error('[CLOUDFLARE] Rate limit alcanzado (HTTP 429)');
    }
    if (!response.ok) {
      throw new Error(`[CLOUDFLARE] HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
    }

    const json = JSON.parse(bodyText) as { success?: boolean; result?: { response?: string }; errors?: unknown[] };
    if (!json.success || !json.result?.response) {
      throw new Error(`[CLOUDFLARE] Respuesta sin contenido: ${bodyText.slice(0, 300)}`);
    }
    return json.result.response;
  },
};
