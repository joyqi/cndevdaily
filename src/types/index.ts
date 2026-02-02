export interface Article {
  id: string;
  title: string;
  url: string;
  source: 'hackernews' | 'lobsters';
  score?: number;
  comments?: number;
  author?: string;
  tags?: string[];
}

export interface ArticleWithContent extends Article {
  content: string;
  summary?: string;
}

export interface Persona {
  id: string;
  name: string;
  nickname: string;
  description: string;
  interests: string[];
  votingPreference: string;
  speakingStyle: string;
}

export interface Message {
  role: string;
  content: string;
  round: number;
}

export interface Vote {
  persona: string;
  articleId: string;
  reason: string;
}

export interface DiscussionRound {
  round: number;
  messages: Message[];
  votes?: Vote[];
}

export interface DiscussionResult {
  rounds: DiscussionRound[];
  selectedArticles: Article[];
  finalSelection?: ArticleWithContent;
  summary?: string;
}

export interface GraphState {
  articles: Article[];
  titleDiscussion: DiscussionRound[];
  top3Articles: ArticleWithContent[];
  contentDiscussion: DiscussionRound[];
  finalArticle: ArticleWithContent | null;
  finalSummary: string;
  publishedUrl: string;
}

export interface HistoryRecord {
  date: string;
  articleId: string;
  title: string;
  url: string;
  source: 'hackernews' | 'lobsters';
  summary: string;
}
