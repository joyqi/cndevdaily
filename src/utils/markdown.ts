import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type {
  Article,
  ArticleWithContent,
  DiscussionRound,
  Message,
} from '../types/index.js';

const DISCUSSIONS_DIR = 'discussions';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatArticleTable(articles: Article[]): string {
  const header = '| # | 来源 | 标题 |\n|---|------|------|\n';
  const rows = articles
    .map((a, i) => {
      const source = a.source === 'hackernews' ? 'HN' : 'Lobsters';
      return `| ${i + 1} | ${source} | ${a.title} |`;
    })
    .join('\n');
  return header + rows;
}

function formatMessages(messages: Message[]): string {
  return messages
    .map((m) => `**${m.role}**:\n> ${m.content.replace(/\n/g, '\n> ')}`)
    .join('\n\n');
}

function formatRound(round: DiscussionRound, title: string): string {
  let content = `### ${title}\n\n`;
  content += formatMessages(round.messages);

  if (round.votes && round.votes.length > 0) {
    content += '\n\n**投票结果**:\n';
    const voteCounts = new Map<string, number>();
    for (const vote of round.votes) {
      voteCounts.set(vote.articleId, (voteCounts.get(vote.articleId) || 0) + 1);
    }
    const sorted = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [articleId, count] of sorted) {
      content += `- ${articleId}: ${count} 票\n`;
    }
  }

  return content;
}

export interface DiscussionMarkdownOptions {
  date: Date;
  articles: Article[];
  titleDiscussion: DiscussionRound[];
  top3Articles: ArticleWithContent[];
  contentDiscussion: DiscussionRound[];
  finalArticle: ArticleWithContent;
  finalSummary: string;
}

export async function generateDiscussionMarkdown(
  options: DiscussionMarkdownOptions
): Promise<string> {
  const {
    date,
    articles,
    titleDiscussion,
    top3Articles,
    contentDiscussion,
    finalArticle,
    finalSummary,
  } = options;

  const dateStr = formatDate(date);

  let md = `# 开发者新闻讨论记录 - ${dateStr}\n\n`;

  md += `## 候选文章列表\n\n`;
  md += `共 ${articles.length} 篇文章参与评选\n\n`;
  md += formatArticleTable(articles);
  md += '\n\n---\n\n';

  md += `## 第一轮讨论：标题评选\n\n`;
  for (let i = 0; i < titleDiscussion.length; i++) {
    const roundTitles = ['Round 1 - 提名', 'Round 2 - 辩论', 'Round 3 - 投票'];
    md += formatRound(titleDiscussion[i], roundTitles[i] || `Round ${i + 1}`);
    md += '\n\n';
  }

  md += `**入选 Top 3**:\n`;
  for (const article of top3Articles) {
    md += `- ${article.title}\n`;
  }
  md += '\n---\n\n';

  md += `## 第二轮讨论：内容评选\n\n`;
  md += `### 文章摘要\n\n`;
  for (const article of top3Articles) {
    md += `**${article.title}**\n`;
    md += `> ${article.summary || '(摘要生成中...)'}\n\n`;
  }

  md += `### 讨论记录\n\n`;
  for (let i = 0; i < contentDiscussion.length; i++) {
    md += formatRound(contentDiscussion[i], `Round ${i + 1}`);
    md += '\n\n';
  }

  md += `---\n\n`;
  md += `## 今日推荐\n\n`;
  md += `**《${finalArticle.title}》**\n\n`;
  md += `### 发布内容\n\n`;
  md += `> ${finalSummary}\n\n`;
  md += `${finalArticle.url}\n`;

  return md;
}

export async function saveDiscussionMarkdown(
  content: string,
  date: Date
): Promise<string> {
  if (!existsSync(DISCUSSIONS_DIR)) {
    await mkdir(DISCUSSIONS_DIR, { recursive: true });
  }

  const filename = `${DISCUSSIONS_DIR}/${formatDate(date)}.md`;
  await writeFile(filename, content, 'utf-8');
  return filename;
}

// 实时讨论记录写入器
export class DiscussionWriter {
  private date: Date;
  private filename: string;
  private content: string = '';

  constructor(date: Date = new Date()) {
    this.date = date;
    this.filename = `${DISCUSSIONS_DIR}/${formatDate(date)}.md`;
  }

  async init(articles: Article[]): Promise<void> {
    if (!existsSync(DISCUSSIONS_DIR)) {
      await mkdir(DISCUSSIONS_DIR, { recursive: true });
    }

    this.content = `# 开发者新闻讨论记录 - ${formatDate(this.date)}\n\n`;
    this.content += `## 候选文章列表\n\n`;
    this.content += `共 ${articles.length} 篇文章参与评选\n\n`;
    this.content += formatArticleTable(articles);
    this.content += '\n\n---\n\n';
    this.content += `## 第一轮讨论：标题评选\n\n`;

    await this.save();
  }

  async writeRound(round: DiscussionRound, title: string): Promise<void> {
    this.content += formatRound(round, title);
    this.content += '\n\n';
    await this.save();
  }

  async writeTop3(articles: ArticleWithContent[]): Promise<void> {
    const count = articles.length;
    if (count === 1) {
      this.content += `**入选文章**:\n`;
    } else {
      this.content += `**入选 Top ${count}**:\n`;
    }
    for (const article of articles) {
      this.content += `- ${article.title}\n`;
    }
    this.content += '\n---\n\n';
    if (count > 1) {
      this.content += `## 第二轮讨论：内容评选\n\n`;
    }
    await this.save();
  }

  async writeArticleSummaries(articles: ArticleWithContent[]): Promise<void> {
    this.content += `### 文章摘要\n\n`;
    for (const article of articles) {
      this.content += `**${article.title}**\n`;
      this.content += `> ${article.summary || '(无摘要)'}\n\n`;
    }
    this.content += `### 讨论记录\n\n`;
    await this.save();
  }

  async writeFinalResult(article: ArticleWithContent, summary: string): Promise<void> {
    this.content += `---\n\n`;
    this.content += `## 今日推荐\n\n`;
    this.content += `**《${article.title}》**\n\n`;
    this.content += `### 发布内容\n\n`;
    this.content += `> ${summary}\n\n`;
    this.content += `${article.url}\n`;
    await this.save();
  }

  private async save(): Promise<void> {
    await writeFile(this.filename, this.content, 'utf-8');
  }

  getFilename(): string {
    return this.filename;
  }
}
