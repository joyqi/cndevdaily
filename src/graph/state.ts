import { Annotation } from '@langchain/langgraph';
import type { Article, ArticleEvaluation, ArticleWithContent } from '../types/index.js';

export const GraphState = Annotation.Root({
  // 经过社区信号排序后的候选文章（每源前 N 篇）
  articles: Annotation<Article[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  // 基于正文打分后的评估结果
  evaluations: Annotation<ArticleEvaluation[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  // 今日选出的推荐文章
  winner: Annotation<ArticleWithContent | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  // 选中理由（供撰写推荐语使用）
  winnerReason: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
  // 最终推荐语
  finalSummary: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
  publishedUrl: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
});

export type GraphStateType = typeof GraphState.State;
