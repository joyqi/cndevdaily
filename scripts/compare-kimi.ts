/**
 * Kimi K3 复测：多跑几个样本，并用两个不同的评审模型交叉打分，
 * 排查"一次低分"是模型问题还是评审偏差。
 *
 * 运行：pnpm exec tsx --env-file=.env scripts/compare-kimi.ts
 */
import { createLLM } from '../src/utils/llm.js';
import { scrapeArticle } from '../src/services/scraper.js';
import { loadModeratorPersona, buildModeratorPrompt } from '../src/agents/personas.js';
import {
  generateRecommendation,
  humanizeRecommendation,
  critiqueRecommendation,
  buildWriterSystemPrompt,
  type WriteContext,
} from '../src/agents/writer.js';

const WRITER = 'moonshotai/kimi-k3';
const JUDGES = ['deepseek/deepseek-v4-flash', 'qwen/qwen3.7-max'];
const SAMPLES = 3;
const ARTICLE_URL = 'https://victoriametrics.com/blog/go-1-27/';

async function main() {
  const persona = await loadModeratorPersona();
  const systemPrompt = buildWriterSystemPrompt(buildModeratorPrompt(persona));

  const scraped = await scrapeArticle({
    id: 'test-go127',
    title: 'Go 1.27 interactive tour',
    url: ARTICLE_URL,
    source: 'hackernews',
    score: 100,
    comments: 50,
    author: 'VictoriaMetrics',
  });
  const ctx: WriteContext = {
    article: scraped,
    hook: '每个新特性都配了可直接运行的示例',
    takeaway: '一篇能直接上手跑 Go 1.27 新特性的交互式教程，比官方 release notes 好懂',
    reason: 'Go 1.27 即将发布，这篇教程用可运行示例讲解新特性，实用价值高',
  };

  const writer = createLLM(0.9, WRITER);
  const judges = JUDGES.map((m) => ({ name: m, model: createLLM(0.3, m) }));

  for (let s = 1; s <= SAMPLES; s++) {
    console.log(`\n===== 样本 ${s} =====`);
    const draft = await generateRecommendation(writer, systemPrompt, ctx);
    const text = await humanizeRecommendation(writer, systemPrompt, ctx, draft);
    console.log(`推荐语：${text}`);

    for (const { name, model } of judges) {
      try {
        const c = await critiqueRecommendation(model, text);
        console.log(`  [${name.split('/').pop()}] clarity ${c.clarity} / naturalness ${c.naturalness} / specificity ${c.specificity} / ${c.verdict}（合计 ${c.clarity + c.naturalness + c.specificity}）`);
      } catch (e) {
        console.log(`  [${name}] ❌ ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
