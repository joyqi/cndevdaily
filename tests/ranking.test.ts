import { describe, it, expect } from 'vitest';
import { rankCandidates } from '../src/utils/ranking.js';
import type { Article } from '../src/types/index.js';

const hn = (id: string, score: number, comments = 0): Article => ({
  id: `hn-${id}`,
  title: id,
  url: `http://hn/${id}`,
  source: 'hackernews',
  score,
  comments,
});

const lo = (id: string, score: number): Article => ({
  id: `lobsters-${id}`,
  title: id,
  url: `http://lo/${id}`,
  source: 'lobsters',
  score,
});

describe('rankCandidates', () => {
  it('按分数排序，每源各取前 perSource 篇', () => {
    const articles: Article[] = [
      hn('a', 10),
      hn('b', 50),
      hn('c', 30),
      hn('d', 5),
      lo('x', 3),
      lo('y', 9),
    ];
    const ranked = rankCandidates(articles, 2);
    const hnIds = ranked.filter((a) => a.source === 'hackernews').map((a) => a.id);
    const loIds = ranked.filter((a) => a.source === 'lobsters').map((a) => a.id);
    expect(hnIds).toEqual(['hn-b', 'hn-c']);
    expect(loIds).toEqual(['lobsters-y', 'lobsters-x']);
  });

  it('score 相同时用 comments 打破平局', () => {
    const articles: Article[] = [hn('a', 10, 5), hn('b', 10, 20)];
    const ranked = rankCandidates(articles, 1);
    expect(ranked.map((a) => a.id)).toEqual(['hn-b']);
  });

  it('score 缺失时按 0 处理', () => {
    const articles: Article[] = [
      { id: 'x', title: 'x', url: 'http://x', source: 'hackernews' },
      hn('y', 5),
    ];
    const ranked = rankCandidates(articles, 1);
    expect(ranked.map((a) => a.id)).toEqual(['hn-y']);
  });

  it('空数组返回空', () => {
    expect(rankCandidates([])).toEqual([]);
  });
});
