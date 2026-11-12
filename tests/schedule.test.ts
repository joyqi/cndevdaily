import { describe, it, expect, vi, afterEach } from 'vitest';
import { msUntilPublish, shouldSkipToday, waitUntilPublish } from '../src/utils/schedule.js';
import type { HistoryRecord } from '../src/types/index.js';

const at = (iso: string) => new Date(iso);

describe('msUntilPublish', () => {
  it('未到点返回差值', () => {
    expect(msUntilPublish(at('2026-11-12T03:53:00Z'), '05:00')).toBe(67 * 60 * 1000);
  });

  it('刚好到点返回 0', () => {
    expect(msUntilPublish(at('2026-11-12T05:00:00Z'), '05:00')).toBe(0);
  });

  it('已过点返回 0', () => {
    expect(msUntilPublish(at('2026-11-12T06:50:00Z'), '05:00')).toBe(0);
  });

  it('跨天：UTC 日期刚翻过去时等到当天的目标时刻', () => {
    expect(msUntilPublish(at('2026-11-12T00:01:00Z'), '05:00')).toBe((4 * 60 + 59) * 60 * 1000);
  });

  it('跨天：当天已过点不会等到第二天', () => {
    expect(msUntilPublish(at('2026-11-12T23:59:00Z'), '05:00')).toBe(0);
  });

  it.each(['5:00', '24:00', '05:60', '0500', '', 'abc'])('格式错误抛错：%s', (target) => {
    expect(() => msUntilPublish(at('2026-11-12T03:00:00Z'), target)).toThrow(/PUBLISH_AT_UTC/);
  });
});

describe('waitUntilPublish', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('未配置时立即返回', async () => {
    vi.stubEnv('PUBLISH_AT_UTC', '');
    await expect(waitUntilPublish()).resolves.toBeUndefined();
  });

  it('未到点时等到目标时刻，并打印 UTC 与北京时间', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(at('2026-11-12T04:00:00Z'));
    vi.stubEnv('PUBLISH_AT_UTC', '05:00');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    let done = false;
    const p = waitUntilPublish().then(() => { done = true; });

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/UTC 05:00.*北京时间 13:00/));
  });
});

describe('shouldSkipToday', () => {
  const record = (date: string) => ({ date } as HistoryRecord);

  it('已有今天（UTC）的记录时跳过', () => {
    expect(shouldSkipToday([record('2026-11-11'), record('2026-11-12')], at('2026-11-12T05:00:00Z'))).toBe(true);
  });

  it('没有今天的记录时不跳过', () => {
    expect(shouldSkipToday([record('2026-11-11')], at('2026-11-12T05:00:00Z'))).toBe(false);
    expect(shouldSkipToday([], at('2026-11-12T05:00:00Z'))).toBe(false);
  });

  it('按 UTC 日期判断，而不是北京时间', () => {
    // 北京时间 11-12 07:00 = UTC 11-11 23:00
    expect(shouldSkipToday([record('2026-11-12')], at('2026-11-11T23:00:00Z'))).toBe(false);
  });
});
