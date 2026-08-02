import { describe, it, expect } from 'vitest';
import { isScrapeFailure, SCRAPE_FAILURE_PREFIX } from '../src/services/scraper.js';

describe('isScrapeFailure', () => {
  it('识别抓取失败标记', () => {
    expect(isScrapeFailure(`${SCRAPE_FAILURE_PREFIX}HTTP 403`)).toBe(true);
    expect(isScrapeFailure(`${SCRAPE_FAILURE_PREFIX}无法解析文章内容`)).toBe(true);
  });

  it('正常内容不被误判', () => {
    expect(isScrapeFailure('这是一段正常的文章内容')).toBe(false);
    expect(isScrapeFailure('')).toBe(false);
    expect(isScrapeFailure('[可能以方括号开头的正文]')).toBe(false);
  });
});
