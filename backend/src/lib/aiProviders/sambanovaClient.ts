import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';
import { callOpenAiCompatible } from './openAiCompatibleClient.js';

const BASE_URL = 'https://api.sambanova.ai/v1/chat/completions';

export const sambanovaClient: AiClient = {
  disponible: () => env.sambanovaApiKey.length > 0,
  getModelId: () => `sambanova:${env.sambanovaModel}`,
  complete(systemPrompt, userContent, maxTokens) {
    return callOpenAiCompatible(BASE_URL, env.sambanovaApiKey, env.sambanovaModel, systemPrompt, userContent, maxTokens, 'SAMBANOVA');
  },
};
