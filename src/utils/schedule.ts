import type { HistoryRecord } from '../types/index.js';

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function utcDate(now: Date): string {
  return now.toISOString().split('T')[0];
}

function publishTime(now: Date, target: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(target);
  if (!match) {
    throw new Error(`PUBLISH_AT_UTC 格式错误：${target}（应为 HH:MM）`);
  }
  const at = new Date(now);
  at.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  return at;
}

/** 距今天（UTC）target 时刻还有多少毫秒；已到或已过返回 0 */
export function msUntilPublish(now: Date, target: string): number {
  return Math.max(0, publishTime(now, target).getTime() - now.getTime());
}

/** 按 PUBLISH_AT_UTC 等到发布时刻；未配置或已过点立即返回 */
export async function waitUntilPublish(): Promise<void> {
  const target = process.env.PUBLISH_AT_UTC;
  if (!target) return;

  const now = new Date();
  const ms = msUntilPublish(now, target);
  if (ms === 0) return;

  const at = publishTime(now, target);
  const beijing = new Date(at.getTime() + BEIJING_OFFSET_MS).toISOString().slice(11, 16);
  console.log(`   ⏰ 等到 UTC ${target}（北京时间 ${beijing}）再发布，还需 ${Math.ceil(ms / 60000)} 分钟`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** history 里是否已有 now 当天（UTC）的发布记录 */
export function shouldSkipToday(history: HistoryRecord[], now: Date): boolean {
  const today = utcDate(now);
  return history.some((r) => r.date === today);
}
