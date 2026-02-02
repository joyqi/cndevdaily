import { Moderator, Participant } from '../../agents/moderator.js';
import { loadPersonas } from '../../agents/personas.js';
import { DiscussionWriter } from '../../utils/markdown.js';
import { createLLM } from '../../utils/llm.js';
import type { Article, ArticleWithContent, DiscussionRound, Message, Vote } from '../../types/index.js';
import type { GraphStateType } from '../state.js';

// 全局 writer 实例，用于跨节点共享
let discussionWriter: DiscussionWriter | null = null;

export function getDiscussionWriter(): DiscussionWriter | null {
  return discussionWriter;
}

function countVotes(votes: Vote[], articles: Article[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const article of articles) {
    counts.set(article.id, 0);
  }
  for (const vote of votes) {
    const current = counts.get(vote.articleId) || 0;
    counts.set(vote.articleId, current + 1);
  }
  return counts;
}

function getTopArticles(votes: Vote[], articles: Article[], topN: number): Article[] {
  const counts = countVotes(votes, articles);
  // 只选有票的文章（票数 > 0），最多 topN 篇
  const sorted = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const topIds = sorted.slice(0, topN).map(([id]) => id);
  return articles.filter((a) => topIds.includes(a.id));
}

// 从提名消息中提取被提名的文章
function extractNominatedArticles(messages: Message[], articles: Article[]): Article[] {
  const nominatedIds = new Set<string>();

  for (const msg of messages) {
    if (msg.role === '主持人') continue;

    // 尝试匹配文章编号（如 #1, #12, 第1篇 等）
    const matches = msg.content.match(/(?:#|第)(\d+)/g);
    if (matches) {
      for (const match of matches) {
        const num = parseInt(match.replace(/[#第]/g, ''));
        if (num >= 1 && num <= articles.length) {
          nominatedIds.add(articles[num - 1].id);
        }
      }
    }
  }

  return articles.filter((a) => nominatedIds.has(a.id));
}

// 格式化提名信息供辩论使用
function formatNominations(messages: Message[], articles: Article[]): string {
  const nominations: string[] = [];

  for (const msg of messages) {
    if (msg.role === '主持人') continue;
    nominations.push(`【${msg.role}的提名】\n${msg.content}`);
  }

  return nominations.join('\n\n');
}

// 并行执行参与者任务
async function runParallel<T>(
  participants: Participant[],
  task: (p: Participant) => Promise<T>,
  round: number,
  label: string
): Promise<Message[]> {
  const results = await Promise.all(
    participants.map(async (p) => {
      const content = await task(p);
      console.log(`      ${p.name} 完成${label}`);
      return { role: p.name, content: content as string, round };
    })
  );
  return results;
}

export async function titleDiscussionNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('💬 开始第一轮讨论：标题评选...');

  // 初始化 writer
  discussionWriter = new DiscussionWriter();
  await discussionWriter.init(state.articles);
  console.log(`   📝 讨论记录：${discussionWriter.getFilename()}`);

  const model = createLLM(0.7);

  const moderator = new Moderator(model);
  await moderator.init();
  const personas = await loadPersonas();
  const participants = personas.map((p) => new Participant(model, p));

  const rounds: DiscussionRound[] = [];
  const allMessages: Message[] = [];

  // Round 1: 提名（并行）
  console.log('   Round 1: 提名阶段（并行）');
  const opening = await moderator.openDiscussion(state.articles, 'title');
  const round1ModeratorMsg: Message = { role: '主持人', content: opening, round: 1 };

  const round1Responses = await runParallel(
    participants,
    (p) => p.nominate(state.articles),
    1,
    '提名'
  );

  const round1Messages = [round1ModeratorMsg, ...round1Responses];
  rounds.push({ round: 1, messages: round1Messages });
  allMessages.push(...round1Messages);
  await discussionWriter.writeRound({ round: 1, messages: round1Messages }, 'Round 1 - 提名');

  // 提取被提名的文章
  const nominatedArticles = extractNominatedArticles(round1Messages, state.articles);
  const nominationsContext = formatNominations(round1Messages, state.articles);

  // Round 2: 辩论（并行，带上提名上下文）
  console.log('   Round 2: 辩论阶段（并行）');
  const round2Guide = await moderator.guidNextRound(2, allMessages, state.articles);
  const round2ModeratorMsg: Message = { role: '主持人', content: round2Guide, round: 2 };

  const round2Responses = await runParallel(
    participants,
    (p) => p.discuss(
      nominatedArticles.length > 0 ? nominatedArticles : state.articles,
      allMessages,
      nominationsContext
    ),
    2,
    '发言'
  );

  const round2Messages = [round2ModeratorMsg, ...round2Responses];
  rounds.push({ round: 2, messages: round2Messages });
  allMessages.push(...round2Messages);
  await discussionWriter.writeRound({ round: 2, messages: round2Messages }, 'Round 2 - 辩论');

  // Round 3: 投票（并行，带上前两轮上下文）
  console.log('   Round 3: 投票阶段（并行）');
  const round3Guide = await moderator.guidNextRound(3, allMessages, state.articles);
  const round3ModeratorMsg: Message = { role: '主持人', content: round3Guide, round: 3 };

  const round3Responses = await runParallel(
    participants,
    (p) => p.vote(state.articles, allMessages),
    3,
    '投票'
  );

  const round3Messages = [round3ModeratorMsg, ...round3Responses];
  const votes = await moderator.collectVotes(round3Messages, state.articles);
  rounds.push({ round: 3, messages: round3Messages, votes });
  await discussionWriter.writeRound({ round: 3, messages: round3Messages, votes }, 'Round 3 - 投票');

  const top3 = getTopArticles(votes, state.articles, 3);
  console.log(`   投票结束，选出 ${top3.length} 篇文章进入下一轮`);

  const top3WithContent = top3.map((a) => ({ ...a, content: '' }));
  await discussionWriter.writeTop3(top3WithContent);

  return {
    titleDiscussion: rounds,
    top3Articles: top3WithContent,
  };
}

export async function contentDiscussionNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('💬 开始第二轮讨论：内容评选...');

  const writer = discussionWriter;
  if (writer) {
    await writer.writeArticleSummaries(state.top3Articles);
  }

  const model = createLLM(0.7);

  const moderator = new Moderator(model);
  await moderator.init();
  const personas = await loadPersonas();
  const participants = personas.map((p) => new Participant(model, p));

  const rounds: DiscussionRound[] = [];
  const allMessages: Message[] = [];

  // Round 1: 内容评价（并行）
  console.log('   Round 1: 内容评价（并行）');
  const opening = await moderator.openDiscussion(state.top3Articles, 'content');
  const round1ModeratorMsg: Message = { role: '主持人', content: opening, round: 1 };

  const round1Responses = await runParallel(
    participants,
    (p) => p.discussContent(state.top3Articles, []),
    1,
    '评价'
  );

  const round1Messages = [round1ModeratorMsg, ...round1Responses];
  rounds.push({ round: 1, messages: round1Messages });
  allMessages.push(...round1Messages);
  if (writer) {
    await writer.writeRound({ round: 1, messages: round1Messages }, 'Round 1 - 内容评价');
  }

  // Round 2: 最终投票（并行，带上评价上下文）
  console.log('   Round 2: 最终投票（并行）');
  const voteGuide = await moderator.guidNextRound(3, allMessages, state.top3Articles);
  const round2ModeratorMsg: Message = { role: '主持人', content: voteGuide, round: 2 };

  const round2Responses = await runParallel(
    participants,
    (p) => p.voteContent(state.top3Articles, allMessages),
    2,
    '投票'
  );

  const round2Messages = [round2ModeratorMsg, ...round2Responses];
  const votes = await moderator.collectVotes(round2Messages, state.top3Articles);
  rounds.push({ round: 2, messages: round2Messages, votes });
  if (writer) {
    await writer.writeRound({ round: 2, messages: round2Messages, votes }, 'Round 2 - 最终投票');
  }

  const winner = getTopArticles(votes, state.top3Articles, 1)[0];
  const finalArticle = state.top3Articles.find((a) => a.id === winner?.id) || state.top3Articles[0];

  console.log(`   最终选定：${finalArticle.title}`);

  // 生成总结
  const allDiscussionMessages = [...allMessages, ...round2Messages];
  const summary = await moderator.generateFinalSummary(finalArticle, allDiscussionMessages);
  console.log(`   生成总结完成`);

  if (writer) {
    await writer.writeFinalResult(finalArticle, summary);
  }

  return {
    contentDiscussion: rounds,
    finalArticle,
    finalSummary: summary,
  };
}
