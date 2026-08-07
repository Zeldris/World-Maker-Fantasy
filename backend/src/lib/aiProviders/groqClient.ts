import { env } from '../../config/env.js';
import type { AiClient } from './aiClient.js';
import { callOpenAiCompatible } from './openAiCompatibleClient.js';

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const groqClient: AiClient = {
  disponible: () => env.groqApiKey.length > 0,
  getModelId: () => `groq:${env.groqModel}`,
  complete(systemPrompt, userContent, maxTokens) {
    return callOpenAiCompatible(BASE_URL, env.groqApiKey, env.groqModel, systemPrompt, userContent, maxTokens, 'GROQ');
  },
};
