import { createWorkflow } from './graph/workflow.js';
import { loadHistory } from './utils/history.js';
import { shouldSkipToday } from './utils/schedule.js';

async function main() {
  console.log('🚀 DevNews Bot 启动\n');
  console.log(`📅 ${new Date().toISOString().split('T')[0]}\n`);

  if (process.env.DRY_RUN !== 'true' && shouldSkipToday(await loadHistory(), new Date())) {
    console.log('✅ 今天已发布，跳过');
    return;
  }

  const workflow = createWorkflow();

  try {
    const result = await workflow.invoke({});

    console.log('\n✨ 运行完成！');

    if (result.winner) {
      console.log(`\n📰 今日推荐：${result.winner.title}`);
      console.log(`🔗 ${result.winner.url}`);
      console.log(`\n💬 ${result.finalSummary}`);
    }

    if (result.publishedUrl) {
      console.log(`\n🦣 Mastodon：${result.publishedUrl}`);
    }

    if (result.publishedXUrl) {
      console.log(`\n𝕏 X：${result.publishedXUrl}`);
    }
  } catch (error) {
    console.error('❌ 运行出错：', error);
    process.exit(1);
  }
}

main();
