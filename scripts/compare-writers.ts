/**
 * 写作模型调研脚本：同一篇文章、同一套写作规则，让多个候选模型各写一遍，
 * 再用评审模型（flash）按"零背景可懂 / 像不像人写的 / 讲没讲清楚"打分对比。
 *
 * 运行：pnpm exec tsx --env-file=.env scripts/compare-writers.ts
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

const WRITER_CANDIDATES = [
  'qwen/qwen3.7-max',
  'deepseek/deepseek-v4-pro',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-opus-5',
];

const JUDGE_MODEL = 'deepseek/deepseek-v4-flash';
const ARTICLE_URL = 'https://victoriametrics.com/blog/go-1-27/';

async function main() {
  const persona = await loadModeratorPersona();
  const systemPrompt = buildWriterSystemPrompt(buildModeratorPrompt(persona));

  console.log('📥 抓取测试文章...');
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

  const judge = createLLM(0.3, JUDGE_MODEL);
  const results: Array<{ model: string; score: number; text: string; critique: string }> = [];

  for (const modelId of WRITER_CANDIDATES) {
    const model = createLLM(0.9, modelId);
    const name = modelId.split('/').pop();
    process.stdout.write(`\n⏳ ${modelId} ... `);
    try {
      const draft = await generateRecommendation(model, systemPrompt, ctx);
      const text = await humanizeRecommendation(model, systemPrompt, ctx, draft);
      const critique = await critiqueRecommendation(judge, text);
      const total = critique.clarity + critique.naturalness + critique.specificity;
      results.push({ model: modelId, score: total, text, critique: JSON.stringify(critique) });
      console.log(`clarity ${critique.clarity} / naturalness ${critique.naturalness} / specificity ${critique.specificity} / ${critique.verdict}（合计 ${total}）`);
    } catch (e) {
      console.log(`❌ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log('\n\n========== 汇总（按总分排序） ==========');
  results.sort((a, b) => b.score - a.score);
  for (const r of results) {
    console.log(`\n[${r.score} 分] ${r.model}`);
    console.log(`  推荐语：${r.text}`);
  }
}

main().catch((e) => {
  console.error('❌ 脚本出错：', e);
  process.exit(1);
});
