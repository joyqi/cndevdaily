import type { Article } from '../types/index.js';

/**
 * 按社区信号对候选文章排序，每个来源各取前 perSource 篇。
 * 不调用 LLM，纯粹用 score（热度）排序、comments 打破平局。
 */
export function rankCandidates(articles: Article[], perSource: number = 5): Article[] {
  const bySource = new Map<string, Article[]>();
  for (const article of articles) {
    const list = bySource.get(article.source) || [];
    list.push(article);
    bySource.set(article.source, list);
  }

  const ranked: Article[] = [];
  for (const list of bySource.values()) {
    list.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.comments || 0) - (a.comments || 0);
    });
    ranked.push(...list.slice(0, perSource));
  }
  return ranked;
}
