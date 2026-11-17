import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { filterPublicThreads } from './catalogue.mjs';

// Public reads use only the publishable/anon key, never a service-role key.
// RLS must independently enforce the public-post visibility predicate.
export async function loadPublicCommunityThreads({ characterKey = null, limit = 5 } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { threads: [], availability: 'unconfigured' };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.from('community_threads')
      .select('id,slug,title,excerpt,character_key,category_id,published_at,last_official_activity_at,status,visibility')
      .eq('status', 'published')
      .in('visibility', ['public_all', 'public_post_members_replies'])
      .lte('published_at', new Date().toISOString())
      .order('last_official_activity_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return { threads: filterPublicThreads(data, characterKey, limit), availability: 'ready' };
  } catch {
    // No table is deployed yet. Fail closed without showing private data or fake posts.
    return { threads: [], availability: 'unavailable' };
  }
}
