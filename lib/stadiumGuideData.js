import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { resolveStadium } from './stadiums';

function fallbackFor(value='kiryu') {
  const stadium = resolveStadium(value) || resolveStadium('kiryu');
  return {
    course_code: stadium.courseCode,
    slug: stadium.slug,
    name: stadium.name,
    english_name: stadium.englishName,
    updated_at_label: '集計データ準備中',
    aggregation_from: null,
    aggregation_to: null,
    race_count: null,
    basic_info: {
      race_type: null,
      water_type: null,
      tide: null,
      summary: `${stadium.name}の基本情報・水面特徴・コース傾向を順次整備しています。`,
    },
    yearly_stats: {},
    trifecta_stats: [],
    seasonal_stats: [],
    layout_image_url: null,
    layout_notes: [],
    wind_stats: [],
    inside_strategy: {},
    upset_strategy: {},
    exhibition_reliability: {},
    today_ai: { races: [] },
    premium_enabled: true,
  };
}

function client(){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function getStadiumGuide(value='kiryu'){
  const stadium = resolveStadium(value) || resolveStadium('kiryu');
  const fallback = fallbackFor(stadium.slug);
  const sb=client();
  if(!sb) return fallback;

  const [{data:guide,error:guideError},{data:snapshot,error:snapshotError}] = await Promise.all([
    sb.from('stadium_guides').select('*').eq('slug',stadium.slug).maybeSingle(),
    sb.from('stadium_ai_snapshots').select('*').eq('course_code',stadium.courseCode).maybeSingle(),
  ]);
  if(guideError) console.warn('stadium_guides:',guideError.message);
  if(snapshotError) console.warn('stadium_ai_snapshots:',snapshotError.message);
  const payload=snapshot?.payload||{};
  return {
    ...fallback,
    ...(guide||{}),
    ...payload,
    basic_info:{...fallback.basic_info,...(guide?.basic_info||{}),...(payload?.basic_info||{})},
    generated_at:snapshot?.generated_at||null,
  };
}

export function isPremiumPreview(searchParams){
  return process.env.STADIUM_PREMIUM_PREVIEW==='true'||searchParams?.preview==='premium';
}
