import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { Article, ArticleWithContent } from '../types/index.js';

const MAX_CONTENT_LENGTH = 8000;

export async function scrapeArticle(article: Article): Promise<ArticleWithContent> {
  try {
    const response = await fetch(article.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DevNewsBot/1.0; +https://github.com/devnews)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        ...article,
        content: `[无法获取文章内容: HTTP ${response.status}]`,
      };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: article.url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();

    if (!parsed || !parsed.textContent) {
      return {
        ...article,
        content: '[无法解析文章内容]',
      };
    }

    let content = parsed.textContent.trim();

    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '...[内容已截断]';
    }

    return {
      ...article,
      content,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      ...article,
      content: `[抓取失败: ${message}]`,
    };
  }
}

export async function scrapeArticles(articles: Article[]): Promise<ArticleWithContent[]> {
  return Promise.all(articles.map((article) => scrapeArticle(article)));
}
