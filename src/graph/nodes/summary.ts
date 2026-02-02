import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { scrapeArticle } from '../../services/scraper.js';
import { createLLM } from '../../utils/llm.js';
import { getDiscussionWriter } from './discuss.js';
import { loadModeratorPersona, buildModeratorPrompt } from '../../agents/personas.js';
import type { GraphStateType } from '../state.js';

export async function directSummaryNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📝 直接总结模式（只有1篇入选文章）...');

  const article = state.top3Articles[0];
  if (!article) {
    throw new Error('No article to summarize');
  }

  // 抓取文章内容
  console.log(`   抓取文章：${article.title}`);
  const scrapedArticle = await scrapeArticle({
    id: article.id,
    title: article.title,
    url: article.url,
    source: article.source,
  });

  // 生成摘要
  const model = createLLM(0.3);

  let summary = '';
  if (!scrapedArticle.content.startsWith('[')) {
    const summaryResponse = await model.invoke([
      new SystemMessage(
        '你是一位技术编辑，擅长提炼文章核心内容。请用 2-3 句话总结文章要点，突出技术价值和创新点。'
      ),
      new HumanMessage(
        `请总结以下文章：\n\n标题：${article.title}\n\n内容：${scrapedArticle.content.slice(0, 4000)}`
      ),
    ]);
    summary = (summaryResponse.content as string).trim();
  } else {
    summary = scrapedArticle.content;
  }

  const articleWithSummary = { ...scrapedArticle, summary };

  // 生成最终推荐语
  console.log('   生成推荐语...');

  // 加载主持人人设
  let moderatorPrompt = '你是一位资深技术编辑，擅长撰写简洁有力的内容推荐语。';
  try {
    const moderatorPersona = await loadModeratorPersona();
    moderatorPrompt = buildModeratorPrompt(moderatorPersona);
  } catch {
    // 使用默认 prompt
  }

  // 收集标题讨论中的观点
  const discussionContext = state.titleDiscussion
    .flatMap((round) => round.messages)
    .filter((m) => m.role !== '主持人')
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  const finalSummaryResponse = await model.invoke([
    new SystemMessage(moderatorPrompt),
    new HumanMessage(`文章标题：${article.title}
文章链接：${article.url}
文章摘要：${summary}

团队讨论记录：
${discussionContext}

请以你的视角，综合团队讨论的观点，为这篇文章写一段推荐语。
要求：
1. 不超过 120 字
2. 体现你的个人风格和见解，不要机械化
3. 可以点评文章的价值，也可以结合讨论中的有趣观点
4. 语气真诚、务实，像在和朋友分享一篇好文章
5. 不要使用标签和表情

只返回推荐语本身。`),
  ]);

  const finalSummary = (finalSummaryResponse.content as string).trim();
  console.log(`   推荐语生成完成`);

  // 写入讨论记录
  const writer = getDiscussionWriter();
  if (writer) {
    await writer.writeArticleSummaries([articleWithSummary]);
    await writer.writeFinalResult(articleWithSummary, finalSummary);
  }

  return {
    top3Articles: [articleWithSummary],
    finalArticle: articleWithSummary,
    finalSummary,
  };
}
