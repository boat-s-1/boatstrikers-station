import { NextResponse } from 'next/server';
import { requireRadioBlogAdmin } from '../../../../../lib/radioBlogAdminAuth';
import { getRadioAdminSupabase } from '../../../../../lib/supabaseRadioAdmin';

export async function POST(request){
  try{
    await requireRadioBlogAdmin();
    const body=await request.json().catch(()=>({}));
    const courseCode=Number(body.course_code||1);
    const asOf=body.as_of||new Date().toISOString().slice(0,10);
    const {data,error}=await getRadioAdminSupabase().rpc('bs_refresh_stadium_ai',{p_course_code:courseCode,p_as_of:asOf});
    if(error) throw error;
    return NextResponse.json({ok:true,payload:data});
  }catch(error){
    return NextResponse.json({error:error.message||'集計に失敗しました。'},{status:error.status||500});
  }
}
