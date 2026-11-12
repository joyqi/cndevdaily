import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { publishToX } from '../src/services/typefully.js';

const draft = (over: Record<string, unknown>) => ({
  id: 42,
  status: 'draft',
  publish_state: 'in_progress',
  x_published_url: null,
  private_url: 'https://typefully.com/?d=42',
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('publishToX', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('创建草稿后轮询到 finished，返回 X 链接', async () => {
    fetchMock
      .mockResolvedValueOnce(json(draft({}), 201))
      .mockResolvedValueOnce(json(draft({})))
      .mockResolvedValueOnce(
        json(draft({ publish_state: 'finished', status: 'published', x_published_url: 'https://x.com/a/status/1' }))
      );

    const promise = publishToX('hello', 'CNDevDaily 2026-11-12', 'key', 'set1');
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(promise).resolves.toBe('https://x.com/a/status/1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.typefully.com/v2/social-sets/set1/drafts');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer key');
    expect(JSON.parse(init.body)).toEqual({
      platforms: { x: { enabled: true, posts: [{ text: 'hello' }] } },
      publish_at: 'now',
      draft_title: 'CNDevDaily 2026-11-12',
    });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.typefully.com/v2/social-sets/set1/drafts/42');
  });

  it('finished 但 status 为 error 时抛错', async () => {
    fetchMock
      .mockResolvedValueOnce(json(draft({}), 201))
      .mockResolvedValueOnce(json(draft({ publish_state: 'finished', status: 'error' })));

    const promise = publishToX('hello', 't', 'key', 'set1');
    const assertion = expect(promise).rejects.toThrow(/draft 42.*error/);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
  });

  it('轮询超时抛错并带 draft id', async () => {
    fetchMock.mockImplementation(async () => json(draft({}), 201));

    const promise = publishToX('hello', 't', 'key', 'set1');
    const assertion = expect(promise).rejects.toThrow(/timed out.*draft 42/);
    await vi.advanceTimersByTimeAsync(62_000);
    await assertion;
  });

  it('非 2xx 抛错', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await expect(publishToX('hello', 't', 'key', 'set1')).rejects.toThrow(/429 - rate limited/);
  });
});
