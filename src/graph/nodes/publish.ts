import { publishToMastodon } from '../../services/mastodon.js';
import { publishToX } from '../../services/typefully.js';
import { addToHistory } from '../../utils/history.js';
import { fitXText } from '../../utils/xlength.js';
import type { GraphStateType } from '../state.js';

async function publishMastodon(content: string): Promise<string> {
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;

  if (!instance || !token) {
    console.log('   ⚠️ 未配置 Mastodon，跳过发布');
    return '';
  }

  try {
    const status = await publishToMastodon(content, instance, token);
    console.log(`   ✅ Mastodon 发布成功：${status.url}`);
    return status.url;
  } catch (error) {
    console.error(`   ❌ Mastodon 发布失败：${error}`);
    return '';
  }
}

async function publishX(content: string, date: string): Promise<string> {
  const apiKey = process.env.TYPEFULLY_API_KEY;
  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;

  if (!apiKey || !socialSetId) {
    console.log('   ⚠️ 未配置 Typefully，跳过发布到 X');
    return '';
  }

  try {
    const url = await publishToX(content, `CNDevDaily ${date}`, apiKey, socialSetId);
    console.log(`   ✅ X 发布成功：${url}`);
    return url;
  } catch (error) {
    console.error(`   ❌ X 发布失败：${error}`);
    return '';
  }
}

export async function publishNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log('📤 正在发布结果...');

  const { winner, finalSummary } = state;

  if (!winner) {
    throw new Error('No winner selected');
  }

  const date = new Date().toISOString().split('T')[0];

  // 生成发布内容（X 有 280 权重上限，单独裁剪）
  const publishContent = `${finalSummary}\n\n${winner.url}`;
  const xContent = fitXText(finalSummary, winner.url);
  console.log(`   发布内容：\n${publishContent}`);
  if (xContent !== publishContent) {
    console.log(`   X 发布内容（已裁剪）：\n${xContent}`);
  }

  if (process.env.DRY_RUN === 'true') {
    console.log('   🧪 DRY_RUN 模式，跳过发布');
    console.log('   ⏭️ 未成功发布，不写入历史记录');
    return { publishedUrl: '', publishedXUrl: '' };
  }

  // 两个平台互不阻塞
  const [publishedUrl, publishedXUrl] = await Promise.all([
    publishMastodon(publishContent),
    publishX(xContent, date),
  ]);

  // 任一平台真正发布成功才写入历史，避免：
  // 1. 本地 dev/DRY_RUN 测试把文章永久标记为"已发布"
  // 2. 线上发布全部失败后文章永远不再被推荐
  if (publishedUrl || publishedXUrl) {
    await addToHistory({
      date,
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

  return { publishedUrl, publishedXUrl };
}
