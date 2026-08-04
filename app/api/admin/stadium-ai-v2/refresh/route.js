import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const dynamic='force-dynamic';
function client(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase環境変数が不足しています。');return createClient(url,key,{auth:{persistSession:false}})}
export async function POST(req){try{const body=await req.json().catch(()=>({}));const courseCode=Number(body.courseCode||0);const asOf=body.asOf||new Date().toISOString().slice(0,10);const sb=client();const fn=courseCode?'bs_refresh_stadium_ai_v2':'bs_refresh_all_stadium_ai_v2';const args=courseCode?{p_course_code:courseCode,p_as_of:asOf}:{p_as_of:asOf};const {data,error}=await sb.rpc(fn,args);if(error)throw error;return NextResponse.json({ok:true,data});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:500})}}
