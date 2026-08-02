import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { ArticleWithContent } from '../types/index.js';

const DIR = 'discussions';

/** 保存每日运行记录（今日推荐 + 推荐语） */
export async function saveRunLog(
  date: Date,
  winner: ArticleWithContent,
  recommendation: string
): Promise<string> {
  if (!existsSync(DIR)) {
    await mkdir(DIR, { recursive: true });
  }

  const dateStr = date.toISOString().split('T')[0];
  const filename = `${DIR}/${dateStr}.md`;
  const content = `# 开发者日报 - ${dateStr}

## 今日推荐

**《${winner.title}》**

${recommendation}

${winner.url}
`;
  await writeFile(filename, content, 'utf-8');
  return filename;
}
