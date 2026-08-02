import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { withRetry } from '../utils/retry.js';
import type { Article, ArticleWithContent } from '../types/index.js';

const MAX_CONTENT_LENGTH = 8000;

// 抓取失败标记。以该前缀开头的内容表示抓取失败，不应作为真实内容使用。
export const SCRAPE_FAILURE_PREFIX = 'SCRAPE_FAILED:';

export function isScrapeFailure(content: string): boolean {
  return content.startsWith(SCRAPE_FAILURE_PREFIX);
}

function failureContent(reason: string): string {
  return `${SCRAPE_FAILURE_PREFIX}${reason}`;
}

export async function scrapeArticle(article: Article): Promise<ArticleWithContent> {
  try {
    const response = await withRetry(
      () =>
        fetch(article.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; DevNewsBot/1.0; +https://github.com/devnews)',
          },
          signal: AbortSignal.timeout(10000),
        }),
      { retries: 2, baseDelayMs: 1500 }
    );

    if (!response.ok) {
      return {
        ...article,
        content: failureContent(`HTTP ${response.status}`),
      };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: article.url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();

    if (!parsed || !parsed.textContent) {
      return {
        ...article,
        content: failureContent('无法解析文章内容'),
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
      content: failureContent(message),
    };
  }
}

export async function scrapeArticles(articles: Article[]): Promise<ArticleWithContent[]> {
  return Promise.all(articles.map((article) => scrapeArticle(article)));
}
