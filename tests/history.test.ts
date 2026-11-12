import { describe, it, expect } from 'vitest';
import { isArticlePublished, shouldSkipToday } from '../src/utils/history.js';
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

describe('shouldSkipToday', () => {
  const at = (iso: string) => new Date(iso);
  const record = (date: string) => ({ date } as HistoryRecord);

  it('已有今天（UTC）的记录时跳过', () => {
    expect(shouldSkipToday([record('2026-11-11'), record('2026-11-12')], at('2026-11-12T05:00:00Z'))).toBe(true);
  });

  it('没有今天的记录时不跳过', () => {
    expect(shouldSkipToday([record('2026-11-11')], at('2026-11-12T05:00:00Z'))).toBe(false);
    expect(shouldSkipToday([], at('2026-11-12T05:00:00Z'))).toBe(false);
  });

  it('按 UTC 日期判断，而不是北京时间', () => {
    // 北京时间 11-12 07:00 = UTC 11-11 23:00
    expect(shouldSkipToday([record('2026-11-12')], at('2026-11-11T23:00:00Z'))).toBe(false);
  });
});
