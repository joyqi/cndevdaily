import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { scrapeArticles } from '../../services/scraper.js';
import { createLLM } from '../../utils/llm.js';
import type { ArticleWithContent } from '../../types/index.js';
import type { GraphStateType } from '../state.js';

async function summarizeArticle(
  model: BaseChatModel,
  article: ArticleWithContent
): Promise<string> {
  if (article.content.startsWith('[')) {
    return article.content;
  }

  const response = await model.invoke([
    new SystemMessage(
      '你是一位技术编辑，擅长提炼文章核心内容。请用 2-3 句话总结文章要点，突出技术价值和创新点。'
    ),
    new HumanMessage(
      `请总结以下文章：\n\n标题：${article.title}\n\n内容：${article.content.slice(0, 4000)}`
    ),
  ]);

  return (response.content as string).trim();
}

export async function scrapeAndSummarizeNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📄 正在抓取文章内容...');

  const articles = state.top3Articles.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    source: a.source,
    score: a.score,
    comments: a.comments,
    author: a.author,
    tags: a.tags,
  }));

  const scrapedArticles = await scrapeArticles(articles);
  console.log(`   抓取完成，共 ${scrapedArticles.length} 篇`);

  console.log('📝 正在生成文章摘要...');
  const model = createLLM(0.3);

  const articlesWithSummary: ArticleWithContent[] = [];

  for (const article of scrapedArticles) {
    const summary = await summarizeArticle(model, article);
    articlesWithSummary.push({ ...article, summary });
    console.log(`   完成：${article.title.slice(0, 30)}...`);
  }

  return {
    top3Articles: articlesWithSummary,
  };
}
