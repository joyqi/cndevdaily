import type { Article } from '../types/index.js';

interface LobstersStory {
  short_id: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  submitter_user: string;
  tags: string[];
}

export async function fetchLobstersArticles(limit: number = 25): Promise<Article[]> {
  const response = await fetch('https://lobste.rs/hottest.json');

  if (!response.ok) {
    throw new Error(`Failed to fetch Lobsters: ${response.status}`);
  }

  const stories: LobstersStory[] = await response.json();

  return stories.slice(0, limit).map((story) => ({
    id: `lobsters-${story.short_id}`,
    title: story.title,
    url: story.url || `https://lobste.rs/s/${story.short_id}`,
    source: 'lobsters' as const,
    score: story.score,
    comments: story.comment_count,
    author: story.submitter_user,
    tags: story.tags,
  }));
}
