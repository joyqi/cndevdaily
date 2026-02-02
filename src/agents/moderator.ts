import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Article, ArticleWithContent, Message, Vote, Persona } from '../types/index.js';
import { buildPersonaPrompt, loadModeratorPersona, buildModeratorPrompt } from './personas.js';

const DEFAULT_MODERATOR_PROMPT = `你是一位资深的技术社区主持人，负责主持开发者新闻讨论会。

你的职责：
1. 引导讨论流程，确保每位参与者都有发言机会
2. 控制讨论节奏，避免跑题
3. 在讨论结束后汇总各方观点，做出最终决策
4. 生成简洁有力的总结

讨论规则：
- 第一轮：让每位参与者提名 2-3 篇感兴趣的文章并简述理由
- 第二轮：针对高票文章展开讨论，允许反驳和支持
- 第三轮：每人投出一票，统计结果

保持中立客观，尊重每位参与者的观点。`;

export class Moderator {
  private model: BaseChatModel;
  private persona: Persona | null = null;
  private systemPrompt: string = DEFAULT_MODERATOR_PROMPT;

  constructor(model: BaseChatModel) {
    this.model = model;
  }

  async init(): Promise<void> {
    try {
      this.persona = await loadModeratorPersona();
      this.systemPrompt = buildModeratorPrompt(this.persona);
    } catch {
      // 如果加载失败，使用默认 prompt
      this.systemPrompt = DEFAULT_MODERATOR_PROMPT;
    }
  }

  async openDiscussion(articles: Article[], phase: 'title' | 'content'): Promise<string> {
    const context =
      phase === 'title'
        ? `今天我们有 ${articles.length} 篇候选文章，请大家根据标题选出最值得深入阅读的内容。`
        : `我们已经获取了 3 篇文章的完整内容，请大家根据内容质量评选出今日最佳。`;

    const articleList = articles
      .map((a, i) => `${i + 1}. [${a.source === 'hackernews' ? 'HN' : 'Lobsters'}] ${a.title}`)
      .join('\n');

    const prompt = `${context}\n\n候选文章列表：\n${articleList}\n\n请宣布讨论开始，并邀请第一轮发言。`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  async guidNextRound(
    round: number,
    previousMessages: Message[],
    articles: Article[]
  ): Promise<string> {
    const context = previousMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const prompt =
      round === 2
        ? `以下是第一轮提名发言：\n\n${context}\n\n请总结提名情况，引导进入第二轮讨论，让大家对高票文章展开辩论。`
        : `以下是前两轮讨论内容：\n\n${context}\n\n请总结讨论要点，宣布进入最终投票环节，要求每人投出一票。`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  async collectVotes(messages: Message[], articles: Article[]): Promise<Vote[]> {
    const prompt = `请分析以下投票发言，提取每位参与者的投票选择。

发言内容：
${messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}

文章列表：
${articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

请以 JSON 格式返回投票结果，格式为：
[{"persona": "角色名", "articleNumber": 文章编号(数字), "reason": "投票理由"}]

注意：articleNumber 必须是数字类型，对应文章列表中的编号（1, 2, 3...）。

只返回 JSON，不要其他内容。`;

    const response = await this.model.invoke([
      new SystemMessage('你是一个数据提取助手，负责从讨论内容中提取投票信息。'),
      new HumanMessage(prompt),
    ]);

    try {
      const content = (response.content as string).trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rawVotes = JSON.parse(jsonMatch[0]) as Array<{
          persona: string;
          articleNumber?: number;
          articleId?: string;
          reason: string;
        }>;

        // 将文章编号转换为实际的文章 ID
        return rawVotes
          .map((v) => {
            let articleId = v.articleId || '';

            // 如果返回的是编号，转换为实际 ID
            if (v.articleNumber && v.articleNumber >= 1 && v.articleNumber <= articles.length) {
              articleId = articles[v.articleNumber - 1].id;
            }
            // 如果 articleId 是纯数字字符串，也尝试转换
            else if (articleId && /^\d+$/.test(articleId)) {
              const num = parseInt(articleId);
              if (num >= 1 && num <= articles.length) {
                articleId = articles[num - 1].id;
              }
            }

            return {
              persona: v.persona,
              articleId,
              reason: v.reason,
            };
          })
          .filter((v) => v.articleId); // 过滤掉无效投票
      }
      return [];
    } catch {
      return [];
    }
  }

  async generateFinalSummary(
    article: ArticleWithContent,
    allMessages: Message[]
  ): Promise<string> {
    const discussionContext = allMessages
      .filter((m) => m.role !== '主持人')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const prompt = `文章标题：${article.title}
文章链接：${article.url}
文章摘要：${article.summary}

团队讨论记录：
${discussionContext}

请以你的视角，综合团队讨论的观点，为这篇文章写一段推荐语。
要求：
1. 不超过 120 字
2. 体现你的个人风格和见解，不要机械化
3. 可以点评文章的价值，也可以结合讨论中的有趣观点
4. 语气真诚、务实，像在和朋友分享一篇好文章
5. 不要使用标签和表情

只返回推荐语本身。`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return (response.content as string).trim();
  }
}

export class Participant {
  private model: BaseChatModel;
  private persona: Persona;
  private systemPrompt: string;

