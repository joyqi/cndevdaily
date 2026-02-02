import { Annotation } from '@langchain/langgraph';
import type {
  Article,
  ArticleWithContent,
  DiscussionRound,
} from '../types/index.js';

export const GraphState = Annotation.Root({
  articles: Annotation<Article[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  titleDiscussion: Annotation<DiscussionRound[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  top3Articles: Annotation<ArticleWithContent[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  contentDiscussion: Annotation<DiscussionRound[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  finalArticle: Annotation<ArticleWithContent | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
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
