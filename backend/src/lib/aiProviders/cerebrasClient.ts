import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';
import { callOpenAiCompatible } from './openAiCompatibleClient.js';

const BASE_URL = 'https://api.cerebras.ai/v1/chat/completions';

export const cerebrasClient: AiClient = {
  disponible: () => env.cerebrasApiKey.length > 0,
  getModelId: () => `cerebras:${env.cerebrasModel}`,
  async complete(systemPrompt, userContent, maxTokens) {
    // gpt-oss-120b es un modelo "razonador" (mismo hallazgo que en VeriNews_AI): gasta buena
    // parte del presupuesto de tokens en un rastro de pensamiento interno antes del texto final.
    const maxTokensEfectivo = Math.max(maxTokens * 2, 1500);
    return callOpenAiCompatible(BASE_URL, env.cerebrasApiKey, env.cerebrasModel, systemPrompt, userContent, maxTokensEfectivo, 'CEREBRAS');
  },
};
