import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ArticleWithContent } from '../types/index.js';

/**
 * 禁止出现的套话词。只用于注入写作/评审 prompt，不在代码里做文本匹配——
 * 是否违规由 AI 评审来判断。
 */
const BANNED_PHRASES = [
  '直击痛点', '干货满满', '干货', '不容错过', '闭眼入', '天花板', '保姆级',
  '手把手', '强烈推荐', '赶紧收藏', '划重点', '含金量', '拉满', 'yyds', 'YYDS',
  '绝绝子', '必看', '必读', '一网打尽', '玩转', '解锁', '赋能', '底层逻辑',
  '思维模型', '太香了', '真香', '宝藏', '神器', '速收藏', '敲重点',
  '弯道超车', '降维打击',
];

export interface WriteContext {
  article: ArticleWithContent;
  /** 文章里最具体、最抓人的一个细节 */
  hook?: string;
  /** 一句话价值点 */
  takeaway?: string;
  /** 编辑选中理由 */
  reason?: string;
  /** 最近几期的开头（用于避免每篇开头雷同） */
  recentOpenings?: string[];
}

const STYLE_RULES = `
你写的东西要像一个真正读过文章、并且真心觉得"这篇值得分享"的人在跟开发者朋友安利，而不是新闻稿、营销文案、AI 生成内容，更不是论文摘要的翻译。

最重要的前提：读者是完全不了解这篇文章、甚至可能不懂这个话题的陌生人。他刷到这条内容时没有任何背景。所以每一句话都必须"零上下文可懂"——任何术语、工具名、特性名、编号，第一次出现要么用一句人话讲清它是什么，要么干脆不提。

模仿对象：学阮一峰分享链接的"味道"，不要抄他的"格式"。
他的味道是：
- 平实、就事论事，先把"这是什么、它做了什么"用大白话讲清楚；
- 句子短、叙述直白，不堆形容词，不用转折绕弯；
- 偶尔带一句轻量的个人反应（"很有意思""看完挺后怕"），但克制；
- 开头随性自然、每次都不一样：他有时写"最近看到…"，有时写"xx 发了一款…"，有时写"这两天大家都在聊…"，有时直接说事。
绝不把任何一种开头当成模板反复用。

铁律：
1. 不超过 120 个汉字，一到三句话。
2. 下面这些词是套话/AI 腔，绝对不能出现：${BANNED_PHRASES.join('、')}。
3. 不要以"这篇/本文/文章"开头；不要用"首先/其次/最后"结构；不要复述文章结构；不要用"证明了/给出了/实现了/提出了"这类论文腔动词堆砌。
4. 禁止"不是 X，而是 Y"这种先否定再肯定的句式（以及"并非…而是…""与其…不如…""看似…其实…"），这是最典型的 AI 行文风格。
5. 开头要自然多样，每篇都不一样：可以学阮一峰那种随性的起手（"最近看到…""xx 发了一款…""这两天被…刷屏了""有人把…做成…"），但不要固定套同一种。如果提供了"最近几期开头"，开头务必与之错开。
6. 具体细节最多 1-2 个，且必须是零上下文也能懂的——用一句大白话说明它为什么重要；某个词不解释读者就看不懂，就别用（比如不要出现"Box[int] 变成 Box[string]"这种只有懂 Go 泛型的人才看得懂的写法）。
7. 语气平实克制，可以有"很有意思"这种轻量个人反应，但不要强观点、不要喊口号、不要以"值得一读/值得看看"收尾。
8. 不用表情符号、标签、网络感叹词。
9. 不使用任何 Markdown 格式：不加粗（**）、不写标题（#）、不用列表（- 或 1.）、不用代码块和引用（>、\`）。输出必须是纯文本，标点只用中文标点。
10. 写完后自己读一遍：如果有任何一句"不了解背景的人看不懂"，或读起来像 AI 腔、像模板，就重写或删掉。

正面例子（要这种感觉，参考阮一峰；注意两篇开头各不相同）：
「最近看到一篇很有意思的复盘：AI 写了一份推翻著名数学猜想的证明，负责核查证明的软件竟然放行了。查下来是核查软件自己的 bug，一小时内修完，另一套独立核查工具也栽在同类问题上。」
「有人在 Linux 内核里挖到一个十来年的老 bug：某条指令在某些 CPU 上会静默算错，文档里一直没人写过。修复就几行，但追查过程把调用链翻了个底朝天。做底层或碰性能优化的人建议看看。」

反面教材（禁止这种味道）：
① 套话：「这篇文章直击痛点、干货满满，深刻揭示了XX的底层逻辑，值得每一位开发者细细品读，强烈推荐收藏！」
② 论文腔：「本文提出了 XX 方法，在 Zynq-7000 上实现了 3.81×10^-5 pJ/op 的能耗，证明了 INT4 内存单元的可行性。」
③ 黑话堆砌：「以前方法里想用泛型，得绕道包级函数；Go 1.27 直接放开了，比如一个 Map 方法就能把 Box[int] 变成 Box[string]。」
④ 先否定再肯定：「其实不是证明写错了，而是核查软件自己的漏洞，才放行了错误证明。」`;

