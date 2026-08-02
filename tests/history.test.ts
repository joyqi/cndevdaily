import { describe, it, expect } from 'vitest';
import { isArticlePublished } from '../src/utils/history.js';
import type { Article, HistoryRecord } from '../src/types/index.js';

const history: HistoryRecord[] = [
  {
    date: '2026-02-02',
    articleId: 'hn-1',
    title: 'Article 1',
    url: 'https://example.com/a',
    source: 'hackernews',
    summary: 's',
  },
  {
    date: '2026-02-02',
    articleId: 'lobsters-1',
    title: 'Article 2',
    url: 'https://example.com/b',
    source: 'lobsters',
    summary: 's',
  },
];

describe('isArticlePublished', () => {
  it('已发布的 URL 返回 true', () => {
    const article: Article = {
      id: 'hn-2',
      title: 'A',
      url: 'https://example.com/a',
      source: 'hackernews',
    };
    expect(isArticlePublished(history, article)).toBe(true);
  });

  it('未发布的 URL 返回 false', () => {
    const article: Article = {
      id: 'hn-3',
      title: 'A',
      url: 'https://example.com/never',
      source: 'hackernews',
    };
    expect(isArticlePublished(history, article)).toBe(false);
  });

  it('空历史返回 false', () => {
    const article: Article = {
      id: 'hn-4',
      title: 'A',
      url: 'https://example.com/a',
      source: 'hackernews',
    };
    expect(isArticlePublished([], article)).toBe(false);
  });
});
