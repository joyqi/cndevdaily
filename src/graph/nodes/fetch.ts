import { fetchLobstersArticles } from '../../services/lobsters.js';
import { fetchHackerNewsArticles } from '../../services/hackernews.js';
import { filterNewArticles } from '../../utils/history.js';
import type { GraphStateType } from '../state.js';

export async function fetchArticlesNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📥 正在获取文章列表...');

  const [lobsters, hackernews] = await Promise.all([
    fetchLobstersArticles(25),
    fetchHackerNewsArticles(25),
  ]);

  const allArticles = [...lobsters, ...hackernews];
  console.log(`   获取到 ${allArticles.length} 篇文章`);

  const newArticles = await filterNewArticles(allArticles);
  console.log(`   过滤后剩余 ${newArticles.length} 篇新文章`);

  return {
    articles: newArticles,
  };
}
