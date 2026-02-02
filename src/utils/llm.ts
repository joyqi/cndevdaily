import { ChatOpenAI } from '@langchain/openai';

export function createLLM(temperature: number = 0.7): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.OPENAI_API_MODEL || 'gpt-4o-mini',
    temperature,
    configuration: {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    }
  });
}