export function buildWriterSystemPrompt(personaPrompt: string): string {
  return `${personaPrompt}\n\n${STYLE_RULES}`;
}

function buildWritePrompt(ctx: WriteContext, extra = ''): string {
  const { article } = ctx;
  const recentOpenings = ctx.recentOpenings && ctx.recentOpenings.length > 0
    ? `\n最近几期推荐语的开头（请务必避免与之雷同）：\n${ctx.recentOpenings.map((o) => `- ${o}`).join('\n')}`
    : '';

  return `请为今天的中文开发者写一条文章推荐语。

标题：${article.title}
来源：${article.source === 'hackernews' ? 'Hacker News' : 'Lobsters'}
作者：${article.author || '未知'}

文章最抓人的具体细节：${ctx.hook || '（见正文节选）'}
一句话价值点：${ctx.takeaway || ''}
编辑选中理由：${ctx.reason || ''}
${recentOpenings}
正文节选：
${article.content.slice(0, 2500)}

${extra}
只返回推荐语本身，不要任何解释。`;
}

export async function generateRecommendation(
  model: BaseChatModel,
  systemPrompt: string,
  ctx: WriteContext
): Promise<string> {
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(buildWritePrompt(ctx)),
  ]);
  return (response.content as string).trim();
}

export async function rewriteRecommendation(
  model: BaseChatModel,
  systemPrompt: string,
  ctx: WriteContext,
  draft: string,
  issues: string
): Promise<string> {
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      buildWritePrompt(
        ctx,
        `上一次的草稿（存在问题）：\n${draft}\n\n问题：${issues}\n\n请重写一版，彻底规避上述问题，保持不超过 120 字。`
      )
    ),
  ]);
  return (response.content as string).trim();
}

/**
 * "去机器味"改写：初稿生成后必跑的一遍，专门对付翻译腔/论文腔/摘要腔/黑话堆砌。
 * 保留事实与具体细节，但要求读起来像真人写的、且零上下文可懂。
 */
export async function humanizeRecommendation(
  model: BaseChatModel,
  systemPrompt: string,
  ctx: WriteContext,
  draft: string
): Promise<string> {
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      buildWritePrompt(
        ctx,
        `这是初稿：\n${draft}\n\n请把它改得像一个真人写的、而且完全不了解背景的读者也能一眼看懂：
- 去掉翻译腔、论文摘要腔和机械感；
- 先交代"这篇文章是关于什么的、读完有什么用"，再谈细节；
- 任何术语/工具名/特性名，读者没背景也看不懂的，就换成大白话或删掉；
- 细节最多 1-2 个，且要零上下文可懂；
- 加一点个人态度或视角；开头给个钩子；不超过 120 字。
只返回改写后的推荐语。`
      )
    ),
  ]);
  return (response.content as string).trim();
}

// ─── 质量评审（LLM-as-judge）───
// 所有文风规则都写进评审 prompt，由 AI 直接判断；代码里不做任何文本匹配。

const critiqueSchema = z.object({
  clarity: z.number().min(0).max(10).describe('零背景读者能否看懂，0-10'),
  naturalness: z.number().min(0).max(10).describe('像不像真人写的，有没有翻译腔/论文腔/AI 腔，0-10'),
  specificity: z.number().min(0).max(10).describe('是否讲清了文章是关于什么的、读完有什么用，0-10'),
  issues: z.array(z.string()).describe('具体毛病，尽量引用原文片段，至少列 1 条，没有就说"无明显问题"'),
  verdict: z.enum(['pass', 'rewrite']).describe('rewrite=需要重写，pass=通过'),
});

