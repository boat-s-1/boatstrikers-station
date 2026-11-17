import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { filterPublicThreads } from './catalogue.mjs';

// This route is intentionally anonymous; members-only posts must not be fetched here.
// RLS is mandatory and must independently enforce public visibility.
export async function loadPublicCommunityThreads({ characterKey = null, limit = 5 } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { threads: [], availability: 'unconfigured' };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    let query = client.from('community_threads')
      .select('id,slug,title,excerpt,character_key,published_at,last_official_activity_at,status,audience')
      .eq('status', 'published').eq('audience', 'public')
      .lte('published_at', new Date().toISOString());
    if (characterKey) query = query.eq('character_key', characterKey);
    const { data, error } = await query
      .order('last_official_activity_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return { threads: filterPublicThreads(data, characterKey, limit), availability: 'ready' };
  } catch {
    return { threads: [], availability: 'unavailable' };
  }
}
