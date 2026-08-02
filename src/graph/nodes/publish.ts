import { publishToMastodon } from '../../services/mastodon.js';
import { addToHistory } from '../../utils/history.js';
import type { GraphStateType } from '../state.js';

export async function publishNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📤 正在发布结果...');

  const { winner, finalSummary } = state;

  if (!winner) {
    throw new Error('No winner selected');
  }

  // 生成发布内容
  const publishContent = `${finalSummary}\n\n${winner.url}`;
  console.log(`   发布内容：\n${publishContent}`);

  // 发布到 Mastodon
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  const dryRun = process.env.DRY_RUN === 'true';

  let publishedUrl = '';
  let actuallyPublished = false;

  if (dryRun) {
    console.log('   🧪 DRY_RUN 模式，跳过发布');
  } else if (instance && token) {
    try {
      const status = await publishToMastodon(publishContent, instance, token);
      publishedUrl = status.url;
      actuallyPublished = true;
      console.log(`   ✅ 发布成功：${publishedUrl}`);
    } catch (error) {
      console.error(`   ❌ 发布失败：${error}`);
    }
  } else {
    console.log('   ⚠️ 未配置 Mastodon，跳过发布');
  }

  // 只有真正发布成功才写入历史，避免：
  // 1. 本地 dev/DRY_RUN 测试把文章永久标记为"已发布"
  // 2. 线上发布失败后文章永远不再被推荐
  if (actuallyPublished) {
    await addToHistory({
      date: new Date().toISOString().split('T')[0],
      articleId: winner.id,
      title: winner.title,
      url: winner.url,
      source: winner.source,
      summary: finalSummary,
    });
    console.log('   💾 历史记录已保存');
  } else {
    console.log('   ⏭️ 未成功发布，不写入历史记录');
  }

  return {
    publishedUrl,
  };
}
