import {NextResponse} from "next/server";
import {isScheduleAdminAuthenticated} from "../../../../admin/schedule/_lib/scheduleAdminAuth";
import {getAdminScheduleSupabase} from "../../../../../lib/scheduleSupabase";
export const dynamic="force-dynamic";
function clean(b){return{message:String(b.message||"").trim(),link_url:String(b.link_url||"").trim()||null,sort_order:Number(b.sort_order)||0,is_active:Boolean(b.is_active)}}
export async function GET(){if(!(await isScheduleAdminAuthenticated()))return NextResponse.json({error:"Unauthorized"},{status:401});try{const s=getAdminScheduleSupabase();const{data,error}=await s.from("home_ticker_items").select("*").order("sort_order");if(error)throw error;return NextResponse.json({items:data||[]})}catch(e){return NextResponse.json({error:e.message},{status:500})}}
export async function POST(r){if(!(await isScheduleAdminAuthenticated()))return NextResponse.json({error:"Unauthorized"},{status:401});try{const item=clean(await r.json());if(!item.message)return NextResponse.json({error:"文章を入力してください。"},{status:400});const s=getAdminScheduleSupabase();const{data,error}=await s.from("home_ticker_items").insert(item).select().single();if(error)throw error;return NextResponse.json({item:data},{status:201})}catch(e){return NextResponse.json({error:e.message},{status:500})}}
