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

/** 基于正文的内容打分 */
export interface ArticleScores {
  novelty: number;
  practicality: number;
  depth: number;
  relevance: number;
  /** 与 AI 方向的相关程度（AI 开发、LLM、Agent、AI 工具链等） */
  aiRelevance: number;
  /** 加权总分（0-10） */
  total: number;
}

/** 一篇候选文章的内容评估结果 */
export interface ArticleEvaluation {
  article: ArticleWithContent;
  scores: ArticleScores;
  /** 文章里最具体、最抓人的一个细节（用于写推荐语） */
  hook: string;
  /** 一句话价值点 */
  takeaway: string;
}

export interface GraphState {
  articles: Article[];
  evaluations: ArticleEvaluation[];
  winner: ArticleWithContent | null;
  winnerReason: string;
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
