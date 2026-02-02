import type { Article } from '../types/index.js';

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  descendants?: number;
  by: string;
  type: string;
}

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

async function fetchItem(id: number): Promise<HNItem | null> {
  const response = await fetch(`${HN_API_BASE}/item/${id}.json`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function fetchHackerNewsArticles(limit: number = 25): Promise<Article[]> {
  const response = await fetch(`${HN_API_BASE}/topstories.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch HackerNews: ${response.status}`);
  }

  const storyIds: number[] = await response.json();
  const topIds = storyIds.slice(0, limit);

  const items = await Promise.all(topIds.map((id) => fetchItem(id)));

  return items
    .filter((item): item is HNItem => item !== null && item.type === 'story')
    .map((item) => ({
      id: `hn-${item.id}`,
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      source: 'hackernews' as const,
      score: item.score,
      comments: item.descendants || 0,
      author: item.by,
    }));
}
