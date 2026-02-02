import { publishToMastodon } from '../../services/mastodon.js';
import { addToHistory } from '../../utils/history.js';
import { getDiscussionWriter } from './discuss.js';
import type { GraphStateType } from '../state.js';

export async function publishNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📤 正在发布结果...');

  const { finalArticle, finalSummary } = state;

  if (!finalArticle) {
    throw new Error('No final article selected');
  }

  // 生成发布内容
  const publishContent = `${finalSummary}\n\n${finalArticle.url}`;
  console.log(`   发布内容：\n${publishContent}`);

  // 发布到 Mastodon
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  const dryRun = process.env.DRY_RUN === 'true';

  let publishedUrl = '';

  if (dryRun) {
    console.log('   🧪 DRY_RUN 模式，跳过发布');
  } else if (instance && token) {
    try {
      const status = await publishToMastodon(publishContent, instance, token);
      publishedUrl = status.url;
      console.log(`   ✅ 发布成功：${publishedUrl}`);
    } catch (error) {
      console.error(`   ❌ 发布失败：${error}`);
    }
  } else {
    console.log('   ⚠️ 未配置 Mastodon，跳过发布');
  }

  // 保存历史记录
  await addToHistory({
    date: new Date().toISOString().split('T')[0],
    articleId: finalArticle.id,
    title: finalArticle.title,
    url: finalArticle.url,
    source: finalArticle.source,
    summary: finalSummary,
  });
  console.log('   💾 历史记录已保存');

  // 讨论记录已在讨论过程中实时写入
  const writer = getDiscussionWriter();
  if (writer) {
    console.log(`   📝 讨论记录：${writer.getFilename()}`);
  }

  return {
    publishedUrl,
  };
}
