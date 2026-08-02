import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  Article,
  ArticleEvaluation,
  ArticleScores,
  ArticleWithContent,
  Persona,
} from '../types/index.js';

// 内容打分：基于真实正文，对候选文章做结构化评估
const evaluationSchema = z.object({
  novelty: z.number().min(0).max(10).describe('观点或技术是否新鲜，0-10'),
  practicality: z.number().min(0).max(10).describe('是否有可落地的经验、代码、数据或步骤，0-10'),
  depth: z.number().min(0).max(10).describe('是否讲清了原理，0-10'),
  relevance: z.number().min(0).max(10).describe('对中文开发者/国内技术生态的相关性，0-10'),
  aiRelevance: z
    .number()
    .min(0)
    .max(10)
    .describe('与 AI 方向的相关程度（AI 开发、LLM、机器学习、Agent、AI 工具链与基础设施、AI 应用等），0-10'),
  hook: z.string().describe('正文中最具体、最抓人的一个细节（数字/工具名/具体做法/一句原话），中文'),
  takeaway: z.string().describe('用一句中文说清楚这篇文章到底讲清了或证明了什么'),
});

const EVAL_SYSTEM = `你是一位资深中文技术编辑。请基于正文评估一篇英文技术文章对中文开发者的价值，用 0-10 打分（可以是小数）：
- novelty：观点或技术是否新鲜，是否老生常谈
- practicality：是否有可落地的经验、代码、数据或步骤
- depth：是否讲清了原理，而非浮于表面
- relevance：对中文开发者/国内技术生态的相关性
- aiRelevance：与 AI 方向的相关程度（AI 开发、LLM、机器学习、Agent、AI 工具链与基础设施、AI 应用等）。与 AI 明显相关打高分；与 AI 无关但质量很高的文章也可以给中等偏上的分数，但不要过高
另外：
- hook：从正文里摘出最具体、最抓人的一个细节（一个数字、一个工具名、一个具体做法或一句原话），这个细节将用于撰写推荐语
- takeaway：用一句中文说清楚这篇文章到底讲清了或证明了什么
只返回 JSON 对象（不要 Markdown、不要解释），格式遵循要求。`;

export const SCORE_WEIGHTS = {
  novelty: 0.2,
  practicality: 0.25,
  depth: 0.2,
  relevance: 0.2,
  aiRelevance: 0.15,
};

export async function evaluateArticle(
  model: BaseChatModel,
  article: ArticleWithContent
): Promise<ArticleEvaluation> {
  const content = article.content.slice(0, 4000);
  // 使用 jsonMode 结构化输出：兼容不支持 function calling 的思考型模型（如 deepseek-v4-flash）
  const result = await model
    .withStructuredOutput(evaluationSchema, { method: 'jsonMode' })
    .invoke([
      new SystemMessage(EVAL_SYSTEM),
      new HumanMessage(
        `标题：${article.title}\n来源：${article.source}\n作者：${article.author || '未知'}\n\n正文节选：\n${content}`
      ),
    ]);

  const scores: ArticleScores = {
    novelty: result.novelty,
    practicality: result.practicality,
    depth: result.depth,
    relevance: result.relevance,
    aiRelevance: result.aiRelevance,
    total:
      Math.round(
        (result.novelty * SCORE_WEIGHTS.novelty +
          result.practicality * SCORE_WEIGHTS.practicality +
          result.depth * SCORE_WEIGHTS.depth +
          result.relevance * SCORE_WEIGHTS.relevance +
          result.aiRelevance * SCORE_WEIGHTS.aiRelevance) *
          10
      ) / 10,
  };

  return { article, scores, hook: result.hook, takeaway: result.takeaway };
}

// 主编终选：从 Top 3 里挑出今天唯一值得推荐的一篇
const pickSchema = z.object({
  winnerIndex: z.number().int().min(1).max(3),
  reason: z.string().describe('为什么是它、今天为什么值得读，一句中文'),
});

const PICK_SYSTEM = `你是一位中文开发者新闻主编。下面是内容打分后的 Top 3 候选，请选出今天唯一值得推荐给中文开发者的一篇。
判断标准：价值密度最高、对读者最有实际帮助、在今天这个时间点最值得读。
你的偏好：在价值相当的情况下，稍微偏向 AI 方向的内容（AI 开发、LLM、Agent、AI 工具链等），但不要为了 AI 而牺牲文章本身的质量。
只返回 JSON 对象：winnerIndex（1-3）和一句 reason（为什么是它、今天为什么值得读，将用于撰写推荐语）。`;

