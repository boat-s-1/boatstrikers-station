import 'server-only';
import { createClient } from '@supabase/supabase-js';

const KIRYU_FALLBACK = {
  course_code: 1, slug: 'kiryu', name: '桐生', english_name: 'BOAT RACE KIRYU',
  updated_at_label: '集計データ準備中', aggregation_from: null, aggregation_to: null, race_count: null,
  basic_info: { race_type: 'ナイター', water_type: '淡水', tide: '潮位変化なし', summary: '山あいに位置する淡水のナイター場。直近1年と当日データを組み合わせて傾向を確認します。' },
  yearly_stats: {}, trifecta_stats: [], seasonal_stats: [], layout_image_url: '/book-24-stadiums.jpg',
  layout_notes: [], wind_stats: [], inside_strategy: {}, upset_strategy: {}, exhibition_reliability: {},
  today_ai: { races: [] }, premium_enabled: true,
};
function client(){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getStadiumGuide(slug='kiryu'){
  const sb=client(); if(!sb) return KIRYU_FALLBACK;
  const courseCode=slug==='kiryu'?1:null; if(!courseCode) return KIRYU_FALLBACK;
  const [{data:guide,error:guideError},{data:snapshot,error:snapshotError}] = await Promise.all([
    sb.from('stadium_guides').select('*').eq('slug',slug).maybeSingle(),
    sb.from('stadium_ai_snapshots').select('*').eq('course_code',courseCode).maybeSingle(),
  ]);
  if(guideError) console.warn('stadium_guides:',guideError.message);
  if(snapshotError) console.warn('stadium_ai_snapshots:',snapshotError.message);
  const payload=snapshot?.payload||{};
  return {
    ...KIRYU_FALLBACK,
    ...(guide||{}),
    ...payload,
    basic_info:{...KIRYU_FALLBACK.basic_info,...(guide?.basic_info||{})},
    generated_at:snapshot?.generated_at||null,
  };
}
export function isPremiumPreview(searchParams){
  return process.env.STADIUM_PREMIUM_PREVIEW==='true'||searchParams?.preview==='premium';
}
