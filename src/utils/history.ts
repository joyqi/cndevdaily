import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { HistoryRecord, Article } from '../types/index.js';

const HISTORY_PATH = 'data/history.json';

export async function loadHistory(): Promise<HistoryRecord[]> {
  try {
    if (!existsSync(HISTORY_PATH)) {
      return [];
    }
    const content = await readFile(HISTORY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function saveHistory(records: HistoryRecord[]): Promise<void> {
  const dir = dirname(HISTORY_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(HISTORY_PATH, JSON.stringify(records, null, 2), 'utf-8');
}

export async function addToHistory(record: HistoryRecord): Promise<void> {
  const history = await loadHistory();
  history.push(record);
  await saveHistory(history);
}

export async function filterNewArticles(articles: Article[]): Promise<Article[]> {
  const history = await loadHistory();
  const publishedUrls = new Set(history.map((r) => r.url));

  return articles.filter((article) => !publishedUrls.has(article.url));
}

export function isArticlePublished(history: HistoryRecord[], article: Article): boolean {
  return history.some((r) => r.url === article.url);
}