const CRITIQUE_SYSTEM = `你是一个普通的中国开发者，技术背景一般，正在刷社交媒体的信息流。你刷到一条"今日文章推荐"，你对这篇文章没有任何背景知识。

请以这个读者的视角，严格、诚实地逐项检查这条推荐语（不要因为它是 AI 生成的就更宽容，也不要更苛刻）：

1. 套话词（出现即不合格，naturalness 直接低分）：${BANNED_PHRASES.join('、')} 等。
2. AI 腔句式（出现即扣分）："不是 X，而是 Y""并非 X，而是 Y""与其 X，不如 Y""看似 X，其实 Y"这类先否定再肯定、先抑后扬的转折。
3. 论文腔/翻译腔：以"证明了/给出了/实现了/提出了/本文/本研究"开头堆砌，或堆叠科学计数法、括号数值。
4. 黑话堆砌：出现"Box[int] 变成 Box[string]"这类零上下文读者看不懂的代码/类型写法。
5. clarity：零背景读者能看懂吗？有没有不解释就让人懵的术语、写法？（注意：目标读者是特定领域开发者，如 Go 开发者，领域常识术语不算问题，只有连目标读者都看不懂的才扣分。）
6. naturalness：像不像一个真人随手写的？像不像阮一峰那种平实口吻？有没有宣传腔、总结腔、官腔、AI 味？
7. specificity：有没有讲清楚"这篇文章是关于什么的、它做了什么"？还是空泛？
8. 开头：是不是"这篇/本文/文章"开头，或第一句就抛技术名词/数据？开头是否机械、模板化（例如每篇都固定用"最近看到…"这种套路）？像套模板就扣分。
9. 长度：是否超过 120 字？
10. 格式：是否混入了 Markdown 痕迹（**加粗**、#、- 列表、\`代码\`、> 引用等）？推荐语必须是纯文本。

然后列出你具体看不懂/觉得别扭的地方（引用原文片段），最后给出 verdict（"pass" 或 "rewrite"）。

必须严格按下面的 JSON 结构返回，不要有别的文字：
clarity / naturalness / specificity 必须是 0-10 的**数字**（不能是文字描述），verdict 只能是 "pass" 或 "rewrite"：
{"clarity": 7, "naturalness": 6, "specificity": 8, "issues": ["具体问题1", "具体问题2"], "verdict": "rewrite"}`;

export interface RecommendationCritique {
  clarity: number;
  naturalness: number;
  specificity: number;
  issues: string[];
  verdict: 'pass' | 'rewrite';
}

/** 宽松地把模型返回的各种类型规范成数字（兼容它不守 schema 的情况） */
function toNum(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const m = value.match(/\d+(\.\d+)?/);
    if (m) return Math.min(10, Math.max(0, parseFloat(m[0])));
  }
  return fallback;
}

function toVerdict(value: unknown): 'pass' | 'rewrite' {
  if (typeof value === 'string') {
    return /rewrite|重写/.test(value) ? 'rewrite' : 'pass';
  }
  return value === 'rewrite' ? 'rewrite' : 'pass';
}

function normalizeCritique(raw: Record<string, unknown>): RecommendationCritique {
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map((i) => String(i)).filter(Boolean)
    : [];
  return {
    clarity: toNum(raw.clarity, 7),
    naturalness: toNum(raw.naturalness, 7),
    specificity: toNum(raw.specificity, 5),
    issues,
    verdict: toVerdict(raw.verdict),
  };
}

/** 让模型扮演零背景读者，对推荐语做真实维度评审；解析失败时降级为"通过"，绝不阻断流程 */
export async function critiqueRecommendation(
  model: BaseChatModel,
  draft: string
): Promise<RecommendationCritique> {
  const messages = [
    new SystemMessage(CRITIQUE_SYSTEM),
    new HumanMessage(`需要评审的推荐语：\n${draft}`),
  ];

  // 1) 结构化输出
  try {
    const result = await model
      .withStructuredOutput(critiqueSchema, { method: 'jsonMode' })
      .invoke(messages);
    const critique = normalizeCritique(result as Record<string, unknown>);
    if (critique.verdict === 'pass' || critique.verdict === 'rewrite') {
      return critique;
    }
  } catch (error) {
    console.warn(
      '   ⚠️ 结构化评审失败，尝试宽松解析:',
      error instanceof Error ? error.message : error
    );
  }

  // 2) 宽松解析：很多思考型模型不守 schema，会返回带描述的文字 JSON
  try {
    const response = await model.invoke(messages);
    const text =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const critique = normalizeCritique(parsed);
      console.log(`   ⚠️ 宽松解析评审成功（clarity ${critique.clarity} / naturalness ${critique.naturalness} / specificity ${critique.specificity}）`);
      return critique;
    }
  } catch (error) {
    console.warn(
      '   ⚠️ 宽松解析评审失败:',
      error instanceof Error ? error.message : error
    );
  }

  // 3) 兜底：解析不了就按通过处理，不让评审变成单点故障
  console.warn('   ⚠️ 评审结果无法解析，按通过处理');
  return { clarity: 7, naturalness: 7, specificity: 5, issues: [], verdict: 'pass' };
}

/** 评审是否通过：任何核心维度低于阈值即重写 */
export function needsRewrite(
  critique: RecommendationCritique,
  thresholds: { clarity?: number; naturalness?: number; specificity?: number } = {}
): boolean {
  const { clarity = 7, naturalness = 7, specificity = 5 } = thresholds;
  return (
    critique.verdict === 'rewrite' ||
    critique.clarity < clarity ||
    critique.naturalness < naturalness ||
    critique.specificity < specificity
  );
}
