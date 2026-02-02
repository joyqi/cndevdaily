import { StateGraph, END } from '@langchain/langgraph';
import { GraphState } from './state.js';
import { fetchArticlesNode } from './nodes/fetch.js';
import { titleDiscussionNode, contentDiscussionNode } from './nodes/discuss.js';
import { scrapeAndSummarizeNode } from './nodes/scrape.js';
import { publishNode } from './nodes/publish.js';
import { directSummaryNode } from './nodes/summary.js';

function shouldContinue(state: typeof GraphState.State): string {
  if (state.articles.length === 0) {
    console.log('⚠️ 没有新文章，结束流程');
    return END;
  }
  return 'discussTitles';
}

function afterTitleDiscussion(state: typeof GraphState.State): string {
  const count = state.top3Articles.length;

  if (count === 0) {
    console.log('⚠️ 没有选出任何文章，结束流程');
    return END;
  }

  if (count === 1) {
    console.log('📌 只选出 1 篇文章，跳过内容投票，直接总结');
    return 'directSummary';
  }

  console.log(`📌 选出 ${count} 篇文章，进入内容评选`);
  return 'scrapeArticles';
}

export function createWorkflow() {
  const workflow = new StateGraph(GraphState)
    .addNode('fetchArticles', fetchArticlesNode)
    .addNode('discussTitles', titleDiscussionNode)
    .addNode('scrapeArticles', scrapeAndSummarizeNode)
    .addNode('discussContent', contentDiscussionNode)
    .addNode('directSummary', directSummaryNode)
    .addNode('publishResult', publishNode)
    .addEdge('__start__', 'fetchArticles')
    .addConditionalEdges('fetchArticles', shouldContinue)
    .addConditionalEdges('discussTitles', afterTitleDiscussion)
    .addEdge('scrapeArticles', 'discussContent')
    .addEdge('discussContent', 'publishResult')
    .addEdge('directSummary', 'publishResult')
    .addEdge('publishResult', END);

  return workflow.compile();
}
