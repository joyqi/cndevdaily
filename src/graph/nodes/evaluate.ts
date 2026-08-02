import { withRetry } from '../../utils/retry.js';
import { createLLM } from '../../utils/llm.js';
import { scrapeArticles, isScrapeFailure } from '../../services/scraper.js';
import { evaluateArticle, pickWinner } from '../../agents/editor.js';
import type { ArticleEvaluation } from '../../types/index.js';
import type { GraphStateType } from '../state.js';

/**
 * 内容评选节点：
 * 1. 抓取全部候选正文（并行）
 * 2. 逐篇基于正文打分（并行、结构化）
 * 3. 从 Top 3 里由主编终选出一篇今日推荐
 */
export async function evaluateArticlesNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📄 抓取候选文章内容...');
  const scraped = await scrapeArticles(state.articles);

  const valid = scraped.filter((a) => !isScrapeFailure(a.content));
  const failedCount = scraped.length - valid.length;
  if (failedCount > 0) {
    console.log(`   ⚠️ ${failedCount} 篇抓取失败，已剔除`);
  }

  if (valid.length === 0) {
    console.log('   ❌ 所有候选文章内容均抓取失败');
    return { evaluations: [], winner: null, winnerReason: '' };
  }

  console.log(`🧮 对 ${valid.length} 篇候选逐篇内容打分（并行）...`);
  const model = createLLM(0.2);

  const results = await Promise.all(
    valid.map(async (article) => {
      try {
        const evaluation = await withRetry(() => evaluateArticle(model, article), {
          retries: 2,
          baseDelayMs: 1500,
        });
        console.log(`   ✅ ${article.title.slice(0, 30)}... ${evaluation.scores.total} 分`);
        return evaluation;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`   ⚠️ 打分失败（已跳过）: ${article.title.slice(0, 30)}... ${message}`);
        return null;
      }
    })
  );

  const evaluations = results.filter((r): r is ArticleEvaluation => r !== null);
  evaluations.sort((a, b) => b.scores.total - a.scores.total);

  if (evaluations.length === 0) {
    console.log('   ❌ 所有候选打分失败');
    return { evaluations, winner: null, winnerReason: '' };
  }

  // 从 Top 3 里终选
  let winner = evaluations[0].article;
  let winnerReason = evaluations[0].takeaway;

  if (evaluations.length > 1) {
    const top3 = evaluations.slice(0, 3);
    try {
      const pick = await withRetry(() => pickWinner(model, top3), { retries: 2 });
      const chosen = top3[pick.winnerIndex - 1];
      if (chosen) {
        winner = chosen.article;
        winnerReason = pick.reason;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ⚠️ 主编终选失败，回退到最高分: ${message}`);
    }
  }

  console.log(`🏆 今日推荐候选：${winner.title}`);
  console.log(`   理由：${winnerReason}`);

  return { evaluations, winner, winnerReason };
}
