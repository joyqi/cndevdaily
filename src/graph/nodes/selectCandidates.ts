import { rankCandidates } from '../../utils/ranking.js';
import { withRetry } from '../../utils/retry.js';
import { createLLM } from '../../utils/llm.js';
import { pickHiddenGems } from '../../agents/editor.js';
import { loadModeratorPersona } from '../../agents/personas.js';
import type { Article } from '../../types/index.js';
import type { GraphStateType } from '../state.js';

// 每个来源按社区热度保留的候选数
const PER_SOURCE = 5;
// 遗珠数量：从冷门文章里凭个人品味挑选的备选数
const GEM_COUNT = 4;

/**
 * 候选筛选节点：
 * 1. 按社区热度每源取 Top N（零 LLM 成本）
 * 2. 从剩余冷门文章里凭主编个人品味挑几篇"遗珠"作为备选
 * 两者合并后进入内容评估（遗珠是否真的好，由内容打分来把关）
 */
export async function selectCandidatesNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const { articles } = state;

  // 热度候选
  const hotPool = rankCandidates(articles, PER_SOURCE);
  console.log(`   社区热度候选：${hotPool.length} 篇（每源前 ${PER_SOURCE}）`);

  // 遗珠候选：热度池之外的文章
  const hotIds = new Set(hotPool.map((a) => a.id));
  const rest = articles.filter((a) => !hotIds.has(a.id));

  let gems: Article[] = [];
  if (rest.length > 0) {
    console.log(`💎 挑选遗珠（从 ${rest.length} 篇冷门文章中选 ${GEM_COUNT} 篇）...`);
    const model = createLLM(0.3);
    let persona;
    try {
      persona = await loadModeratorPersona();
    } catch {
      persona = undefined;
    }
    gems = await withRetry(() => pickHiddenGems(model, rest, GEM_COUNT, persona), {
      retries: 2,
      baseDelayMs: 1500,
    });
    for (const gem of gems) {
      console.log(`   💎 ${gem.title.slice(0, 60)}`);
    }
  }

  const candidates = [...hotPool, ...gems];
  console.log(`   候选共 ${candidates.length} 篇（热度 ${hotPool.length} + 遗珠 ${gems.length}）`);

  return { articles: candidates };
}
