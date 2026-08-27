import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { STADIUMS, resolveStadium } from './stadiums';

export { STADIUMS, resolveStadium };

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getStadiumAiV2(value) {
  const stadium = resolveStadium(value);
  if (!stadium) return { stadium: STADIUMS[0], payload: null, error: '指定されたボートレース場が見つかりません。' };
  const sb = supabase();
  if (!sb) return { stadium, payload: null, error: 'Supabase環境変数が未設定です。' };

  const { data, error } = await sb
    .from('stadium_data_snapshots')
    .select('*')
    .eq('course_code', stadium.courseCode)
    .maybeSingle();

  return {
    stadium,
    payload: data?.payload || null,
    generatedAt: data?.generated_at || null,
    error: error?.message || null,
  };
}

// Premium content is no longer unlocked by a public query parameter.
// It is delivered only through the authenticated members API.
export function premiumPreview() {
  return false;
}
