import { describe, it, expect } from 'vitest';
import { xWeight, fitXText, X_MAX_WEIGHT } from '../src/utils/xlength.js';

const URL = 'https://example.com/a/very/long/path/that/would/otherwise/count/a/lot';

describe('xWeight', () => {
  it('ASCII 每个算 1', () => {
    expect(xWeight('hello, world')).toBe(12);
  });

  it('CJK、全角标点、emoji 每个算 2', () => {
    expect(xWeight('中文')).toBe(4);
    expect(xWeight('。！')).toBe(4);
    expect(xWeight('🚀')).toBe(2);
    expect(xWeight('👨‍👩‍👧')).toBe(2);
  });

  it('链接按 t.co 算 23', () => {
    expect(xWeight(URL)).toBe(23);
    expect(xWeight(`看 ${URL} 吧`)).toBe(2 + 1 + 23 + 1 + 2);
  });
});

describe('fitXText', () => {
  // 推荐语 + "\n\n"(2) + 链接(23)，推荐语可用 255
  it('刚好 280 原样通过', () => {
    const summary = '中'.repeat(127) + 'a';
    const text = fitXText(summary, URL);
    expect(text).toBe(`${summary}\n\n${URL}`);
    expect(xWeight(text)).toBe(X_MAX_WEIGHT);
  });

  it('超长时从后往前丢整句', () => {
    const s1 = '甲'.repeat(59) + '。'; // 120
    const s2 = '乙'.repeat(59) + '！'; // 120
    const s3 = '丙'.repeat(29) + '；'; // 60
    const text = fitXText(s1 + s2 + s3, URL);
    expect(text).toBe(`${s1}${s2}\n\n${URL}`);
    expect(xWeight(text)).toBeLessThanOrEqual(X_MAX_WEIGHT);
  });

  it('裁剪后以「；」收尾时换成「。」，未裁剪路径不受影响', () => {
    const s1 = '甲'.repeat(59) + '；'; // 120
    const s2 = '乙'.repeat(99) + '。'; // 200
    expect(fitXText(s1 + s2, URL)).toBe(`${'甲'.repeat(59)}。\n\n${URL}`);
    expect(fitXText(s1, URL)).toBe(`${s1}\n\n${URL}`);
  });

  it('句末标点后的引号随句子保留', () => {
    const s1 = '他说「' + '甲'.repeat(50) + '。」';
    const s2 = '乙'.repeat(100) + '。';
    expect(fitXText(s1 + s2, URL)).toBe(`${s1}\n\n${URL}`);
  });

  it('第一句就超长时硬截并以省略号结尾', () => {
    const summary = '甲'.repeat(200) + '。乙。';
    const text = fitXText(summary, URL);
    const body = text.split('\n\n')[0];
    expect(body.endsWith('…')).toBe(true);
    expect(body).toBe('甲'.repeat(126) + '…');
    expect(text.endsWith(`\n\n${URL}`)).toBe(true);
    expect(xWeight(text)).toBeLessThanOrEqual(X_MAX_WEIGHT);
  });
});
