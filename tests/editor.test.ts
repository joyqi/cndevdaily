import { describe, it, expect } from 'vitest';
import { resolveGems } from '../src/agents/editor.js';
import type { Article } from '../src/types/index.js';

const pool: Article[] = [
  { id: 'a', title: 'A', url: 'http://a', source: 'hackernews', score: 1 },
  { id: 'b', title: 'B', url: 'http://b', source: 'lobsters', score: 2 },
  { id: 'c', title: 'C', url: 'http://c', source: 'hackernews', score: 3 },
  { id: 'd', title: 'D', url: 'http://d', source: 'lobsters', score: 4 },
];

describe('resolveGems', () => {
  it('按编号解析出对应的文章', () => {
    const gems = resolveGems(pool, [{ index: 2 }, { index: 4 }], 4);
    expect(gems.map((g) => g.id)).toEqual(['b', 'd']);
  });

  it('过滤越界编号', () => {
    const gems = resolveGems(pool, [{ index: 0 }, { index: 99 }], 4);
    expect(gems).toEqual([]);
  });

  it('去重', () => {
    const gems = resolveGems(pool, [{ index: 1 }, { index: 1 }], 4);
    expect(gems.map((g) => g.id)).toEqual(['a']);
  });

  it('限制返回数量', () => {
    const gems = resolveGems(pool, [{ index: 1 }, { index: 2 }, { index: 3 }], 2);
    expect(gems.map((g) => g.id)).toEqual(['a', 'b']);
  });
});
