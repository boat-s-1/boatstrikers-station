const workflowUrl = 'https://api.github.com/repos/boat-s-1/boatstrikers-station/actions/workflows/trinity-official-previous-day.yml/dispatches';

export function previousEveningJst(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
  return hour >= 21 && hour <= 23;
}

export async function dispatchPreviousDayCollector({ token, now = new Date(), fetcher = fetch }) {
  if (!previousEveningJst(now)) return { status: 'outside_previous_evening_window' };
  if (!token) throw new Error('TRINITY_GITHUB_DISPATCH_TOKEN is not configured');

  const response = await fetcher(workflowUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main', inputs: { dry_run: 'false' } }),
  });
  if (response.status !== 204) {
    // Do not log the response body; it can include details about credentials.
    throw new Error(`GitHub workflow dispatch returned HTTP ${response.status}`);
  }
  return { status: 'dispatched' };
}
