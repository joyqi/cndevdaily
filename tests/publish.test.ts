import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishToMastodon } from '../src/services/mastodon.js';
import { publishToX } from '../src/services/typefully.js';
import { addToHistory } from '../src/utils/history.js';
import { publishNode } from '../src/graph/nodes/publish.js';
import type { GraphStateType } from '../src/graph/state.js';

vi.mock('../src/services/mastodon.js', () => ({ publishToMastodon: vi.fn() }));
vi.mock('../src/services/typefully.js', () => ({ publishToX: vi.fn() }));
vi.mock('../src/utils/history.js', () => ({ addToHistory: vi.fn() }));

const state = {
  winner: { id: 'hn-1', title: 'T', url: 'https://example.com/a', source: 'hackernews', content: '' },
  finalSummary: '推荐语。',
} as unknown as GraphStateType;

describe('publishNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('DRY_RUN', '');
    vi.stubEnv('MASTODON_INSTANCE', 'https://m.example');
    vi.stubEnv('MASTODON_ACCESS_TOKEN', 'tok');
    vi.stubEnv('TYPEFULLY_API_KEY', 'key');
    vi.stubEnv('TYPEFULLY_SOCIAL_SET_ID', 'set1');
  });

  it('两个平台都发布并写入历史', async () => {
    vi.mocked(publishToMastodon).mockResolvedValue({ id: '1', url: 'https://m/1', content: '' });
    vi.mocked(publishToX).mockResolvedValue('https://x.com/1');

    const result = await publishNode(state);

    expect(result).toEqual({ publishedUrl: 'https://m/1', publishedXUrl: 'https://x.com/1' });
    expect(publishToX).toHaveBeenCalledWith('推荐语。\n\nhttps://example.com/a', expect.stringMatching(/^CNDevDaily \d{4}-\d{2}-\d{2}$/), 'key', 'set1');
    expect(addToHistory).toHaveBeenCalledOnce();
  });

  it('一边失败不影响另一边，仍写入历史', async () => {
    vi.mocked(publishToMastodon).mockRejectedValue(new Error('down'));
    vi.mocked(publishToX).mockResolvedValue('https://x.com/1');

    const result = await publishNode(state);

    expect(result).toEqual({ publishedUrl: '', publishedXUrl: 'https://x.com/1' });
    expect(addToHistory).toHaveBeenCalledOnce();
  });

  it('两边都失败不写历史', async () => {
    vi.mocked(publishToMastodon).mockRejectedValue(new Error('down'));
    vi.mocked(publishToX).mockRejectedValue(new Error('down'));

    await publishNode(state);

    expect(addToHistory).not.toHaveBeenCalled();
  });

  it('未配置 Typefully 时跳过 X', async () => {
    vi.stubEnv('TYPEFULLY_API_KEY', '');
    vi.mocked(publishToMastodon).mockResolvedValue({ id: '1', url: 'https://m/1', content: '' });

    const result = await publishNode(state);

    expect(publishToX).not.toHaveBeenCalled();
    expect(result.publishedXUrl).toBe('');
    expect(addToHistory).toHaveBeenCalledOnce();
  });

  it('DRY_RUN 两个平台都不发', async () => {
    vi.stubEnv('DRY_RUN', 'true');

    await publishNode(state);

    expect(publishToMastodon).not.toHaveBeenCalled();
    expect(publishToX).not.toHaveBeenCalled();
    expect(addToHistory).not.toHaveBeenCalled();
  });
});
