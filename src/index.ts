import { createWorkflow } from './graph/workflow.js';

async function main() {
  console.log('🚀 DevNews Bot 启动\n');
  console.log(`📅 ${new Date().toISOString().split('T')[0]}\n`);

  const workflow = createWorkflow();

  try {
    const result = await workflow.invoke({});

    console.log('\n✨ 运行完成！');

    if (result.finalArticle) {
      console.log(`\n📰 今日推荐：${result.finalArticle.title}`);
      console.log(`🔗 ${result.finalArticle.url}`);
      console.log(`\n💬 ${result.finalSummary}`);
    }

    if (result.publishedUrl) {
      console.log(`\n🦣 Mastodon：${result.publishedUrl}`);
    }
  } catch (error) {
    console.error('❌ 运行出错：', error);
    process.exit(1);
  }
}

main();