export async function pickWinner(
  model: BaseChatModel,
  evaluations: ArticleEvaluation[]
): Promise<{ winnerIndex: number; reason: string }> {
  const list = evaluations
    .map(
      (e, i) =>
        `${i + 1}. 《${e.article.title}》（来源：${e.article.source}）\n   总分：${e.scores.total}（novelty ${e.scores.novelty} / practicality ${e.scores.practicality} / depth ${e.scores.depth} / relevance ${e.scores.relevance} / ai ${e.scores.aiRelevance}）\n   价值点：${e.takeaway}\n   细节：${e.hook}\n   正文节选：${e.article.content.slice(0, 1200)}`
    )
    .join('\n\n');

  const result = await model
    .withStructuredOutput(pickSchema, { method: 'jsonMode' })
    .invoke([
      new SystemMessage(PICK_SYSTEM),
      new HumanMessage(list),
    ]);

  return {
    winnerIndex: Number(result.winnerIndex),
    reason: String(result.reason),
  };
}

// ─── 遗珠机制：从冷门文章里按"个人品味"挑几篇备选 ───

const gemSchema = z.object({
  gems: z.array(
    z.object({
      index: z.number().int().min(1).describe('文章在列表中的编号，从 1 开始'),
      reason: z.string().describe('为什么你觉得它被低估、值得一读，一句中文'),
    })
  ),
});

/**
 * 根据模型返回的编号，从候选池里解析出真正的文章（纯函数，可测试）。
 * 自动去重、越界过滤、限制数量。
 */
export function resolveGems(
  pool: Article[],
  picks: Array<{ index: number }>,
  count: number
): Article[] {
  const seen = new Set<number>();
  const result: Article[] = [];
  for (const pick of picks) {
    const idx = pick.index - 1;
    if (idx >= 0 && idx < pool.length && !seen.has(idx)) {
      seen.add(idx);
      result.push(pool[idx]);
    }
    if (result.length >= count) break;
  }
  return result;
}

/**
 * 凭主编个人品味，从一批社区热度不高的文章里挑出 count 篇"遗珠"。
 * 只基于标题/来源/热度做直觉筛选，是否真的好由后续的内容打分来把关。
 */
export async function pickHiddenGems(
  model: BaseChatModel,
  articles: Article[],
  count: number,
  persona?: Persona
): Promise<Article[]> {
  const pool = articles.slice(0, 40);
  const n = Math.min(count, pool.length);
  if (n <= 0) return [];

  const taste =
    persona && persona.nickname
      ? `你是「${persona.nickname}」，一位${persona.name}。
你关注的领域：${(persona.interests || []).join('、')}
你偏好的内容：${persona.votingPreference}
另外，你最近对 AI 方向的内容（AI 开发、LLM、Agent、AI 工具链、机器学习等）特别关注，希望每日推荐里能多出现这类被低估的好文。
`
      : '你是一位资深开发者，最近对 AI 方向的内容（AI 开发、LLM、Agent、AI 工具链、机器学习等）特别关注。';

  const system = `${taste}
下面是一批社区热度不高、可能被埋没的文章（来自 Hacker News 和 Lobsters）。它们可能因为标题不够抓眼、题材冷门或发布时机不佳而没进热门榜，但里面可能有真正的好东西。

请凭你的个人品味，从下面的列表里选出 ${n} 篇你认为最可能被低估、值得一读的"遗珠"，每篇给一句理由。
注意：
- 凭直觉和品味挑选，不要只看热度；
- 避开明显的广告、工具宣传、或标题党；
- 只返回 JSON 对象：gems 数组，每项 { index, reason }，index 是文章在列表中的编号（从 1 开始）。`;

  const list = pool
    .map(
      (a, i) =>
        `${i + 1}. [${a.source === 'hackernews' ? 'HN' : 'Lobsters'}] (score ${a.score ?? 0}, ${a.comments ?? 0} comments) ${a.title}`
    )
    .join('\n');

  try {
    const result = await model
      .withStructuredOutput(gemSchema, { method: 'jsonMode' })
      .invoke([
        new SystemMessage(system),
        new HumanMessage(list),
      ]);
    return resolveGems(pool, result.gems ?? [], n);
  } catch (error) {
    // 兜底：回退到剩余文章中热度最高的几篇，保证机制不失效
    console.warn(
      '   ⚠️ 遗珠挑选失败，回退到剩余文章中热度最高的几篇:',
      error instanceof Error ? error.message : error
    );
    return [...pool].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, n);
  }
}