  constructor(model: BaseChatModel, persona: Persona) {
    this.model = model;
    this.persona = persona;
    this.systemPrompt = buildPersonaPrompt(persona);
  }

  get name(): string {
    return this.persona.nickname;
  }

  get id(): string {
    return this.persona.id;
  }

  async nominate(articles: Article[]): Promise<string> {
    const articleList = articles
      .map((a, i) => `${i + 1}. [${a.source === 'hackernews' ? 'HN' : 'Lobsters'}] ${a.title}`)
      .join('\n');

    const prompt = `以下是今天的候选文章列表：

${articleList}

请从你的专业角度，选出 2-3 篇你最感兴趣的文章。要求：
1. 明确指出文章编号（如 #1、#15）
2. 为每篇提名的文章详细说明理由（为什么这篇文章值得关注）
3. 保持你的角色特点`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  async discuss(
    articles: Article[],
    previousMessages: Message[],
    nominationsContext?: string
  ): Promise<string> {
    const articleList = articles
      .map((a, i) => `${i + 1}. ${a.title}`)
      .join('\n');

    let prompt = '';

    if (nominationsContext) {
      prompt = `以下是所有人的提名和理由：

${nominationsContext}

被提名的文章：
${articleList}

请针对其他人的提名和理由发表你的看法：
- 你可以支持某个提名并补充理由
- 你可以反驳某个提名并说明原因
- 你可以为自己的提名辩护

记住保持你的角色特点，发言不超过 150 字。`;
    } else {
      const context = previousMessages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n');

      prompt = `以下是目前的讨论内容：

${context}

请针对其他人的观点发表你的看法，可以支持或反驳。记住保持你的角色特点，发言不超过 100 字。`;
    }

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  async vote(articles: Article[], previousMessages: Message[]): Promise<string> {
    const context = previousMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const articleList = articles
      .map((a, i) => `${i + 1}. ${a.title}`)
      .join('\n');

    const prompt = `经过讨论，现在进入投票环节。候选文章：

${articleList}

之前的讨论：
${context}

请投出你的一票，明确说出你选择的文章编号和理由。记住保持你的角色特点。`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  async discussContent(
    articles: ArticleWithContent[],
    previousMessages: Message[]
  ): Promise<string> {
    const articleSummaries = articles
      .map((a, i) => `${i + 1}. ${a.title}\n摘要：${a.summary}`)
      .join('\n\n');

    const context =
      previousMessages.length > 0
        ? `之前的讨论：\n${previousMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}\n\n`
        : '';

    const prompt = `${context}以下是 3 篇候选文章的内容摘要：

${articleSummaries}

请从你的专业角度，评价这些文章的内容质量和价值。记住保持你的角色特点，发言不超过 100 字。`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  async voteContent(
    articles: ArticleWithContent[],
    previousMessages: Message[]
  ): Promise<string> {
    const context = previousMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const articleList = articles
      .map((a, i) => `${i + 1}. ${a.title}`)
      .join('\n');

    const prompt = `经过内容讨论，现在进入最终投票。候选文章：

${articleList}

之前的讨论：
${context}

请投出你认为今日最佳的一票，明确说出文章编号和理由。记住保持你的角色特点。`;

    const response = await this.model.invoke([
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }
}
