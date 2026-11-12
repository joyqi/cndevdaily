const API_BASE = 'https://api.typefully.com/v2';
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 60_000;

interface TypefullyDraft {
  id: number;
  status: string;
  publish_state: string | null;
  x_published_url: string | null;
  private_url: string;
}

async function request(
  url: string,
  apiKey: string,
  init: RequestInit = {}
): Promise<TypefullyDraft> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Typefully API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// 通过 Typefully 立即发布到 X。publish_at=now 是异步的，需轮询直到 publish_state=finished
export async function publishToX(
  text: string,
  title: string,
  apiKey: string,
  socialSetId: string
): Promise<string> {
  const draftsUrl = `${API_BASE}/social-sets/${socialSetId}/drafts`;

  const created = await request(draftsUrl, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      platforms: { x: { enabled: true, posts: [{ text }] } },
      publish_at: 'now',
      draft_title: title,
    }),
  });

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let draft = created;
  while (draft.publish_state !== 'finished') {
    if (Date.now() >= deadline) {
      throw new Error(`Typefully publish timed out after ${POLL_TIMEOUT_MS / 1000}s (draft ${created.id})`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    draft = await request(`${draftsUrl}/${created.id}`, apiKey);
  }

  if (draft.status === 'error') {
    throw new Error(`Typefully publish failed (draft ${draft.id}, status error): ${draft.private_url}`);
  }
  if (!draft.x_published_url) {
    throw new Error(`Typefully publish finished without X URL (draft ${draft.id}, status ${draft.status})`);
  }

  return draft.x_published_url;
}
