/// Cerebras, Mistral y SambaNova exponen la misma forma de API que OpenAI (`/chat/completions`,
/// `messages`, Bearer token) — un único helper evita triplicar el mismo fetch tres veces (ver
/// cerebrasClient.ts/mistralClient.ts/sambanovaClient.ts, que solo cambian baseUrl/modelo/clave).
export async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  providerLabel: string,
): Promise<string> {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  const bodyText = await response.text();
  if (response.status === 429) {
    throw new Error(`[${providerLabel}] Rate limit alcanzado (HTTP 429)`);
  }
  if (!response.ok) {
    throw new Error(`[${providerLabel}] HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const json = JSON.parse(bodyText) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = json.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error(`[${providerLabel}] Respuesta sin contenido: ${bodyText.slice(0, 300)}`);
  }
  if (choice.finish_reason === 'length') {
    throw new Error(`[${providerLabel}] Respuesta cortada por límite de tokens (finish_reason=length)`);
  }
  return choice.message.content;
}
