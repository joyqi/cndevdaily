import { withRetry } from '../../utils/retry.js';
import { createWriterLLM, createJudgeLLM } from '../../utils/llm.js';
import { saveRunLog } from '../../utils/runlog.js';
import { loadHistory } from '../../utils/history.js';
import { MODERATOR_PERSONA, buildModeratorPrompt } from '../../agents/personas.js';
import {
  generateRecommendation,
  rewriteRecommendation,
  humanizeRecommendation,
  critiqueRecommendation,
  needsRewrite,
  buildWriterSystemPrompt,
  type WriteContext,
} from '../../agents/writer.js';
import type { GraphStateType } from '../state.js';

/**
 * 推荐语撰写节点：
 * 1. 用 Joyqi 人设 + 反 AI 腔规则，用"写作专用模型"生成初稿
 * 2. 必跑一遍"去机器味"改写
 * 3. 用"评审专用模型"扮演零背景读者打分（真实维度：能不能看懂/像不像人写的/讲没讲清楚），
 *    不合格再重写；关键词检查只作为补充提示，不是质量门槛
 */
export async function writeRecommendationNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const { winner, winnerReason, evaluations } = state;
  if (!winner) {
    throw new Error('No winner to write recommendation');
  }

  console.log('✍️ 撰写推荐语...');

  // 用主编 Joyqi 的人设作为写作声音
  const systemPrompt = buildWriterSystemPrompt(buildModeratorPrompt(MODERATOR_PERSONA));

  const evaluation = evaluations.find((e) => e.article.id === winner.id);
  const context: WriteContext = {
    article: winner,
    hook: evaluation?.hook,
    takeaway: evaluation?.takeaway,
    reason: winnerReason,
  };

  // 取最近几期已发布推荐语的开头，避免每天开头雷同
  try {
    const history = await loadHistory();
    const recentOpenings = history
      .slice(-5)
      .map((r) => r.summary?.trim().slice(0, 18) || '')
      .filter(Boolean);
    if (recentOpenings.length > 0) {
      context.recentOpenings = recentOpenings;
    }
  } catch (error) {
    console.warn(
      `   ⚠️ 读取历史开头失败: ${error instanceof Error ? error.message : error}`
    );
  }

  // 写作用写作专用模型（质量优先）
  const model = createWriterLLM(0.9);

  const draft = await withRetry(() => generateRecommendation(model, systemPrompt, context), {
    retries: 2,
    baseDelayMs: 1500,
  });

  // 必跑一遍去机器味改写
  let text = await withRetry(() => humanizeRecommendation(model, systemPrompt, context, draft), {
    retries: 2,
    baseDelayMs: 1500,
  });

  // 质量评审：用评审专用模型（flash 级）扮演零背景读者打分。
  // 所有文风规则（套话词、AI 句式、论文腔、黑话、长度、人味等）都在评审 prompt 里由 AI 判断，
  // 代码里不做任何文本匹配。
  const judge = createJudgeLLM(0.3);
  const critique = await withRetry(() => critiqueRecommendation(judge, text), {
    retries: 2,
    baseDelayMs: 1500,
  });

  if (needsRewrite(critique)) {
    const feedback = critique.issues.filter((s, i, arr) => s && arr.indexOf(s) === i).join('；');
    console.log(
      `   ✍️ 评审未通过（clarity ${critique.clarity} / naturalness ${critique.naturalness} / specificity ${critique.specificity}），重写一次`
    );
    text = await withRetry(
      () => rewriteRecommendation(model, systemPrompt, context, text, feedback),
      { retries: 2, baseDelayMs: 1500 }
    );

    // 重写后再评审一次，仅作记录（用评审专用模型）
    const reCritique = await withRetry(() => critiqueRecommendation(judge, text), {
      retries: 2,
      baseDelayMs: 1500,
    });
    if (needsRewrite(reCritique)) {
      console.warn(
        `   ⚠️ 重写后评审仍未通过（clarity ${reCritique.clarity} / naturalness ${reCritique.naturalness} / specificity ${reCritique.specificity}）：${reCritique.issues.join('；')}`
      );
    } else {
      console.log(`   ✅ 重写后评审通过`);
    }
  } else {
    console.log(`   ✅ 评审通过（clarity ${critique.clarity} / naturalness ${critique.naturalness} / specificity ${critique.specificity}）`);
  }

  // 保存运行记录
  try {
    const filename = await saveRunLog(new Date(), winner, text);
    console.log(`   📝 运行记录：${filename}`);
  } catch (error) {
    console.warn(`   ⚠️ 保存运行记录失败: ${error instanceof Error ? error.message : error}`);
  }

  return { finalSummary: text };
}
