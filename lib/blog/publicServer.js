import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readPublicIndex } from './publicIndex.mjs';
import { readPublicArticle } from './publicArticle.mjs';
import { cache } from 'react';

function publicClient() {
  const url = process.env.BLOG_SUPABASE_URL;
  const key = process.env.BLOG_SUPABASE_ANON_KEY;
  // Never inherit race DB credentials or use a service-role client on the public path.
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }) } });
}
export const loadPublicBlogIndex = cache(async () => {
  const client = publicClient();
  if (!client) return { posts: [], categories: [], authors: [], tags: [], availability: 'unconfigured' };
  try { return { ...await readPublicIndex(client), availability: 'ready' }; }
  catch {
    console.error('BLOG public index unavailable');
    return { posts: [], categories: [], authors: [], tags: [], availability: 'unavailable' };
  }
});
// Request-local deduplication between metadata and the page. Never cache across requests.
export const loadPublicBlogArticle = cache(async (slug) => {
  const client = publicClient();
  if (!client) return null;
  try { return await readPublicArticle(client, slug); }
  catch {
    console.error('BLOG public article unavailable');
    throw new Error('記事を読み込めませんでした。時間をおいて再度お試しください。');
  }
});
