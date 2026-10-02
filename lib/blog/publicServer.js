import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readPublicIndex } from './publicIndex.mjs';

export async function loadPublicBlogIndex() {
  const url = process.env.BLOG_SUPABASE_URL;
  const key = process.env.BLOG_SUPABASE_ANON_KEY;
  // Never inherit race DB credentials or use a service-role client on the public path.
  if (!url || !key) return { posts: [], categories: [], authors: [], tags: [], availability: 'unconfigured' };
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }) } });
    return { ...await readPublicIndex(client), availability: 'ready' };
  } catch {
    console.error('BLOG public index unavailable'); // No credentials or document payload in logs.
    return { posts: [], categories: [], authors: [], tags: [], availability: 'unavailable' };
  }
}
