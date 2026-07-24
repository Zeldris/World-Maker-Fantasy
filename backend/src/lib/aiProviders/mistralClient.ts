import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';
import { callOpenAiCompatible } from './openAiCompatibleClient.js';

const BASE_URL = 'https://api.mistral.ai/v1/chat/completions';

export const mistralClient: AiClient = {
  disponible: () => env.mistralApiKey.length > 0,
  getModelId: () => `mistral:${env.mistralModel}`,
  complete(systemPrompt, userContent, maxTokens) {
    return callOpenAiCompatible(BASE_URL, env.mistralApiKey, env.mistralModel, systemPrompt, userContent, maxTokens, 'MISTRAL');
  },
};
