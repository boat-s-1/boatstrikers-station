import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {adminError,adminServerError,guardAdminWrite,intInRange,jstToday,readJsonBody,validDateInRange} from '../../../../../lib/adminApiGuard.js';
import {acquireAdminJobLock,releaseAdminJobLock} from '../../../../../lib/adminJobLock.js';
export const dynamic='force-dynamic';
function client(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase環境変数が不足しています。');return createClient(url,key,{auth:{persistSession:false}})}
// 書き込み（再集計）の制限。基準日は JST の今日から7日前まで。courseCode は 1〜24（1場）か 0（全24場、明示したときだけ）
// 同じ対象は60秒に1回、全24場は30分に1回（DB ロック適用時）。再集計は同時に1つだけ
const AS_OF_DAYS_BACK=7;const SINGLE_COOLDOWN_SECONDS=60;const ALL_COOLDOWN_SECONDS=30*60;
// ロックの期限：1場15分、全24場40分（engine-v3 の全場と同じ）
const SINGLE_LOCK_TTL_SECONDS=15*60;const ALL_LOCK_TTL_SECONDS=40*60;
export async function POST(req){
  const denied=await guardAdminWrite(req);if(denied)return denied;
  const body=await readJsonBody(req);if(!body)return adminError(400,'リクエストの形式が不正です。');
  const courseCode=body.courseCode;
  if(!intInRange(courseCode,0,24))return adminError(400,'courseCode は 1〜24（1場）か 0（全24場）を指定してください。');
  const asOf=body.asOf??jstToday();
  if(!validDateInRange(asOf,{daysBack:AS_OF_DAYS_BACK}))return adminError(400,`集計基準日は今日から${AS_OF_DAYS_BACK}日前までの日付で指定してください。`);
  let sb;let lock;
  try{
    sb=client();
    // 直近の集計からの間隔（ロック未適用のインスタンス間でも効くよう、保存済みの generated_at で確かめる）
    let recent=sb.from('stadium_ai_snapshots_v2').select('generated_at').order('generated_at',{ascending:false}).limit(1);
    if(courseCode)recent=recent.eq('course_code',courseCode);
    const {data:rows,error:readError}=await recent;if(readError)throw readError;
    const last=rows?.[0]?.generated_at?new Date(rows[0].generated_at).getTime():0;
    if(Date.now()-last<SINGLE_COOLDOWN_SECONDS*1000)return adminError(429,'直前に集計したばかりです。しばらくしてから実行してください。');
    lock=await acquireAdminJobLock(sb,'stadium-ai-v2-refresh',{ttlSeconds:courseCode?SINGLE_LOCK_TTL_SECONDS:ALL_LOCK_TTL_SECONDS});
    if(!lock.ok){if(lock.reason==='error')throw lock.error;return adminError(409,'別の集計が実行中です。終わってから実行してください。');}
    const fn=courseCode?'bs_refresh_stadium_ai_v2':'bs_refresh_all_stadium_ai_v2';const args=courseCode?{p_course_code:courseCode,p_as_of:asOf}:{p_as_of:asOf};
    const {data,error}=await sb.rpc(fn,args);if(error)throw error;
    await releaseAdminJobLock(sb,lock,{cooldownSeconds:courseCode?SINGLE_COOLDOWN_SECONDS:ALL_COOLDOWN_SECONDS});
    return NextResponse.json({ok:true,data});
  }catch(e){if(lock?.ok)await releaseAdminJobLock(sb,lock).catch(()=>{});return adminServerError('stadium-ai-v2-refresh',e)}
}
