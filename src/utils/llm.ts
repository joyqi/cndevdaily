import { ChatOpenAI } from '@langchain/openai';

/**
 * 创建 OpenAI 兼容客户端。
 * @param temperature 采样温度
 * @param model 可选，覆盖模型名；默认用 OPENAI_API_MODEL
 */
export function createLLM(temperature: number = 0.7, model?: string): ChatOpenAI {
  const modelName = model || process.env.OPENAI_API_MODEL || 'gpt-4o-mini';
  const client = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName,
    temperature,
    configuration: {
      baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    }
  });

  // Claude 系模型在部分代理上不接受采样参数（400: temperature/top_p is deprecated）。
  // ChatOpenAI 会给默认值（temperature=1、topP=1 等），这里显式置为 undefined 让请求体省略这些字段。
  if (/claude/i.test(modelName)) {
    const raw = client as unknown as {
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    };
    raw.temperature = undefined;
    raw.topP = undefined;
    raw.frequencyPenalty = undefined;
    raw.presencePenalty = undefined;
  }

  return client;
}

/**
 * 写作专用模型：用 OPENAI_API_MODEL_WRITER，未配置时回退到默认模型。
 * 写作质量决定观感，值得用当前最好的模型。
 */
export function createWriterLLM(temperature: number = 0.9): ChatOpenAI {
  return createLLM(temperature, process.env.OPENAI_API_MODEL_WRITER || process.env.OPENAI_API_MODEL);
}

/**
 * 评审（judge）专用模型：用 OPENAI_API_MODEL_JUDGE，未配置时回退到默认模型。
 * 评审讲求稳定和克制，用便宜可靠的 flash 级模型即可。
 */
export function createJudgeLLM(temperature: number = 0.3): ChatOpenAI {
  return createLLM(temperature, process.env.OPENAI_API_MODEL_JUDGE || process.env.OPENAI_API_MODEL);
}
