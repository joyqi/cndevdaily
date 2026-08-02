import { StateGraph, END } from '@langchain/langgraph';
import { GraphState } from './state.js';
import { fetchArticlesNode } from './nodes/fetch.js';
import { selectCandidatesNode } from './nodes/selectCandidates.js';
import { evaluateArticlesNode } from './nodes/evaluate.js';
import { writeRecommendationNode } from './nodes/write.js';
import { publishNode } from './nodes/publish.js';

function shouldContinue(state: typeof GraphState.State): string {
  if (state.articles.length === 0) {
    console.log('⚠️ 没有新文章，结束流程');
    return END;
  }
  return 'selectCandidates';
}

function afterSelect(state: typeof GraphState.State): string {
  if (state.articles.length === 0) {
    console.log('⚠️ 没有筛出候选文章，结束流程');
    return END;
  }
  return 'evaluateArticles';
}

function afterEvaluate(state: typeof GraphState.State): string {
  if (!state.winner) {
    console.log('⚠️ 没有选出有效文章，结束流程');
    return END;
  }
  return 'writeRecommendation';
}

export function createWorkflow() {
  const workflow = new StateGraph(GraphState)
    .addNode('fetchArticles', fetchArticlesNode)
    .addNode('selectCandidates', selectCandidatesNode)
    .addNode('evaluateArticles', evaluateArticlesNode)
    .addNode('writeRecommendation', writeRecommendationNode)
    .addNode('publishResult', publishNode)
    .addEdge('__start__', 'fetchArticles')
    .addConditionalEdges('fetchArticles', shouldContinue)
    .addConditionalEdges('selectCandidates', afterSelect)
    .addConditionalEdges('evaluateArticles', afterEvaluate)
    .addEdge('writeRecommendation', 'publishResult')
    .addEdge('publishResult', END);

  return workflow.compile();
}
