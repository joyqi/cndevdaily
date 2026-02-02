interface MastodonStatus {
  id: string;
  url: string;
  content: string;
}

export async function publishToMastodon(
  content: string,
  instance: string,
  accessToken: string
): Promise<MastodonStatus> {
  const response = await fetch(`${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: content,
      visibility: 'public',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to publish to Mastodon: ${response.status} - ${error}`);
  }

  return response.json();
}
