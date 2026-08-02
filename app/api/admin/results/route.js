import { NextResponse } from "next/server";
import { isScheduleAdminAuthenticated } from "../../../admin/schedule/_lib/scheduleAdminAuth";
import { getAdminScheduleSupabase } from "../../../../lib/scheduleSupabase";

export const dynamic = "force-dynamic";
const fields = "id,race_date,place,race_no,category,bet_text,invest,payout,hit,memo,hit_image_url,hit_title,hit_note,created_at";
function clean(body){return {race_date:body.race_date,place:String(body.place||"").trim(),race_no:Number(body.race_no),category:body.category,bet_text:String(body.bet_text||"").trim(),invest:Number(body.invest||0),payout:Number(body.payout||0),hit:Boolean(body.hit),memo:String(body.memo||"").trim(),hit_image_url:String(body.hit_image_url||"").trim(),hit_title:String(body.hit_title||"").trim(),hit_note:String(body.hit_note||"").trim()}}
async function guard(){return await isScheduleAdminAuthenticated()}
export async function GET(){if(!(await guard()))return NextResponse.json({error:"認証が必要です"},{status:401});try{const {data,error}=await getAdminScheduleSupabase().from("bsc_results").select(fields).order("race_date",{ascending:false}).order("race_no",{ascending:false}).limit(500);if(error)throw error;return NextResponse.json({results:data||[]})}catch(e){return NextResponse.json({error:e.message},{status:500})}}
export async function POST(req){if(!(await guard()))return NextResponse.json({error:"認証が必要です"},{status:401});try{const payload=clean(await req.json());if(!payload.race_date||!payload.place||!payload.race_no)return NextResponse.json({error:"日付・場名・レース番号は必須です"},{status:400});const {data,error}=await getAdminScheduleSupabase().from("bsc_results").insert(payload).select(fields).single();if(error)throw error;return NextResponse.json({result:data},{status:201})}catch(e){return NextResponse.json({error:e.message},{status:500})}}
